-- Run this in Supabase SQL Editor (after migrate-enable-rls.sql)
-- Stores each user's role, replacing the old rule in lib/auth.tsx that made
-- anyone whose email starts with "admin" an Admin.
--
-- Users can read only their own row. Roles are changed here in the SQL Editor
-- (or Table Editor), never from the app, so nobody can promote themselves:
--
--   update user_roles set role = 'Admin', full_name = 'JC Fong'
--   where user_id = (select id from auth.users where email = 'jcfong@tridentmanagement.com.my');
--
-- A user with no row is treated as Staff.

create table if not exists user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null default '',
  role       text not null default 'Staff' check (role in ('Admin', 'Staff')),
  created_at timestamptz not null default now()
);

alter table user_roles enable row level security;
revoke all on user_roles from anon, authenticated;
grant select on user_roles to authenticated;
grant select, insert, update, delete on user_roles to service_role;

drop policy if exists "Users read own role" on user_roles;
create policy "Users read own role" on user_roles
  for select to authenticated using (user_id = auth.uid());

-- For future RLS policies, e.g. "only Admins may delete cases":
--   create policy ... using (public.is_admin())
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = 'Admin')
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Seed existing users, keeping today's behaviour (admin* emails stay Admin).
-- Fill in full_name afterwards — it is shown in the sidebar and activity logs.
insert into user_roles (user_id, role)
select id, case when lower(email) like 'admin%' then 'Admin' else 'Staff' end
from auth.users
on conflict (user_id) do nothing;

select u.email, r.role, r.full_name
from user_roles r join auth.users u on u.id = r.user_id
order by u.email;
