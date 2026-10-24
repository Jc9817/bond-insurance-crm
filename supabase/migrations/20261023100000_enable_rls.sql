-- Stage 1.1 / 1.2 (applied with `npx supabase db push`, see supabase/README.md)
-- Turns Row Level Security ON for every table and locks out the anon key.
--
-- Before this, RLS was disabled (legacy/schema.sql, legacy/disable-rls.sql) and tables were
-- granted to anon. The anon key ships to the browser, so anyone could read and
-- change every table without logging in.
--
-- After this:
--   anon           -> no access to any table or to case files
--   authenticated  -> full access (any logged-in DocFlow user)
--   service_role   -> full access, bypasses RLS (Telegram webhook, n8n callback)
--
-- BEFORE RUNNING:
--   1. Supabase -> Authentication -> Sign In / Providers: turn OFF
--      "Allow new users to sign up". Otherwise anyone can create an account
--      and become "authenticated".
--   2. Make sure SUPABASE_SERVICE_ROLE_KEY is set in Vercel. The Telegram and
--      n8n routes fall back to the anon key without it and would stop working.
--   3. Deploy the stage1-security branch at the same time — the old public
--      report page and public file links stop working once this runs.
--
-- Safe to run more than once. The tables are found automatically, so tables
-- created outside the SQL files (pics, email_logs, ...) are covered too.

do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename <> 'user_roles'   -- has its own read-only policy (20261023100100_user_roles.sql)
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

-- Sequences (if any table uses serial ids)
revoke all on all sequences in schema public from anon;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Tables created later must not be granted to anon automatically
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;


-- ─── Case files bucket: private, logged-in users only ────────────────────────
-- Insert so a fresh database (supabase db reset) gets the bucket too
insert into storage.buckets (id, name, public) values ('case-files', 'case-files', false)
on conflict (id) do update set public = false;

drop policy if exists "Logged-in users read case files"   on storage.objects;
drop policy if exists "Logged-in users upload case files" on storage.objects;
drop policy if exists "Logged-in users delete case files" on storage.objects;

create policy "Logged-in users read case files" on storage.objects
  for select to authenticated using (bucket_id = 'case-files');
create policy "Logged-in users upload case files" on storage.objects
  for insert to authenticated with check (bucket_id = 'case-files');
create policy "Logged-in users delete case files" on storage.objects
  for delete to authenticated using (bucket_id = 'case-files');


-- ─── Check: remaining storage policies open to anon / public ─────────────────
-- Any row returned here was set up earlier (e.g. when the bucket was created)
-- and still lets people without a login reach files. Drop it with:
--   drop policy "<policyname>" on storage.objects;
select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and (roles && array['anon', 'public']::name[]);
