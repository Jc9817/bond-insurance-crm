# DocFlow: personal data note (PDPA)

_25 Oct 2026. Keep periods decided. Three questions in italics below are
still open._

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
| WhatsApp | Messages customers send the agency's WhatsApp Business number: their phone number and WhatsApp name, texts, and the documents and photos they send (which can include IC copies and bank statements) | Customers send case documents this way; it is part of the record of the case |
| Users | Staff names, work emails, roles | To control who can log in and what they can do |

The most sensitive items are **IC copies, financial statements and bank
statements**.

## Where it is stored

- **Database and files:** Supabase (project `gdzdnrspukzlmgrjnlcs`). Files sit
  in a private storage area. They open only through short-lived links
  (about 5 minutes) given to logged-in staff.
- **Email:** sent from `operation@tridentmanagement.com.my` through
  Microsoft 365. Copies are kept in its Sent Items.
- **AI document reading:** documents are sent to Anthropic (Claude) to extract
  details (WhatsApp files only if `WHATSAPP_AI` is switched on; it is off). _Check that Anthropic's data retention settings are acceptable._
- **WhatsApp:** messages pass through YCloud (an official WhatsApp partner),
  which keeps media for 30 days. DocFlow copies documents and photos into the
  same private storage as case files (folder `whatsapp/`) as soon as they
  arrive. DocFlow only reads WhatsApp and never sends messages. IC copies and
  bank statements stay **files only**: DocFlow never copies IC, passport or
  bank account numbers into text fields, logs or AI summaries, and the AI is
  told not to write them anywhere. **Voice notes and videos are not stored**
  unless an Admin switches that on (`WHATSAPP_STORE_AUDIO_VIDEO`).

## Who can see it

- Only staff with a DocFlow login. Public sign-up is switched off, and
  accounts are created by an Admin (Settings → Users).
- Every logged-in user can currently see every customer and case.
  _Decide whether some staff should only see their own cases._
- Admins can add, deactivate and change users. Deactivated users cannot log in.
- Only Admins can delete a case for good, after confirming twice. The
  deletion and who did it stay on record in the activity history.
- No customer data is visible without logging in, including file links and
  the case report page.

## How long it is kept

| Data | Kept for | Then |
|---|---|---|
| Closed cases and their files | 7 years after the case's last policy expires (or after closing, if it had no policy) | Archived automatically; an Admin deletes them for good |
| Lost / cancelled cases that never went ahead | 2 years after closing | Archived automatically; an Admin deletes them for good |
| Open cases | As long as they are open | — |
| WhatsApp messages and files | Company records. Once filed to a case, the case's copy follows the case rules above | _The WhatsApp page's own copies (including messages never filed) are kept until an Admin removes them. Decide a keep period, e.g. 2 years_ |
| Deactivated user accounts | _Not decided — their names stay on case history; an Admin can remove the login in Supabase when no longer needed_ | — |

**How the rule runs:** every morning DocFlow archives cases whose keep
period has ended and emails a list to `OPS_NOTIFY_EMAIL`. Nothing is deleted
automatically. An Admin reviews the list in **Settings → Data Retention**
and clicks **Delete permanently**. That removes the case, its files (including
the SharePoint copies, which go to the SharePoint recycle bin for 93 days),
notes, emails, history and policies. A short record of each deletion (case
number, title, who deleted it) is kept in the activity log.

## Customer requests

If a customer asks to see, correct or delete their data, an Admin finds the
customer in DocFlow, and exports, corrects or deletes the customer, its cases
and files. Note the request and the date in the customer's notes.
