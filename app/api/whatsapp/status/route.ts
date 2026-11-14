import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { requireAdmin, requireUser } from '@/lib/admin-auth'
import { missingWhatsappSettings } from '@/lib/whatsapp-config'
import { checkWebhookEndpoint, whatsappHealth } from '@/lib/whatsapp-intake'

// WhatsApp screen: which settings are missing, and how the connection is
// doing (last event, failed downloads in 7 days, unknown numbers).
// ?test=1 (Admins only) adds the last 5 events' types and results — never
// message content — and asks YCloud whether the webhook endpoint is active.

export async function GET(req: NextRequest) {
  const test = req.nextUrl.searchParams.get('test') === '1'
  const who = test ? await requireAdmin() : await requireUser()
  if (who instanceof NextResponse) return who

  const missing = missingWhatsappSettings()
  const health = await whatsappHealth(serviceClient())
  if (!test) {
    return NextResponse.json({
      missing, lastEventAt: health.lastEventAt, failedDownloads7d: health.failedDownloads7d, unmatchedNumbers: health.unmatchedNumbers,
    })
  }
  return NextResponse.json({ missing, ...health, endpoint: await checkWebhookEndpoint() })
}
