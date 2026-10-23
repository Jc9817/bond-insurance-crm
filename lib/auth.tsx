'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/utils/supabase/client'

type AppUser = {
  email: string
  fullName: string
  role: 'Admin' | 'Staff'
}

type AuthCtx = {
  currentUser: AppUser | null
  ready: boolean
  login: (email: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthCtx | null>(null)

// Role and display name come from the user_roles table (see
// supabase/migrate-add-user-roles.sql). A user with no row is treated as Staff.
async function mapUser(supabaseUser: { id: string; email?: string } | null): Promise<AppUser | null> {
  if (!supabaseUser?.email) return null
  const email = supabaseUser.email.toLowerCase()
  const { data } = await createClient()
    .from('user_roles')
    .select('role, full_name')
    .eq('user_id', supabaseUser.id)
    .maybeSingle()
  const role: AppUser['role'] = data?.role === 'Admin' ? 'Admin' : 'Staff'
  return {
    email,
    fullName: data?.full_name || role,
    role,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setCurrentUser(await mapUser(session?.user ?? null))
      setReady(true)
    })

    // Supabase warns against awaiting other Supabase calls inside this
    // callback, so the role lookup runs after it returns.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null
      setTimeout(() => { mapUser(user).then(setCurrentUser) }, 0)
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email: string, password: string): Promise<string | null> => {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ currentUser, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
