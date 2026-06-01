import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── Microsoft Graph token ────────────────────────────────────────────────────

async function getMsGraphToken(): Promise<string> {
  const tenantId = process.env.AZURE_TENANT_ID
  const clientId = process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing Azure credentials — set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET')
  }

  const res = await fetch(
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

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token request failed (${res.status}): ${err}`)
  }

  const data = await res.json()
  if (!data.access_token) throw new Error('No access_token in Microsoft response')
  return data.access_token as string
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const {
      recipientEmail,
      recipientTitle,
      coverNotes,       // string | string[]
      bondType,
      projectName,
      principalName,
      amount,
      senderName,
      documentUrl,      // Supabase storage URL of the document to attach
    } = await req.json()

    if (!recipientEmail || !bondType || !projectName || !principalName) {
      return NextResponse.json(
        { error: 'Missing required fields: recipientEmail, bondType, projectName, principalName' },
        { status: 400 }
      )
    }

    const senderEmail = process.env.SENDER_EMAIL
    if (!senderEmail) {
      return NextResponse.json({ error: 'SENDER_EMAIL not configured in environment' }, { status: 500 })
    }

    // Get access token
    let token: string
    try {
      token = await getMsGraphToken()
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 })
    }

    // Format cover notes and amount
    const coverNotesStr = Array.isArray(coverNotes)
      ? coverNotes.filter(Boolean).join(', ')
      : (coverNotes ?? '')
    const amountFormatted = Number(amount || 0).toLocaleString('en-MY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const greeting = recipientTitle?.trim() || 'Sir/Madam'

    // Fixed email template
    const subject = `Cover Note ${coverNotesStr} : Quotation of ${bondType} - ${projectName} - ${principalName} (CV RM${amountFormatted})`
    const bodyText = `Dear ${greeting},

Cover Note ${coverNotesStr} : Quotation of ${bondType} - ${projectName} - ${principalName} (CV RM${amountFormatted})

Thanks

Regards
${senderName ?? ''}`

    // Fetch and attach document from Supabase Storage
    interface GraphAttachment {
      '@odata.type': string
      name: string
      contentType: string
      contentBytes: string
    }
    const attachments: GraphAttachment[] = []
    let attachmentWarning: string | null = null

    if (documentUrl) {
      try {
        const docRes = await fetch(documentUrl)
        if (docRes.ok) {
          const buffer = await docRes.arrayBuffer()
          const base64Content = Buffer.from(buffer).toString('base64')
          // Strip timestamp prefix from filename (e.g. "1748234567890_LOA.pdf" → "LOA.pdf")
          const rawName = decodeURIComponent(documentUrl.split('/').pop()?.split('?')[0] ?? 'document.pdf')
          const fileName = rawName.replace(/^\d+_/, '')
          const contentType = fileName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'
          attachments.push({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: fileName,
            contentType,
            contentBytes: base64Content,
          })
        } else {
          attachmentWarning = `Document unavailable (HTTP ${docRes.status}) — email sent without attachment`
          console.warn('[send-quotation]', attachmentWarning)
        }
      } catch (err) {
        attachmentWarning = `Document fetch failed — email sent without attachment`
        console.warn('[send-quotation]', attachmentWarning, (err as Error).message)
      }
    }

    // Build Microsoft Graph message
    const message = {
      subject,
      body: { contentType: 'Text', content: bodyText },
      toRecipients: [{ emailAddress: { address: recipientEmail } }],
      ...(attachments.length > 0 ? { attachments } : {}),
    }

    // Send via Microsoft Graph
    const graphRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, saveToSentItems: true }),
      }
    )

    if (!graphRes.ok) {
      const errText = await graphRes.text()
      console.error('[send-quotation] Graph API error:', graphRes.status, errText)
      return NextResponse.json(
        { error: `Microsoft Graph rejected the request (${graphRes.status}): ${errText}` },
        { status: 502 }
      )
    }

    // Log sent email to Supabase (non-fatal if it fails)
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      await sb.from('email_logs').insert({
        recipient: recipientEmail,
        subject,
        principal: principalName,
        bond_type: bondType,
        amount: Number(amount) || 0,
        sent_at: new Date().toISOString(),
        status: 'sent',
      })
    } catch (logErr) {
      console.warn('[send-quotation] Email log insert failed:', (logErr as Error).message)
    }

    return NextResponse.json({
      success: true,
      subject,
      ...(attachmentWarning ? { warning: attachmentWarning } : {}),
    })

  } catch (err) {
    console.error('[send-quotation] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
