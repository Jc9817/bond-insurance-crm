# DocFlow: personal data note (PDPA)

_Draft, 24 Oct 2026. The retention periods marked **TO DECIDE** need a
decision by management before this note is final._

This note records what personal data DocFlow holds, why, who can see it, and
how long it is kept, as required by Malaysia's Personal Data Protection Act
2010 (PDPA).

## What personal data DocFlow holds

| Where in DocFlow | Personal data | Why we hold it |
|---|---|---|
| Customers | Company name, SSM number, main phone and email | To arrange bonds and insurance for the customer |
| Contacts | Names, job roles, phone numbers, emails of customer staff, directors, referrers | To contact the right person about a case |
| Case files | Documents customers send: IC copies, directors' and guarantors' financial statements, bank statements, SSM records, letters of award, signed indemnities | Insurers require them to issue bonds and policies |
| Policies | Policy and bond numbers, sums insured, premiums, dates | To track cover and remind customers before it expires |
| Emails, notes, follow-ups, history | Messages sent to customers and insurers; staff notes; who did what and when | Record of the work done on each case |
| Inbox | Documents waiting to be filed; the name of who sent them (e.g. the Telegram sender) | To file documents to the right case |
| Users | Staff names, work emails, roles | To control who can log in and what they can do |

The most sensitive items are **IC copies, financial statements and bank
statements**.

## Where it is stored

- **Database and files:** Supabase (project `gdzdnrspukzlmgrjnlcs`). Files sit
  in a private storage area. They open only through short-lived links
  (about 5 minutes) given to logged-in staff.
- **Email:** sent from `operation@tridentmanagement.com.my` through
  Microsoft 365. Copies are kept in its Sent Items.
- **AI document reading:** documents are sent to n8n and Anthropic (Claude) to
  extract details. _Check that n8n and Anthropic data retention settings are
  acceptable._
- **Telegram:** documents sent to the DocFlow bot also stay in that Telegram
  group.

## Who can see it

- Only staff with a DocFlow login. Public sign-up is switched off, and
  accounts are created by an Admin (Settings → Users).
- Every logged-in user can currently see every customer and case.
  _Decide whether some staff should only see their own cases._
- Admins can add, deactivate and change users. Deactivated users cannot log in.
- No customer data is visible without logging in, including file links and
  the case report page.

## How long it is kept

| Data | Kept for | Then |
|---|---|---|
| Closed cases (Done / archived) and their files | **TO DECIDE** — e.g. 7 years after the last policy expires (matching typical record-keeping for financial records) | Archive, then delete files |
| Discarded Inbox documents | File deleted immediately; a short record (name, sender, who discarded) kept | — |
| Duplicate Inbox documents | Not stored; a short record kept | — |
| Lost / cancelled cases that never went ahead | **TO DECIDE** — e.g. 2 years | Delete |
| Deactivated user accounts | **TO DECIDE** | Delete |

Once the periods above are decided, DocFlow can run the archive and delete
rule on a schedule (the second half of fix list 5.6).

## Customer requests

If a customer asks to see, correct or delete their data, an Admin finds the
customer in DocFlow, and exports, corrects or deletes the customer, its cases
and files. Note the request and the date in the customer's notes.
