import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { runPolicyReminders } from '@/lib/policy-reminders'
import { ensureSubscriptions } from '@/lib/graph-intake'
import { cronAuthorized } from '@/lib/cron'
import { sharePointStorageEnabled, syncMissingFiles } from '@/lib/sharepoint-files'
import { runRetention } from '@/lib/retention'
import { mailboxEnabled, syncMailbox } from '@/lib/mail-inbox'

// The daily job (vercel.json: 00:00 UTC = 08:00 Malaysia time). Protected by
// CRON_SECRET. It:
//   1. sends the policy expiry reminders (fix list 5.2)
//   2. renews the Microsoft new-email subscription (4.1), creating it the
//      first time
//   3. sweeps the shared mailbox once, in case a notification was missed
//      (missed emails are added to the Emails screen; the AI reads them when
//      someone opens them)
//   4. copies case files not yet in SharePoint (4.4) — a batch per day, which
//      also catches up older files and retries failed copies
//   5. archives cases past their keep period (5.6) — deleting them for good
//      is left to an Admin in Settings → Data Retention
// Each part runs even if another fails; the response reports all of them.

export const maxDuration = 300

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = serviceClient()
  const report: Record<string, unknown> = {}

  try {
    report.policyReminders = await runPolicyReminders(sb)
  } catch (err) {
    report.policyReminders = `FAILED — ${err instanceof Error ? err.message : err}`
  }

  report.subscriptions = await ensureSubscriptions(sb)

  if (mailboxEnabled()) {
    try {
      report.mailboxSweep = await syncMailbox(sb)
    } catch (err) {
      report.mailboxSweep = `FAILED — ${err instanceof Error ? err.message : err}`
    }
  }

  if (sharePointStorageEnabled()) {
    try {
      report.sharePointCopies = await syncMissingFiles(sb)
    } catch (err) {
      report.sharePointCopies = `FAILED — ${err instanceof Error ? err.message : err}`
    }
  }

  try {
    report.retention = await runRetention(sb)
  } catch (err) {
    report.retention = `FAILED — ${err instanceof Error ? err.message : err}`
  }

  return NextResponse.json(report)
}
