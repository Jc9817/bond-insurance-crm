import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { graphConfigured, graphDownload, graphRequest } from './msGraph'
import type { Customer, MailAttachment, MailReference, MailSuggestion } from './types'
import { CASE_TYPES, MAIL_ACTIONS, REFERENCE_KINDS, REQUEST_TYPES, filedCases } from './types'
import {
  applyCaseMatch, cleanReferences, findCaseMatch, loadedStore, normalizeReference, recordFiling, splitReferences, withoutCaseFilings,
  type CaseLinkStore, type CaseMatch,
} from './mail-links'
import { matchCustomer, ssmKey } from './ssm'
import { activeDocumentTypes, resolveRequiredDocForCase } from './document-types'
import { isReadable, readEmail, type EmailAiResult } from './mail-ai'
import { caseFolder } from './storage'
import { saveFile, sha256 } from './storage-server'

// Server-only. The Emails screen: DocFlow's copy of the shared mailbox
// (MAIL_INTAKE_MAILBOX, i.e. operation@).
//
// - importMessage() copies one email's details and text into mail_messages.
//   Attachments are only listed, not downloaded.
// - syncMailbox() imports every Inbox email from the last SYNC_DAYS days that
//   DocFlow hasn't seen (the Refresh button and the daily job). New emails also
//   arrive straight away through /api/intake/email/notify.
// - analyseMessage() has the AI read the email (lib/mail-ai.ts) and stores
//   its suggestion — overruled by an earlier email of the same thread, or a
//   reference number already kept on a case (lib/mail-links.ts).
// - fileMessage() files a person's decision: downloads the chosen attachments
//   from the mailbox into the cases, links the email to them and records its
//   thread and reference numbers against them.
//
// Needs the Mail.Read application permission on the Azure app, scoped to
// operation@ (docs/microsoft-365-setup.md). DocFlow never changes the mailbox.

export const SYNC_DAYS = 30
const MAX_IMPORT_PER_SYNC = 100
const MAX_BODY_CHARS = 100_000
// Limits on what is sent to the AI for one email
const MAX_AI_FILES = 10
const MAX_AI_BYTES = 20 * 1024 * 1024
const MAX_OPEN_CASES = 300

const mailbox = () => process.env.MAIL_INTAKE_MAILBOX ?? ''
export const mailboxEnabled = () => graphConfigured() && !!mailbox()
const messagePath = (graphId: string) =>
  `/users/${encodeURIComponent(mailbox())}/messages/${encodeURIComponent(graphId)}`

type Recipient = { emailAddress?: { name?: string; address?: string } }
type GraphMessage = {
  id: string; subject?: string; internetMessageId?: string; conversationId?: string
  receivedDateTime: string; hasAttachments?: boolean
  from?: Recipient; toRecipients?: Recipient[]; ccRecipients?: Recipient[]
  body?: { content?: string }
}
type GraphAttachment = {
  '@odata.type': string; id: string; name?: string; size?: number; contentType?: string; isInline?: boolean
}

const person = (r?: Recipient) => {
  const e = r?.emailAddress
  return e?.name && e.address && e.name !== e.address ? `${e.name} <${e.address}>` : e?.address ?? e?.name ?? ''
}

// ─── Importing ──────────────────────────────────────────────────────────────

/** Copies one email's details into mail_messages (once). Returns the row id and whether it is new. */
export async function importMessage(sb: SupabaseClient, graphId: string): Promise<{ id: string; isNew: boolean }> {
  const { data: seen } = await sb.from('mail_messages').select('id').eq('graph_id', graphId).maybeSingle()
  if (seen) return { id: seen.id, isNew: false }

  const msg = await graphRequest<GraphMessage>('GET',
    `${messagePath(graphId)}?$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,internetMessageId,conversationId,hasAttachments,body`,
    undefined, { Prefer: 'outlook.body-content-type="text"' })

  let attachments: MailAttachment[] = []
  if (msg.hasAttachments) {
    const { value } = await graphRequest<{ value: GraphAttachment[] }>('GET',
      `${messagePath(graphId)}/attachments?$select=id,name,size,contentType,isInline`)
    // Files only — not embedded emails, cloud links or inline signature images
    attachments = value
      .filter(a => a['@odata.type'] === '#microsoft.graph.fileAttachment' && !a.isInline && a.name)
      .map(a => ({ id: a.id, name: a.name!, size: a.size ?? 0, contentType: a.contentType || 'application/octet-stream' }))
  }

  const { data, error } = await sb.from('mail_messages').upsert({
    graph_id: msg.id,
    internet_message_id: msg.internetMessageId ?? null,
    conversation_id: msg.conversationId ?? null,
    subject: msg.subject ?? '',
    from_name: msg.from?.emailAddress?.name ?? '',
    from_address: msg.from?.emailAddress?.address ?? '',
    to_recipients: (msg.toRecipients ?? []).map(person).join(', '),
    cc_recipients: (msg.ccRecipients ?? []).map(person).join(', '),
    received_at: msg.receivedDateTime,
    body_text: (msg.body?.content ?? '').trim().slice(0, MAX_BODY_CHARS),
    attachments,
  }, { onConflict: 'graph_id' }).select('id').single()
  if (error) throw new Error(`Could not save email: ${error.message}`)
  return { id: data.id, isNew: true }
}

/** Imports the Inbox emails of the last `days` days that DocFlow hasn't seen. */
export async function syncMailbox(sb: SupabaseClient, days = SYNC_DAYS): Promise<{ added: number; failed: number }> {
  const since = new Date(Date.now() - days * 86400000).toISOString()
  let link: string | undefined =
    `/users/${encodeURIComponent(mailbox())}/mailFolders('Inbox')/messages` +
    `?$select=id&$filter=receivedDateTime ge ${since}&$orderby=receivedDateTime desc&$top=100`
  const ids: string[] = []
  while (link && ids.length < 1000) {
    const page: { value: { id: string }[]; '@odata.nextLink'?: string } = await graphRequest('GET', link)
    ids.push(...page.value.map(m => m.id))
    link = page['@odata.nextLink']
  }

  const known = new Set<string>()
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await sb.from('mail_messages').select('graph_id').in('graph_id', ids.slice(i, i + 100))
    for (const r of data ?? []) known.add(r.graph_id)
  }

  let added = 0, failed = 0
  for (const id of ids.filter(id => !known.has(id)).slice(0, MAX_IMPORT_PER_SYNC)) {
    try {
      await importMessage(sb, id)
      added++
    } catch (err) {
      console.error('[mail] import failed:', id, err instanceof Error ? err.message : err)
      failed++
    }
  }
  return { added, failed }
}

/** One attachment's bytes, straight from the mailbox. */
export function downloadAttachment(graphId: string, attachmentId: string): Promise<Buffer> {
  return graphDownload(`${messagePath(graphId)}/attachments/${encodeURIComponent(attachmentId)}/$value`)
}

// ─── AI suggestion ──────────────────────────────────────────────────────────

/** Has the AI read the email and stores its suggestion (or why it couldn't). */
export async function analyseMessage(sb: SupabaseClient, id: string): Promise<void> {
  const { data: row } = await sb.from('mail_messages').select('*').eq('id', id).single()
  if (!row || row.status === 'filed' || row.status === 'not_case') return
  await sb.from('mail_messages').update({ status: 'analysing', ai_error: null }).eq('id', id)

  try {
    const { suggestion, error } = await suggest(sb, row)
    await sb.from('mail_messages').update({ status: 'ready', ai_suggestion: suggestion, ai_error: error ?? null }).eq('id', id)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[mail] AI failed:', id, message)
    await sb.from('mail_messages').update({ status: 'ready', ai_error: message }).eq('id', id)
  }
}

type OpenCase = { id: string; case_number: string | null; case_title: string | null; customer_id: string | null; customer_name: string | null; bond_principal: string | null; amount: number | null }
const CASE_COLUMNS = 'id, case_number, case_title, customer_id, customer_name, bond_principal, amount'

/** Adds these cases to the list when missing (e.g. a closed case a thread was filed to). */
async function addCases(sb: SupabaseClient, cases: OpenCase[], ids: string[]) {
  const missing = ids.filter(id => !cases.some(c => c.id === id))
  if (missing.length === 0) return
  const { data } = await sb.from('cases').select(CASE_COLUMNS).in('id', missing)
  cases.push(...((data ?? []) as OpenCase[]))
}

/**
 * The AI's reading of the email, with a thread or reference match applied.
 * When the AI fails but a match is found, the match is still suggested and
 * the AI's error returned alongside.
 */
async function suggest(sb: SupabaseClient, row: Record<string, unknown>): Promise<{ suggestion: MailSuggestion; error?: string }> {
  const attachments = (row.attachments ?? []) as MailAttachment[]
  const links = caseLinks(sb)
  const conversationId = (row.conversation_id as string | null) ?? null
  const threadCaseIds = conversationId ? await links.casesForConversation(conversationId) : []

  const { data: caseRows } = await sb
    .from('cases').select(CASE_COLUMNS)
    .is('archived_at', null).neq('current_status', 'Done')
    .order('created_at', { ascending: false }).limit(MAX_OPEN_CASES)
  const cases = (caseRows ?? []) as OpenCase[]
  await addCases(sb, cases, threadCaseIds)
  const label = (id: string) => {
    const c = cases.find(x => x.id === id)
    return c?.case_number || c?.case_title || 'a case'
  }

  let r: EmailAiResult | undefined
  let error: string | undefined
  try {
    // Readable attachments go to the AI, within limits; the rest by name only
    let budget = MAX_AI_BYTES, sent = 0
    const files = await Promise.all(attachments.map(async a => {
      if (!isReadable(a.contentType) || sent >= MAX_AI_FILES || a.size > budget) return { ...a, content: undefined }
      sent++
      budget -= a.size
      return { ...a, content: await downloadAttachment(String(row.graph_id), a.id) }
    }))

    r = await readEmail({
      subject: String(row.subject ?? ''),
      from: row.from_name ? `${row.from_name} <${row.from_address}>` : String(row.from_address ?? ''),
      to: String(row.to_recipients ?? ''),
      cc: String(row.cc_recipients ?? ''),
      receivedAt: String(row.received_at),
      body: String(row.body_text ?? ''),
      attachments: files,
      openCases: cases.filter(c => c.case_number).map(c => ({
        caseNumber: c.case_number!, title: c.case_title ?? '', customer: c.customer_name ?? '',
        principal: c.bond_principal ?? '', amount: Number(c.amount ?? 0),
      })),
      threadCases: threadCaseIds.map(id => cases.find(c => c.id === id)?.case_number).filter((n): n is string => !!n),
      documentTypes: await activeDocumentTypes(sb),
    })
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  }

  const match = await findCaseMatch(links, {
    conversationId,
    references: r?.references ?? [],
    text: [row.subject, row.body_text, ...attachments.map(a => a.name)].join('\n'),
  })
  if (!r && !match) throw new Error(error)
  if (match?.by === 'reference') await addCases(sb, cases, [match.caseId])

  const base: MailSuggestion = r
    ? await resolveSuggestion(sb, r, attachments, cases)
    : { action: 'not_case', summary: '', confidence: 0, policies: [], attachments: {} }
  const s = applyCaseMatch(base, match, label)

  // The chosen case's customer, rather than one the AI guessed
  const chosen = match && s.action === 'existing_case' ? cases.find(c => c.id === s.caseId) : undefined
  if (chosen?.customer_id) s.customer = { id: chosen.customer_id, name: chosen.customer_name ?? '', isNew: false }
  return { suggestion: s, error }
}

/** Turns the AI's answer into ids DocFlow knows (cases by number, customer by SSM / name). */
async function resolveSuggestion(sb: SupabaseClient, r: EmailAiResult, attachments: MailAttachment[], openCases: OpenCase[]): Promise<MailSuggestion> {
  const caseByNumber = new Map(openCases.filter(c => c.case_number).map(c => [c.case_number!.trim(), c]))
  const findCase = (n: string) => caseByNumber.get(n.trim())
  const text = (s: string) => s.trim() || undefined
  const referenceNumbers = cleanReferences(
    (r.references ?? []).filter(x => (REFERENCE_KINDS as readonly string[]).includes(x.kind)))

  const s: MailSuggestion = {
    action: MAIL_ACTIONS.includes(r.action) ? r.action : 'not_case',
    summary: r.summary.trim(),
    confidence: Math.max(0, Math.min(1, Number(r.confidence) || 0)),
    caseType: (CASE_TYPES as readonly string[]).includes(r.caseType) ? r.caseType : undefined,
    requestType: (REQUEST_TYPES as readonly string[]).includes(r.requestType) ? r.requestType : undefined,
    principal: text(r.principal),
    amount: r.amount > 0 ? r.amount : undefined,
    coverTypes: text(r.coverTypes),
    references: text(referenceNumbers.map(x => x.value).join(', ')),
    referenceNumbers: referenceNumbers.length ? referenceNumbers : undefined,
    policies: r.policies
      .filter(p => p.policyNumber.trim() || p.policyType.trim())
      .map(p => ({
        policyType: p.policyType.trim(), policyNumber: p.policyNumber.trim(), insurer: p.insurer.trim(),
        sumInsured: p.sumInsured > 0 ? p.sumInsured : undefined,
        startDate: /^\d{4}-\d{2}-\d{2}$/.test(p.startDate) ? p.startDate : undefined,
        expiryDate: /^\d{4}-\d{2}-\d{2}$/.test(p.expiryDate) ? p.expiryDate : undefined,
      })),
    attachments: {},
  }

  for (const a of r.attachments) {
    const att = attachments[a.index - 1]
    if (!att) continue
    s.attachments[att.id] = { documentType: a.documentType.trim() || 'Other', caseId: findCase(a.caseNumber)?.id }
  }

  const matched = r.caseNumber ? findCase(r.caseNumber) : undefined
  if (s.action === 'existing_case' && matched) s.caseId = matched.id

  // Customer: the matched case's, else by SSM number / name, else a new one
  if (matched?.customer_id) {
    s.customer = { id: matched.customer_id, name: matched.customer_name ?? '', isNew: false }
  } else if (r.customerName.trim() || r.ssmNumber.trim()) {
    const { data: customerRows } = await sb.from('customers').select('id, customer_name, company_registration_no')
    const customers = (customerRows ?? []).map(c => ({
      id: c.id, customerName: c.customer_name ?? '', companyRegistrationNo: c.company_registration_no ?? '',
    })) as Customer[]
    const found = matchCustomer(customers, { ssm: r.ssmNumber, name: r.customerName })
    s.customer = found
      ? { id: found.id, name: found.customerName, ssm: found.companyRegistrationNo || undefined, isNew: false }
      : { name: r.customerName.trim(), ssm: ssmKey(r.ssmNumber) ? r.ssmNumber.trim() : undefined, isNew: true }
  }

  if (s.action === 'create_case') {
    const now = new Date()
    const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`
    const title = r.caseTitle.trim() || s.customer?.name
    if (title) s.caseTitle = `${yearMonth} - ${title}`
  }
  return s
}

// ─── Filing ─────────────────────────────────────────────────────────────────

export type FileAssignment = { attachmentId: string; caseId: string; documentType: string }
export type FileOutcome = {
  filed: string[]; duplicates: string[]; failed: string[]; caseFileIds: string[]
  files: { name: string; caseId: string; caseFileId: string }[]   // every attachment now on a case, new or already there
}

/**
 * Files a person's decision: each assignment's attachment is copied from the
 * mailbox into its case, and the email is linked to every case in
 * assignments + caseIds (shown in the case's email history).
 */
export async function fileMessage(
  sb: SupabaseClient, id: string, assignments: FileAssignment[], caseIds: string[], decidedBy: string,
): Promise<FileOutcome> {
  const { data: row } = await sb.from('mail_messages').select('*').eq('id', id).single()
  if (!row) throw new Error('Email not found')
  const attachments = (row.attachments ?? []) as MailAttachment[]
  const outcome: FileOutcome = { filed: [], duplicates: [], failed: [], caseFileIds: [], files: [] }
  const from = row.from_name || row.from_address

  const allCaseIds = [...new Set([...caseIds, ...assignments.map(a => a.caseId)])]
  const { data: caseRows } = await sb.from('cases').select('id, case_title').in('id', allCaseIds)
  const titles = new Map((caseRows ?? []).map(c => [c.id, c.case_title ?? '']))
  const missing = allCaseIds.filter(c => !titles.has(c))
  if (missing.length) throw new Error('Case not found — it may still be saving, try again in a moment')

  for (const a of assignments) {
    const att = attachments.find(x => x.id === a.attachmentId)
    if (!att) continue
    // Each attachment can go to several cases, once per case
    const earlier = filedCases(att).find(f => f.caseId === a.caseId)
    if (earlier) {
      outcome.duplicates.push(att.name)
      outcome.files.push({ name: att.name, caseId: a.caseId, caseFileId: earlier.caseFileId })
      continue
    }
    const record = (caseFileId: string) => {
      outcome.files.push({ name: att.name, caseId: a.caseId, caseFileId })
      const filing = { caseId: a.caseId, caseFileId, documentType: a.documentType }
      if (att.filedTo) att.alsoFiledTo = [...(att.alsoFiledTo ?? []), filing]
      else att.filedTo = filing
    }
    try {
      const content = await downloadAttachment(row.graph_id, att.id)
      const fileHash = sha256(content)
      const { data: dup } = await sb.from('case_files').select('id')
        .eq('case_id', a.caseId).eq('file_hash', fileHash).limit(1)
      if (dup?.length) {
        record(dup[0].id)
        outcome.duplicates.push(att.name)
        continue
      }

      const fileRef = await saveFile(caseFolder(a.caseId), att.name, content, att.contentType)
      const requiredDocumentId = await resolveRequiredDocForCase(sb, a.caseId, a.documentType)
      let aiPrompt: string | null = null
      if (requiredDocumentId) {
        const { data: doc } = await sb.from('required_documents').select('ai_prompt').eq('id', requiredDocumentId).single()
        aiPrompt = doc?.ai_prompt ?? null
      }
      const caseFileId = randomUUID()
      const { error } = await sb.from('case_files').insert({
        id: caseFileId, case_id: a.caseId, file_name: att.name, file_size: content.length,
        file_type: att.contentType, document_type: a.documentType, required_document_id: requiredDocumentId,
        uploaded_by: `${from} (email)`, uploaded_at: new Date().toISOString(), file_data_url: fileRef,
        ai_scanned: false, ai_status: 'Pending', ai_extracted_data: null, ai_prompt: aiPrompt, file_hash: fileHash,
      })
      if (error) throw new Error(error.message)

      await sb.from('activity_logs').insert({
        id: randomUUID(), case_id: a.caseId, case_title: titles.get(a.caseId) ?? null,
        action_type: 'DOCUMENT_ASSIGNED', title: 'Filed from email',
        description: `${att.name} from "${row.subject}" (${from}) filed as "${a.documentType}"`,
        changed_by: decidedBy, timestamp: new Date().toISOString(),
      })
      record(caseFileId)
      outcome.filed.push(att.name)
      outcome.caseFileIds.push(caseFileId)
    } catch (err) {
      console.error('[mail] filing failed:', att.name, err instanceof Error ? err.message : err)
      outcome.failed.push(att.name)
    }
  }

  // Link the email to each case once, in the case's email history
  const linked = new Set<string>(row.case_ids ?? [])
  for (const caseId of allCaseIds.filter(c => !linked.has(c))) {
    await sb.from('case_emails').insert({
      id: randomUUID(), case_id: caseId, template_name: 'Received email',
      to_email: row.from_name ? `${row.from_name} <${row.from_address}>` : row.from_address,
      subject: row.subject, body: row.body_text, status: 'received', sent_at: row.received_at,
    })
    linked.add(caseId)
  }

  // So later replies and emails carrying the same numbers find these cases
  const s = row.ai_suggestion as MailSuggestion | null
  const references: MailReference[] = [
    ...(s?.referenceNumbers ?? splitReferences(s?.references)),
    ...(s?.policies ?? []).filter(p => p.policyNumber).map(p => ({ kind: 'policy' as const, value: p.policyNumber })),
  ]
  await recordFiling(caseLinks(sb), { mailId: id, caseIds: allCaseIds, conversationId: row.conversation_id, references })

  await sb.from('mail_messages').update({
    attachments, case_ids: [...linked], status: 'filed',
    decided_by: decidedBy, decided_at: new Date().toISOString(),
  }).eq('id', id)

  try {
    await rematchWaiting(sb)
  } catch (err) {
    console.error('[mail] rematch failed:', err instanceof Error ? err.message : err)
  }
  return outcome
}

/**
 * After a filing: emails still waiting for a decision that are in a filed
 * thread, or carry a reference now kept on a case, get that case suggested
 * straight away — without asking the AI again.
 */
async function rematchWaiting(sb: SupabaseClient) {
  const { data: waiting } = await sb.from('mail_messages')
    .select('id, subject, body_text, attachments, conversation_id, ai_suggestion')
    .eq('status', 'ready').not('ai_suggestion', 'is', null).limit(500)
  const rows = (waiting ?? []).filter(m => !(m.ai_suggestion as MailSuggestion).matchReason)
  if (rows.length === 0) return

  const conversationIds = [...new Set(rows.map(m => m.conversation_id).filter(Boolean))] as string[]
  const conversations: { caseId: string; conversationId: string }[] = []
  for (let i = 0; i < conversationIds.length; i += 100) {
    const { data } = await sb.from('case_conversations').select('case_id, conversation_id')
      .in('conversation_id', conversationIds.slice(i, i + 100)).order('created_at', { ascending: false })
    conversations.push(...(data ?? []).map(c => ({ caseId: c.case_id, conversationId: c.conversation_id })))
  }
  const { data: refRows } = await sb.from('case_references').select('case_id, kind, value, value_normalized').limit(10000)
  const store = loadedStore(conversations, (refRows ?? []).map(r => ({
    caseId: r.case_id, kind: r.kind, value: r.value, valueNormalized: r.value_normalized,
  })))

  const found: { id: string; s: MailSuggestion; match: CaseMatch }[] = []
  for (const m of rows) {
    const s = m.ai_suggestion as MailSuggestion
    const match = await findCaseMatch(store, {
      conversationId: m.conversation_id,
      references: s.referenceNumbers ?? splitReferences(s.references),
      text: [m.subject, m.body_text, ...((m.attachments ?? []) as MailAttachment[]).map(a => a.name)].join('\n'),
    })
    if (match) found.push({ id: m.id, s, match })
  }
  if (found.length === 0) return

  const cases: OpenCase[] = []
  await addCases(sb, cases, [...new Set(found.flatMap(f => f.match.by === 'thread' ? f.match.caseIds : [f.match.caseId]))])
  const label = (caseId: string) => {
    const c = cases.find(x => x.id === caseId)
    return c?.case_number || c?.case_title || 'a case'
  }
  for (const { id, s, match } of found) {
    const next = applyCaseMatch(s, match, label)
    if (next === s) continue
    const chosen = next.action === 'existing_case' ? cases.find(c => c.id === next.caseId) : undefined
    if (chosen?.customer_id) next.customer = { id: chosen.customer_id, name: chosen.customer_name ?? '', isNew: false }
    await sb.from('mail_messages').update({ ai_suggestion: next }).eq('id', id).eq('status', 'ready')
  }
}

/**
 * After a case is deleted: emails filed only to it go back to To do, and
 * emails waiting with a suggestion naming it are read again. Nothing in the
 * mailbox changes.
 */
export async function releaseEmailsFromCase(sb: SupabaseClient, caseId: string) {
  const fresh = { status: 'new', ai_suggestion: null, ai_error: null, decided_by: null, decided_at: null }

  const { data: filed, error } = await sb.from('mail_messages')
    .select('id, case_ids, attachments').contains('case_ids', [caseId])
  if (error) console.error('[mail] release from deleted case failed:', error.message)
  for (const m of filed ?? []) {
    const caseIds = (m.case_ids as string[]).filter(c => c !== caseId)
    await sb.from('mail_messages').update({
      case_ids: caseIds, attachments: withoutCaseFilings(m.attachments as MailAttachment[], caseId),
      ...(caseIds.length ? {} : fresh),
    }).eq('id', m.id)
  }

  const { data: waiting } = await sb.from('mail_messages')
    .select('id, ai_suggestion').eq('status', 'ready').not('ai_suggestion', 'is', null).limit(500)
  const stale = (waiting ?? []).filter(m => JSON.stringify(m.ai_suggestion).includes(caseId)).map(m => m.id)
  if (stale.length) await sb.from('mail_messages').update(fresh).in('id', stale)
}

// ─── Threads and references (lib/mail-links.ts) ─────────────────────────────

/** case_conversations / case_references. Problems are logged, never block filing. */
function caseLinks(sb: SupabaseClient): CaseLinkStore {
  const warn = (what: string, error: { message: string } | null) => {
    if (error) console.error(`[mail] ${what}:`, error.message)
  }
  return {
    async casesForConversation(conversationId) {
      const { data, error } = await sb.from('case_conversations').select('case_id')
        .eq('conversation_id', conversationId).order('created_at', { ascending: false })
      warn('thread lookup failed', error)
      return (data ?? []).map(r => r.case_id as string)
    },
    async findReferences(normalized) {
      const { data, error } = await sb.from('case_references')
        .select('case_id, kind, value, value_normalized').in('value_normalized', normalized)
      warn('reference lookup failed', error)
      return (data ?? []).map(r => ({ caseId: r.case_id, kind: r.kind, value: r.value, valueNormalized: r.value_normalized }))
    },
    async link(caseIds, conversationId, references, referencesCaseId, mailId) {
      if (conversationId && caseIds.length) {
        const { error } = await sb.from('case_conversations').upsert(
          caseIds.map(case_id => ({ case_id, conversation_id: conversationId })),
          { onConflict: 'conversation_id,case_id', ignoreDuplicates: true })
        warn('saving thread failed', error)
      }
      if (referencesCaseId && references.length) {
        const { error } = await sb.from('case_references').upsert(
          references.map(r => ({
            case_id: referencesCaseId, kind: r.kind, value: r.value,
            value_normalized: normalizeReference(r.value), mail_message_id: mailId,
          })),
          { onConflict: 'kind,value_normalized', ignoreDuplicates: true })
        warn('saving references failed', error)
      }
    },
  }
}
