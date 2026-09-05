import { NextRequest, NextResponse } from 'next/server'
import { notifyDocFlowWebhook } from '@/lib/n8n'

// ─── n8n Doc Flow webhook ───────────────────────────────────────────────────
// Forwards a "document uploaded" event to the n8n workflow configured in
// N8N_DOCFLOW_WEBHOOK_URL. Kept server-side so the webhook URL never ships to
// the browser and so we don't depend on n8n's CORS config.

export async function POST(req: NextRequest) {
  const body = await req.json()
  // AI scan requests go to their own dedicated n8n webhook, separate from
  // the shared DocFlow one used for upload/case-creation events.
  const webhookUrl = body.event === 'ai_scan_requested'
    ? process.env.N8N_AI_SCAN_WEBHOOK_URL
    : process.env.N8N_DOCFLOW_WEBHOOK_URL
  const result = await notifyDocFlowWebhook(body, webhookUrl)

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'n8n webhook failed' }, { status: result.status ?? 500 })
  }
  return NextResponse.json({ success: true })
}
