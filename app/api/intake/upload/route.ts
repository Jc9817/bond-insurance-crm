import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/lib/supabase-service'
import { INBOX_FOLDER, INBOX_UPLOAD_TYPES, fileExtension, isZipFile, storagePath } from '@/lib/storage'
import { readFile, removeFile, saveFile } from '@/lib/storage-server'
import { createIntakeItem, sha256 } from '@/lib/intake'

// Bulk upload on the Inbox page (fix list 4.3). The browser has already put
// each chosen file in the Inbox folder of storage (lib/upload.ts); this turns
// them into Inbox items. A zip is unpacked here: every supported file inside
// becomes its own item, and the zip itself is deleted.

export const maxDuration = 60

// Guards against oversized or malicious zips
const MAX_ZIP_ENTRIES = 300
const MAX_UNZIPPED_BYTES = 300 * 1024 * 1024

type UploadedFile = { ref: string; fileName: string; fileSize: number; fileHash?: string }

type Outcome = { added: string[]; duplicates: string[]; skipped: string[] }

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
  const outcome: Outcome = { added: [], duplicates: [], skipped: [] }

  for (const f of files) {
    // Only files the browser just put in the Inbox folder
    if (!storagePath(f.ref)?.startsWith(`${INBOX_FOLDER}/`)) {
      outcome.skipped.push(f.fileName)
      continue
    }
    try {
      if (isZipFile(f.fileName)) {
        await addZip(sb, f, sender, outcome)
        await removeFile(f.ref)
      } else {
        const type = INBOX_UPLOAD_TYPES[fileExtension(f.fileName)]
        if (!type) {
          outcome.skipped.push(f.fileName)
          await removeFile(f.ref)
          continue
        }
        const fileHash = f.fileHash || sha256(await readFile(f.ref))
        const { duplicate } = await createIntakeItem(sb, {
          source: 'upload', sender, fileName: f.fileName, fileSize: f.fileSize, fileType: type,
          fileRef: f.ref, fileHash,
        })
        ;(duplicate ? outcome.duplicates : outcome.added).push(f.fileName)
      }
    } catch (err) {
      console.error('[intake/upload] failed:', f.fileName, err instanceof Error ? err.message : err)
      outcome.skipped.push(f.fileName)
    }
  }

  return NextResponse.json(outcome)
}

async function addZip(sb: ReturnType<typeof serviceClient>, f: UploadedFile, sender: string, outcome: Outcome) {
  const zip = await JSZip.loadAsync(await readFile(f.ref))
  const entries = Object.values(zip.files).filter(e => {
    const base = e.name.split('/').pop() ?? ''
    // Skip folders and Mac/Windows clutter (__MACOSX/, .DS_Store, Thumbs.db)
    return !e.dir && !e.name.startsWith('__MACOSX/') && !base.startsWith('.') && base !== 'Thumbs.db'
  })
  if (entries.length > MAX_ZIP_ENTRIES) throw new Error(`zip has more than ${MAX_ZIP_ENTRIES} files`)

  let unzippedBytes = 0
  for (const entry of entries) {
    const fileName = entry.name.split('/').pop()!
    const type = INBOX_UPLOAD_TYPES[fileExtension(fileName)]
    if (!type) {
      outcome.skipped.push(`${f.fileName} › ${fileName}`)
      continue
    }
    const content = await entry.async('nodebuffer')
    unzippedBytes += content.length
    if (unzippedBytes > MAX_UNZIPPED_BYTES) throw new Error('zip contents are too large')

    const fileRef = await saveFile(INBOX_FOLDER, fileName, content, type)
    const { duplicate } = await createIntakeItem(sb, {
      source: 'upload', sender, fileName, fileSize: content.length, fileType: type,
      fileRef, fileHash: sha256(content),
      sourceMeta: { fromZip: f.fileName, pathInZip: entry.name },
    })
    ;(duplicate ? outcome.duplicates : outcome.added).push(fileName)
  }
}
