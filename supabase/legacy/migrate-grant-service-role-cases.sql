-- Run this in Supabase SQL Editor
-- cases/case_files were created via raw SQL (schema.sql) and never got an
-- explicit grant for service_role — unlike telegram_uploads and
-- telegram_pending_uploads, which were added later with the grant included.
-- The CRM app itself writes to these tables using the anon/authenticated
-- key, so this went unnoticed until the Telegram bot (which uses
-- service_role) tried to insert a case directly and got a permission error.

grant select, insert, update, delete on cases to service_role;
grant select, insert, update, delete on case_files to service_role;
