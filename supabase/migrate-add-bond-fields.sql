-- Run this in Supabase SQL Editor if your cases table already exists
alter table cases add column if not exists bond_expiry_date date;
alter table cases add column if not exists waiting_for text;
alter table cases add column if not exists archived_at timestamptz;
alter table cases add column if not exists acceptance_date date;
alter table cases add column if not exists accepted_by text;
alter table cases add column if not exists bond_principal text;
