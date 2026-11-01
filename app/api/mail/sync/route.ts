import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { requireUser } from '@/lib/admin-auth'
import { mailboxEnabled, syncMailbox } from '@/lib/mail-inbox'

// Emails screen → Refresh: brings in the shared mailbox's emails from the last
// 30 days that DocFlow hasn't seen yet (details only, no attachments).

export const maxDuration = 300

export async function POST() {
  const who = await requireUser()
  if (who instanceof NextResponse) return who
  if (!mailboxEnabled()) {
    return NextResponse.json({ error: 'The mailbox is not connected yet (MAIL_INTAKE_MAILBOX and the Microsoft settings).' }, { status: 503 })
  }
  try {
    return NextResponse.json(await syncMailbox(serviceClient()))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not read the mailbox' }, { status: 502 })
  }
}
