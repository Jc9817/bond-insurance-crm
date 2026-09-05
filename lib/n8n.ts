// ─── n8n webhooks ───────────────────────────────────────────────────────────
// Shared by /api/notify-n8n (client-triggered events) and the Telegram
// webhook (server-to-server, called directly to skip an extra hop).
// webhookUrl defaults to the DocFlow workflow; pass a different one (e.g.
// N8N_AI_SCAN_WEBHOOK_URL) to target a separate n8n workflow/webhook node.

export async function notifyDocFlowWebhook(
  payload: Record<string, unknown>,
  webhookUrl: string | undefined = process.env.N8N_DOCFLOW_WEBHOOK_URL
): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!webhookUrl) return { ok: false, error: 'n8n webhook URL not configured' }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('[n8n] docflow webhook returned', res.status, text)
      return { ok: false, status: res.status, error: text }
    }
    return { ok: true, status: res.status }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    console.error('[n8n] docflow webhook failed:', error)
    return { ok: false, error }
  }
}
