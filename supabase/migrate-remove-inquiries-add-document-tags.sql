-- Removes the deprecated Inquiries feature (dropped from nav back in "New UX
-- UI Design", never actually deleted from the DB) and adds the new Document
-- Tags catalog (tag name + editable AI prompt) used to drive the AI Scan
-- pipeline going forward.
--
-- Run this once in Supabase Dashboard → SQL Editor → New Query.

-- ─── Drop Inquiries tables (dependents first, for the FK) ─────────────────────
drop table if exists inquiry_quotations;
drop table if exists inquiry_notes;
drop table if exists inquiry_documents;
drop table if exists inquiries;

-- ─── Document Tags ──────────────────────────────────────────────────────────
create table if not exists document_tags (
  id text primary key,
  name text not null unique,
  ai_prompt text default '',
  is_active boolean default true,
  created_at timestamptz default now()
);
alter table document_tags disable row level security;

grant select, insert, update, delete on document_tags to service_role;
grant select, insert, update, delete on document_tags to authenticated;
