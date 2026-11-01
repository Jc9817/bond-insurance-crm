-- Emails screen: one row per email in the shared mailbox (operation@).
--
-- DocFlow keeps a copy of each incoming email's details and text so staff
-- can decide, in DocFlow, what it is: a new case, documents for an existing
-- case, split across several cases, or not a case. The attachments are NOT
-- copied in when the email arrives — the list below only names them. A file
-- is copied into the case (and SharePoint) only when someone files it.
--
-- status:
--   new        not read by the AI yet
--   analysing  the AI is reading it
--   ready      the AI has made a suggestion (or could not: ai_error)
--   filed      handled — linked to the cases in case_ids
--   not_case   handled — nothing to file
--
-- attachments: [{ id, name, size, contentType, filedTo?: { caseId, caseFileId, documentType } }]
-- ai_suggestion: see MailSuggestion in lib/types.ts
--
-- Safe to run more than once.

create table if not exists mail_messages (
  id                  text primary key default gen_random_uuid()::text,
  graph_id            text not null unique,          -- Microsoft's id for the message
  internet_message_id text,
  conversation_id     text,
  subject             text not null default '',
  from_name           text not null default '',
  from_address        text not null default '',
  to_recipients       text not null default '',
  cc_recipients       text not null default '',
  received_at         timestamptz not null,
  body_text           text not null default '',
  attachments         jsonb not null default '[]',
  status              text not null default 'new'
                        check (status in ('new', 'analysing', 'ready', 'filed', 'not_case')),
  ai_suggestion       jsonb,
  ai_error            text,
  case_ids            text[] not null default '{}',
  decided_by          text,
  decided_at          timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists mail_messages_received_idx on mail_messages (received_at desc);
create index if not exists mail_messages_case_ids_idx on mail_messages using gin (case_ids);

alter table mail_messages enable row level security;
drop policy if exists "Logged-in users full access" on mail_messages;
create policy "Logged-in users full access" on mail_messages
  for all to authenticated using (true) with check (true);
revoke all on mail_messages from anon;
grant select, insert, update, delete on mail_messages to authenticated, service_role;
