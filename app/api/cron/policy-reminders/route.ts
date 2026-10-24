import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { runPolicyReminders } from '@/lib/policy-reminders'
import { cronAuthorized } from '@/lib/cron'

// Runs the policy expiry reminders by hand (they also run in the daily job,
// /api/cron/daily). ?dryRun=1 shows what would happen without changing or
// sending anything. Protected by CRON_SECRET ("Authorization: Bearer …").

export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await runPolicyReminders(serviceClient(), req.nextUrl.searchParams.get('dryRun') === '1'))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
