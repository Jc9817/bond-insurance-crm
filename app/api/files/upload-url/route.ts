import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createUploadTarget } from '@/lib/storage-server'

// Browser uploads start here: returns a one-time signed upload URL for
// { folder, fileName }. See lib/storage-server.ts and lib/upload.ts.

export async function POST(req: NextRequest) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { folder, fileName } = await req.json()
  if (typeof folder !== 'string' || typeof fileName !== 'string' || !fileName.trim()) {
    return NextResponse.json({ error: 'folder and fileName are required' }, { status: 400 })
  }

  try {
    return NextResponse.json(await createUploadTarget(folder, fileName))
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Could not create upload URL'
    return NextResponse.json({ error }, { status: 400 })
  }
}
