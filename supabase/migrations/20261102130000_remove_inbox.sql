-- The Unassigned Inbox is removed from DocFlow (2 Nov 2026). Staff upload
-- documents straight onto the case; emails are sorted on the Emails screen.
-- The SharePoint _Inbox folder intake (4.2) and the Inbox's n8n AI
-- suggestions (3.3 / 3.5) went with it.
--
-- Drops intake_items. At the time it held only 8 old Telegram test uploads
-- (brochure, invoice, IC, clinic PDF), none of them on a case. Their files
-- stay in Supabase Storage under case-files/inbox/ until deleted there.
-- Also forgets the SharePoint _Inbox subscription, if one was ever made.
-- Safe to run more than once.

drop table if exists intake_items;

delete from graph_subscriptions where kind = 'sharepoint';
