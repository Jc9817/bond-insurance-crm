import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { requireUser } from '@/lib/admin-auth'
import { analyseMessage } from '@/lib/mail-inbox'

// Emails screen: has the AI read one email ({ id }) and stores its suggestion.
// Returns when done; the screen then reloads the email.

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const who = await requireUser()
  if (who instanceof NextResponse) return who
  const { id } = await req.json().catch(() => ({}))
  if (typeof id !== 'string') return NextResponse.json({ error: 'id required' }, { status: 400 })
  await analyseMessage(serviceClient(), id)
  return NextResponse.json({ ok: true })
}
