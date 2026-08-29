import { NextRequest, NextResponse } from 'next/server'

// One-time endpoint to register the Telegram webhook.
// Protected by TELEGRAM_WEBHOOK_SECRET so only you can trigger it.
// The bot token never appears in any URL — it stays server-side in env vars.
//
// Usage (run once after deploy):
//   POST https://your-app.vercel.app/api/telegram/setup
//   Header: x-setup-key: <your TELEGRAM_WEBHOOK_SECRET>

export async function POST(req: NextRequest) {
  const setupKey = req.headers.get('x-setup-key')
  if (!setupKey || setupKey !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

  if (!token || !secret || !appUrl) {
    return NextResponse.json(
      { error: 'Missing env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, or NEXT_PUBLIC_APP_URL' },
      { status: 500 }
    )
  }

  const webhookUrl = `${appUrl}/api/telegram/webhook`

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message', 'callback_query'],
    }),
  })

  const data = await res.json()

  if (!data.ok) {
    return NextResponse.json({ error: 'Telegram rejected the webhook', detail: data }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    message: `Webhook registered to ${webhookUrl}`,
  })
}
