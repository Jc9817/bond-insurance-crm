-- Documents follow the products (lib/product-documents.ts).
--
-- A workflow has two parts: the process steps and the required documents.
-- Staff now tick products; the case's checklist is every selected product's
-- documents, each counted once, and Workflow Type is optional.
--
-- required_documents under the template 'wt_product_docs' is the one master
-- list of documents, built from the existing workflow lists. Documents that
-- had two names became one: "Contract / Award Letter" is now "Letter of Award
-- (LOA)", "Application Forms (All Policies)" is "Application Form", and
-- "IC / Passport (Director or Owner)" is the Director's or Proprietor's IC.
--
-- product_documents says which product needs which document, per company type
-- (customers of any other type use the Sdn. Bhd. list). Fine-tune it in
-- Settings → Product Master.
--
-- products.workflow_type is the workflow whose steps the product follows.
--
-- cases.uses_product_documents marks a case whose checklist comes from its
-- products. Existing cases stay false, so they keep the checklist they have.
--
-- The existing workflow templates are not changed. Safe to run more than once;
-- re-running does not undo fine-tuning, except that deleted rows come back.

alter table products add column if not exists workflow_type text;
alter table cases add column if not exists uses_product_documents boolean not null default false;

insert into workflow_templates (id, name, case_type, description, is_active)
values ('wt_product_docs', 'Product Documents', 'Product Documents',
        'The master list of documents. Which product needs which is set under Product Master.', true)
on conflict (id) do nothing;

-- The master list, copied from the existing lists (with any AI prompts)
insert into required_documents (id, template_id, case_type_id, step_id, name, description, required, accepted_file_types, is_active, ai_prompt)
select m.id, 'wt_product_docs', 'wt_product_docs', null, coalesce(m.name, d.name), d.description, true, d.accepted_file_types, true, d.ai_prompt
from (values
  ('pd_loa',         'wt_bond_d1',    null),
  ('pd_bond_form',   'wt_bond_d5',    null),
  ('pd_profile',     'wt_bond_d2',    null),
  ('pd_ssm',         'wt_bond_d3',    null),
  ('pd_audited',     'wt_bond_d4',    null),
  ('pd_director_ic', 'wt_bond_d6',    null),
  ('pd_auth_letter', 'wt_bond_d7',    null),
  ('pd_bank',        'wt_bond_d8',    null),
  ('pd_form_d',      'wt_bond_sp_d3', null),
  ('pd_owner_ic',    'wt_bond_sp_d4', null),
  ('pd_previous',    'wt_bond_sp_d6', null),
  ('pd_biz_profile', 'wt_bond_sp_d7', null),
  ('pd_app_form',    'wt_simple_d1',  'Application Form'),
  ('pd_supporting',  'wt_simple_d3',  null),
  ('pd_workers',     'wt_project_d6', null),
  ('pd_site_plan',   'wt_project_d7', null)
) as m(id, source_id, name)
join required_documents d on d.id = m.source_id
on conflict (id) do nothing;

create table if not exists product_documents (
  product_id   text not null references products(id) on delete cascade,
  document_id  text not null references required_documents(id) on delete cascade,
  company_type text not null check (company_type in ('Sdn. Bhd.', 'Sole Proprietor')),
  required     boolean not null default true,
  primary key (product_id, document_id, company_type)
);
create index if not exists product_documents_product_idx on product_documents (product_id);

alter table product_documents enable row level security;
drop policy if exists "Logged-in users full access" on product_documents;
create policy "Logged-in users full access" on product_documents
  for all to authenticated using (true) with check (true);
revoke all on product_documents from anon;
grant select, insert, update, delete on product_documents to authenticated, service_role;

-- Which steps each product follows
update products set workflow_type = 'Bond Workflow'
  where id in ('prod1', 'prod2', 'prod3', 'prod4', 'prod5', 'prod6', 'prod7') and workflow_type is null;
update products set workflow_type = 'Project Insurance Workflow'
  where id in ('prod10', 'prod11') and workflow_type is null;
update products set workflow_type = 'Simple Policy Workflow'
  where id in ('prod8', 'prod9', 'prod12', 'prod13') and workflow_type is null;

-- Which documents each group of products needs
with
  bond(id)    as (values ('prod1'), ('prod2'), ('prod3'), ('prod4'), ('prod5'), ('prod6'), ('prod7')),
  project(id) as (values ('prod10'), ('prod11')),
  simple(id)  as (values ('prod8'), ('prod9'), ('prod12'), ('prod13')),
  wanted(product_id, document_id, company_type, required) as (
    select p.id, d.doc, 'Sdn. Bhd.', d.req from bond p cross join (values
      ('pd_loa', true), ('pd_profile', true), ('pd_ssm', true), ('pd_audited', true),
      ('pd_bond_form', true), ('pd_director_ic', true), ('pd_auth_letter', true), ('pd_bank', false)
    ) as d(doc, req)
    union all
    select p.id, d.doc, 'Sole Proprietor', d.req from bond p cross join (values
      ('pd_loa', true), ('pd_bond_form', true), ('pd_form_d', true), ('pd_owner_ic', true),
      ('pd_bank', true), ('pd_previous', false), ('pd_biz_profile', false)
    ) as d(doc, req)
    union all
    select p.id, d.doc, 'Sdn. Bhd.', d.req from project p cross join (values
      ('pd_loa', true), ('pd_profile', true), ('pd_ssm', true), ('pd_director_ic', true),
      ('pd_app_form', true), ('pd_site_plan', false), ('pd_bank', false)
    ) as d(doc, req)
    union all
    select p.id, d.doc, 'Sole Proprietor', d.req from project p cross join (values
      ('pd_loa', true), ('pd_biz_profile', true), ('pd_form_d', true), ('pd_owner_ic', true),
      ('pd_app_form', true), ('pd_site_plan', false), ('pd_bank', false)
    ) as d(doc, req)
    union all
    select p.id, 'pd_app_form', c.t, true from simple p cross join (values ('Sdn. Bhd.'), ('Sole Proprietor')) as c(t)
    union all
    select p.id, 'pd_supporting', c.t, false from simple p cross join (values ('Sdn. Bhd.'), ('Sole Proprietor')) as c(t)
    union all
    select p.id, 'pd_director_ic', 'Sdn. Bhd.', true from simple p
    union all
    select p.id, 'pd_owner_ic', 'Sole Proprietor', true from simple p
    union all
    select 'prod8', 'pd_workers', c.t, false from (values ('Sdn. Bhd.'), ('Sole Proprietor')) as c(t)
  )
insert into product_documents (product_id, document_id, company_type, required)
select r.product_id, r.document_id, r.company_type, r.required
from wanted r
where exists (select 1 from products where products.id = r.product_id)
  and exists (select 1 from required_documents where required_documents.id = r.document_id)
on conflict do nothing;
