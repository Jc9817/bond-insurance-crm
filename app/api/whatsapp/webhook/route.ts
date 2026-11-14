import { NextRequest, NextResponse, after } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { whatsappConfig } from '@/lib/whatsapp-config'
import { ANALYSE_DELAY_MS, parseEvent, quietLongEnough, verifySignature } from '@/lib/whatsapp-core'
import { analyseBundle, storeMessage } from '@/lib/whatsapp-intake'
import { claimEvent, finishEvent } from '@/lib/whatsapp-events'

// YCloud calls this for each WhatsApp event on the agency's number
// (docs/whatsapp-ycloud-setup.md). Called without a login, so it is excluded
// from the login check in proxy.ts; trusted only through the YCloud-Signature
// header (YCLOUD_WEBHOOK_SECRET).
//
// YCloud wants an answer within a few seconds and retries otherwise, so the
// event id is recorded (a repeat is answered 200 and dropped) and the reply
// goes out at once; the message is saved, its file downloaded and — once the
// customer has stopped sending for 2 minutes — read by the AI, afterwards.
//
// DocFlow never sends WhatsApp messages.

export const maxDuration = 300

const loggedTypes = new Set<string>()
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function POST(req: NextRequest) {
  const config = whatsappConfig()
  const raw = await req.text()   // the exact bytes: the signature is over them
  if (!config.webhookSecret || !verifySignature(req.headers.get('ycloud-signature'), raw, config.webhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const event = parseEvent(body, { businessNumber: config.businessNumber, withBusinessApp: config.syncBusinessApp })
  if (!event.id) return NextResponse.json({ error: 'Event id missing' }, { status: 400 })

  const sb = serviceClient()
  if (!(await claimEvent(sb, event.id, event.type))) return NextResponse.json({ ok: true, repeat: true })

  after(async () => {
    if (event.kind === 'ignore') {
      if (!loggedTypes.has(event.type)) {
        loggedTypes.add(event.type)
        console.log('[whatsapp] ignored event type:', event.type, '-', event.reason)
      }
      await finishEvent(sb, event.id, `ignored: ${event.reason}`)
      return
    }

    let bundleId: string | undefined
    try {
      const stored = await storeMessage(sb, event.id, event.message)
      bundleId = stored.bundleId
      const file = stored.hasFile ? ' with file' : ''
      await finishEvent(sb, event.id, stored.isNew ? `stored ${event.message.direction === 'in' ? 'incoming' : 'synced'} ${event.message.type}${file}` : 'already stored')
    } catch (err) {
      console.error('[whatsapp] event failed:', event.id, err instanceof Error ? err.message : err)
      await finishEvent(sb, event.id, `failed: ${err instanceof Error ? err.message : 'unknown error'}`)
      return
    }

    // The AI reads the bundle once nothing new has come for 2 minutes.
    // Each message waits; only the last one of a burst finds it quiet.
    if (!bundleId || event.message.direction !== 'in') return
    await wait(ANALYSE_DELAY_MS + 5000)
    const { data: bundle } = await sb.from('whatsapp_bundles').select('last_at, status').eq('id', bundleId).maybeSingle()
    if (bundle?.status === 'new' && quietLongEnough(bundle.last_at)) {
      await analyseBundle(sb, bundleId).catch(err =>
        console.error('[whatsapp] AI reading failed:', bundleId, err instanceof Error ? err.message : err))
    }
  })

  return NextResponse.json({ ok: true })
}
