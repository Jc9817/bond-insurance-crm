import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { IntakeSource } from './types'
import { generateId } from './utils'
import { removeFile } from './storage-server'

// Server-only. How a document enters the Unassigned Inbox (intake_items),
// whatever channel it came from — Telegram today; email, the SharePoint
// _Inbox folder and bulk upload in Stage 4. Callers pass a service-role client.
//
// Duplicate rule (fix list 3.2): a file whose SHA-256 matches one already in
// the Inbox (not discarded) or already filed to a case is recorded as a
// "duplicate" row — kept for the record, never shown or processed — and its
// newly stored copy is deleted.

export function sha256(bytes: ArrayBuffer | Buffer): string {
  return createHash('sha256').update(Buffer.from(bytes as ArrayBuffer)).digest('hex')
}

export type DuplicateMatch =
  | { kind: 'intake'; id: string; fileName: string }
  | { kind: 'case_file'; id: string; fileName: string; caseId: string }

/** The earlier copy of a file with this hash, if DocFlow already has one. */
export async function findDuplicate(sb: SupabaseClient, fileHash: string): Promise<DuplicateMatch | null> {
  const [{ data: intake }, { data: caseFile }] = await Promise.all([
    sb.from('intake_items').select('id, file_name')
      .eq('file_hash', fileHash).not('status', 'in', '(discarded,duplicate)')
      .order('received_at').limit(1).maybeSingle(),
    sb.from('case_files').select('id, file_name, case_id')
      .eq('file_hash', fileHash).order('uploaded_at').limit(1).maybeSingle(),
  ])
  if (caseFile) return { kind: 'case_file', id: caseFile.id, fileName: caseFile.file_name, caseId: caseFile.case_id }
  if (intake) return { kind: 'intake', id: intake.id, fileName: intake.file_name }
  return null
}

export type NewIntakeItem = {
  source: IntakeSource
  sender: string
  fileName: string
  fileSize: number
  fileType: string
  fileRef: string | null      // already saved with saveFile(); null when not stored
  fileHash: string            // '' if unknown (skips the duplicate check)
  sourceMeta?: Record<string, unknown>
}

/**
 * Adds a document to the Inbox, or records it as a duplicate (and deletes
 * the stored copy) when the same file was received before.
 */
export async function createIntakeItem(
  sb: SupabaseClient,
  item: NewIntakeItem,
): Promise<{ id: string; duplicate: DuplicateMatch | null }> {
  const duplicate = item.fileHash ? await findDuplicate(sb, item.fileHash) : null
  if (duplicate) await removeFile(item.fileRef)

  const id = generateId()
  const { error } = await sb.from('intake_items').insert({
    id,
    source: item.source,
    sender: item.sender,
    received_at: new Date().toISOString(),
    file_name: item.fileName,
    file_size: item.fileSize,
    file_type: item.fileType,
    file_ref: duplicate ? null : item.fileRef,
    file_hash: item.fileHash || null,
    status: duplicate ? 'duplicate' : 'received',
    duplicate_of: duplicate?.id ?? null,
    source_meta: item.sourceMeta ?? {},
  })
  if (error) throw new Error(`intake_items insert failed: ${error.message}`)
  return { id, duplicate }
}
