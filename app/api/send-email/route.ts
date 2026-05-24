import { NextRequest, NextResponse } from 'next/server'

// ─── Email provider config ────────────────────────────────────────────────────
// Supported providers (set EMAIL_PROVIDER in .env.local):
//   "smtp"     — standard SMTP (requires EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, EMAIL_SMTP_PASS)
//   "resend"   — Resend.com (requires RESEND_API_KEY)
//   "sendgrid" — SendGrid (requires SENDGRID_API_KEY)
//
// Also set EMAIL_FROM to the sender address (e.g. "Bond Insurance <info@bondinsurance.com>")

export async function POST(req: NextRequest) {
  const { quotationId, emailTo, emailSubject, emailBody } = await req.json()

  if (!emailTo || !emailSubject || !emailBody) {
    return NextResponse.json({ error: 'Missing required fields: emailTo, emailSubject, emailBody' }, { status: 400 })
  }

  const provider = process.env.EMAIL_PROVIDER
  const from = process.env.EMAIL_FROM ?? 'Bond Insurance <noreply@bondinsurance.com>'

  if (!provider) {
    // No provider configured — log and return success so the UI still marks as sent during development
    console.log('[send-email] No EMAIL_PROVIDER configured. Would have sent:')
    console.log('  To:', emailTo)
    console.log('  Subject:', emailSubject)
    console.log('  Body preview:', emailBody.slice(0, 200))
    return NextResponse.json({ success: true, provider: 'mock', quotationId })
  }

  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to: [emailTo], subject: emailSubject, text: emailBody }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[send-email] Resend error:', err)
      return NextResponse.json({ error: 'Email delivery failed' }, { status: 502 })
    }
    return NextResponse.json({ success: true, provider: 'resend', quotationId })
  }

  if (provider === 'sendgrid') {
    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'SENDGRID_API_KEY not configured' }, { status: 500 })

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: emailTo }] }],
        from: { email: from },
        subject: emailSubject,
        content: [{ type: 'text/plain', value: emailBody }],
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[send-email] SendGrid error:', err)
      return NextResponse.json({ error: 'Email delivery failed' }, { status: 502 })
    }
    return NextResponse.json({ success: true, provider: 'sendgrid', quotationId })
  }

  if (provider === 'smtp') {
    // SMTP requires nodemailer — install with: npm install nodemailer @types/nodemailer
    // Uncomment when ready:
    //
    // const nodemailer = await import('nodemailer')
    // const transporter = nodemailer.createTransport({
    //   host: process.env.EMAIL_SMTP_HOST,
    //   port: Number(process.env.EMAIL_SMTP_PORT ?? 587),
    //   secure: process.env.EMAIL_SMTP_PORT === '465',
    //   auth: { user: process.env.EMAIL_SMTP_USER, pass: process.env.EMAIL_SMTP_PASS },
    // })
    // await transporter.sendMail({ from, to: emailTo, subject: emailSubject, text: emailBody })
    // return NextResponse.json({ success: true, provider: 'smtp', quotationId })

    return NextResponse.json({ error: 'SMTP provider not yet wired — uncomment the nodemailer block in route.ts' }, { status: 501 })
  }

  return NextResponse.json({ error: `Unknown EMAIL_PROVIDER: ${provider}` }, { status: 500 })
}
