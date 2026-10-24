-- Stage 4.4: readable case numbers, and where each file's SharePoint copy is.
--
-- cases.case_number: "2026-005" — the year (Malaysia time) and a running
-- number that restarts each year. Existing cases are numbered in the order
-- they were created; new cases are numbered by a trigger as they are
-- inserted, whoever inserts them (the app, the Telegram bot, the Inbox).
-- It is used in SharePoint folder and file names. The internal id is unchanged.
--
-- case_files.sharepoint_item_id / sharepoint_url: the file's copy in the
-- SharePoint Customers library (Graph drive item id, and a link to open it).
--
-- Safe to run more than once.

alter table cases add column if not exists case_number text;

-- Number existing cases, continuing after any numbers already given
with numbered as (
  select id,
         to_char(created_at at time zone 'Asia/Kuala_Lumpur', 'YYYY') as yr,
         row_number() over (
           partition by to_char(created_at at time zone 'Asia/Kuala_Lumpur', 'YYYY')
           order by created_at, id
         ) as n
  from cases
  where case_number is null
),
offsets as (
  select split_part(case_number, '-', 1) as yr, max(split_part(case_number, '-', 2)::int) as last
  from cases where case_number ~ '^\d{4}-\d+$'
  group by 1
)
update cases c
set case_number = numbered.yr || '-' || lpad((numbered.n + coalesce(offsets.last, 0))::text, 3, '0')
from numbered left join offsets on offsets.yr = numbered.yr
where c.id = numbered.id;

create unique index if not exists cases_case_number_unique on cases (case_number);

create or replace function public.assign_case_number()
returns trigger
language plpgsql
as $$
declare
  yr text := to_char(coalesce(new.created_at, now()) at time zone 'Asia/Kuala_Lumpur', 'YYYY');
  last int;
begin
  if new.case_number is not null and new.case_number <> '' then
    return new;
  end if;
  -- One numbering at a time, so two new cases never get the same number
  perform pg_advisory_xact_lock(hashtext('cases.case_number'));
  select coalesce(max(split_part(case_number, '-', 2)::int), 0) into last
  from cases where case_number like yr || '-%' and case_number ~ '^\d{4}-\d+$';
  new.case_number := yr || '-' || lpad((last + 1)::text, 3, '0');
  return new;
end $$;

drop trigger if exists cases_assign_case_number on cases;
create trigger cases_assign_case_number
  before insert on cases
  for each row execute function public.assign_case_number();

alter table case_files add column if not exists sharepoint_item_id text;
alter table case_files add column if not exists sharepoint_url text;
