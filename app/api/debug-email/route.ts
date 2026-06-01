import { NextResponse } from 'next/server'

export async function GET() {
  const tenantId = process.env.AZURE_TENANT_ID
  const clientId = process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_CLIENT_SECRET
  const senderEmail = process.env.SENDER_EMAIL

  const config = {
    AZURE_TENANT_ID: tenantId ? `${tenantId.slice(0, 8)}…` : 'MISSING',
    AZURE_CLIENT_ID: clientId ? `${clientId.slice(0, 8)}…` : 'MISSING',
    AZURE_CLIENT_SECRET: clientSecret ? `set (${clientSecret.length} chars)` : 'MISSING',
    SENDER_EMAIL: senderEmail ?? 'MISSING',
  }

  if (!tenantId || !clientId || !clientSecret || !senderEmail) {
    return NextResponse.json({ step: 'config', ok: false, config })
  }

  // Step 1 — get token
  let token: string
  try {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials',
          scope: 'https://graph.microsoft.com/.default',
        }),
      }
    )
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || !tokenData.access_token) {
      return NextResponse.json({ step: 'token', ok: false, config, error: tokenData })
    }
    token = tokenData.access_token
  } catch (err) {
    return NextResponse.json({ step: 'token', ok: false, config, error: String(err) })
  }

  // Step 2 — verify the sender mailbox exists in this tenant
  const userRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${senderEmail}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const userData = await userRes.json()
  if (!userRes.ok) {
    return NextResponse.json({
      step: 'user-lookup',
      ok: false,
      config,
      status: userRes.status,
      error: userData,
      hint: userRes.status === 404
        ? 'SENDER_EMAIL does not exist as a user in this Azure tenant'
        : userRes.status === 401
        ? 'Token was obtained but Graph still rejects — check if Mail.Send Application permission has admin consent'
        : 'Unexpected error looking up the sender mailbox',
    })
  }

  return NextResponse.json({
    step: 'all-ok',
    ok: true,
    config,
    user: { displayName: userData.displayName, mail: userData.mail, userPrincipalName: userData.userPrincipalName },
  })
}
