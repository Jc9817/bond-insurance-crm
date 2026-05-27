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

function mapUser(supabaseUser: { email?: string } | null): AppUser | null {
  if (!supabaseUser?.email) return null
  const email = supabaseUser.email.toLowerCase()
  const isAdmin = email.startsWith('admin')
  return {
    email,
    fullName: isAdmin ? 'Admin' : 'Staff',
    role: isAdmin ? 'Admin' : 'Staff',
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(mapUser(session?.user ?? null))
      setReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(mapUser(session?.user ?? null))
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
