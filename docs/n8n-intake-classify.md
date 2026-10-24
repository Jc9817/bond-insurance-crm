# n8n workflow: read new Inbox documents

DocFlow asks this workflow to read each new document in the Unassigned Inbox
and say what it is and whose it is. DocFlow then matches the customer and case
itself and shows the suggestion for one-click approval (fix list 3.3 / 3.5).

It is a separate workflow from the existing "AI scan" one, which reads
documents already filed on a case.

## Setup

1. In n8n, create a workflow that starts with a **Webhook** node (POST).
   Activate it and copy its **Production** URL.
2. In Vercel → Settings → Environment Variables, add
   `N8N_INTAKE_WEBHOOK_URL` = that URL, then redeploy.
3. The workflow posts its answer back with the same `x-callback-secret` header
   value as the AI-scan workflow (`N8N_CALLBACK_SECRET`).

Until `N8N_INTAKE_WEBHOOK_URL` is set, Inbox items simply wait as "New" and
are filed by hand.

## What DocFlow sends (webhook input)

```json
{
  "event": "intake_classify_requested",
  "intakeItemId": "6f1c…",
  "fileName": "LOA Jalan Kampung Baru.pdf",
  "fileType": "application/pdf",
  "fileUrl": "https://…supabase.co/storage/v1/object/sign/…",
  "source": "telegram",
  "sender": "Telegram: Ahmad",
  "documentTypes": ["Bank Statement", "Letter of Award (LOA)", "SSM Complete Set", "…"],
  "callbackUrl": "https://<docflow-domain>/api/intake/callback"
}
```

- `fileUrl` works for 1 hour. Download the file from it (HTTP Request node,
  response format: File).
- `documentTypes` is the list to choose from: the Required Documents names in
  DocFlow's Settings → Workflow Templates. Answer with one of these names
  exactly, or leave `documentType` empty if none fits.

## What the workflow does

Send the file to Claude (Anthropic node, or HTTP Request to the Messages API)
and ask for JSON with:

| Field | Meaning |
|---|---|
| `documentType` | One name from `documentTypes`, exactly as written |
| `customerName` | The company the document is about (the contractor / insured), e.g. "Bina Perkasa Sdn Bhd" |
| `ssmNumber` | That company's SSM registration number, as printed (any format) |
| `projectName` | The project or contract title, as printed |
| `confidence` | 0 to 1: how sure the reading is overall |
| `extracted` | Anything else useful (amounts, dates, reference numbers) as an object |

Suggested model: `claude-sonnet-5` (reads messy scans well). `claude-haiku-4-5`
is cheaper for clean PDFs.

## What the workflow sends back

POST to `callbackUrl` with header `x-callback-secret: <N8N_CALLBACK_SECRET>`
and JSON body:

```json
{
  "intakeItemId": "6f1c…",
  "documentType": "Letter of Award (LOA)",
  "customerName": "Bina Perkasa Sdn Bhd",
  "ssmNumber": "201901012345 (1234567-A)",
  "projectName": "Cadangan Membina Jalan Kampung Baru, Kuantan",
  "confidence": 0.92,
  "extracted": { "contractSum": "RM 1,250,000.00", "loaDate": "2026-10-01" }
}
```

If reading failed, send `{ "intakeItemId": "…", "error": "short reason" }`.
The item then goes to "Needs review" with that reason shown.

## What DocFlow does with the answer

- **Customer:** matched by SSM number first, then by name. An unknown
  company is suggested as a new customer, with a new case.
- **Case:** the customer's open case whose title best matches `projectName`,
  or its only open case.
- **Status:** "Suggested" (one-click approve) when `confidence` ≥ 0.80 and
  an existing customer, case and document type were all found. Otherwise
  "Needs review", with a note saying what is missing.
- Nothing is created or filed until a person approves.
