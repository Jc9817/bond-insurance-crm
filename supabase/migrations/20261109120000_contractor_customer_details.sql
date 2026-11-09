-- A Contractor / Customer is a person: it records the company they are with
-- and their position instead of a company registration number.
alter table customers
  add column if not exists company_name text not null default '',
  add column if not exists contact_type text not null default '',
  add column if not exists is_person boolean not null default false;

-- Existing records already chosen as a Contractor / Customer, never as a
-- Principal, and with no registration number
update customers c
set is_person = true
where coalesce(c.company_registration_no, '') = ''
  and exists (select 1 from cases x where x.bond_principal = c.customer_name)
  and not exists (select 1 from cases x where x.customer_id = c.id);
