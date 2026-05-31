import { NextRequest, NextResponse } from 'next/server'

type OverdueItem = {
  title: string
  caseTitle: string
  customerName: string
  personInCharge: string
  dueDate: string
  recipientEmail: string
  recipientName: string
}

export async function POST(req: NextRequest) {
  const { items }: { items: OverdueItem[] } = await req.json()

  if (!items?.length) {
    return NextResponse.json({ error: 'No items provided' }, { status: 400 })
  }

  const from = process.env.EMAIL_FROM ?? 'Bond Insurance <noreply@bondinsurance.com>'
  const provider = process.env.EMAIL_PROVIDER

  // Group by recipient
  const byRecipient = items.reduce<Record<string, OverdueItem[]>>((acc, item) => {
    if (!acc[item.recipientEmail]) acc[item.recipientEmail] = []
    acc[item.recipientEmail].push(item)
    return acc
  }, {})

  const results: { email: string; sent: boolean }[] = []

  for (const [email, overdueItems] of Object.entries(byRecipient)) {
    const name = overdueItems[0].recipientName
    const lines = overdueItems.map(i =>
      `• ${i.title}\n  Case: ${i.caseTitle} | Customer: ${i.customerName} | Due: ${i.dueDate}`
    ).join('\n\n')

    const subject = `[Bond Insurance] ${overdueItems.length} overdue follow-up${overdueItems.length > 1 ? 's' : ''} require your attention`
    const body = `Hi ${name},\n\nYou have ${overdueItems.length} overdue follow-up${overdueItems.length > 1 ? 's' : ''} that need your attention:\n\n${lines}\n\nPlease log in to the CRM to action these.\n\n— Bond Insurance CRM`

    if (!provider) {
      console.log(`[notify-overdue] Would send to ${email}:\n  Subject: ${subject}\n  Items: ${overdueItems.length}`)
      results.push({ email, sent: true })
      continue
    }

    if (provider === 'resend') {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({ from, to: [email], subject, text: body }),
      })
      results.push({ email, sent: res.ok })
    } else if (provider === 'sendgrid') {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SENDGRID_API_KEY}` },
        body: JSON.stringify({ personalizations: [{ to: [{ email }] }], from: { email: from }, subject, content: [{ type: 'text/plain', value: body }] }),
      })
      results.push({ email, sent: res.ok })
    } else {
      results.push({ email, sent: false })
    }
  }

  return NextResponse.json({ success: true, results })
}
