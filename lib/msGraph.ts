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

export async function sendGraphEmail(params: { to: string; subject: string; body: string }): Promise<void> {
  const sender = process.env.MS_GRAPH_SENDER_EMAIL
  if (!graphConfigured() || !sender) {
    throw new Error('Microsoft Graph is not configured — set MS_GRAPH_TENANT_ID, MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET, MS_GRAPH_SENDER_EMAIL')
  }

  const token = await getGraphToken()

  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      message: {
        subject: params.subject,
        body: { contentType: 'Text', content: params.body },
        toRecipients: [{ emailAddress: { address: params.to } }],
      },
      saveToSentItems: true,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Graph sendMail failed (HTTP ${res.status})${err ? `: ${err}` : ' — empty response body'}`)
  }
}
