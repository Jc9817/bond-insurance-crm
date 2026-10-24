import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/lib/supabase-service'
import { requestIntakeClassification } from '@/lib/intake-ai'

// "Ask AI" on an Inbox item: (re)sends it to n8n to be read.

export async function POST(req: NextRequest) {
  const authSb = await createClient()
  const { data: { user } } = await authSb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { id } = await req.json()
  if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const sent = await requestIntakeClassification(serviceClient(), id)
  if (!sent) {
    return NextResponse.json(
      { error: 'The AI reader is not set up yet (N8N_INTAKE_WEBHOOK_URL), or the file is missing.' },
      { status: 503 },
    )
  }
  return NextResponse.json({ ok: true })
}
