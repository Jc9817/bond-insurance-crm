-- Bond Insurance CRM — Supabase Schema
-- Run this entire file in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ─── Customers ────────────────────────────────────────────────────────────────
create table if not exists customers (
  id text primary key,
  customer_name text not null,
  company_registration_no text default '',
  business_type text default '',
  industry text default '',
  main_phone text default '',
  main_email text default '',
  notes text default '',
  created_at timestamptz default now()
);
alter table customers disable row level security;

-- ─── Contacts ─────────────────────────────────────────────────────────────────
create table if not exists contacts (
  id text primary key,
  customer_id text references customers(id) on delete cascade,
  contact_name text not null,
  role text default '',
  phone text default '',
  email text default '',
  contact_type text default 'Other',
  is_primary boolean default false
);
alter table contacts disable row level security;

-- ─── Cases ────────────────────────────────────────────────────────────────────
create table if not exists cases (
  id text primary key,
  case_title text not null,
  customer_id text default '',
  customer_name text default '',
  case_type text default '',
  amount numeric default 0,
  person_in_charge text default '',
  current_status text default 'New',
  current_workflow_step_id text,
  result text default '',
  closing_remarks text default '',
  loss_reason text,
  final_amount numeric,
  final_insurer text,
  closed_at timestamptz,
  bond_principal text,
  bond_expiry_date date,
  waiting_for text,
  archived_at timestamptz,
  acceptance_date date,
  accepted_by text,
  created_at timestamptz default now(),
  updated_at timestamptz
);
alter table cases disable row level security;

-- ─── Case Notes ───────────────────────────────────────────────────────────────
create table if not exists case_notes (
  id text primary key,
  case_id text references cases(id) on delete cascade,
  content text default '',
  created_by text default '',
  created_at timestamptz default now()
);
alter table case_notes disable row level security;

-- ─── Follow-Ups ───────────────────────────────────────────────────────────────
create table if not exists follow_ups (
  id text primary key,
  title text default '',
  customer_id text default '',
  customer_name text default '',
  case_id text default '',
  case_title text default '',
  person_in_charge text default '',
  due_date text default '',
  status text default 'Open',
  created_at timestamptz default now()
);
alter table follow_ups disable row level security;

-- ─── Case Files ───────────────────────────────────────────────────────────────
create table if not exists case_files (
  id text primary key,
  case_id text references cases(id) on delete cascade,
  file_name text default '',
  file_size integer default 0,
  file_type text default '',
  document_type text default '',
  required_document_id text,
  uploaded_by text default '',
  uploaded_at timestamptz default now(),
  file_data_url text,
  ai_scanned boolean default false,
  ai_status text default 'Not Scanned',
  ai_extracted_data jsonb,
  ai_prompt text
);
alter table case_files disable row level security;

-- ─── Activity Logs ────────────────────────────────────────────────────────────
create table if not exists activity_logs (
  id text primary key,
  case_id text,
  case_title text,
  action_type text default '',
  title text default '',
  description text default '',
  old_value text,
  new_value text,
  changed_by text default '',
  timestamp timestamptz default now()
);
alter table activity_logs disable row level security;

-- ─── Workflow Templates ───────────────────────────────────────────────────────
create table if not exists workflow_templates (
  id text primary key,
  name text default '',
  case_type text default '',
  business_type text,
  description text default '',
  is_active boolean default true
);
alter table workflow_templates disable row level security;

-- ─── Workflow Steps ───────────────────────────────────────────────────────────
create table if not exists workflow_steps (
  id text primary key,
  template_id text references workflow_templates(id) on delete cascade,
  case_type_id text default '',
  name text default '',
  description text default '',
  "order" integer default 0,
  require_documents_complete boolean default false,
  default_follow_up_suggestion text default '',
  is_active boolean default true,
  ai_email_enabled boolean default false,
  ai_email_prompt text default ''
);
alter table workflow_steps disable row level security;

-- ─── Required Documents ───────────────────────────────────────────────────────
create table if not exists required_documents (
  id text primary key,
  template_id text references workflow_templates(id) on delete cascade,
  case_type_id text default '',
  step_id text,
  name text default '',
  description text default '',
  required boolean default true,
  accepted_file_types text[] default '{}',
  is_active boolean default true,
  ai_prompt text
);
alter table required_documents disable row level security;

-- ─── Document Tags ────────────────────────────────────────────────────────────
-- Centralized catalog of document tags (LOA, Bank Statement, SSM Certificate, ...)
-- with a per-tag AI prompt, editable from Settings → Document Tags & AI Prompts.
-- Resolved by name against case_files.document_type when triggering an AI scan,
-- so the same prompt is used no matter which workflow template/step the file
-- came through.
create table if not exists document_tags (
  id text primary key,
  name text not null unique,
  ai_prompt text default '',
  is_active boolean default true,
  created_at timestamptz default now()
);
alter table document_tags disable row level security;
