import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/lib/supabase-service'
import { deleteSharePointCopy, sharePointStorageEnabled, syncCaseFile } from '@/lib/sharepoint-files'

// Keeps the SharePoint copy of a case file up to date (fix list 4.4). The
// browser calls this after adding, retagging or deleting a case file:
//   { caseFileId }                  upload, or move/rename after a change
//   { action: 'delete', itemId }    move the SharePoint copy to the recycle bin
// The work happens after the response; the daily job retries anything missed.

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const authSb = await createClient()
  const { data: { user } } = await authSb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  if (!sharePointStorageEnabled()) return NextResponse.json({ skipped: 'SharePoint not set up' })

  const body = await req.json().catch(() => ({}))
  if (body.action === 'delete' && typeof body.itemId === 'string') {
    after(() => deleteSharePointCopy(body.itemId)
      .catch(err => console.error('[sharepoint] delete failed:', err instanceof Error ? err.message : err)))
    return NextResponse.json({ ok: true })
  }
  if (typeof body.caseFileId === 'string') {
    after(() => syncCaseFile(serviceClient(), body.caseFileId)
      .catch(err => console.error('[sharepoint] sync failed:', body.caseFileId, err instanceof Error ? err.message : err)))
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'caseFileId or { action: "delete", itemId } required' }, { status: 400 })
}
