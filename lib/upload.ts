'use client'

import { createClient } from '@/utils/supabase/client'
import { STORAGE_BUCKET } from './storage'

/**
 * Uploads a file chosen in the browser and returns the reference to save on
 * the row ("storage:<path>"). The server decides where it goes
 * (/api/files/upload-url); the bytes go straight to storage.
 *
 * folder: caseFolder(caseId) or INBOX_FOLDER from lib/storage.
 */
export async function uploadFile(file: File, folder: string): Promise<string> {
  const res = await fetch('/api/files/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder, fileName: file.name }),
  })
  const target = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(target.error ?? `Upload failed (${res.status})`)

  const { error } = await createClient().storage.from(STORAGE_BUCKET)
    .uploadToSignedUrl(target.path, target.token, file, { contentType: file.type || undefined })
  if (error) throw error
  return target.ref as string
}
