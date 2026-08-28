// ─── n8n Doc Flow webhook ───────────────────────────────────────────────────
// Shared by /api/notify-n8n (client-triggered case file uploads) and the
// Telegram webhook (server-to-server, called directly to skip an extra hop).

export async function notifyDocFlowWebhook(
  payload: Record<string, unknown>
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const webhookUrl = process.env.N8N_DOCFLOW_WEBHOOK_URL
  if (!webhookUrl) return { ok: false, error: 'N8N_DOCFLOW_WEBHOOK_URL not configured' }

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
