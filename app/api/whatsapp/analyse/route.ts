import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { requireUser } from '@/lib/admin-auth'
import { analyseBundle, bundlesToAnalyse } from '@/lib/whatsapp-intake'

// WhatsApp screen: has the AI read one bundle ({ id }) — "Ask the AI again" —
// or ({ due: true }) the bundles that have been quiet for 2 minutes and hold
// a file but were not read yet (when the screen opens). Returns when done.

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const who = await requireUser()
  if (who instanceof NextResponse) return who
  const body = await req.json().catch(() => ({}))
  const sb = serviceClient()

  if (body.due === true) {
    const ids = await bundlesToAnalyse(sb, 5)
    for (const id of ids) await analyseBundle(sb, id)
    return NextResponse.json({ ok: true, analysed: ids.length })
  }
  if (typeof body.id !== 'string') return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Asked again: start from a clean reading
  await sb.from('whatsapp_bundles').update({ status: 'new', ai_suggestion: null, ai_error: null })
    .eq('id', body.id).eq('status', 'ready')
  await analyseBundle(sb, body.id)
  return NextResponse.json({ ok: true })
}
