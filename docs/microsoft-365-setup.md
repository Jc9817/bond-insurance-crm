# Microsoft 365 setup for DocFlow

For the Microsoft 365 / Azure administrator. DocFlow's code for these is
finished; it needs the permissions and settings below before it works.

| Part | What it does | Fix list |
|---|---|---|
| A–D | Emails to `operation@` and files dropped in SharePoint `_Inbox` appear in the DocFlow Inbox automatically | 4.1, 4.2 |
| E | Staff sign in to DocFlow with their Microsoft account | 4.5 |

Do **1.3** first (limit the app to `operation@`; see `docs/OUTSTANDING.md`).
The same restriction then also covers reading mail.

---

## A. Give the existing Azure app two more permissions

Azure Portal → **App registrations** → **Bond Insurance CRM** →
**API permissions** → **Add a permission** → **Microsoft Graph** →
**Application permissions**:

- `Mail.Read`: read the `operation@` mailbox. The 1.3 access policy limits
  it to that mailbox only.
- `Sites.Selected`: reach only the SharePoint sites it is explicitly given
  (step B), not the whole tenant.

Then click **Grant admin consent**.

## B. Give the app write access to the Operations site only

In PowerShell, with the PnP module (an administrator account):

```powershell
Install-Module PnP.PowerShell        # first time only
Connect-PnPOnline -Url https://<tenant>.sharepoint.com/sites/Operations -Interactive
Grant-PnPAzureADAppSitePermission -AppId <MS_GRAPH_CLIENT_ID> -DisplayName "DocFlow" `
  -Site https://<tenant>.sharepoint.com/sites/Operations -Permissions Write
```

Write access is needed because DocFlow moves each file it takes in from
`_Inbox` to `_Inbox/Processed`. Stage 4.4 will also save filed documents there.

## C. Create the `_Inbox` folder and find the library's id

1. In the Operations site, open the **Customers** document library and create
   a folder named `_Inbox` at the top level.
2. Open [Graph Explorer](https://developer.microsoft.com/graph/graph-explorer),
   sign in as an admin and run:
   ```
   GET https://graph.microsoft.com/v1.0/sites/<tenant>.sharepoint.com:/sites/Operations:/drives
   ```
   Copy the `id` of the drive whose `name` is **Customers**. This is
   `SHAREPOINT_DRIVE_ID`.

## D. Settings in Vercel

Vercel → the DocFlow project → **Settings → Environment Variables**:

| Name | Value |
|---|---|
| `MAIL_INTAKE_MAILBOX` | `operation@tridentmanagement.com.my` |
| `SHAREPOINT_DRIVE_ID` | the id from step C |
| `SHAREPOINT_INBOX_FOLDER` | `_Inbox` (only needed if the folder has another name) |
| `GRAPH_WEBHOOK_SECRET` | any long random text (e.g. from a password generator) |
| `NEXT_PUBLIC_APP_URL` | DocFlow's public address, e.g. `https://docflow.vercel.app` (likely already set) |
| `CRON_SECRET` | any long random text (likely already set for 5.2) |

**Redeploy**, then Vercel → **Settings → Cron Jobs** → `/api/cron/daily` →
**Run**. The result should say `mail: subscription created` and
`sharepoint: subscription created`. After that, the daily job keeps them
renewed by itself.

**Checks**
- [ ] Email `operation@` with three PDFs attached: three items appear in the
      DocFlow Inbox within a minute, marked "Email" with the sender's address
- [ ] Email a zip of 5 documents: 5 items appear
- [ ] Drag 20 files into SharePoint `Customers/_Inbox` in File Explorer: 20
      items appear in the Inbox, and the files move to `_Inbox/Processed`

## E. Sign in with Microsoft

1. Azure Portal → **App registrations** → **New registration**:
   - Name: `DocFlow Sign-in`
   - Supported account types: **Accounts in this organizational directory only**
   - Redirect URI (Web): `https://gdzdnrspukzlmgrjnlcs.supabase.co/auth/v1/callback`
2. In that new app: **Certificates & secrets** → **New client secret**. Copy
   the value. Also copy the **Application (client) ID** and **Directory
   (tenant) ID** from Overview.
3. Supabase → **Authentication → Sign In / Providers → Azure**: turn it on and
   enter the client ID and secret. For **Azure Tenant URL**, enter
   `https://login.microsoftonline.com/<Directory (tenant) ID>`. This keeps
   outside Microsoft accounts out.
4. Supabase → **Authentication → URL Configuration → Redirect URLs**: add
   `https://<DocFlow address>/auth/callback`.
5. Keep **Allow new users to sign up** switched **off**. Only people with a
   DocFlow account (Settings → Users) can sign in. Their Microsoft account
   joins their DocFlow account automatically when the email is the same.
6. Vercel: add `NEXT_PUBLIC_MICROSOFT_LOGIN` = `true` and redeploy. The
   **Sign in with Microsoft** button then appears on the login page.

**Checks**
- [ ] `jcfong@tridentmanagement.com.my` signs in with Microsoft and lands on
      the dashboard as themselves (same role as before)
- [ ] A Microsoft account from outside Trident Management cannot sign in
- [ ] A Trident staff member without a DocFlow account is refused, with a
      message to ask an Admin
