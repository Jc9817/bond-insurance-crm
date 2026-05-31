-- Disable Row Level Security on all tables
-- Run in Supabase Dashboard → SQL Editor → New Query

alter table customers disable row level security;
alter table contacts disable row level security;
alter table cases disable row level security;
alter table case_notes disable row level security;
alter table follow_ups disable row level security;
alter table case_files disable row level security;
alter table activity_logs disable row level security;
alter table workflow_templates disable row level security;
alter table workflow_steps disable row level security;
alter table required_documents disable row level security;
alter table inquiries disable row level security;
alter table inquiry_quotations disable row level security;
alter table inquiry_notes disable row level security;
alter table inquiry_documents disable row level security;
