import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const {
      recipientEmail,
      ccEmails,
      recipientTitle,
      coverNotes,
      bondType,
      projectName,
      principalName,
      amount,
      senderName,
      documentUrl,
    } = await req.json()

    if (!recipientEmail || !bondType || !projectName || !principalName) {
      return NextResponse.json(
        { error: 'Missing required fields: recipientEmail, bondType, projectName, principalName' },
        { status: 400 }
      )
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Email not configured — set RESEND_API_KEY in environment variables' },
        { status: 500 }
      )
    }

    const from = process.env.EMAIL_FROM ?? 'Bond Insurance <onboarding@resend.dev>'
    const coverNotesStr = Array.isArray(coverNotes)
      ? coverNotes.filter(Boolean).join(', ')
      : (coverNotes ?? '')
    const amountFormatted = Number(amount || 0).toLocaleString('en-MY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const greeting = recipientTitle?.trim() || 'Sir/Madam'

    const subject = `Cover Note ${coverNotesStr} : Quotation of ${bondType} - ${projectName} - ${principalName} (CV RM${amountFormatted})`
    const bodyText = `Dear ${greeting},

Cover Note ${coverNotesStr} : Quotation of ${bondType} - ${projectName} - ${principalName} (CV RM${amountFormatted})

Thanks

Regards
${senderName ?? ''}`

    const ccList: string[] = Array.isArray(ccEmails) ? ccEmails.filter(Boolean) : []

    // Fetch document attachment if provided
    type Attachment = { filename: string; content: string }
    const attachments: Attachment[] = []
    let attachmentWarning: string | null = null

    if (documentUrl) {
      try {
        const docRes = await fetch(documentUrl)
        if (docRes.ok) {
          const buffer = Buffer.from(await docRes.arrayBuffer())
          const rawName = decodeURIComponent(documentUrl.split('/').pop()?.split('?')[0] ?? 'document.pdf')
          const filename = rawName.replace(/^\d+_/, '')
          attachments.push({ filename, content: buffer.toString('base64') })
        } else {
          attachmentWarning = `Document unavailable (HTTP ${docRes.status}) — email sent without attachment`
        }
      } catch {
        attachmentWarning = 'Document fetch failed — email sent without attachment'
      }
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from,
        to: [recipientEmail],
        ...(ccList.length > 0 ? { cc: ccList } : {}),
        subject,
        text: bodyText,
        ...(attachments.length > 0 ? { attachments } : {}),
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[send-quotation] Resend error:', res.status, err)
      return NextResponse.json({ error: `Email delivery failed: ${err}` }, { status: 502 })
    }

    // Log to Supabase (non-fatal)
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
    return NextResponse.json({ error: (err as Error).message ?? 'Internal server error' }, { status: 500 })
  }
}
