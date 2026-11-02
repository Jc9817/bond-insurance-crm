-- Emails screen: keep the reference numbers of emails filed before
-- case_references existed (see 20261102100000_case_threads_references.sql).
--
-- Those emails' AI suggestions hold the numbers as one line of text
-- ("QTS: B62716/26; KL40465") plus the policy / cover note numbers. Each
-- number is kept against the email's case — only for emails filed to one
-- case — in the same normalized form as lib/mail-links.ts
-- (normalizeReference): label dropped, upper case, letters and digits only.
-- A number already kept stays with its case. Safe to run more than once.

insert into case_references (case_id, kind, value, value_normalized, mail_message_id)
select distinct on (r.kind, r.n) r.case_id, r.kind, r.value, r.n, r.mail_id
from (
  select m.case_ids[1] as case_id, m.id as mail_id, m.decided_at, x.kind, trim(x.value) as value,
         regexp_replace(regexp_replace(upper(trim(x.value)), '^[A-Z .]{0,20}[:#]\s*', ''), '[^A-Z0-9]', '', 'g') as n
  from mail_messages m
  cross join lateral (
    select 'other' as kind, v as value
      from regexp_split_to_table(coalesce(m.ai_suggestion->>'references', ''), '[;,\n]') as v
    union all
    select 'policy', p->>'policyNumber'
      from jsonb_array_elements(coalesce(m.ai_suggestion->'policies', '[]'::jsonb)) as p
  ) x
  where m.status = 'filed' and cardinality(m.case_ids) = 1
    and exists (select 1 from cases where cases.id = m.case_ids[1])
) r
where length(r.n) >= 5 and r.n ~ '[0-9]'
order by r.kind, r.n, r.decided_at
on conflict do nothing;
