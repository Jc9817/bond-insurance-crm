import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'

// ─── Settings → Users (Admins only) ─────────────────────────────────────────
// DocFlow users are Supabase Auth accounts; their name, role and status live
// in user_roles (supabase/migrations/20261023100200_settings_tables.sql). The browser can
// only read user_roles, so creating and changing users goes through here with
// the service-role key, after checking that the caller is an Admin.
//
// Inactive users are banned in Supabase Auth, so they can't sign in.

const ROLES = ['Admin', 'Staff']
const STATUSES = ['Active', 'Inactive']
const BAN_FOREVER = '876000h' // ~100 years

function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Returns the caller's user id if they are an Admin, else an error response. */
async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  const { data: isAdmin } = await sb.rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Only Admins can manage users' }, { status: 403 })
  return { userId: user.id }
}

// Create a user: { fullName, email, password, role }
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { fullName, email, password, role } = await req.json()
  const cleanEmail = String(email ?? '').trim().toLowerCase()
  if (!String(fullName ?? '').trim() || !cleanEmail) {
    return NextResponse.json({ error: 'Full name and email are required' }, { status: 400 })
  }
  if (String(password ?? '').length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: `Role must be one of ${ROLES.join(', ')}` }, { status: 400 })
  }

  try {
    const sb = serviceClient()
    const { data, error } = await sb.auth.admin.createUser({
      email: cleanEmail, password, email_confirm: true,
    })
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message ?? 'Could not create user' }, { status: 400 })
    }
    const row = {
      user_id: data.user.id, email: cleanEmail, full_name: String(fullName).trim(),
      role, status: 'Active',
    }
    const { error: roleErr } = await sb.from('user_roles').upsert(row)
    if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 })
    return NextResponse.json({ user: { ...row, created_at: data.user.created_at } })
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Could not create user'
    return NextResponse.json({ error }, { status: 500 })
  }
}

// Change a user: { id, fullName?, role?, status?, password? }
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { id, fullName, role, status, password } = await req.json()
  if (!id) return NextResponse.json({ error: 'User id is required' }, { status: 400 })
  if (role !== undefined && !ROLES.includes(role)) {
    return NextResponse.json({ error: `Role must be one of ${ROLES.join(', ')}` }, { status: 400 })
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return NextResponse.json({ error: `Status must be one of ${STATUSES.join(', ')}` }, { status: 400 })
  }
  if (password !== undefined && password !== '' && String(password).length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  // An Admin locking themselves out would leave nobody able to undo it.
  if (id === admin.userId && (status === 'Inactive' || role === 'Staff')) {
    return NextResponse.json({ error: 'You cannot deactivate or demote your own account' }, { status: 400 })
  }

  try {
    const sb = serviceClient()

    const authUpdate: { password?: string; ban_duration?: string } = {}
    if (password) authUpdate.password = password
    if (status !== undefined) authUpdate.ban_duration = status === 'Inactive' ? BAN_FOREVER : 'none'
    if (Object.keys(authUpdate).length > 0) {
      const { error } = await sb.auth.admin.updateUserById(id, authUpdate)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const upd: Record<string, string> = {}
    if (fullName !== undefined) upd.full_name = String(fullName).trim()
    if (role !== undefined) upd.role = role
    if (status !== undefined) upd.status = status
    if (Object.keys(upd).length > 0) {
      const { error } = await sb.from('user_roles').update(upd).eq('user_id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Could not update user'
    return NextResponse.json({ error }, { status: 500 })
  }
}
