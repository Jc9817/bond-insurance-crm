-- Stage 3.4: the SSM registration number is the customer key.
--
-- customers.ssm_key is filled in automatically from company_registration_no:
-- the 12-digit SSM number when there is one ("2019-0101-2345",
-- "201901012345 (1234567-A)" -> "201901012345"), otherwise the old-style
-- number with punctuation removed ("1234567-A" -> "1234567A"). Same rule as
-- ssmKey() in lib/ssm.ts. What people typed in company_registration_no is
-- left as it is.
--
-- A unique index then stops two customers having the same number — but only
-- once there are no duplicates left. If this file reports duplicates, merge
-- or correct those customers, then run it again. The app also checks before
-- saving, so new duplicates are refused either way.
--
-- Safe to run more than once.

alter table customers add column if not exists ssm_key text generated always as (
  coalesce(
    (regexp_match(regexp_replace(company_registration_no, '[\s-]', '', 'g'), '\d{12}'))[1],
    nullif(upper(regexp_replace(company_registration_no, '[^0-9A-Za-z]', '', 'g')), '')
  )
) stored;

do $$
begin
  if exists (
    select 1 from customers where ssm_key is not null group by ssm_key having count(*) > 1
  ) then
    raise notice 'Some customers share an SSM number - the unique rule is NOT on yet. See the list below, merge them, then run this file again.';
  else
    create unique index if not exists customers_ssm_key_unique on customers (ssm_key) where ssm_key is not null;
    raise notice 'No duplicate SSM numbers - unique rule is on.';
  end if;
end $$;

-- Customers sharing an SSM number (empty = none)
select ssm_key,
       count(*) as customers,
       string_agg(customer_name || '  [id ' || id || ']', '  |  ' order by created_at) as names
from customers
where ssm_key is not null
group by ssm_key
having count(*) > 1
order by ssm_key;
