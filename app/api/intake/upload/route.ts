import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/lib/supabase-service'
import { INBOX_FOLDER, INBOX_UPLOAD_TYPES, fileExtension, isZipFile, storagePath } from '@/lib/storage'
import { readFile, removeFile } from '@/lib/storage-server'
import { createIntakeItem, sha256 } from '@/lib/intake'
import { addReceivedFile, emptyOutcome } from '@/lib/intake-files'

// Bulk upload on the Inbox page (fix list 4.3). The browser has already put
// each chosen file in the Inbox folder of storage (lib/upload.ts); this turns
// them into Inbox items. A zip is unpacked here: every supported file inside
// becomes its own item, and the zip itself is deleted.

export const maxDuration = 60

type UploadedFile = { ref: string; fileName: string; fileSize: number; fileHash?: string }

export async function POST(req: NextRequest) {
  const authSb = await createClient()
  const { data: { user } } = await authSb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  const { data: role } = await authSb.from('user_roles').select('full_name').eq('user_id', user.id).maybeSingle()
  const sender = role?.full_name || user.email || 'DocFlow user'

  const { files } = (await req.json()) as { files?: UploadedFile[] }
  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: 'No files' }, { status: 400 })
  }

  const sb = serviceClient()
  const outcome = emptyOutcome()

  for (const f of files) {
    // Only files the browser just put in the Inbox folder
    if (!storagePath(f.ref)?.startsWith(`${INBOX_FOLDER}/`)) {
      outcome.skipped.push(f.fileName)
      continue
    }
    try {
      if (isZipFile(f.fileName)) {
        await addReceivedFile(sb, { source: 'upload', sender, fileName: f.fileName, content: await readFile(f.ref) }, outcome)
        await removeFile(f.ref)
        continue
      }
      const type = INBOX_UPLOAD_TYPES[fileExtension(f.fileName)]
      if (!type) {
        outcome.skipped.push(f.fileName)
        await removeFile(f.ref)
        continue
      }
      // Already stored by the browser — just add it to the Inbox
      const { duplicate } = await createIntakeItem(sb, {
        source: 'upload', sender, fileName: f.fileName, fileSize: f.fileSize, fileType: type,
        fileRef: f.ref, fileHash: f.fileHash || sha256(await readFile(f.ref)),
      })
      ;(duplicate ? outcome.duplicates : outcome.added).push(f.fileName)
    } catch (err) {
      console.error('[intake/upload] failed:', f.fileName, err instanceof Error ? err.message : err)
      outcome.skipped.push(f.fileName)
    }
  }

  return NextResponse.json(outcome)
}
