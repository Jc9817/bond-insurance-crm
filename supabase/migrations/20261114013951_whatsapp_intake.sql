-- WhatsApp screen: messages customers send to the agency's WhatsApp Business
-- number, received through YCloud (docs/whatsapp-ycloud-setup.md).
--
-- DocFlow only READS WhatsApp: it never sends a message. Every incoming
-- document or photo is copied into private storage straight away (YCloud
-- keeps media only 30 days), and a person decides what to file, as on the
-- Emails screen.
--
-- Only new tables. Nothing existing is changed.
--
--   whatsapp_events       every webhook call's event id, to ignore repeats
--                         (YCloud retries), with what DocFlow did with it
--   whatsapp_messages     one row per WhatsApp message
--   whatsapp_bundles      one decision unit: a burst of messages from one
--                         phone (a text, then several photos / PDFs)
--   whatsapp_phone_links  a number a person linked to a customer / contact
--                         on the WhatsApp screen (the contact itself is not
--                         changed)
--
-- whatsapp_messages.media: [{ media_id, filename, mime_type, sha256, size,
--   file_hash, storage_ref, download_status: pending|stored|failed|skipped,
--   error, filed_to?: [{ caseId, caseFileId, documentType }] }]
-- whatsapp_bundles.ai_suggestion: see MailSuggestion in lib/types.ts; its
--   attachments are keyed "<message id>:<media index>"
--
-- Safe to run more than once.

create table if not exists whatsapp_events (
  event_id     text primary key,          -- YCloud's event id
  type         text not null default '',
  result       text,                      -- what DocFlow did: stored, ignored (why), failed (why) — no message content
  received_at  timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists whatsapp_events_received_idx on whatsapp_events (received_at desc);

create table if not exists whatsapp_bundles (
  id             text primary key default gen_random_uuid()::text,
  customer_phone text not null,           -- E.164, e.g. +60123456789
  contact_id     text,
  customer_id    text,
  first_at       timestamptz not null,
  last_at        timestamptz not null,
  message_count  integer not null default 0,
  status         text not null default 'new'
                   check (status in ('new', 'analysing', 'ready', 'filed', 'not_case')),
  ai_suggestion  jsonb,
  ai_error       text,
  case_ids       text[] not null default '{}',
  decided_by     text,
  decided_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists whatsapp_bundles_last_idx on whatsapp_bundles (last_at desc);
create index if not exists whatsapp_bundles_phone_idx on whatsapp_bundles (customer_phone, last_at desc);
create index if not exists whatsapp_bundles_case_ids_idx on whatsapp_bundles using gin (case_ids);

create table if not exists whatsapp_messages (
  id                 text primary key default gen_random_uuid()::text,
  ycloud_message_id  text unique,
  wamid              text unique,
  event_id           text,
  direction          text not null check (direction in ('in', 'out')),
  business_number    text not null default '',
  customer_phone     text not null,       -- E.164
  customer_name      text not null default '',   -- the WhatsApp profile name
  contact_id         text,
  customer_id        text,
  type               text not null default 'other'
                       check (type in ('text', 'document', 'image', 'audio', 'video', 'sticker', 'location', 'other')),
  body               text not null default '',   -- text, or the caption
  sent_at            timestamptz not null,
  media              jsonb not null default '[]',
  bundle_id          text references whatsapp_bundles(id) on delete set null,
  created_at         timestamptz not null default now()
);
create index if not exists whatsapp_messages_phone_idx on whatsapp_messages (customer_phone, sent_at desc);
create index if not exists whatsapp_messages_bundle_idx on whatsapp_messages (bundle_id);
create index if not exists whatsapp_messages_media_idx on whatsapp_messages using gin (media jsonb_path_ops);

create table if not exists whatsapp_phone_links (
  phone_e164  text primary key,
  contact_id  text,
  customer_id text,
  linked_by   text,
  linked_at   timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['whatsapp_events', 'whatsapp_bundles', 'whatsapp_messages', 'whatsapp_phone_links'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "Logged-in users full access" on %I', t);
    execute format('create policy "Logged-in users full access" on %I for all to authenticated using (true) with check (true)', t);
    execute format('revoke all on %I from anon', t);
    execute format('grant select, insert, update, delete on %I to authenticated, service_role', t);
  end loop;
end $$;
