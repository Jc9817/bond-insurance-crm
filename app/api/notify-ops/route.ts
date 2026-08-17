import { NextRequest, NextResponse } from 'next/server'
import { sendGraphEmail } from '@/lib/msGraph'

// ─── Internal "new case received" notification ────────────────────────────────
// Fixed template (no AI) sent to a single ops distribution address on manual
// trigger. Sends via Microsoft Graph from MS_GRAPH_SENDER_EMAIL (the real
// operations mailbox), not the Resend sandbox address. Recipient comes from
// OPS_NOTIFY_EMAIL, not the client.

export async function POST(req: NextRequest) {
  const { caseId, caseTitle, customerName, caseType, amount, personInCharge, currentStatus } = await req.json()

  if (!caseId || !caseTitle || !customerName) {
    return NextResponse.json({ error: 'Missing required fields: caseId, caseTitle, customerName' }, { status: 400 })
  }

  const to = process.env.OPS_NOTIFY_EMAIL
  if (!to) {
    return NextResponse.json({ error: 'OPS_NOTIFY_EMAIL not configured' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const amountFormatted = Number(amount || 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const subject = `New Case Received – ${caseTitle} (${customerName})`
  const body = `A new case has been logged in the CRM.

Case: ${caseTitle}
Customer: ${customerName}
Bond / Case Type: ${caseType || 'TBD'}
Amount: RM ${amountFormatted}
Person In Charge: ${personInCharge || 'Unassigned'}
Status: ${currentStatus || 'New'}
${appUrl ? `\nView case: ${appUrl}/cases/${caseId}` : ''}

This is an automated notification.`

  try {
    await sendGraphEmail({ to, subject, body })
    return NextResponse.json({ success: true, provider: 'graph', to, subject })
  } catch (err) {
    console.error('[notify-ops] failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
