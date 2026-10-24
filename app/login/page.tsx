'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/utils/supabase/client'

// "Sign in with Microsoft" (fix list 4.5) shows once NEXT_PUBLIC_MICROSOFT_LOGIN
// is "true" — i.e. after the Azure provider is set up in Supabase.
const MICROSOFT_LOGIN = process.env.NEXT_PUBLIC_MICROSOFT_LOGIN === 'true'

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary on a prerendered page
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const { login } = useAuth()
  const router = useRouter()
  // Set by /auth/callback when Microsoft sign-in was refused
  const callbackError = useSearchParams().get('error')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const signInWithMicrosoft = async () => {
    setError('')
    setLoading(true)
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'azure',
      options: { scopes: 'email', redirectTo: `${window.location.origin}/auth/callback` },
    })
    // On success the browser is already on its way to Microsoft
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const errorMsg = await login(email, password)
    if (!errorMsg) {
      router.push('/dashboard')
    } else {
      setError('Incorrect email or password. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Bond Insurance CRM</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to continue</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
          <form onSubmit={submit} className="space-y-4">
            {(error || callbackError) && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-700">{error || `Microsoft sign-in failed: ${callbackError}. Ask an Admin to check you have a DocFlow account.`}</p>
              </div>
            )}
            <div>
              <label className="label">Email Address</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@trident.com"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center mt-2"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {MICROSOFT_LOGIN && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="h-px bg-gray-200 flex-1" />
                <span className="text-xs text-gray-400">or</span>
                <div className="h-px bg-gray-200 flex-1" />
              </div>
              <button
                type="button"
                onClick={signInWithMicrosoft}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <svg className="w-4 h-4" viewBox="0 0 21 21" aria-hidden="true">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
                Sign in with Microsoft
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          Trident · Internal Use Only
        </p>
      </div>
    </div>
  )
}
