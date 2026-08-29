-- Run this in Supabase SQL Editor
-- Transient state for the bot's "what type of document is this?" routing
-- question — holds the downloaded file between the upload message and the
-- button tap. A plain in-memory Map won't work here since the webhook runs
-- as a Vercel serverless function: the two Telegram requests (the upload,
-- then the callback when a button is tapped) aren't guaranteed to land on
-- the same running instance.

create table if not exists telegram_pending_uploads (
  user_id bigint primary key,
  chat_id bigint not null,
  message_id bigint not null,
  file_name text not null,
  file_size integer not null default 0,
  file_type text not null,
  file_data_url text not null,
  telegram_file_id text,
  uploaded_by text not null default '',
  created_at timestamptz not null default now()
);
alter table telegram_pending_uploads disable row level security;
grant select, insert, update, delete on telegram_pending_uploads to anon, authenticated;
