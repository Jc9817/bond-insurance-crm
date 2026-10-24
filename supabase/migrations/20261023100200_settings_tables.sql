-- Stage 2.1 (applied with `npx supabase db push`, see supabase/README.md)
-- Moves Settings out of browser memory into the database (fix list 2.1).
--
-- Before this, case types, industries, contact types, follow-up categories,
-- insurers, products, product packages, submission letter templates, PICs and
-- users lived only in lib/store.tsx state, seeded from lib/mock-data.ts. Any
-- change was lost on refresh and never seen by another user.
--
-- After this:
--   settings_items              -> case types, industries, contact types,
--                                  follow-up categories, insurers (one table,
--                                  `category` column)
--   products, product_packages  -> Product Master and Product Packages tabs
--   submission_letter_templates -> Submission Letters tab
--   pics                        -> Person in Charge tab (addPic wrote here
--                                  before, but no SQL file created it)
--   user_roles                  -> gains email + status; every logged-in
--                                  user can read it (the Users tab), only
--                                  /api/admin/users (service role) writes it
--
-- Seed rows use the same ids as lib/mock-data.ts, so cases that already
-- reference e.g. product 'prod1' keep working. Safe to run more than once:
-- existing rows are never overwritten.

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table if not exists settings_items (
  id         text primary key,
  category   text not null check (category in
               ('caseTypes', 'industries', 'contactTypes', 'followUpCategories', 'insurers')),
  name       text not null,
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists settings_items_category_idx on settings_items (category, sort_order);

create table if not exists products (
  id          text primary key,
  name        text not null,
  category    text not null default 'Bond',
  description text not null default '',
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists product_packages (
  id          text primary key,
  name        text not null,
  description text not null default '',
  product_ids text[] not null default '{}',
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists submission_letter_templates (
  id           text primary key,
  name         text not null,
  is_active    boolean not null default true,
  subject_line text not null default '',
  letter_body  text not null default '',
  doc_items    jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

create table if not exists pics (
  id         text primary key,
  name       text not null,
  email      text not null default '',
  created_at timestamptz not null default now()
);

-- ─── Access: logged-in users only (same rule as 20261023100000_enable_rls.sql) 

do $$
declare
  t text;
begin
  foreach t in array array['settings_items', 'products', 'product_packages',
                           'submission_letter_templates', 'pics']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Logged-in users full access" on public.%I', t);
    execute format(
      'create policy "Logged-in users full access" on public.%I
         for all to authenticated using (true) with check (true)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
  end loop;
end $$;

-- ─── user_roles: email + status, readable by every logged-in user ────────────
-- Writes stay with service_role only, so nobody can change their own role
-- from the browser; Admins do it through Settings -> Users (/api/admin/users).

alter table user_roles add column if not exists email  text not null default '';
alter table user_roles add column if not exists status text not null default 'Active';
alter table user_roles drop constraint if exists user_roles_status_check;
alter table user_roles add constraint user_roles_status_check check (status in ('Active', 'Inactive'));

update user_roles r set email = u.email
from auth.users u
where u.id = r.user_id and r.email = '';

drop policy if exists "Users read own role" on user_roles;
drop policy if exists "Logged-in users read roles" on user_roles;
create policy "Logged-in users read roles" on user_roles
  for select to authenticated using (true);

-- ─── Seed (today's built-in values) ──────────────────────────────────────────

insert into settings_items (id, category, name, is_active, sort_order) values
  ('sct1', 'caseTypes', 'Bond Workflow', true, 0),
  ('sct2', 'caseTypes', 'Simple Policy Workflow', true, 1),
  ('sct3', 'caseTypes', 'Project Insurance Workflow', true, 2),
  ('sct4', 'caseTypes', 'Claim Workflow', true, 3),
  ('sct5', 'caseTypes', 'Renewal Workflow', true, 4),
  ('sct6', 'caseTypes', 'Endorsement Workflow', true, 5),
  ('sct7', 'caseTypes', 'Servicing Workflow', true, 6),
  ('si1', 'industries', 'Construction', true, 0),
  ('si2', 'industries', 'Manufacturing', true, 1),
  ('si3', 'industries', 'Trading', true, 2),
  ('si4', 'industries', 'Retail', true, 3),
  ('si5', 'industries', 'Services', true, 4),
  ('si6', 'industries', 'Technology', true, 5),
  ('si7', 'industries', 'Healthcare', true, 6),
  ('si8', 'industries', 'Education', true, 7),
  ('si9', 'industries', 'Transportation', true, 8),
  ('si10', 'industries', 'Other', true, 9),
  ('sco1', 'contactTypes', 'Owner', true, 0),
  ('sco2', 'contactTypes', 'Director', true, 1),
  ('sco3', 'contactTypes', 'Manager', true, 2),
  ('sco4', 'contactTypes', 'Finance', true, 3),
  ('sco5', 'contactTypes', 'Operations', true, 4),
  ('sco6', 'contactTypes', 'Worker', true, 5),
  ('sco7', 'contactTypes', 'Referral', true, 6),
  ('sco8', 'contactTypes', 'Introducer', true, 7),
  ('sco9', 'contactTypes', 'Other', true, 8),
  ('sfu1', 'followUpCategories', 'Client Follow-Up', true, 0),
  ('sfu2', 'followUpCategories', 'Insurer Follow-Up', true, 1),
  ('sfu3', 'followUpCategories', 'Renewal Reminder', true, 2),
  ('sfu4', 'followUpCategories', 'Documentation', true, 3),
  ('sfu5', 'followUpCategories', 'Internal', true, 4),
  ('sfu6', 'followUpCategories', 'Payment', true, 5),
  ('sfu7', 'followUpCategories', 'Other', true, 6),
  ('sins1', 'insurers', 'Allianz Malaysia', true, 0),
  ('sins2', 'insurers', 'Etiqa Takaful', true, 1),
  ('sins3', 'insurers', 'RHB Insurance', true, 2),
  ('sins4', 'insurers', 'Zurich Insurance', true, 3),
  ('sins5', 'insurers', 'AIA Malaysia', true, 4),
  ('sins6', 'insurers', 'Tokio Marine', true, 5),
  ('sins7', 'insurers', 'Berjaya Sompo', true, 6),
  ('sins8', 'insurers', 'MSIG Insurance', true, 7)
on conflict (id) do nothing;

insert into products (id, name, category, description, is_active, sort_order) values
  ('prod1', 'Performance Bond', 'Bond', 'Guarantees contractor performance per contract terms', true, 0),
  ('prod2', 'Tender Bond / Bid Bond', 'Bond', 'Required during tender process; forfeited if contractor withdraws after award', true, 1),
  ('prod3', 'Advance Payment Bond', 'Bond', 'Guarantees repayment of advance payment if not utilised by contractor', true, 2),
  ('prod4', 'Retention Bond', 'Bond', 'Replaces cash retention withheld by employer; released upon DLP end', true, 3),
  ('prod5', 'Customs Bond', 'Bond', 'Required by Royal Malaysian Customs for duty-deferred imports', true, 4),
  ('prod6', 'Immigration Bond', 'Bond', 'Required for foreign worker visa and permit applications (PLKS/PATI)', true, 5),
  ('prod7', 'Fidelity Guarantee', 'Bond', 'Covers employer against employee dishonesty, fraud, or defalcation', true, 6),
  ('prod8', 'Workmen Compensation (WC)', 'Insurance', 'Covers work-related injury, illness, disability, and death for workers', true, 7),
  ('prod9', 'Third Party Liability (TPL)', 'Insurance', 'Covers legal liability to third parties for bodily injury or property damage', true, 8),
  ('prod10', 'Contractor All Risk (CAR)', 'Insurance', 'All-risk cover for contract works in progress and third party liability during construction', true, 9),
  ('prod11', 'Contractor Plant & Machinery (CPM)', 'Insurance', 'Covers sudden accidental damage to contractor plant and equipment on-site', true, 10),
  ('prod12', 'Fire Insurance', 'Insurance', 'Covers property against fire, lightning, and related perils', true, 11),
  ('prod13', 'Marine Cargo Insurance', 'Insurance', 'Covers goods during transit by sea, air, or land', true, 12)
on conflict (id) do nothing;

insert into product_packages (id, name, description, product_ids, is_active, sort_order) values
  ('pkg1', 'Performance Bond Only', 'Standalone performance bond for government or private contracts', array['prod1']::text[], true, 0),
  ('pkg2', 'Tender Bond Only', 'Standalone tender / bid bond for submission stage', array['prod2']::text[], true, 1),
  ('pkg3', 'Advance Payment Bond Only', 'Standalone advance payment bond', array['prod3']::text[], true, 2),
  ('pkg4', 'WC Only', 'Workmen compensation insurance only', array['prod8']::text[], true, 3),
  ('pkg5', 'TPL Only', 'Third party liability insurance only', array['prod9']::text[], true, 4),
  ('pkg6', 'WC + TPL', 'Workers compensation and third party liability package', array['prod8', 'prod9']::text[], true, 5),
  ('pkg7', 'Performance Bond + WC + TPL', 'Full government construction package — bond plus insurance cover', array['prod1', 'prod8', 'prod9']::text[], true, 6),
  ('pkg8', 'CAR Package', 'Contractor All Risk with Third Party Liability', array['prod10', 'prod9']::text[], true, 7),
  ('pkg9', 'Custom', 'Select products manually — for non-standard combinations', array[]::text[], true, 8)
on conflict (id) do nothing;

insert into submission_letter_templates (id, name, is_active, subject_line, letter_body, doc_items) values
  ('slt1', 'Performance Bond — Standard', true, 'REQUISITION OF PERFORMANCE BOND (INSURANCE GUARANTEE) OF {{bondAmount}}',
   'Dear Sir / Mdm

The above Performance Bond (Insurance Guarantee) refers.

We submit herewith the following documents for your processing.

{{docList}}

Kindly acknowledge the above documents by signing & returning the duplicate of this letter.

Thank you.

Yours faithfully',
   '[
  {
    "id": "di1",
    "labelInForm": "Proposal Form",
    "textTemplate": "Duly completed & Executed Contract Guarantee proposal form",
    "defaultChecked": true
  },
  {
    "id": "di2",
    "labelInForm": "Quotation for Performance Bond",
    "textTemplate": "Quotation for Performance Bond",
    "defaultChecked": true
  },
  {
    "id": "di3",
    "labelInForm": "Letter of Indemnity (Green)",
    "textTemplate": "Letter of Indemnity (Green) – {{contractor}}",
    "defaultChecked": true
  },
  {
    "id": "di4",
    "labelInForm": "Letter of Indemnity (White) – Director",
    "textTemplate": "Letter of Indemnity (White), Financial Statement & Copy of NRIC – {{directorName}}",
    "defaultChecked": true,
    "subFieldType": "director"
  },
  {
    "id": "di5",
    "labelInForm": "3rd Party Guarantor LOI (White)",
    "textTemplate": "3RD Party Guarantor - Letter of Indemnity (White), Financial Statement & Copy of NRIC – {{guarantorName}}",
    "defaultChecked": true,
    "subFieldType": "guarantor"
  },
  {
    "id": "di6",
    "labelInForm": "SSM Complete Set",
    "textTemplate": "SSM Complete set – {{contractor}}",
    "defaultChecked": true
  },
  {
    "id": "di7",
    "labelInForm": "Bank Statement",
    "textTemplate": "{{contractor}} – {{bankName}} Statement – {{statementPeriod}}",
    "defaultChecked": true,
    "subFieldType": "bank"
  },
  {
    "id": "di8",
    "labelInForm": "CIDB Certificates",
    "textTemplate": "{{contractor}} – CIDB Perakuan Pendaftaran, Sijil Perolehan Kerja Kerajaan, Bahagian Pembangunan Kontraktor Dan Usahawan, Sijil Akuan Pendaftaran Syarikat Bumiputra & Sijil Akuan Pendaftaran Syarikat",
    "defaultChecked": true
  },
  {
    "id": "di9",
    "labelInForm": "Company Profile",
    "textTemplate": "{{contractor}} – Company Profile",
    "defaultChecked": true
  },
  {
    "id": "di10",
    "labelInForm": "Letter of Award",
    "textTemplate": "Letter of Award – {{principal}} to {{contractor}}",
    "defaultChecked": true
  },
  {
    "id": "di11",
    "labelInForm": "Payment of Premium",
    "textTemplate": "Payment of Premium {{premiumAmount}}",
    "defaultChecked": true,
    "subFieldType": "premium"
  }
]'::jsonb)
on conflict (id) do nothing;
