# Outstanding items from the DocFlow Fix and Build List

Items from earlier stages that are not finished yet. Tick them off here and
delete the section once done.

_Last updated: 24 Oct 2026_

---

## [ ] Putting the finished work live (do these in this order)

Every finished item since Stage 1 (2.3–2.6, 3.1–3.5, 4.1–4.3, 4.5, 5.1–5.3) is on the
branch **`stage4-microsoft`**. Each item was built on top of the one before,
so this one branch contains all of them.

1. **Database first.** In Supabase → SQL Editor, paste and run these files,
   one at a time, in this order:
   - `supabase/migrations/20261024100000_intake_items.sql` (the new Inbox
     table — the new code needs it, or Telegram uploads would fail)
   - `supabase/migrations/20261024110000_customer_ssm_key.sql` (one customer
     per SSM number). If it lists customers sharing a number, merge or
     correct them, then run it again until the list is empty.
   - `supabase/migrations/20261024120000_policies.sql` (policies — cases that
     have a bond expiry date get a first policy row automatically)
   - `supabase/migrations/20261025100000_graph_subscriptions.sql` (email and
     SharePoint intake bookkeeping)
2. **Push and merge.** In the VS Code terminal:
   ```
   git push -u origin stage4-microsoft
   ```
   Then on GitHub open a pull request from `stage4-microsoft` into `master` and
   merge it. Wait for Vercel to show **Ready**.
3. **Move old files out of the database.** In the VS Code terminal, first a
   dry run (only counts, changes nothing):
   ```
   node scripts/move-base64-files.mjs
   ```
   If the numbers look sensible:
   ```
   node scripts/move-base64-files.mjs --apply
   ```
4. Then work through the checks below.

---

## [ ] 1.3 Limit the Microsoft 365 app to operation@ only

**Why:** DocFlow sends email through an Azure app with the *application*
`Mail.Send` permission. As it stands, that permission lets the app send as
**any** mailbox in the Trident Management tenant, not just `operation@`. If the
app secret leaked, someone could send email as anyone in the company.

**Who:** whoever administers Microsoft 365 / Exchange Online. No code change.

**Steps:**

1. In the Microsoft 365 admin centre, create a **mail-enabled security group**,
   e.g. `DocFlow Senders` (`docflow-senders@tridentmanagement.com.my`), with
   one member: `operation@tridentmanagement.com.my`.
2. Open PowerShell and connect to Exchange Online:
   ```powershell
   Install-Module ExchangeOnlineManagement   # first time only
   Connect-ExchangeOnline
   ```
3. Restrict the app to that group. `<APP_ID>` is `MS_GRAPH_CLIENT_ID` from
   Vercel (Azure Portal → App registrations → Bond Insurance CRM →
   Application (client) ID):
   ```powershell
   New-ApplicationAccessPolicy -AppId <APP_ID> `
     -PolicyScopeGroupId docflow-senders@tridentmanagement.com.my `
     -AccessRight RestrictAccess `
     -Description "DocFlow may only send as operation@"
   ```
4. Check it (it can take up to an hour to take effect):
   ```powershell
   Test-ApplicationAccessPolicy -Identity jcfong@tridentmanagement.com.my -AppId <APP_ID>    # AccessCheckResult: Denied
   Test-ApplicationAccessPolicy -Identity operation@tridentmanagement.com.my -AppId <APP_ID> # AccessCheckResult: Granted
   ```
5. In Vercel, confirm `MS_GRAPH_SENDER_EMAIL` = `operation@tridentmanagement.com.my`.

Microsoft's newer replacement for this is "RBAC for Applications" in Exchange
Online. The policy above still works and is the simpler of the two.

**Done when:** a test send as `jcfong@` is refused and a send as `operation@` works.

---

## [ ] 2.2 Save the database baseline

**Why:** so the database can be rebuilt exactly from the repo (test copies,
disaster recovery). See [supabase/README.md](../supabase/README.md).

**Needs:** Docker Desktop installed and running.

**Steps:** "One-time setup" in `supabase/README.md`, steps 1–3 and 5
(`login`, `link`, `db dump`, `migration repair`). Skip `db push`: the
migrations up to `20261023100200_settings_tables.sql` were already run by hand
in the SQL Editor. After the dump, also mark them as applied:
```
npx supabase migration repair --status applied 20261023100000 20261023100100 20261023100200
```

**Done when:** `supabase/migrations/20261023000000_baseline.sql` is committed and
`npx supabase db reset` builds a local database the app runs on.

---

## [ ] Cross-check Stage 1 on the live app

Deployed 24 Oct 2026 (PR #1). Check once:

- [ ] Log in, open a case, open an existing file: it opens
- [ ] Upload a new file to a case and open it
- [ ] Settings → Insurers: add one, refresh, still there (and on another computer)
- [ ] Settings → Users: staff list shows; as Admin, "+ Add User" works
- [ ] A case report link in a private window goes to the login page
- [ ] An AI scan finishes and the extracted data appears on the case file (1.5)
- [ ] Telegram upload still lands in the Inbox

---

## [ ] 2.3 One way to store files — checks

Going live: see "Putting the finished work live" at the top.

Checks afterwards:
- [ ] Upload a quotation document, view it, download it
- [ ] Send a file to the Telegram bot, open it in the Inbox, assign it to a case
- [ ] Discard an Inbox file: it disappears
- [ ] AI scan on a quotation file works
- [ ] Old quotation and Telegram files (from before) still open

---

## [ ] 2.4 Faster loading — checks

Branch `stage2-load-per-page` (builds on `stage2-files`; merging it brings
both in). After it is live:

- [ ] Dashboard opens and shows "Recent activity" and the "needs attention" list
- [ ] Open a case: files, notes, emails and the Activity tab all appear
- [ ] Add a note and a follow-up inside a case: they stay after refresh
- [ ] Start an AI scan and stay on the case page: the result appears by itself
      within a few seconds of finishing (no refresh needed)
- [ ] Inbox: View a file, then Assign it to a case
- [ ] Case report page shows the AI-extracted details
- [ ] Cases list / board still show the "missing documents" counts

---

## [ ] 2.5 All email from operation@ — checks and tidy-up

Branch `stage2-email-graph` (builds on the 2.3 and 2.4 branches).

After it is live:
- [ ] Send a quotation email from a case (with a document attached) to your
      own address: it arrives from `operation@tridentmanagement.com.my`, the
      attachment opens, and the email is in operation@'s **Sent Items**
- [ ] Follow-ups page → "Send Reminders": the person in charge gets the email
      (they need an email address under Settings → Person in Charge)

Tidy-up once the checks pass — these settings are no longer used. Delete them
in Vercel (Settings → Environment Variables) and in `.env.local`:
`RESEND_API_KEY`, `EMAIL_PROVIDER`, `EMAIL_FROM`, `SENDGRID_API_KEY`,
`EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASS`.
You can also close the Resend account.

Note: with every email now going through the Microsoft 365 app, item 1.3
(limiting it to operation@ only) matters more.

---

## [ ] 2.6 One AI path — n8n settings

DocFlow no longer reads documents itself; all document reading runs in n8n.
In n8n, open the AI-scan workflow's Claude/Anthropic step and check which
model it uses. Current models: `claude-haiku-4-5` (cheapest, fine for simple
forms), `claude-sonnet-5` (better on messy scans), `claude-opus-5` (best, priced highest).
There is no "Haiku 5.5" yet, despite the example in the fix list.

Tidy-up: the `AI_MOCK` setting is no longer used (delete from `.env.local`).
Keep `ANTHROPIC_API_KEY`: it's for the email drafter planned in 5.3.

---

## [ ] 3.1 / 3.2 New Inbox and duplicate files — checks

- [ ] Documents that were waiting in the Inbox before are still there
- [ ] Send a file to the Telegram bot → "Add to Existing Case": it appears in
      the Inbox with "Telegram" and the sender's name
- [ ] Send the **same** file again: the bot replies that it was received
      before, and the Inbox still shows it only once
- [ ] Assign it to a case: it leaves the Inbox, appears on the case, and the
      case's Activity tab shows "Filed from Inbox" with your name
- [ ] Upload the same file twice on a case: DocFlow asks before adding it again

---

## [ ] 4.3 Bulk upload and zips — checks

- [ ] Inbox page: drag in several files at once — each appears as its own item
- [ ] Drag in one zip holding 15 documents — 15 items appear, the zip itself does not
- [ ] Drag in the same files again — they are reported as "already received" and not added twice

---

## [ ] 5.3 Every email recorded — checks

Nothing in DocFlow sends email on its own: quotations, customer emails, ops
notices and reminders all need someone to click Send.

- [ ] Send a quotation from a case: it shows in that case's email history
      (Emails tab), including when sending fails

---

## [ ] 3.4 One customer per SSM number — checks

- [ ] Add a customer with an SSM number that another customer already has
      (even written differently, e.g. with dashes): DocFlow refuses and names
      the existing customer
- [ ] Add a customer whose name matches an existing one (e.g. "ABC Sdn Bhd"
      vs "ABC SDN. BHD."): DocFlow asks before saving

---

## [ ] 3.3 / 3.5 AI suggestions in the Inbox — set up the n8n workflow, then check

The AI reading runs in n8n, so it needs one new n8n workflow. The full recipe
(what DocFlow sends, what n8n must send back) is in
[docs/n8n-intake-classify.md](n8n-intake-classify.md). Until it is set up,
Inbox items wait as "New" and are filed by hand as before.

1. Build the workflow in n8n as described there and activate it.
2. In Vercel → Settings → Environment Variables, add `N8N_INTAKE_WEBHOOK_URL`
   (the workflow's Production webhook URL) and redeploy.

Checks afterwards:
- [ ] Send a Letter of Award for an existing customer to the Telegram bot →
      "Add to Existing Case": in the Inbox it shows "AI reading…", then a
      suggested customer, case and document type
- [ ] Approve it: it lands on that case, in the right checklist slot
- [ ] A document for a company DocFlow doesn't know shows "Needs review",
      suggesting a new customer and case; approving creates them
- [ ] Upload 10 documents at once, "Select all", "Approve selected": all filed
- [ ] "Change…" lets you pick a different case and document type
- [ ] Each filing shows in the case's Activity tab with your name

---

## [ ] 5.1 Policies — checks

- [ ] Sidebar → Policies lists the policies copied from existing bond expiry
      dates (marked "check the type, number and insurer"). Fill those in.
- [ ] On a case's Policies tab, add a Performance Bond, a CAR and a TPL:
      they show as three separate rows
- [ ] "Renew" a policy: a new row starts the day after the old expiry and
      runs a year; the old one moves under "earlier (renewed) policies"
- [ ] Policies page filters "Expiring ≤ 30 days" etc. show the right ones

---

## [ ] 5.2 Daily renewal reminders — set up, then check

Every morning at 8am (Malaysia time), DocFlow checks for policies expiring
within 60 and 30 days, creates a renewal follow-up for each, and emails one
summary from operation@ to `OPS_NOTIFY_EMAIL`. Each policy is reminded once
at 60 days and once at 30 days. Active policies past their expiry date are
marked Expired.

Set up (Vercel → Settings → Environment Variables), then redeploy:
- `CRON_SECRET`: any long random text (Vercel uses it to call the job safely)
- `OPS_NOTIFY_EMAIL`: who receives the summary (already used for ops notices)

Checks:
- [ ] Vercel → Settings → Cron Jobs shows `/api/cron/daily` once a day
- [ ] Give a test policy an expiry date 30 days from today. Next morning (or
      use "Run" on the Cron Jobs page for `/api/cron/daily`): the summary email arrives, the
      policy has a "Renew …" follow-up, and running it again sends nothing new

---

## [ ] 4.6 WhatsApp documents — share the guide

The steps are written in plain words in
[docs/whatsapp-to-docflow.md](whatsapp-to-docflow.md). Print it or send it
to whoever handles WhatsApp documents.

---

## [ ] 5.4 Paid plans and a tested backup (before going live)

- [ ] Supabase → Billing: upgrade to **Pro** (daily backups, project never pauses)
- [ ] Vercel → Settings → Billing: upgrade to **Pro** (Hobby is for non-commercial use)
- [ ] Test a restore once: Supabase → Database → Backups → restore the latest
      backup into a **new** project (not the live one), log in to it, check a case opens

---

## [ ] 5.6 PDPA — decide how long data is kept

A draft note is in [docs/PDPA-note.md](PDPA-note.md). Fill in the
**TO DECIDE** periods (closed cases, lost cases, old user accounts) and the
two questions marked in italics. Once decided, the automatic archive and
delete rule can be built.

---

## [ ] 4.1 / 4.2 / 4.5 Email intake, SharePoint _Inbox, Sign in with Microsoft

Finished in DocFlow; they switch on once your Microsoft 365 administrator
follows [docs/microsoft-365-setup.md](microsoft-365-setup.md) (Azure
permissions, the SharePoint `_Inbox` folder, a few Vercel settings). The
checks are listed at the end of each part of that guide.

---

## [ ] Old `users` table in the database

The live database has a `public.users` table (`id, full_name, email, password,
role, status, created_at`) that no code uses. Real logins are in Supabase Auth
and `user_roles`. It may hold passwords.

**Steps:** look at it in Supabase → Table Editor → `users`. If it is unused
test data, delete it with a migration file (`drop table public.users;`) run
in the SQL Editor. It is already locked to logged-in users by the RLS change.

---

## [ ] Two insurer lists

Settings → Insurers (`settings_items`) and the older `insurers` table (with
email addresses, read by the quotation email panel) hold the same thing twice.
Merge them into one list with an optional email. Fits naturally with 2.5
(sending quotations through Graph).

---

## [ ] Set yourself as Admin (if not done)

```sql
update user_roles set role = 'Admin', full_name = 'JC Fong'
where email = 'jcfong@tridentmanagement.com.my';
```
