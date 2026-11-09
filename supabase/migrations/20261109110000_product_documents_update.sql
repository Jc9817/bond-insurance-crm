-- Product documents, as filled in on DocFlow-data-entry.xlsx (9 Nov 2026).
--
-- 1. Partnership becomes its own company type with its own list. Before this,
--    Partnership customers used the Sdn. Bhd. list.
-- 2. Three new documents join the master list: Guarantor's IC, Letter of
--    Consent for Disclosure of Credit Information, and Asset Declaration.
-- 3. Performance Bond, CAR and WC get the lists filled in on the Excel, for
--    Sdn. Bhd., Sole Proprietor and Partnership.
-- 4. Every other product starts its Partnership list as a copy of its Sole
--    Proprietor list; its Sdn. Bhd. and Sole Proprietor lists do not change.
--
-- Safe to run more than once, but running it again puts the three products
-- back to these lists, undoing later changes made in Settings.

alter table product_documents drop constraint if exists product_documents_company_type_check;
alter table product_documents add constraint product_documents_company_type_check
  check (company_type in ('Sdn. Bhd.', 'Sole Proprietor', 'Partnership'));

insert into required_documents (id, template_id, case_type_id, step_id, name, description, required, accepted_file_types, is_active, ai_prompt)
values
  ('pd_guarantor_ic', 'wt_product_docs', 'wt_product_docs', null, 'Guarantor''s IC', '', true, '{}', true, null),
  ('pd_credit_consent', 'wt_product_docs', 'wt_product_docs', null, 'Letter of Consent for Disclosure of Credit Information', '', true, '{}', true, null),
  ('pd_asset_declaration', 'wt_product_docs', 'wt_product_docs', null, 'Asset Declaration', '', true, '{}', true, null)
on conflict (id) do nothing;

delete from product_documents where product_id in ('prod1', 'prod8', 'prod10');

insert into product_documents (product_id, document_id, company_type, required)
values
  -- Performance Bond, Sdn. Bhd.
  ('prod1', 'pd_loa', 'Sdn. Bhd.', true),
  ('prod1', 'pd_bond_form', 'Sdn. Bhd.', true),
  ('prod1', 'pd_app_form', 'Sdn. Bhd.', false),
  ('prod1', 'pd_profile', 'Sdn. Bhd.', true),
  ('prod1', 'pd_biz_profile', 'Sdn. Bhd.', false),
  ('prod1', 'pd_ssm', 'Sdn. Bhd.', true),
  ('prod1', 'pd_form_d', 'Sdn. Bhd.', true),
  ('prod1', 'pd_director_ic', 'Sdn. Bhd.', true),
  ('prod1', 'pd_owner_ic', 'Sdn. Bhd.', false),
  ('prod1', 'pd_guarantor_ic', 'Sdn. Bhd.', true),
  ('prod1', 'pd_credit_consent', 'Sdn. Bhd.', true),
  ('prod1', 'pd_asset_declaration', 'Sdn. Bhd.', true),
  ('prod1', 'pd_audited', 'Sdn. Bhd.', true),
  ('prod1', 'pd_bank', 'Sdn. Bhd.', true),
  ('prod1', 'pd_auth_letter', 'Sdn. Bhd.', false),
  ('prod1', 'pd_previous', 'Sdn. Bhd.', false),
  ('prod1', 'pd_workers', 'Sdn. Bhd.', false),
  ('prod1', 'pd_site_plan', 'Sdn. Bhd.', false),
  ('prod1', 'pd_supporting', 'Sdn. Bhd.', false),
  -- Performance Bond, Sole Proprietor
  ('prod1', 'pd_loa', 'Sole Proprietor', true),
  ('prod1', 'pd_bond_form', 'Sole Proprietor', true),
  ('prod1', 'pd_app_form', 'Sole Proprietor', false),
  ('prod1', 'pd_profile', 'Sole Proprietor', true),
  ('prod1', 'pd_biz_profile', 'Sole Proprietor', false),
  ('prod1', 'pd_ssm', 'Sole Proprietor', true),
  ('prod1', 'pd_form_d', 'Sole Proprietor', true),
  ('prod1', 'pd_director_ic', 'Sole Proprietor', false),
  ('prod1', 'pd_owner_ic', 'Sole Proprietor', true),
  ('prod1', 'pd_guarantor_ic', 'Sole Proprietor', true),
  ('prod1', 'pd_credit_consent', 'Sole Proprietor', false),
  ('prod1', 'pd_asset_declaration', 'Sole Proprietor', false),
  ('prod1', 'pd_audited', 'Sole Proprietor', false),
  ('prod1', 'pd_bank', 'Sole Proprietor', true),
  ('prod1', 'pd_auth_letter', 'Sole Proprietor', false),
  ('prod1', 'pd_previous', 'Sole Proprietor', false),
  ('prod1', 'pd_workers', 'Sole Proprietor', false),
  ('prod1', 'pd_site_plan', 'Sole Proprietor', false),
  ('prod1', 'pd_supporting', 'Sole Proprietor', false),
  -- Performance Bond, Partnership
  ('prod1', 'pd_loa', 'Partnership', true),
  ('prod1', 'pd_bond_form', 'Partnership', true),
  ('prod1', 'pd_app_form', 'Partnership', false),
  ('prod1', 'pd_profile', 'Partnership', true),
  ('prod1', 'pd_biz_profile', 'Partnership', false),
  ('prod1', 'pd_ssm', 'Partnership', true),
  ('prod1', 'pd_form_d', 'Partnership', true),
  ('prod1', 'pd_director_ic', 'Partnership', false),
  ('prod1', 'pd_owner_ic', 'Partnership', true),
  ('prod1', 'pd_guarantor_ic', 'Partnership', true),
  ('prod1', 'pd_credit_consent', 'Partnership', false),
  ('prod1', 'pd_asset_declaration', 'Partnership', false),
  ('prod1', 'pd_audited', 'Partnership', false),
  ('prod1', 'pd_bank', 'Partnership', true),
  ('prod1', 'pd_auth_letter', 'Partnership', false),
  ('prod1', 'pd_previous', 'Partnership', false),
  ('prod1', 'pd_workers', 'Partnership', false),
  ('prod1', 'pd_site_plan', 'Partnership', false),
  ('prod1', 'pd_supporting', 'Partnership', false),
  -- Contractor All Risk (CAR), Sdn. Bhd.
  ('prod10', 'pd_loa', 'Sdn. Bhd.', true),
  ('prod10', 'pd_bond_form', 'Sdn. Bhd.', false),
  ('prod10', 'pd_app_form', 'Sdn. Bhd.', false),
  ('prod10', 'pd_profile', 'Sdn. Bhd.', false),
  ('prod10', 'pd_biz_profile', 'Sdn. Bhd.', false),
  ('prod10', 'pd_ssm', 'Sdn. Bhd.', false),
  ('prod10', 'pd_form_d', 'Sdn. Bhd.', false),
  ('prod10', 'pd_director_ic', 'Sdn. Bhd.', false),
  ('prod10', 'pd_owner_ic', 'Sdn. Bhd.', false),
  ('prod10', 'pd_guarantor_ic', 'Sdn. Bhd.', false),
  ('prod10', 'pd_credit_consent', 'Sdn. Bhd.', false),
  ('prod10', 'pd_asset_declaration', 'Sdn. Bhd.', false),
  ('prod10', 'pd_audited', 'Sdn. Bhd.', false),
  ('prod10', 'pd_bank', 'Sdn. Bhd.', false),
  ('prod10', 'pd_auth_letter', 'Sdn. Bhd.', false),
  ('prod10', 'pd_previous', 'Sdn. Bhd.', false),
  ('prod10', 'pd_workers', 'Sdn. Bhd.', false),
  ('prod10', 'pd_site_plan', 'Sdn. Bhd.', false),
  ('prod10', 'pd_supporting', 'Sdn. Bhd.', false),
  -- Contractor All Risk (CAR), Sole Proprietor
  ('prod10', 'pd_loa', 'Sole Proprietor', true),
  ('prod10', 'pd_bond_form', 'Sole Proprietor', false),
  ('prod10', 'pd_app_form', 'Sole Proprietor', false),
  ('prod10', 'pd_profile', 'Sole Proprietor', false),
  ('prod10', 'pd_biz_profile', 'Sole Proprietor', false),
  ('prod10', 'pd_ssm', 'Sole Proprietor', false),
  ('prod10', 'pd_form_d', 'Sole Proprietor', false),
  ('prod10', 'pd_director_ic', 'Sole Proprietor', false),
  ('prod10', 'pd_owner_ic', 'Sole Proprietor', false),
  ('prod10', 'pd_guarantor_ic', 'Sole Proprietor', false),
  ('prod10', 'pd_credit_consent', 'Sole Proprietor', false),
  ('prod10', 'pd_asset_declaration', 'Sole Proprietor', false),
  ('prod10', 'pd_audited', 'Sole Proprietor', false),
  ('prod10', 'pd_bank', 'Sole Proprietor', false),
  ('prod10', 'pd_auth_letter', 'Sole Proprietor', false),
  ('prod10', 'pd_previous', 'Sole Proprietor', false),
  ('prod10', 'pd_workers', 'Sole Proprietor', false),
  ('prod10', 'pd_site_plan', 'Sole Proprietor', false),
  ('prod10', 'pd_supporting', 'Sole Proprietor', false),
  -- Contractor All Risk (CAR), Partnership
  ('prod10', 'pd_loa', 'Partnership', true),
  ('prod10', 'pd_bond_form', 'Partnership', false),
  ('prod10', 'pd_app_form', 'Partnership', false),
  ('prod10', 'pd_profile', 'Partnership', false),
  ('prod10', 'pd_biz_profile', 'Partnership', false),
  ('prod10', 'pd_ssm', 'Partnership', false),
  ('prod10', 'pd_form_d', 'Partnership', false),
  ('prod10', 'pd_director_ic', 'Partnership', false),
  ('prod10', 'pd_owner_ic', 'Partnership', false),
  ('prod10', 'pd_guarantor_ic', 'Partnership', false),
  ('prod10', 'pd_credit_consent', 'Partnership', false),
  ('prod10', 'pd_asset_declaration', 'Partnership', false),
  ('prod10', 'pd_audited', 'Partnership', false),
  ('prod10', 'pd_bank', 'Partnership', false),
  ('prod10', 'pd_auth_letter', 'Partnership', false),
  ('prod10', 'pd_previous', 'Partnership', false),
  ('prod10', 'pd_workers', 'Partnership', false),
  ('prod10', 'pd_site_plan', 'Partnership', false),
  ('prod10', 'pd_supporting', 'Partnership', false),
  -- Workmen Compensation (WC), Sdn. Bhd.
  ('prod8', 'pd_loa', 'Sdn. Bhd.', true),
  ('prod8', 'pd_bond_form', 'Sdn. Bhd.', false),
  ('prod8', 'pd_app_form', 'Sdn. Bhd.', false),
  ('prod8', 'pd_profile', 'Sdn. Bhd.', false),
  ('prod8', 'pd_biz_profile', 'Sdn. Bhd.', false),
  ('prod8', 'pd_ssm', 'Sdn. Bhd.', false),
  ('prod8', 'pd_form_d', 'Sdn. Bhd.', false),
  ('prod8', 'pd_director_ic', 'Sdn. Bhd.', false),
  ('prod8', 'pd_owner_ic', 'Sdn. Bhd.', false),
  ('prod8', 'pd_guarantor_ic', 'Sdn. Bhd.', false),
  ('prod8', 'pd_credit_consent', 'Sdn. Bhd.', false),
  ('prod8', 'pd_asset_declaration', 'Sdn. Bhd.', false),
  ('prod8', 'pd_audited', 'Sdn. Bhd.', false),
  ('prod8', 'pd_bank', 'Sdn. Bhd.', false),
  ('prod8', 'pd_auth_letter', 'Sdn. Bhd.', false),
  ('prod8', 'pd_previous', 'Sdn. Bhd.', false),
  ('prod8', 'pd_workers', 'Sdn. Bhd.', false),
  ('prod8', 'pd_site_plan', 'Sdn. Bhd.', false),
  ('prod8', 'pd_supporting', 'Sdn. Bhd.', false),
  -- Workmen Compensation (WC), Sole Proprietor
  ('prod8', 'pd_loa', 'Sole Proprietor', true),
  ('prod8', 'pd_bond_form', 'Sole Proprietor', false),
  ('prod8', 'pd_app_form', 'Sole Proprietor', false),
  ('prod8', 'pd_profile', 'Sole Proprietor', false),
  ('prod8', 'pd_biz_profile', 'Sole Proprietor', false),
  ('prod8', 'pd_ssm', 'Sole Proprietor', false),
  ('prod8', 'pd_form_d', 'Sole Proprietor', false),
  ('prod8', 'pd_director_ic', 'Sole Proprietor', false),
  ('prod8', 'pd_owner_ic', 'Sole Proprietor', false),
  ('prod8', 'pd_guarantor_ic', 'Sole Proprietor', false),
  ('prod8', 'pd_credit_consent', 'Sole Proprietor', false),
  ('prod8', 'pd_asset_declaration', 'Sole Proprietor', false),
  ('prod8', 'pd_audited', 'Sole Proprietor', false),
  ('prod8', 'pd_bank', 'Sole Proprietor', false),
  ('prod8', 'pd_auth_letter', 'Sole Proprietor', false),
  ('prod8', 'pd_previous', 'Sole Proprietor', false),
  ('prod8', 'pd_workers', 'Sole Proprietor', false),
  ('prod8', 'pd_site_plan', 'Sole Proprietor', false),
  ('prod8', 'pd_supporting', 'Sole Proprietor', false),
  -- Workmen Compensation (WC), Partnership
  ('prod8', 'pd_loa', 'Partnership', true),
  ('prod8', 'pd_bond_form', 'Partnership', false),
  ('prod8', 'pd_app_form', 'Partnership', false),
  ('prod8', 'pd_profile', 'Partnership', false),
  ('prod8', 'pd_biz_profile', 'Partnership', false),
  ('prod8', 'pd_ssm', 'Partnership', false),
  ('prod8', 'pd_form_d', 'Partnership', false),
  ('prod8', 'pd_director_ic', 'Partnership', false),
  ('prod8', 'pd_owner_ic', 'Partnership', false),
  ('prod8', 'pd_guarantor_ic', 'Partnership', false),
  ('prod8', 'pd_credit_consent', 'Partnership', false),
  ('prod8', 'pd_asset_declaration', 'Partnership', false),
  ('prod8', 'pd_audited', 'Partnership', false),
  ('prod8', 'pd_bank', 'Partnership', false),
  ('prod8', 'pd_auth_letter', 'Partnership', false),
  ('prod8', 'pd_previous', 'Partnership', false),
  ('prod8', 'pd_workers', 'Partnership', false),
  ('prod8', 'pd_site_plan', 'Partnership', false),
  ('prod8', 'pd_supporting', 'Partnership', false)
on conflict do nothing;

insert into product_documents (product_id, document_id, company_type, required)
select product_id, document_id, 'Partnership', required
from product_documents
where company_type = 'Sole Proprietor' and product_id not in ('prod1', 'prod8', 'prod10')
on conflict do nothing;
