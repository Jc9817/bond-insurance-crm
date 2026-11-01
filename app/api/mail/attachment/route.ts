import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { requireUser } from '@/lib/admin-auth'
import { downloadAttachment } from '@/lib/mail-inbox'
import type { MailAttachment } from '@/lib/types'

// Emails screen: opens one attachment (?id=<email>&att=<attachment id>)
// straight from the mailbox, without filing it. Add &download=1 to save it.

export async function GET(req: NextRequest) {
  const who = await requireUser()
  if (who instanceof NextResponse) return who
  const id = req.nextUrl.searchParams.get('id') ?? ''
  const attId = req.nextUrl.searchParams.get('att') ?? ''

  const { data: row } = await serviceClient().from('mail_messages').select('graph_id, attachments').eq('id', id).maybeSingle()
  const att = ((row?.attachments ?? []) as MailAttachment[]).find(a => a.id === attId)
  if (!row || !att) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })

  try {
    const content = await downloadAttachment(row.graph_id, att.id)
    const disposition = req.nextUrl.searchParams.get('download') ? 'attachment' : 'inline'
    return new NextResponse(new Uint8Array(content), {
      headers: {
        'Content-Type': att.contentType,
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(att.name)}`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not fetch the attachment' }, { status: 502 })
  }
}
