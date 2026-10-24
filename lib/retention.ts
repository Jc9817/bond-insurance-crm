import type { SupabaseClient } from '@supabase/supabase-js'
import { STORAGE_BUCKET, storagePath } from './storage'
import { deleteSharePointCopy, sharePointStorageEnabled } from './sharepoint-files'
import { graphConfigured, sendGraphEmail } from './msGraph'

// Server-only. How long DocFlow keeps a case (fix list 5.6, see
// docs/PDPA-note.md):
//   - Lost / Cancelled cases (never went ahead): 2 years after closing
//   - Other closed (Done) cases: 7 years after the last policy expires, or
//     after closing when there were no policies
//   - Open cases are always kept
//
// The daily job archives cases whose keep period has ended and emails a
// summary. Deleting them for good is never automatic: an Admin reviews the
// list in Settings → Data Retention and confirms (deleteCasesPermanently).

const LOST_YEARS = 2
const CLOSED_YEARS = 7

export type DueCase = {
  id: string; caseNumber: string; caseTitle: string; customerName: string
  rule: string; keepUntil: string; archived: boolean
}

const addYears = (date: string, years: number) => {
  const d = new Date(date)
  d.setUTCFullYear(d.getUTCFullYear() + years)
  return d.toISOString().slice(0, 10)
}

/** Closed cases whose keep period has ended (today is YYYY-MM-DD). */
export async function casesPastRetention(sb: SupabaseClient, today = new Date().toISOString().slice(0, 10)): Promise<DueCase[]> {
  const { data: cases, error } = await sb
    .from('cases')
    .select('id, case_number, case_title, customer_name, current_status, result, closed_at, updated_at, created_at, archived_at')
    .or('current_status.eq.Done,result.in.(Lost,Cancelled)')
  if (error) throw new Error(error.message)
  if (!cases?.length) return []

  const { data: policies } = await sb.from('policies').select('case_id, expiry_date').in('case_id', cases.map(c => c.id))
  const lastExpiry = new Map<string, string>()
  for (const p of policies ?? []) {
    if (p.expiry_date && (!lastExpiry.has(p.case_id) || p.expiry_date > lastExpiry.get(p.case_id)!)) {
      lastExpiry.set(p.case_id, p.expiry_date)
    }
  }

  const due: DueCase[] = []
  for (const c of cases) {
    const closed = (c.closed_at ?? c.updated_at ?? c.created_at ?? '').slice(0, 10)
    if (!closed) continue
    const lost = c.result === 'Lost' || c.result === 'Cancelled'
    const keepUntil = lost
      ? addYears(closed, LOST_YEARS)
      : addYears(lastExpiry.get(c.id) && lastExpiry.get(c.id)! > closed ? lastExpiry.get(c.id)! : closed, CLOSED_YEARS)
    if (keepUntil > today) continue
    due.push({
      id: c.id, caseNumber: c.case_number ?? '', caseTitle: c.case_title ?? '', customerName: c.customer_name ?? '',
      rule: lost ? `${c.result} — kept ${LOST_YEARS} years after closing`
        : lastExpiry.has(c.id) ? `Closed — kept ${CLOSED_YEARS} years after the last policy expired`
        : `Closed — kept ${CLOSED_YEARS} years after closing`,
      keepUntil, archived: !!c.archived_at,
    })
  }
  return due.sort((a, b) => a.keepUntil.localeCompare(b.keepUntil))
}

/** The daily step: archive cases past their keep period and email who needs to know. */
export async function runRetention(sb: SupabaseClient) {
  const due = await casesPastRetention(sb)
  const toArchive = due.filter(c => !c.archived)
  if (toArchive.length) {
    await sb.from('cases').update({ archived_at: new Date().toISOString() }).in('id', toArchive.map(c => c.id))
    const to = process.env.OPS_NOTIFY_EMAIL || process.env.MS_GRAPH_SENDER_EMAIL
    if (to && graphConfigured()) {
      const lines = toArchive.map(c => `• ${c.caseNumber} ${c.caseTitle} (${c.customerName || 'no customer'}) — ${c.rule}`).join('\n')
      await sendGraphEmail({
        to,
        subject: `[DocFlow] ${toArchive.length} case${toArchive.length === 1 ? '' : 's'} reached the end of the keep period`,
        body: `These cases have been archived because their keep period has ended (data retention rule):\n\n${lines}\n\n` +
          `Nothing has been deleted. An Admin can review and delete them for good in DocFlow → Settings → Data Retention.\n\n— DocFlow`,
      }).catch(err => console.error('[retention] email failed:', err instanceof Error ? err.message : err))
    }
  }
  return { pastKeepPeriod: due.length, newlyArchived: toArchive.length }
}

/**
 * Deletes cases for good: their files (DocFlow storage and SharePoint copies),
 * notes, follow-ups, emails, history, policies and the cases themselves.
 * Only cases still past their keep period are deleted. Returns the cases deleted.
 */
export async function deleteCasesPermanently(sb: SupabaseClient, caseIds: string[]): Promise<DueCase[]> {
  const due = (await casesPastRetention(sb)).filter(c => caseIds.includes(c.id))
  for (const c of due) {
    const { data: files } = await sb.from('case_files').select('file_data_url, sharepoint_item_id').eq('case_id', c.id)
    const paths = (files ?? []).map(f => storagePath(f.file_data_url)).filter((p): p is string => !!p)
    if (paths.length) await sb.storage.from(STORAGE_BUCKET).remove(paths)
    if (sharePointStorageEnabled()) {
      for (const f of files ?? []) {
        if (f.sharepoint_item_id) await deleteSharePointCopy(f.sharepoint_item_id).catch(() => {})
      }
    }
    // Inbox records that were filed to this case keep their record, not the file
    await sb.from('intake_items').update({ file_ref: null }).eq('case_id', c.id)
    for (const table of ['case_files', 'case_notes', 'follow_ups', 'activity_logs', 'case_emails', 'policies']) {
      await sb.from(table).delete().eq('case_id', c.id)
    }
    const { error } = await sb.from('cases').delete().eq('id', c.id)
    if (error) throw new Error(`Could not delete case ${c.caseNumber}: ${error.message}`)
  }
  return due
}
