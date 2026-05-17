'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User } from './types'
import { mockUsers } from './mock-data'

type AuthCtx = {
  currentUser: User | null
  ready: boolean
  login: (email: string, password: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthCtx | null>(null)

const SESSION_KEY = 'crm_session_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY)
    if (saved) {
      const user = mockUsers.find(u => u.id === saved && u.status === 'Active')
      if (user) setCurrentUser(user)
    }
    setReady(true)
  }, [])

  const login = (email: string, password: string): boolean => {
    const user = mockUsers.find(
      u =>
        u.email.toLowerCase() === email.toLowerCase() &&
        u.password === password &&
        u.status === 'Active'
    )
    if (user) {
      setCurrentUser(user)
      localStorage.setItem(SESSION_KEY, user.id)
      return true
    }
    return false
  }

  const logout = () => {
    setCurrentUser(null)
    localStorage.removeItem(SESSION_KEY)
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
