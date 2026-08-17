-- Run this in Supabase SQL Editor
-- Reusable customer-facing email templates + a per-case send history log.

create table if not exists email_templates (
  id text primary key,
  name text not null,
  subject text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table email_templates disable row level security;
grant select, insert, update, delete on email_templates to anon, authenticated;

create table if not exists case_emails (
  id text primary key,
  case_id text references cases(id) on delete cascade,
  template_name text,
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'sent', -- 'sent' | 'failed'
  error_message text,
  sent_at timestamptz not null default now()
);
alter table case_emails disable row level security;
grant select, insert, update, delete on case_emails to anon, authenticated;
