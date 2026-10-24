# Outstanding items from the DocFlow Fix and Build List

Items from earlier stages that are not finished yet. Tick them off here and
delete the section once done.

_Last updated: 24 Oct 2026_

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

## [ ] 2.3 Put the new file storage live, then move the old files

The `stage2-files` branch is pushed to GitHub but not merged into `master`, so
the live site doesn't have it yet.

1. On GitHub, open a pull request from `stage2-files` into `master` and merge it.
   Wait for Vercel to show **Ready**.
2. Only then, in the VS Code terminal, count the files still kept inside the database:
   ```
   node scripts/move-base64-files.mjs
   ```
3. If the numbers look sensible, move them:
   ```
   node scripts/move-base64-files.mjs --apply
   ```

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
