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
    // Names only, never values
    const missing = ['MAIL_INTAKE_MAILBOX', 'MS_GRAPH_TENANT_ID', 'MS_GRAPH_CLIENT_ID', 'MS_GRAPH_CLIENT_SECRET', 'MS_GRAPH_SENDER_EMAIL']
      .filter(name => !process.env[name]?.trim())
    return NextResponse.json({
      error: `The mailbox is not connected yet. Missing in Vercel (Production): ${missing.join(', ') || 'none — redeploy to apply new settings'}.`,
    }, { status: 503 })
  }
  try {
    return NextResponse.json(await syncMailbox(serviceClient()))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not read the mailbox' }, { status: 502 })
  }
}
