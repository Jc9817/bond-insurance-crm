import { NextRequest, NextResponse } from 'next/server'
import { sendGraphEmail } from '@/lib/msGraph'

export async function POST(req: NextRequest) {
  const { emailTo, emailSubject, emailBody } = await req.json()

  if (!emailTo || !emailSubject || !emailBody) {
    return NextResponse.json({ error: 'Missing required fields: emailTo, emailSubject, emailBody' }, { status: 400 })
  }

  try {
    await sendGraphEmail({ to: emailTo, subject: emailSubject, body: emailBody })
    return NextResponse.json({ success: true, provider: 'graph' })
  } catch (err) {
    console.error('[send-graph-email] failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
