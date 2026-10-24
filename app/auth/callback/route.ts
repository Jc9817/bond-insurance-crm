import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Sign in with Microsoft (fix list 4.5): Microsoft sends the user back here
// through Supabase with a one-time code, which is swapped for a DocFlow
// session. Only people who already have a DocFlow account get in — public
// sign-up is switched off in Supabase, so an unknown Microsoft account is
// refused. Excluded from the login check in proxy.ts (the user isn't logged
// in yet when they arrive).

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}/dashboard`)
    console.error('[auth/callback] code exchange failed:', error.message)
  }

  // Refused by Microsoft or Supabase (e.g. no DocFlow account for this email)
  const reason = searchParams.get('error_description') ?? 'Microsoft sign-in did not complete.'
  const url = new URL('/login', origin)
  url.searchParams.set('error', reason)
  return NextResponse.redirect(url)
}
