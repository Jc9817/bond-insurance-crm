import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { requireUser } from '@/lib/admin-auth'
import { signFileUrlForServer } from '@/lib/storage-server'
import type { WaMedia } from '@/lib/whatsapp-types'

// WhatsApp screen: opens one stored file (?m=<message id>&i=<index>) through
// a 5-minute signed link to the private storage copy.

export async function GET(req: NextRequest) {
  const who = await requireUser()
  if (who instanceof NextResponse) return who
  const id = req.nextUrl.searchParams.get('m') ?? ''
  const index = Number(req.nextUrl.searchParams.get('i') ?? -1)

  const { data: row } = await serviceClient().from('whatsapp_messages').select('media').eq('id', id).maybeSingle()
  const item = ((row?.media ?? []) as WaMedia[])[index]
  if (!item?.storage_ref || item.download_status !== 'stored') {
    return NextResponse.json({ error: 'File not stored' }, { status: 404 })
  }
  try {
    return NextResponse.redirect(await signFileUrlForServer(item.storage_ref, 300))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not open the file' }, { status: 502 })
  }
}
