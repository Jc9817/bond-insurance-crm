import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { graphConfigured, sendGraphEmail } from '@/lib/msGraph'
import { generateId } from '@/lib/utils'

// Daily policy expiry reminders (fix list 5.2). Run once a day by Vercel Cron
// (vercel.json, 08:00 Malaysia time). Called without a login, so it is
// excluded from the login check in proxy.ts and protected by CRON_SECRET,
// which Vercel sends as "Authorization: Bearer <CRON_SECRET>".
//
// Each run:
//   - marks Active policies past their expiry date as Expired
//   - finds Active policies expiring within 60 days (not reminded at 60 yet)
//     and within 30 days (not reminded at 30 yet)
//   - creates a renewal follow-up for each, for the case's person in charge
//   - emails one summary from operation@ to OPS_NOTIFY_EMAIL
//   - records reminded_60_at / reminded_30_at, so nothing is sent twice
//
// ?dryRun=1 shows what would happen without changing or sending anything.

export const maxDuration = 60

type PolicyRow = {
  id: string; case_id: string; policy_type: string; policy_number: string; insurer: string
  expiry_date: string; reminded_60_at: string | null; reminded_30_at: string | null
  cases: { case_title: string; customer_id: string | null; customer_name: string; person_in_charge: string } | null
}

/** Today's date in Malaysia, as YYYY-MM-DD. */
function todayMY(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date())
}
const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'

  const sb = serviceClient()
  const today = todayMY()

  // 1. Past expiry and never renewed -> Expired
  const { data: expiredRows } = await sb
    .from('policies').select('id').eq('status', 'Active').lt('expiry_date', today)
  const expiredIds = (expiredRows ?? []).map(r => r.id)
  if (!dryRun && expiredIds.length) {
    await sb.from('policies').update({ status: 'Expired', updated_at: new Date().toISOString() }).in('id', expiredIds)
  }

  // 2. Expiring within 60 days
  const { data, error } = await sb
    .from('policies')
    .select('id, case_id, policy_type, policy_number, insurer, expiry_date, reminded_60_at, reminded_30_at, cases(case_title, customer_id, customer_name, person_in_charge)')
    .eq('status', 'Active')
    .gte('expiry_date', today)
    .lte('expiry_date', addDays(today, 60))
    .order('expiry_date')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as unknown as PolicyRow[]
  const due30 = rows.filter(p => daysBetween(today, p.expiry_date) <= 30 && !p.reminded_30_at)
  const due60 = rows.filter(p => daysBetween(today, p.expiry_date) > 30 && !p.reminded_60_at)
  const due = [...due30, ...due60]

  const label = (p: PolicyRow) => `${p.policy_type}${p.policy_number ? ` ${p.policy_number}` : ''}`
  const line = (p: PolicyRow) =>
    `• ${label(p)} — expires ${p.expiry_date} (${daysBetween(today, p.expiry_date)} days)\n` +
    `  Case: ${p.cases?.case_title ?? p.case_id} | Customer: ${p.cases?.customer_name || '—'} | ` +
    `Insurer: ${p.insurer || '—'} | PIC: ${p.cases?.person_in_charge || '—'}`

  const summary = {
    today, dryRun,
    markedExpired: expiredIds.length,
    within30Days: due30.map(label),
    within60Days: due60.map(label),
    emailed: false,
    followUpsCreated: 0,
  }
  if (dryRun || due.length === 0) return NextResponse.json(summary)

  // 3. A renewal follow-up per policy, for the case's person in charge
  const nowIso = new Date().toISOString()
  const followUps = due.map(p => {
    const days = daysBetween(today, p.expiry_date)
    // Act well before expiry: 30 days before it, or within a week if that has passed
    const dueDate = days > 37 ? addDays(p.expiry_date, -30) : addDays(today, Math.min(7, Math.max(days - 1, 0)))
    return {
      id: generateId(),
      title: `Renew ${label(p)} — expires ${p.expiry_date}`,
      customer_id: p.cases?.customer_id ?? null,
      customer_name: p.cases?.customer_name ?? '',
      case_id: p.case_id,
      case_title: p.cases?.case_title ?? '',
      person_in_charge: p.cases?.person_in_charge ?? '',
      due_date: dueDate,
      status: 'Open',
      created_at: nowIso,
    }
  })
  const { error: fuError } = await sb.from('follow_ups').insert(followUps)
  if (fuError) console.error('[policy-reminders] follow-ups failed:', fuError.message)
  else summary.followUpsCreated = followUps.length

  // 4. One summary email from operation@
  const to = process.env.OPS_NOTIFY_EMAIL || process.env.MS_GRAPH_SENDER_EMAIL
  if (to && graphConfigured()) {
    const parts = [
      due30.length ? `Expiring within 30 days:\n\n${due30.map(line).join('\n\n')}` : '',
      due60.length ? `Expiring within 60 days:\n\n${due60.map(line).join('\n\n')}` : '',
    ].filter(Boolean)
    try {
      await sendGraphEmail({
        to,
        subject: `[DocFlow] ${due.length} polic${due.length === 1 ? 'y' : 'ies'} due for renewal`,
        body: `Good morning,\n\nThese policies are coming up for renewal. A follow-up has been created for each.\n\n${parts.join('\n\n')}\n\n— DocFlow`,
      })
      summary.emailed = true
    } catch (err) {
      console.error('[policy-reminders] email failed:', (err as Error).message)
    }
  }

  // 5. Remember what was reported, so it isn't sent again
  if (due30.length) {
    await sb.from('policies').update({ reminded_30_at: nowIso })
      .in('id', due30.map(p => p.id))
    // A policy already inside 30 days doesn't need the 60-day reminder later
    await sb.from('policies').update({ reminded_60_at: nowIso })
      .in('id', due30.filter(p => !p.reminded_60_at).map(p => p.id))
  }
  if (due60.length) {
    await sb.from('policies').update({ reminded_60_at: nowIso }).in('id', due60.map(p => p.id))
  }

  return NextResponse.json(summary)
}
