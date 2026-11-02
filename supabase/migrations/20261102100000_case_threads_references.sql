-- Emails screen: threads and reference numbers (lib/mail-links.ts).
--
-- case_conversations: when an email is filed, its Outlook conversation id
--   (shared by the original and every reply) is recorded against each case
--   it went to. A later reply in the same thread is then suggested for the
--   same case(s) instead of "create new case".
--
-- case_references: the reference numbers of a filed email — insurer quote
--   refs ("QTS: B62716/26"), cover note numbers (ANCKL0032785), policy /
--   bond numbers, RFQ, PO, tender and LOA numbers — kept against its case.
--   A new email carrying one of them (e.g. a forward, which starts a new
--   thread) is suggested for that case. value_normalized is the number
--   without its label, upper case, letters and digits only ("B6271626");
--   each number belongs to one case.
--
-- Emails already filed get their threads recorded below. Safe to run more
-- than once.

create table if not exists case_conversations (
  case_id         text not null references cases(id) on delete cascade,
  conversation_id text not null,
  created_at      timestamptz not null default now(),
  primary key (conversation_id, case_id)
);
create index if not exists case_conversations_case_idx on case_conversations (case_id);

create table if not exists case_references (
  id               text primary key default gen_random_uuid()::text,
  case_id          text not null references cases(id) on delete cascade,
  kind             text not null
                     check (kind in ('quote', 'cover_note', 'policy', 'rfq', 'po', 'tender', 'loa', 'other')),
  value            text not null,              -- as written, e.g. "B62716/26"
  value_normalized text not null,              -- e.g. "B6271626"
  mail_message_id  text references mail_messages(id) on delete set null,   -- the email it came from
  created_at       timestamptz not null default now(),
  unique (kind, value_normalized)
);
create index if not exists case_references_value_idx on case_references (value_normalized);
create index if not exists case_references_case_idx  on case_references (case_id);

create index if not exists mail_messages_conversation_idx on mail_messages (conversation_id);

alter table case_conversations enable row level security;
drop policy if exists "Logged-in users full access" on case_conversations;
create policy "Logged-in users full access" on case_conversations
  for all to authenticated using (true) with check (true);
revoke all on case_conversations from anon;
grant select, insert, update, delete on case_conversations to authenticated, service_role;

alter table case_references enable row level security;
drop policy if exists "Logged-in users full access" on case_references;
create policy "Logged-in users full access" on case_references
  for all to authenticated using (true) with check (true);
revoke all on case_references from anon;
grant select, insert, update, delete on case_references to authenticated, service_role;

-- Threads of emails filed before this table existed
insert into case_conversations (case_id, conversation_id)
select distinct c.case_id, m.conversation_id
from mail_messages m
cross join lateral unnest(m.case_ids) as c(case_id)
where m.conversation_id is not null
  and exists (select 1 from cases where cases.id = c.case_id)
on conflict do nothing;
