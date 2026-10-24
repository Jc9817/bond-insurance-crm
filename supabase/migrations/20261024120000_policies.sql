-- Stage 5.1: one row per policy or bond, several per case.
--
-- Before this, a case had a single bond_expiry_date. A case is one contract
-- (one LOA) and can carry several policies — e.g. a performance bond, CAR
-- and TPL — each with its own number, insurer and dates. A yearly renewal is
-- a new row in the same case; the old row becomes "Renewed" and the new one
-- points back to it (renewed_from).
--
-- Status values:
--   Pending   quoted / applied for, not issued yet
--   Active    in force
--   Renewed   replaced by its renewal (a newer row with renewed_from = this id)
--   Expired   past its expiry date without renewal
--   Cancelled cancelled before expiry
--
-- reminded_60_at / reminded_30_at record when the daily reminder job
-- (/api/cron/policy-reminders, fix list 5.2) reported this policy, so each
-- reminder goes out once even if a day is missed.
--
-- Existing cases with a bond_expiry_date get one policy row each, so nothing
-- is lost. Safe to run more than once.

create table if not exists policies (
  id             text primary key,
  case_id        text not null references cases(id) on delete cascade,
  policy_type    text not null default '',      -- e.g. Performance Bond, CAR, TPL (Product Master names)
  policy_number  text not null default '',
  insurer        text not null default '',
  sum_insured    numeric,
  premium        numeric,
  start_date     date,
  expiry_date    date,
  status         text not null default 'Active'
                   check (status in ('Pending', 'Active', 'Renewed', 'Expired', 'Cancelled')),
  case_file_id   text,                          -- the policy / bond document on the case
  renewed_from   text references policies(id) on delete set null,
  notes          text not null default '',
  reminded_60_at timestamptz,
  reminded_30_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists policies_case_idx   on policies (case_id);
create index if not exists policies_expiry_idx on policies (status, expiry_date);

alter table policies enable row level security;
drop policy if exists "Logged-in users full access" on policies;
create policy "Logged-in users full access" on policies
  for all to authenticated using (true) with check (true);
revoke all on policies from anon;
grant select, insert, update, delete on policies to authenticated, service_role;

-- One policy per case that already has a bond expiry date
insert into policies (id, case_id, policy_type, insurer, sum_insured, expiry_date, status, notes)
select 'pol_' || c.id,
       c.id,
       'Bond',
       coalesce(c.final_insurer, ''),
       coalesce(c.final_amount, c.amount),
       c.bond_expiry_date::date,
       case when c.bond_expiry_date::date < current_date then 'Expired' else 'Active' end,
       'Created from the case''s bond expiry date — check the type, number and insurer.'
from cases c
where c.bond_expiry_date is not null and c.bond_expiry_date::text <> ''
on conflict (id) do nothing;
