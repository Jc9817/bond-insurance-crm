import { NextRequest, NextResponse } from 'next/server'
import { notifyDocFlowWebhook } from '@/lib/n8n'

// ─── n8n Doc Flow webhook ───────────────────────────────────────────────────
// Forwards a "document uploaded" event to the n8n workflow configured in
// N8N_DOCFLOW_WEBHOOK_URL. Kept server-side so the webhook URL never ships to
// the browser and so we don't depend on n8n's CORS config.

export async function POST(req: NextRequest) {
  const body = await req.json()
  const result = await notifyDocFlowWebhook(body)

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'n8n webhook failed' }, { status: result.status ?? 500 })
  }
  return NextResponse.json({ success: true })
}
