-- Run this in Supabase SQL Editor
-- The AI scan callback now resolves a document type name (e.g. "Bank
-- Statement") sent by n8n to the matching required-document slot in the
-- case's workflow template, so it needs to read cases/workflow_templates/
-- required_documents using service_role — same missing-grant class as
-- cases/case_files (these tables were created via raw SQL and only ever
-- got anon/authenticated access, never service_role).

grant select, insert, update, delete on workflow_templates to service_role;
grant select, insert, update, delete on workflow_steps to service_role;
grant select, insert, update, delete on required_documents to service_role;
