-- Stage 4.1 / 4.2: Microsoft Graph change notifications for intake.
--
-- DocFlow asks Microsoft to notify it when a new email reaches operation@
-- (kind 'mail') and when a file is dropped into the SharePoint _Inbox folder
-- (kind 'sharepoint'). Each request ("subscription") expires after a few
-- days, so the daily job (/api/cron/daily) renews it; this table remembers
-- its id and expiry. For SharePoint it also keeps the "delta link" — Graph's
-- bookmark for "changes since last time".
--
-- Server-only: no access for the browser. Safe to run more than once.

create table if not exists graph_subscriptions (
  kind            text primary key check (kind in ('mail', 'sharepoint')),
  subscription_id text,
  resource        text not null default '',
  expires_at      timestamptz,
  delta_link      text,
  updated_at      timestamptz not null default now()
);

alter table graph_subscriptions enable row level security;
revoke all on graph_subscriptions from anon, authenticated;
grant select, insert, update, delete on graph_subscriptions to service_role;

-- Fast "was this email / SharePoint file already taken in?" checks
create index if not exists intake_items_message_idx    on intake_items ((source_meta->>'messageId'));
create index if not exists intake_items_drive_item_idx on intake_items ((source_meta->>'driveItemId'));
