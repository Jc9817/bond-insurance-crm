// ─── Microsoft Graph email sender ──────────────────────────────────────────────
// Uses app-only auth (client credentials flow) so the CRM can send mail as a
// fixed mailbox without a signed-in user. Requires in .env.local:
//   MS_GRAPH_TENANT_ID, MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET, MS_GRAPH_SENDER_EMAIL
// The Azure app registration needs Application permission Mail.Send (admin-consented).

export async function getGraphToken(): Promise<string> {
  const tenantId = process.env.MS_GRAPH_TENANT_ID
  const clientId = process.env.MS_GRAPH_CLIENT_ID
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId ?? '',
      client_secret: clientSecret ?? '',
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Graph token request failed: ${err}`)
  }

  const data = await res.json()
  return data.access_token
}

export function graphConfigured(): boolean {
  return Boolean(
    process.env.MS_GRAPH_TENANT_ID &&
    process.env.MS_GRAPH_CLIENT_ID &&
    process.env.MS_GRAPH_CLIENT_SECRET &&
    process.env.MS_GRAPH_SENDER_EMAIL
  )
}

// ─── Sending ──────────────────────────────────────────────────────────────────
// All DocFlow email goes out through here, from MS_GRAPH_SENDER_EMAIL
// (operation@tridentmanagement.com.my), and lands in that mailbox's Sent Items.

export type GraphAttachment = { name: string; contentType: string; content: Buffer }

export type GraphEmail = {
  to: string | string[]
  cc?: string[]
  subject: string
  body: string                 // plain text
  attachments?: GraphAttachment[]
}

// Graph rejects a sendMail request over 4 MB; base64 adds a third, so keep
// inline attachments under 3 MB and upload anything bigger separately.
const INLINE_ATTACHMENT_LIMIT = 3 * 1024 * 1024
const UPLOAD_CHUNK = 320 * 1024 * 10   // Graph wants multiples of 320 KiB

const recipients = (list: string[]) => list.map(address => ({ emailAddress: { address } }))

const fileAttachment = (a: GraphAttachment) => ({
  '@odata.type': '#microsoft.graph.fileAttachment',
  name: a.name,
  contentType: a.contentType,
  contentBytes: a.content.toString('base64'),
})

async function graphFetch(token: string, url: string, body?: unknown): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Graph request failed (HTTP ${res.status})${err ? `: ${err}` : ' — empty response body'}`)
  }
  return res
}

export async function sendGraphEmail(params: GraphEmail): Promise<void> {
  const sender = process.env.MS_GRAPH_SENDER_EMAIL
  if (!graphConfigured() || !sender) {
    throw new Error('Microsoft Graph is not configured — set MS_GRAPH_TENANT_ID, MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET, MS_GRAPH_SENDER_EMAIL')
  }

  const token = await getGraphToken()
  const mailbox = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}`
  const attachments = params.attachments ?? []
  const message = {
    subject: params.subject,
    body: { contentType: 'Text', content: params.body },
    toRecipients: recipients(Array.isArray(params.to) ? params.to : [params.to]),
    ...(params.cc?.length ? { ccRecipients: recipients(params.cc) } : {}),
  }

  const totalSize = attachments.reduce((n, a) => n + a.content.length, 0)
  if (totalSize <= INLINE_ATTACHMENT_LIMIT) {
    await graphFetch(token, `${mailbox}/sendMail`, {
      message: { ...message, ...(attachments.length ? { attachments: attachments.map(fileAttachment) } : {}) },
      saveToSentItems: true,
    })
    return
  }

  // Large attachments: create a draft, attach each file, then send the draft
  // (sent drafts are kept in Sent Items).
  const draft = await (await graphFetch(token, `${mailbox}/messages`, message)).json()
  const draftUrl = `${mailbox}/messages/${draft.id}`
  for (const a of attachments) {
    if (a.content.length <= INLINE_ATTACHMENT_LIMIT) {
      await graphFetch(token, `${draftUrl}/attachments`, fileAttachment(a))
    } else {
      await uploadLargeAttachment(token, draftUrl, a)
    }
  }
  await graphFetch(token, `${draftUrl}/send`)
}

async function uploadLargeAttachment(token: string, draftUrl: string, a: GraphAttachment) {
  const session = await (await graphFetch(token, `${draftUrl}/attachments/createUploadSession`, {
    AttachmentItem: { attachmentType: 'file', name: a.name, size: a.content.length, contentType: a.contentType },
  })).json()

  // uploadUrl is pre-authorised — no Authorization header on these PUTs
  for (let start = 0; start < a.content.length; start += UPLOAD_CHUNK) {
    const chunk = a.content.subarray(start, Math.min(start + UPLOAD_CHUNK, a.content.length))
    const res = await fetch(session.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.length),
        'Content-Range': `bytes ${start}-${start + chunk.length - 1}/${a.content.length}`,
      },
      body: new Uint8Array(chunk),
    })
    if (!res.ok) throw new Error(`Attachment upload failed for ${a.name} (HTTP ${res.status}): ${await res.text()}`)
  }
}
