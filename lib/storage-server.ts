import { STORAGE_BUCKET, isStorageFile, isUploadFolder, newStoragePath, resolveFileUrl, storagePath, toStorageRef } from './storage'
import { serviceClient } from './supabase-service'

// Server-only. The one place DocFlow writes files: every upload — from the
// browser, the Telegram bot, or later e-mail / SharePoint intake — goes through
// here, and the database only ever keeps the returned reference
// ("storage:<path>"), never the file contents. Stage 4 swaps Supabase Storage
// for SharePoint behind these same functions.
//
// Uses the service-role key, so callers must check who is asking first.

function checkFolder(folder: string) {
  if (!isUploadFolder(folder)) throw new Error(`Invalid upload folder: ${folder}`)
}

/** Saves file bytes the server already holds (e.g. downloaded from Telegram). Returns the reference to store. */
export async function saveFile(
  folder: string,
  fileName: string,
  bytes: ArrayBuffer | Buffer,
  contentType: string,
): Promise<string> {
  checkFolder(folder)
  const path = newStoragePath(folder, fileName)
  const { error } = await serviceClient().storage.from(STORAGE_BUCKET)
    .upload(path, bytes, { contentType, upsert: false })
  if (error) throw error
  return toStorageRef(path)
}

/**
 * For browser uploads: a one-time signed upload URL, so the file goes straight
 * from the browser to storage without passing through (and being size-limited
 * by) a Vercel function. The browser calls uploadToSignedUrl(path, token, file)
 * and then stores `ref`.
 */
export async function createUploadTarget(folder: string, fileName: string): Promise<{ path: string; token: string; ref: string }> {
  checkFolder(folder)
  const path = newStoragePath(folder, fileName)
  const { data, error } = await serviceClient().storage.from(STORAGE_BUCKET).createSignedUploadUrl(path)
  if (error || !data) throw error ?? new Error('Could not create upload URL')
  return { path, token: data.token, ref: toStorageRef(path) }
}

/** Reads a stored file's bytes (e.g. to unpack an uploaded zip). */
export async function readFile(value: string): Promise<Buffer> {
  const path = storagePath(value)
  if (!path) throw new Error('Not a stored file')
  const { data, error } = await serviceClient().storage.from(STORAGE_BUCKET).download(path)
  if (error || !data) throw error ?? new Error('Could not read file')
  return Buffer.from(await data.arrayBuffer())
}

/** Deletes a stored file. Ignores values that aren't stored files. */
export async function removeFile(value?: string | null): Promise<void> {
  const path = storagePath(value)
  if (!path) return
  const { error } = await serviceClient().storage.from(STORAGE_BUCKET).remove([path])
  if (error) console.error('[Storage] remove failed:', path, error.message)
}

/** Signed URL for a Storage file (default 1 hour, so a queued n8n run can still fetch it); other values pass through. */
export async function signFileUrlForServer(value: string, expiresInSeconds = 3600): Promise<string> {
  if (!isStorageFile(value)) return value
  return resolveFileUrl(serviceClient(), value, expiresInSeconds)
}
