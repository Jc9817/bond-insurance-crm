'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { currentUser, ready } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const isLoginPage = pathname === '/login'
  const isReportPage = pathname.endsWith('/report')

  useEffect(() => {
    if (!ready) return
    if (!currentUser && !isLoginPage) {
      router.replace('/login')
    } else if (currentUser && isLoginPage) {
      router.replace('/dashboard')
    }
  }, [currentUser, ready, isLoginPage, router])

  // Show nothing while checking session
  if (!ready) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Login page: full-width, no sidebar
  if (isLoginPage) {
    return <>{children}</>
  }

  // Not authenticated yet: show nothing while redirect happens
  if (!currentUser) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Report pages: full-width, no sidebar (clean for printing)
  if (isReportPage) {
    return <div className="flex-1 overflow-y-auto bg-white">{children}</div>
  }

  // Authenticated: sidebar + content
  return (
    <>
      <Sidebar />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </>
  )
}
