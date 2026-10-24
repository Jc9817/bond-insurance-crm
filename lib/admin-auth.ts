import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Server-only. For Admin-only routes: the caller's user id and name if they
// are an Admin (user_roles + is_admin()), otherwise the error response to return.
export async function requireAdmin(): Promise<{ userId: string; name: string } | NextResponse> {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  const { data: isAdmin } = await sb.rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Only Admins can do this' }, { status: 403 })
  const { data: role } = await sb.from('user_roles').select('full_name').eq('user_id', user.id).maybeSingle()
  return { userId: user.id, name: role?.full_name || user.email || 'Admin' }
}
