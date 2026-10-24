import { createClient } from '@supabase/supabase-js'

// Server-only. A Supabase client with the service-role key: bypasses Row
// Level Security, so callers must check who is asking before using it.

export function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
