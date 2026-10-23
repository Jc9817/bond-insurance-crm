import { createClient } from '@supabase/supabase-js'
import { isStorageFile, resolveFileUrl } from './storage'

// Server-only: signs case-file URLs with the service-role key, for callers
// outside the app (n8n, the email sender) that have no user session.

function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Signed URL for a Storage file (default 1 hour, so a queued n8n run can still fetch it); other values pass through. */
export async function signFileUrlForServer(value: string, expiresInSeconds = 3600): Promise<string> {
  if (!isStorageFile(value)) return value
  return resolveFileUrl(serviceClient(), value, expiresInSeconds)
}
