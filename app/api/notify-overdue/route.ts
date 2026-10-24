import { NextRequest, NextResponse } from 'next/server'
import { graphConfigured, sendGraphEmail } from '@/lib/msGraph'

// "Send Reminders" on the Follow-ups page: one email per person in charge
// listing their overdue follow-ups, sent through Microsoft Graph from operation@.

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
  if (!graphConfigured()) {
    return NextResponse.json({ error: 'Email not configured — set the MS_GRAPH_* environment variables' }, { status: 500 })
  }

  // Group by recipient
  const byRecipient = items.reduce<Record<string, OverdueItem[]>>((acc, item) => {
    if (!acc[item.recipientEmail]) acc[item.recipientEmail] = []
    acc[item.recipientEmail].push(item)
    return acc
  }, {})

  const results: { email: string; sent: boolean; error?: string }[] = []

  for (const [email, overdueItems] of Object.entries(byRecipient)) {
    const name = overdueItems[0].recipientName
    const lines = overdueItems.map(i =>
      `• ${i.title}\n  Case: ${i.caseTitle} | Customer: ${i.customerName} | Due: ${i.dueDate}`
    ).join('\n\n')

    const subject = `[DocFlow] ${overdueItems.length} overdue follow-up${overdueItems.length > 1 ? 's' : ''} require your attention`
    const body = `Hi ${name},\n\nYou have ${overdueItems.length} overdue follow-up${overdueItems.length > 1 ? 's' : ''} that need your attention:\n\n${lines}\n\nPlease log in to DocFlow to action these.\n\n— DocFlow`

    try {
      await sendGraphEmail({ to: email, subject, body })
      results.push({ email, sent: true })
    } catch (err) {
      console.error('[notify-overdue] send failed:', email, (err as Error).message)
      results.push({ email, sent: false, error: (err as Error).message })
    }
  }

  const failed = results.filter(r => !r.sent)
  return NextResponse.json(
    { success: failed.length === 0, results },
    { status: failed.length === results.length ? 502 : 200 },
  )
}
