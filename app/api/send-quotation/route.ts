import { NextRequest, NextResponse } from 'next/server'
import { signFileUrlForServer } from '@/lib/storage-server'
import { originalFileName } from '@/lib/storage'
import { graphConfigured, sendGraphEmail, type GraphAttachment } from '@/lib/msGraph'
import { serviceClient } from '@/lib/supabase-service'
import { generateId } from '@/lib/utils'

// Sends a quotation email (with the case's document attached) through
// Microsoft Graph from operation@, so it comes from the company's own domain
// and is kept in that mailbox's Sent Items. Every attempt, sent or failed, is
// recorded in the case's email history (case_emails, fix list 5.3).

async function logCaseEmail(row: {
  caseId?: string; toEmail: string; subject: string; body: string
  status: 'sent' | 'failed'; errorMessage?: string
}) {
  if (!row.caseId) return
  const { error } = await serviceClient().from('case_emails').insert({
    id: generateId(),
    case_id: row.caseId,
    template_name: 'Quotation',
    to_email: row.toEmail,
    subject: row.subject,
    body: row.body,
    status: row.status,
    error_message: row.errorMessage ?? null,
    sent_at: new Date().toISOString(),
  })
  if (error) console.warn('[send-quotation] case_emails insert failed:', error.message)
}

export async function POST(req: NextRequest) {
  try {
    const {
      caseId,
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

    if (!graphConfigured()) {
      return NextResponse.json(
        { error: 'Email not configured — set the MS_GRAPH_* environment variables' },
        { status: 500 }
      )
    }

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
    const attachments: GraphAttachment[] = []
    let attachmentWarning: string | null = null

    if (documentUrl) {
      try {
        // Private bucket: fetch through a short-lived signed URL
        const docRes = await fetch(await signFileUrlForServer(documentUrl, 60))
        if (docRes.ok) {
          const content = Buffer.from(await docRes.arrayBuffer())
          const name = originalFileName(documentUrl)
          const contentType = docRes.headers.get('content-type') ?? 'application/octet-stream'
          attachments.push({ name, contentType, content })
        } else {
          attachmentWarning = `Document unavailable (HTTP ${docRes.status}) — email sent without attachment`
        }
      } catch {
        attachmentWarning = 'Document fetch failed — email sent without attachment'
      }
    }

    const toEmail = [recipientEmail, ...ccList.map(c => `cc: ${c}`)].join(', ')
    try {
      await sendGraphEmail({ to: recipientEmail, cc: ccList, subject, body: bodyText, attachments })
    } catch (err) {
      console.error('[send-quotation] Graph error:', (err as Error).message)
      await logCaseEmail({ caseId, toEmail, subject, body: bodyText, status: 'failed', errorMessage: (err as Error).message })
      return NextResponse.json({ error: `Email delivery failed: ${(err as Error).message}` }, { status: 502 })
    }
    await logCaseEmail({ caseId, toEmail, subject, body: bodyText, status: 'sent' })

    // Log to Supabase (non-fatal)
    try {
      const sb = serviceClient()
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
