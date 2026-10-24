-- Stage 3.1 / 3.2: one Inbox for every source, and duplicate detection.
--
-- intake_items replaces telegram_uploads as the Unassigned Inbox. Every
-- document that arrives — Telegram now; email, the SharePoint _Inbox folder
-- and bulk upload in Stage 4 — becomes one row here and waits for a person to
-- file it. Rows are kept after a decision (approved / discarded) as a record
-- of who filed what, instead of being deleted like telegram_uploads rows.
--
-- Status flow:
--   received -> processing -> suggested -> approved | needs_review | discarded
--   duplicate: an identical file (same SHA-256) was already received; kept
--              only as a record, never processed or shown in the Inbox.
--
-- file_hash (SHA-256 of the file's bytes) is also added to case_files, so a
-- file that was already filed to a case is recognised too.
--
-- Run AFTER `node scripts/move-base64-files.mjs --apply` (fix list 2.3), so
-- the Telegram rows copied below hold storage references, not file contents.
-- Safe to run more than once.

create table if not exists intake_items (
  id            text primary key,
  source        text not null check (source in ('telegram', 'email', 'sharepoint', 'upload')),
  sender        text not null default '',          -- e.g. "Telegram: Ahmad", an email address
  received_at   timestamptz not null default now(),
  file_name     text not null default '',
  file_size     bigint not null default 0,
  file_type     text not null default '',
  file_ref      text,                               -- "storage:<path>"; null for duplicates
  file_hash     text,                               -- SHA-256, hex
  status        text not null default 'received' check (status in
                  ('received', 'processing', 'suggested', 'needs_review', 'approved', 'discarded', 'duplicate')),
  ai_suggestion jsonb,                              -- suggested customer / case / document type (3.3)
  confidence    numeric,                            -- 0..1 (3.3)
  duplicate_of  text,                               -- intake item or case file id it duplicates
  case_id       text,                               -- case it was filed to, once approved
  case_file_id  text,                               -- the case_files row it became
  decided_by    text,
  decided_at    timestamptz,
  source_meta   jsonb not null default '{}'::jsonb  -- channel details (Telegram chat/message ids, email message id, ...)
);
create index if not exists intake_items_status_idx on intake_items (status, received_at desc);
create index if not exists intake_items_hash_idx   on intake_items (file_hash);

alter table case_files add column if not exists file_hash text;
create index if not exists case_files_hash_idx on case_files (file_hash);

-- The Telegram bot keeps the hash while it waits for "New case / Existing case"
alter table telegram_pending_uploads add column if not exists file_hash text;

-- Logged-in users only (same rule as 20261023100000_enable_rls.sql)
alter table intake_items enable row level security;
drop policy if exists "Logged-in users full access" on intake_items;
create policy "Logged-in users full access" on intake_items
  for all to authenticated using (true) with check (true);
revoke all on intake_items from anon;
grant select, insert, update, delete on intake_items to authenticated, service_role;

-- Bring across what is waiting in the old Telegram Inbox
insert into intake_items (id, source, sender, received_at, file_name, file_size, file_type, file_ref, status, source_meta)
select id, 'telegram', coalesce(uploaded_by, ''), uploaded_at, coalesce(file_name, ''), coalesce(file_size, 0),
       coalesce(file_type, ''), file_data_url, 'received',
       jsonb_strip_nulls(jsonb_build_object(
         'telegramChatId', telegram_chat_id,
         'telegramMessageId', telegram_message_id,
         'telegramFileId', telegram_file_id))
from telegram_uploads
on conflict (id) do nothing;

-- telegram_uploads is no longer written to; it is dropped when Telegram is
-- retired (fix list 5.5).
