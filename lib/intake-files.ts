import JSZip from 'jszip'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { IntakeSource } from './types'
import { INBOX_FOLDER, INBOX_UPLOAD_TYPES, fileExtension, isZipFile } from './storage'
import { saveFile } from './storage-server'
import { createIntakeItem, sha256 } from './intake'

// Server-only. Turns a received file — or every document inside a received
// zip — into Inbox items. Shared by bulk upload (4.3), email intake (4.1) and
// the SharePoint _Inbox folder (4.2).

// Guards against oversized or malicious zips
const MAX_ZIP_ENTRIES = 300
const MAX_UNZIPPED_BYTES = 300 * 1024 * 1024

export type IntakeOutcome = { added: string[]; duplicates: string[]; skipped: string[] }

export const emptyOutcome = (): IntakeOutcome => ({ added: [], duplicates: [], skipped: [] })

type Received = {
  source: IntakeSource
  sender: string
  fileName: string
  content: Buffer
  sourceMeta?: Record<string, unknown>
}

/** The supported documents inside a zip (folders and Mac/Windows clutter left out). */
async function unzip(content: Buffer, zipName: string, outcome: IntakeOutcome) {
  const zip = await JSZip.loadAsync(content)
  const entries = Object.values(zip.files).filter(e => {
    const base = e.name.split('/').pop() ?? ''
    return !e.dir && !e.name.startsWith('__MACOSX/') && !base.startsWith('.') && base !== 'Thumbs.db'
  })
  if (entries.length > MAX_ZIP_ENTRIES) throw new Error(`zip has more than ${MAX_ZIP_ENTRIES} files`)

  const files: { fileName: string; pathInZip: string; content: Buffer }[] = []
  let total = 0
  for (const entry of entries) {
    const fileName = entry.name.split('/').pop()!
    if (!INBOX_UPLOAD_TYPES[fileExtension(fileName)]) {
      outcome.skipped.push(`${zipName} › ${fileName}`)
      continue
    }
    const bytes = await entry.async('nodebuffer')
    total += bytes.length
    if (total > MAX_UNZIPPED_BYTES) throw new Error('zip contents are too large')
    files.push({ fileName, pathInZip: entry.name, content: bytes })
  }
  return files
}

/**
 * Stores a received file (or each document in a received zip) and adds it to
 * the Inbox. Unsupported file types are skipped; files received before are
 * recorded as duplicates. Results are appended to `outcome`.
 */
export async function addReceivedFile(sb: SupabaseClient, f: Received, outcome: IntakeOutcome) {
  const parts = isZipFile(f.fileName)
    ? (await unzip(f.content, f.fileName, outcome)).map(p => ({
        fileName: p.fileName, content: p.content,
        sourceMeta: { ...f.sourceMeta, fromZip: f.fileName, pathInZip: p.pathInZip },
      }))
    : [{ fileName: f.fileName, content: f.content, sourceMeta: f.sourceMeta }]

  for (const part of parts) {
    const type = INBOX_UPLOAD_TYPES[fileExtension(part.fileName)]
    if (!type) {
      outcome.skipped.push(part.fileName)
      continue
    }
    const fileRef = await saveFile(INBOX_FOLDER, part.fileName, part.content, type)
    const { duplicate } = await createIntakeItem(sb, {
      source: f.source, sender: f.sender, fileName: part.fileName, fileSize: part.content.length,
      fileType: type, fileRef, fileHash: sha256(part.content), sourceMeta: part.sourceMeta,
    })
    ;(duplicate ? outcome.duplicates : outcome.added).push(part.fileName)
  }
}
