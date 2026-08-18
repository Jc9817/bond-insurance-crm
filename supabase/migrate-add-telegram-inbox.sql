-- Run this in Supabase SQL Editor
-- Documents uploaded via the Telegram bot land here first, unassigned.
-- A row is deleted once staff either turn it into a new case, attach it to
-- an existing case, or discard it — this table only ever holds pending items.

create table if not exists telegram_uploads (
  id text primary key,
  file_name text default '',
  file_size integer default 0,
  file_type text default '',
  file_data_url text,
  uploaded_by text default '',
  uploaded_at timestamptz not null default now(),
  telegram_chat_id bigint,
  telegram_message_id bigint,
  telegram_file_id text
);
alter table telegram_uploads disable row level security;
grant select, insert, update, delete on telegram_uploads to anon, authenticated;
