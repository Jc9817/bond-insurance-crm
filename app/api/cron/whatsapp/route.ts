import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { cronAuthorized } from '@/lib/cron'
import { graphConfigured, sendGraphEmail } from '@/lib/msGraph'
import { missingWhatsappSettings } from '@/lib/whatsapp-config'
import { dailyWhatsapp } from '@/lib/whatsapp-intake'

// The WhatsApp daily job (vercel.json, after the main daily job). Protected
// by CRON_SECRET. It retries file downloads that failed (YCloud keeps files
// 30 days), has the AI read bundles it missed, and checks the YCloud webhook
// endpoint is still active — YCloud pauses one that keeps failing. If it
// isn't, or downloads failed, a short warning email goes to
// OPS_NOTIFY_EMAIL. Does nothing until the WhatsApp settings are in Vercel.

export const maxDuration = 300

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const missing = missingWhatsappSettings()
  if (missing.length) return NextResponse.json({ skipped: `Not set up: ${missing.join(', ')}` })

  const report = await dailyWhatsapp(serviceClient())

  const warnings = [
    !report.endpoint.ok && `The YCloud webhook is not working: ${report.endpoint.message}. New WhatsApp messages are not reaching DocFlow.`,
    report.failedDownloads7d > 0 && `${report.failedDownloads7d} WhatsApp file${report.failedDownloads7d === 1 ? '' : 's'} could not be downloaded in the last 7 days (see the WhatsApp screen).`,
  ].filter((w): w is string => !!w)
  const to = process.env.OPS_NOTIFY_EMAIL || process.env.MS_GRAPH_SENDER_EMAIL
  if (warnings.length && to && graphConfigured()) {
    try {
      await sendGraphEmail({
        to,
        subject: '[DocFlow] WhatsApp needs attention',
        body: `Good morning,\n\n${warnings.join('\n\n')}\n\nSetup steps: docs/whatsapp-ycloud-setup.md\n\n— DocFlow`,
      })
    } catch (err) {
      console.error('[whatsapp] warning email failed:', err instanceof Error ? err.message : err)
    }
  }
  return NextResponse.json({ ...report, warnings })
}
