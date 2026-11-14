# Connecting the WhatsApp Business number to DocFlow (YCloud)

_14 Nov 2026_

After these steps, every document or photo a customer sends the agency's
WhatsApp Business number also appears on DocFlow's **WhatsApp** page. Staff
open the files there and file them to a case. (An AI that suggests the case
can be switched on later; it is **off** to start with.)

- **Staff keep using WhatsApp on the phone as normal.** DocFlow only reads
  messages. It never sends any, and it has no reply box.
- **YCloud** is the service in between. It is an official WhatsApp partner,
  and its free plan is enough for this.
- Files are copied into DocFlow straight away. YCloud keeps them only 30 days.

> **Try it on a spare number first.** Connecting a number changes a few
> things on that phone (see "What changes on the phone" below). Do the whole
> setup with a spare WhatsApp Business number. Check that everything works,
> then repeat it with the real number.

---

## What changes on the phone

Connecting uses WhatsApp's **Coexistence** mode: the WhatsApp Business app
on the phone keeps working, and YCloud gets a copy of the messages.

- **Group chats** are not passed on. They stay on the phone only.
- **Broadcast lists** become read-only.
- **Disappearing messages** and **view-once** photos are switched off.
- The phone must open WhatsApp at least **once every 14 days**, or the link
  stops.
- Everything else (chats, calls, labels, the catalogue) works as before.

---

_Menu names in YCloud and Meta may differ slightly from those below; look
for the nearest match._

## Part 0. Meta Business account (if the company has no Facebook yet)

WhatsApp belongs to Meta, which needs a free **Meta Business account** for
the company. You don't need a Facebook Page or any posts.

1. Use a real person's **own Facebook login**: the owner's or a trusted
   staff member's. Don't create a fake or second account, because Meta locks
   those. The business account belongs to the company, not to the person.
   Customers never see the personal profile.
2. Go to **business.facebook.com → Create account**. Enter the company name
   as registered with SSM, your name and a work email, then confirm the email.
   (Or skip this and choose **Create new** when the Meta window in Part 1
   asks for a business account.)
3. Add a **second admin** under **Settings → People**, so the company never
   depends on one person's Facebook.
4. Turn on **two-step login** on the admins' Facebook accounts.
5. Keep the **SSM certificate** ready, in case Meta asks to verify the
   business.

## Part 1. YCloud account and the WhatsApp link (about 20 minutes)

You need: the phone with the WhatsApp Business app, and a Facebook login
that can manage the company's Meta (Facebook) Business account. Creating one
during the steps is fine.

1. Go to **ycloud.com** and sign up for a free account with a work email.
2. In YCloud, open **WhatsApp → Connect WhatsApp** (it may be called
   "Embedded sign-up").
3. A Meta window opens. Log in with Facebook and choose (or create) the
   company's Meta Business account.
4. When asked which number to use, choose **"Connect your existing WhatsApp
   Business app"**. Don't choose a new number.
5. Meta shows a **QR code**. On the phone, open **WhatsApp Business →
   Settings → Linked devices (or Account) → scan the code**, then follow the
   prompts. You can choose to share your chat history (up to 6 months).
6. Back in YCloud, the number shows as **Connected**.

## Part 2. API key

1. In YCloud, open **Developers → API keys** and create a key, for example
   "DocFlow".
2. Copy it. This is `YCLOUD_API_KEY`. Keep it private and don't email it.

## Part 3. Webhook (YCloud tells DocFlow about each new message)

1. In YCloud, open **Developers → Webhooks → Add endpoint**.
2. **URL:** `https://<your DocFlow address>/api/whatsapp/webhook`
   (the same address you use to open DocFlow, plus `/api/whatsapp/webhook`).
3. **Events:** tick `whatsapp.inbound_message.received`.
   Optional, only if you also want to see what staff send from the phone:
   `whatsapp.smb.message.echoes` and `whatsapp.smb.history`. These also
   need the `WHATSAPP_SYNC_BUSINESS_APP` setting below.
4. Save. YCloud shows the endpoint's **secret** (it starts with `whsec_`).
   Copy it. This is `YCLOUD_WEBHOOK_SECRET`.

## Part 4. Settings in Vercel

In Vercel → the DocFlow project → **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `YCLOUD_API_KEY` | the key from Part 2 |
| `YCLOUD_WEBHOOK_SECRET` | the `whsec_…` secret from Part 3 |
| `WHATSAPP_BUSINESS_NUMBER` | the connected number with country code, e.g. `+60123456789` |
| `WHATSAPP_STORE_AUDIO_VIDEO` | leave out, or `false`. `true` keeps voice notes and videos too |
| `WHATSAPP_SYNC_BUSINESS_APP` | leave out, or `false`. `true` shows what staff send from the phone |
| `WHATSAPP_AI` | leave out to start. `true` has the AI read each burst and suggest the case (see "AI (optional, off to start)" below) |

Then **redeploy** (Deployments → the latest → ⋯ → Redeploy).

`CRON_SECRET` and `OPS_NOTIFY_EMAIL` are already set for the Emails screen.
WhatsApp uses them too (and `ANTHROPIC_API_KEY`, only if the AI is switched on).

## Part 5. Check it works

1. Open DocFlow → **WhatsApp**. The yellow "not connected" note should be
   gone.
2. As an Admin, click **Test connection**. It should say
   **YCloud webhook: Active**.
3. From another phone, send the business number a PDF. Within a minute it
   appears on the WhatsApp page and opens when clicked.
4. The full list of checks is in [OUTSTANDING.md](OUTSTANDING.md) under
   "WhatsApp through YCloud".

---

## How it works day to day

- A text followed by photos or PDFs from the same number within 10 minutes
  shows as **one row**. Click it to see the chat and open the files.
- Choose **Create case**, **Add to existing case**, **Split across cases** or
  **Not a case**, and pick each file's document type.
- If a number isn't known, click **Link to customer / contact**. The next
  messages from that number then match by themselves.
- Filing puts the files on the case in the right checklist slot, with their
  SharePoint copy if that is set up. The case's Activity tab shows
  **"Filed from WhatsApp"** with the name of the person who filed it.
- Each morning DocFlow retries any file that failed to download. It also
  checks that YCloud's webhook is still active, because YCloud pauses one
  that keeps failing. If something is wrong, an email goes to
  `OPS_NOTIFY_EMAIL`.

## AI (optional, off to start)

With `WHATSAPP_AI` set to `true`, once the customer has stopped sending for 2
minutes the AI reads the burst and suggests the action, the case and each
file's document type. A person still decides. To switch it on later, add the
setting in Vercel and redeploy; nothing else changes.

The AI reading uses Claude Haiku 5.5, and Claude Sonnet 5.5 when Haiku is
unsure or a photo is hard to read. That should be roughly RM 0.01–0.30 per
burst of messages with files (an estimate: check the Anthropic bill after the
first month). That is cheaper than the Emails screen.

## If something goes wrong

- **Messages stop arriving:** click **Test connection**. If the webhook isn't
  active, open YCloud → Developers → Webhooks and switch the endpoint back on.
  Also check that the phone has opened WhatsApp in the last 14 days.
- **"Invalid signature" in the Vercel logs:** `YCLOUD_WEBHOOK_SECRET` doesn't
  match the endpoint's secret. Copy it again and redeploy.
- **To disconnect:** in YCloud, remove the webhook endpoint (DocFlow stops
  receiving). To unlink the number completely, unlink the device in WhatsApp
  Business on the phone.
