import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const {
      recipientEmail,
      ccEmails,         // string[] — optional CC addresses
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

    const smtpUser = process.env.EMAIL_SMTP_USER
    const smtpPass = process.env.EMAIL_SMTP_PASS
    const smtpHost = process.env.EMAIL_SMTP_HOST ?? 'smtp.gmail.com'
    const smtpPort = Number(process.env.EMAIL_SMTP_PORT ?? 587)

    if (!smtpUser || !smtpPass) {
      return NextResponse.json(
        { error: 'Email not configured — set EMAIL_SMTP_USER and EMAIL_SMTP_PASS in environment variables' },
        { status: 500 }
      )
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

    const subject = `Cover Note ${coverNotesStr} : Quotation of ${bondType} - ${projectName} - ${principalName} (CV RM${amountFormatted})`
    const bodyText = `Dear ${greeting},

Cover Note ${coverNotesStr} : Quotation of ${bondType} - ${projectName} - ${principalName} (CV RM${amountFormatted})

Thanks

Regards
${senderName ?? ''}`

    // Fetch document attachment if provided
    type Attachment = { filename: string; content: Buffer; contentType: string }
    const attachments: Attachment[] = []
    let attachmentWarning: string | null = null

    if (documentUrl) {
      try {
        const docRes = await fetch(documentUrl)
        if (docRes.ok) {
          const buffer = Buffer.from(await docRes.arrayBuffer())
          const rawName = decodeURIComponent(documentUrl.split('/').pop()?.split('?')[0] ?? 'document.pdf')
          const filename = rawName.replace(/^\d+_/, '')
          const contentType = filename.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'
          attachments.push({ filename, content: buffer, contentType })
        } else {
          attachmentWarning = `Document unavailable (HTTP ${docRes.status}) — email sent without attachment`
          console.warn('[send-quotation]', attachmentWarning)
        }
      } catch (err) {
        attachmentWarning = `Document fetch failed — email sent without attachment`
        console.warn('[send-quotation]', attachmentWarning, (err as Error).message)
      }
    }

    // Build CC list
    const ccList: string[] = Array.isArray(ccEmails) ? ccEmails.filter(Boolean) : []

    // Send via SMTP
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    })

    await transporter.sendMail({
      from: `Bond Insurance <${smtpUser}>`,
      to: recipientEmail,
      ...(ccList.length > 0 ? { cc: ccList.join(', ') } : {}),
      subject,
      text: bodyText,
      ...(attachments.length > 0 ? { attachments } : {}),
    })

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
    return NextResponse.json({ error: (err as Error).message ?? 'Internal server error' }, { status: 500 })
  }
}
