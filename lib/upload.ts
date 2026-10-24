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
/** SHA-256 of a file, hex — the same fingerprint the server uses (lib/intake.ts). */
export async function fileSha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

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
