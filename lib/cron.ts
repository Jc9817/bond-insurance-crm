import type { NextRequest } from 'next/server'

// Scheduled jobs (/api/cron/*) are called by Vercel Cron without a login. Vercel
// sends "Authorization: Bearer <CRON_SECRET>"; anything else is refused.
export function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}
