-- Run this in Supabase SQL Editor
-- Adds a manually-editable status on each case tracking whether the Letter
-- of Award's AI extraction has been run — 'Manual' covers staff doing the
-- extraction by hand instead of via AI.

alter table cases add column if not exists loa_ai_status text not null default 'Pending';
