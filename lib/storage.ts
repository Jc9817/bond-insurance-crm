import type { SupabaseClient } from '@supabase/supabase-js'

// Case files live in a PRIVATE Supabase Storage bucket. The database keeps a
// reference to the object ("storage:<path>"), never a URL anyone can open —
// a viewer asks for a short-lived signed URL when they actually open the file.
//
// Rows uploaded before the bucket went private still hold the old public URL
// (".../object/public/case-files/<path>"); storagePath() reads both forms so
// those files keep working without a data migration.

export const STORAGE_BUCKET = 'case-files'

const REF_PREFIX = 'storage:'
const PUBLIC_URL_MARKER = `/object/public/${STORAGE_BUCKET}/`

export function toStorageRef(path: string): string {
  return `${REF_PREFIX}${path}`
}

/** True for a file kept in Storage (new ref or legacy public URL), false for base64 data URLs. */
export function isStorageFile(value?: string | null): boolean {
  return storagePath(value) !== null
}

/** The object path inside the bucket, or null if the value isn't a Storage file. */
export function storagePath(value?: string | null): string | null {
  if (!value) return null
  if (value.startsWith(REF_PREFIX)) return value.slice(REF_PREFIX.length)
  const idx = value.indexOf(PUBLIC_URL_MARKER)
  if (idx !== -1) return decodeURIComponent(value.slice(idx + PUBLIC_URL_MARKER.length).split('?')[0])
  return null
}

/**
 * Signed URL for a Storage file, or the value unchanged for base64 data URLs.
 * Works with the logged-in browser client or the service-role server client.
 */
export async function resolveFileUrl(
  sb: SupabaseClient,
  value: string,
  expiresInSeconds = 300,
): Promise<string> {
  const path = storagePath(value)
  if (!path) return value
  const { data, error } = await sb.storage.from(STORAGE_BUCKET).createSignedUrl(path, expiresInSeconds)
  if (error || !data) throw error ?? new Error('Could not create signed URL')
  return data.signedUrl
}
