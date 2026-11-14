import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Customer, MailReference, MailSuggestion } from './types'
import { CASE_TYPES, MAIL_ACTIONS, REFERENCE_KINDS, REQUEST_TYPES } from './types'
import {
  applyCaseMatch, cleanReferences, findCaseMatch, normalizeReference, splitReferences, type CaseLinkStore,
} from './mail-links'
import { matchCustomer, ssmKey } from './ssm'
import { activeDocumentTypes, resolveRequiredDocForCase } from './document-types'
import { STORAGE_BUCKET, caseFolder, toStorageRef } from './storage'
import { readFile, saveFile } from './storage-server'
import { serviceClient } from './supabase-service'
import { whatsappConfig } from './whatsapp-config'
import {
  downloadMedia, fileHash, joinsBundle, mediaFileName, normalizePhone, quietLongEnough, shouldStoreMedia,
  BUNDLE_WINDOW_MS, MAX_MEDIA_BYTES, type ParsedMessage,
} from './whatsapp-core'
import { isReadableFile, readWhatsappBundle, type WhatsappAiResult } from './whatsapp-ai'
import { parseWaFileKey, waFileKey, type WaFiling, type WaMedia } from './whatsapp-types'

// Server-only. The WhatsApp screen: DocFlow's read-only copy of what
// customers send the agency's WhatsApp Business number (through YCloud).
//
// - storeMessage()   saves one message, matches the sender to a contact /
//                    customer, puts it in a bundle and downloads its file
// - analyseBundle()  the AI reads a bundle (lib/whatsapp-ai.ts); a reference
//                    number already kept on a case wins, as on Emails
// - fileBundle()     files a person's decision into the cases
// - linkPhone()      remembers which customer / contact a number belongs to
// - dailyWhatsapp()  retries failed downloads, reads quiet bundles, checks
//                    the YCloud webhook is still active
//
// DocFlow never sends WhatsApp messages. Nothing existing is changed: the
// Emails screen keeps its own code; this only reads the shared case,
// customer and reference tables and adds files to cases.

const MAX_AI_FILES = 10
const MAX_AI_BYTES = 20 * 1024 * 1024
const MAX_OPEN_CASES = 300
const RETRY_DAYS = 30

// ─── Who sent it ────────────────────────────────────────────────────────────

export type PhoneMatch = { contactId?: string; customerId?: string }

/** The contact / customer a number belongs to: a link made on this screen, a contact's phone, then a customer's main phone. */
export async function matchPhone(sb: SupabaseClient, phone: string): Promise<PhoneMatch> {
  const { data: link } = await sb.from('whatsapp_phone_links').select('contact_id, customer_id').eq('phone_e164', phone).maybeSingle()
  if (link) return { contactId: link.contact_id ?? undefined, customerId: link.customer_id ?? undefined }

  // Numbers are kept as people typed them, so they are compared in E.164 form
  const { data: contacts } = await sb.from('contacts').select('id, customer_id, phone').neq('phone', '')
  const contact = (contacts ?? []).find(c => normalizePhone(c.phone) === phone)
  if (contact) return { contactId: contact.id, customerId: contact.customer_id ?? undefined }

  const { data: customers } = await sb.from('customers').select('id, main_phone').neq('main_phone', '')
  const customer = (customers ?? []).find(c => normalizePhone(c.main_phone) === phone)
  return customer ? { customerId: customer.id } : {}
}

/** Saves the number against a customer / contact, and on every message and open bundle from it. */
export async function linkPhone(sb: SupabaseClient, phone: string, match: PhoneMatch, linkedBy: string) {
  let customerId = match.customerId
  if (match.contactId && !customerId) {
    const { data } = await sb.from('contacts').select('customer_id').eq('id', match.contactId).maybeSingle()
    customerId = data?.customer_id ?? undefined
  }
  const fields = { contact_id: match.contactId ?? null, customer_id: customerId ?? null }
  const { error } = await sb.from('whatsapp_phone_links').upsert({
    phone_e164: phone, ...fields, linked_by: linkedBy, linked_at: new Date().toISOString(),
  }, { onConflict: 'phone_e164' })
  if (error) throw new Error(error.message)
  await sb.from('whatsapp_messages').update(fields).eq('customer_phone', phone)
  await sb.from('whatsapp_bundles').update(fields).eq('customer_phone', phone)
}

// ─── Storing a message ──────────────────────────────────────────────────────

/**
 * Saves one message (once), with its file downloaded. Incoming messages go
 * into a bundle. Returns the bundle and whether the message was new.
 */
export async function storeMessage(sb: SupabaseClient, eventId: string, m: ParsedMessage): Promise<{ id: string; bundleId?: string; isNew: boolean; hasFile: boolean }> {
  const seen = m.wamid
    ? await sb.from('whatsapp_messages').select('id, bundle_id').eq('wamid', m.wamid).maybeSingle()
    : m.ycloudId ? await sb.from('whatsapp_messages').select('id, bundle_id').eq('ycloud_message_id', m.ycloudId).maybeSingle() : { data: null }
  if (seen.data) return { id: seen.data.id, bundleId: seen.data.bundle_id ?? undefined, isNew: false, hasFile: false }

  const config = whatsappConfig()
  const who = await matchPhone(sb, m.customerPhone)
  const keepFile = !!m.media && shouldStoreMedia(m.type, config.storeAudioVideo)
  const media: WaMedia[] = m.media ? [{
    media_id: m.media.id,
    filename: m.media.filename ?? '',
    mime_type: m.media.mimeType,
    sha256: m.media.sha256,
    size: 0,
    link: m.media.link,
    download_status: keepFile ? 'pending' : 'skipped',
    ...(keepFile ? {} : { error: m.type === 'sticker' ? 'Stickers are not kept' : 'Voice notes and videos are not kept (WHATSAPP_STORE_AUDIO_VIDEO)' }),
  }] : []

  const id = randomUUID()
  const bundleId = m.direction === 'in' ? await bundleFor(sb, m.customerPhone, m.sentAt, who) : undefined
  const { error } = await sb.from('whatsapp_messages').insert({
    id, ycloud_message_id: m.ycloudId || null, wamid: m.wamid || null, event_id: eventId,
    direction: m.direction, business_number: m.businessNumber, customer_phone: m.customerPhone,
    customer_name: m.profileName, contact_id: who.contactId ?? null, customer_id: who.customerId ?? null,
    type: m.type, body: m.body, sent_at: m.sentAt, media, bundle_id: bundleId ?? null,
  })
  if (error) {
    if (error.code === '23505') return { id, isNew: false, hasFile: false }   // the same message, arriving twice at once
    throw new Error(`Could not save the message: ${error.message}`)
  }

  if (bundleId) await settleBundles(sb, m.customerPhone)
  if (keepFile) await downloadMessageMedia(sb, id)
  const { data: row } = await sb.from('whatsapp_messages').select('bundle_id').eq('id', id).single()
  return { id, bundleId: row?.bundle_id ?? bundleId, isNew: true, hasFile: keepFile }
}

/** The open bundle this message joins, or a new one. */
async function bundleFor(sb: SupabaseClient, phone: string, sentAt: string, who: PhoneMatch): Promise<string> {
  const { data: latest } = await sb.from('whatsapp_bundles').select('id, last_at, status')
    .eq('customer_phone', phone).order('last_at', { ascending: false }).limit(1).maybeSingle()
  if (latest && joinsBundle({ lastAt: latest.last_at, status: latest.status }, sentAt)) return latest.id

  const id = randomUUID()
  const { error } = await sb.from('whatsapp_bundles').insert({
    id, customer_phone: phone, contact_id: who.contactId ?? null, customer_id: who.customerId ?? null,
    first_at: sentAt, last_at: sentAt, message_count: 0, status: 'new',
  })
  if (error) throw new Error(`Could not start a bundle: ${error.message}`)
  return id
}

/**
 * Tidies a phone's open bundles after a message arrives: photos sent
 * together arrive at the same moment, so two could each have started a
 * bundle — those are merged. Counts and times are worked out again from the
 * messages, and a bundle that got new messages after the AI read it is read
 * again.
 */
async function settleBundles(sb: SupabaseClient, phone: string) {
  const { data: open } = await sb.from('whatsapp_bundles').select('id, status, ai_suggestion')
    .eq('customer_phone', phone).in('status', ['new', 'ready']).order('first_at', { ascending: true })
  const bundles = open ?? []
  if (bundles.length === 0) return
  const { data: msgs } = await sb.from('whatsapp_messages').select('id, bundle_id, sent_at')
    .in('bundle_id', bundles.map(b => b.id))
  const byBundle = new Map<string, string[]>()
  for (const m of msgs ?? []) byBundle.set(m.bundle_id, [...(byBundle.get(m.bundle_id) ?? []), m.sent_at])

  // Merge each bundle into the one before when their messages are within the window
  let keep = bundles[0]
  for (const b of bundles.slice(1)) {
    const before = byBundle.get(keep.id) ?? []
    const mine = byBundle.get(b.id) ?? []
    const lastBefore = Math.max(...before.map(t => Date.parse(t)), 0)
    const firstMine = Math.min(...mine.map(t => Date.parse(t)), Infinity)
    if (before.length && mine.length && firstMine - lastBefore <= BUNDLE_WINDOW_MS) {
      await sb.from('whatsapp_messages').update({ bundle_id: keep.id }).eq('bundle_id', b.id)
      byBundle.set(keep.id, [...before, ...mine])
      byBundle.delete(b.id)
      await sb.from('whatsapp_bundles').delete().eq('id', b.id).in('status', ['new', 'ready'])
    } else {
      keep = b
    }
  }

  for (const b of bundles) {
    const times = byBundle.get(b.id)
    if (!times?.length) continue
    const sorted = times.map(t => new Date(t).toISOString()).sort()
    await sb.from('whatsapp_bundles').update({
      first_at: sorted[0], last_at: sorted[sorted.length - 1], message_count: sorted.length,
      // New messages after the AI read it: read again with the whole burst
      ...(b.status === 'ready' ? { status: 'new', ai_suggestion: null, ai_error: null } : {}),
    }).eq('id', b.id).in('status', ['new', 'ready'])
  }
}

// ─── Files ──────────────────────────────────────────────────────────────────

/** Downloads a message's files into private storage (the same file is stored once). */
export async function downloadMessageMedia(sb: SupabaseClient, messageId: string, opts: { useKeyFirst?: boolean } = {}): Promise<void> {
  const { data: row } = await sb.from('whatsapp_messages').select('id, sent_at, media').eq('id', messageId).single()
  if (!row) return
  const media = (row.media ?? []) as WaMedia[]
  const { apiKey } = whatsappConfig()
  let changed = false

  for (const [i, item] of media.entries()) {
    if (item.download_status !== 'pending' && item.download_status !== 'failed') continue
    const result = await downloadMedia({ link: item.link ?? '', sha256: item.sha256 }, { apiKey, maxBytes: MAX_MEDIA_BYTES, useKeyFirst: opts.useKeyFirst })
    changed = true
    if (result.status !== 'stored') {
      media[i] = { ...item, download_status: result.status, error: result.error }
      continue
    }
    const hash = fileHash(result.bytes)
    try {
      media[i] = {
        ...item, size: result.bytes.length, file_hash: hash, download_status: 'stored', error: undefined,
        storage_ref: await storedCopy(sb, hash) ?? await saveWhatsappFile(row.id, row.sent_at, item, result.bytes),
      }
    } catch (err) {
      media[i] = { ...item, download_status: 'failed', error: `Could not store: ${err instanceof Error ? err.message : err}` }
    }
  }
  if (changed) await sb.from('whatsapp_messages').update({ media }).eq('id', messageId)
}

/** An earlier WhatsApp copy of the same file, if any. */
async function storedCopy(sb: SupabaseClient, hash: string): Promise<string | undefined> {
  const { data } = await sb.from('whatsapp_messages').select('media')
    .contains('media', [{ file_hash: hash, download_status: 'stored' }]).limit(1)
  const found = ((data?.[0]?.media ?? []) as WaMedia[]).find(m => m.file_hash === hash && m.storage_ref)
  return found?.storage_ref
}

/** whatsapp/<yyyy>/<mm>/<message id>-<safe name> in the private case-files bucket. */
async function saveWhatsappFile(messageId: string, sentAt: string, item: WaMedia, bytes: Buffer): Promise<string> {
  const d = new Date(sentAt)
  const name = mediaFileName(messageId, item.filename, item.mime_type)
  const path = `whatsapp/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${messageId}-${name}`
  const { error } = await serviceClient().storage.from(STORAGE_BUCKET)
    .upload(path, bytes, { contentType: item.mime_type, upsert: true })
  if (error) throw error
  return toStorageRef(path)
}

/** A file's name as shown on screen and on the case. */
export const displayName = (messageId: string, item: WaMedia) => mediaFileName(messageId, item.filename, item.mime_type)

// ─── AI suggestion ──────────────────────────────────────────────────────────

type MessageRow = { id: string; body: string; sent_at: string; type: string; customer_name: string; media: WaMedia[] }
type OpenCase = { id: string; case_number: string | null; case_title: string | null; customer_id: string | null; customer_name: string | null; bond_principal: string | null; amount: number | null }
const CASE_COLUMNS = 'id, case_number, case_title, customer_id, customer_name, bond_principal, amount'

/** Bundles waiting for the AI: quiet for 2 minutes and holding at least one stored file. */
export async function bundlesToAnalyse(sb: SupabaseClient, limit = 10): Promise<string[]> {
  const { data } = await sb.from('whatsapp_bundles').select('id, last_at').eq('status', 'new')
    .order('last_at', { ascending: false }).limit(50)
  const quiet = (data ?? []).filter(b => quietLongEnough(b.last_at)).map(b => b.id)
  if (quiet.length === 0) return []
  const { data: msgs } = await sb.from('whatsapp_messages').select('bundle_id, media').in('bundle_id', quiet)
  const withFile = new Set((msgs ?? []).filter(m => ((m.media ?? []) as WaMedia[]).some(x => x.download_status === 'stored')).map(m => m.bundle_id))
  return quiet.filter(id => withFile.has(id)).slice(0, limit)
}

/** Has the AI read a bundle and stores its suggestion (or why it couldn't). Text-only bundles are left for a person. */
export async function analyseBundle(sb: SupabaseClient, bundleId: string): Promise<void> {
  const { data: bundle } = await sb.from('whatsapp_bundles').select('*').eq('id', bundleId).single()
  if (!bundle || bundle.status === 'filed' || bundle.status === 'not_case') return
  const { data: msgRows } = await sb.from('whatsapp_messages').select('id, body, sent_at, type, customer_name, media')
    .eq('bundle_id', bundleId).order('sent_at', { ascending: true })
  const messages = (msgRows ?? []) as MessageRow[]
  if (!messages.some(m => m.media.some(x => x.download_status === 'stored'))) return

  // Only one reading at a time
  const { data: claimed } = await sb.from('whatsapp_bundles').update({ status: 'analysing', ai_error: null })
    .eq('id', bundleId).in('status', ['new', 'ready']).select('id')
  if (!claimed?.length) return

  try {
    const { suggestion, error } = await suggest(sb, bundle, messages)
    await sb.from('whatsapp_bundles').update({ status: 'ready', ai_suggestion: suggestion, ai_error: error ?? null }).eq('id', bundleId).eq('status', 'analysing')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[whatsapp] AI failed:', bundleId, message)
    await sb.from('whatsapp_bundles').update({ status: 'ready', ai_error: message }).eq('id', bundleId).eq('status', 'analysing')
  }
}

async function addCases(sb: SupabaseClient, cases: OpenCase[], ids: string[]) {
  const missing = ids.filter(id => !cases.some(c => c.id === id))
  if (missing.length === 0) return
  const { data } = await sb.from('cases').select(CASE_COLUMNS).in('id', missing)
  cases.push(...((data ?? []) as OpenCase[]))
}

/** case_references, read-only (the Emails screen's own store is not used, so nothing there changes). */
function referenceStore(sb: SupabaseClient): CaseLinkStore {
  return {
    async casesForConversation() { return [] },
    async findReferences(normalized) {
      const { data, error } = await sb.from('case_references').select('case_id, kind, value, value_normalized').in('value_normalized', normalized)
      if (error) console.error('[whatsapp] reference lookup failed:', error.message)
      return (data ?? []).map(r => ({ caseId: r.case_id, kind: r.kind, value: r.value, valueNormalized: r.value_normalized }))
    },
    async link() { throw new Error('read only') },
  }
}

async function suggest(sb: SupabaseClient, bundle: Record<string, unknown>, messages: MessageRow[]): Promise<{ suggestion: MailSuggestion; error?: string }> {
  const customerId = (bundle.customer_id as string | null) ?? null
  const contactId = (bundle.contact_id as string | null) ?? null
  const [{ data: customer }, { data: contact }] = await Promise.all([
    customerId ? sb.from('customers').select('id, customer_name').eq('id', customerId).maybeSingle() : Promise.resolve({ data: null }),
    contactId ? sb.from('contacts').select('contact_name').eq('id', contactId).maybeSingle() : Promise.resolve({ data: null }),
  ])

  const { data: caseRows } = await sb.from('cases').select(CASE_COLUMNS)
    .is('archived_at', null).neq('current_status', 'Done')
    .order('created_at', { ascending: false }).limit(MAX_OPEN_CASES)
  const cases = (caseRows ?? []) as OpenCase[]
  const label = (id: string) => {
    const c = cases.find(x => x.id === id)
    return c?.case_number || c?.case_title || 'a case'
  }

  // Every stored file, in order; readable ones go to the AI, within limits
  const files: { key: string; name: string; mimeType: string; ref: string; size: number }[] = []
  for (const m of messages) {
    m.media.forEach((x, i) => {
      if (x.download_status === 'stored' && x.storage_ref) {
        files.push({ key: waFileKey(m.id, i), name: displayName(m.id, x), mimeType: x.mime_type, ref: x.storage_ref, size: x.size })
      }
    })
  }

  let r: WhatsappAiResult | undefined
  let error: string | undefined
  try {
    let budget = MAX_AI_BYTES, sent = 0
    const withContent = await Promise.all(files.map(async f => {
      if (!isReadableFile(f.mimeType) || sent >= MAX_AI_FILES || f.size > budget) return { ...f, content: undefined }
      sent++
      budget -= f.size
      return { ...f, content: await readFile(f.ref) }
    }))
    const fileNumber = new Map(files.map((f, i) => [f.key, `${i + 1} (${f.name})`]))
    r = await readWhatsappBundle({
      senderPhone: String(bundle.customer_phone),
      senderName: contact?.contact_name || customer?.customer_name || messages.find(m => m.customer_name)?.customer_name || '',
      matchedCustomer: customer?.customer_name ?? '',
      messages: messages.map(m => ({
        sentAt: m.sent_at, text: m.body,
        file: m.media.map((_, i) => fileNumber.get(waFileKey(m.id, i))).filter(Boolean).join(', ') || undefined,
      })),
      files: withContent,
      openCases: cases.filter(c => c.case_number).map(c => ({
        caseNumber: c.case_number!, title: c.case_title ?? '', customer: c.customer_name ?? '',
        principal: c.bond_principal ?? '', amount: Number(c.amount ?? 0), sendersCustomer: !!customerId && c.customer_id === customerId,
      })),
      documentTypes: await activeDocumentTypes(sb),
    })
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  }

  const match = await findCaseMatch(referenceStore(sb), {
    references: r?.references ?? [],
    text: [...messages.map(m => m.body), ...files.map(f => f.name)].join('\n'),
  })
  if (!r && !match) throw new Error(error)
  if (match?.by === 'reference') await addCases(sb, cases, [match.caseId])

  const base: MailSuggestion = r
    ? await resolveSuggestion(sb, r, files.map(f => f.key), cases)
    : { action: 'not_case', summary: '', confidence: 0, policies: [], attachments: {} }
  const s = applyCaseMatch(base, match, label)

  // The customer: the chosen case's; else the one the number belongs to (the strongest signal); else the AI's
  const chosen = s.action === 'existing_case' ? cases.find(c => c.id === s.caseId) : undefined
  if (chosen?.customer_id) s.customer = { id: chosen.customer_id, name: chosen.customer_name ?? '', isNew: false }
  else if (customer) s.customer = { id: customer.id, name: customer.customer_name ?? '', isNew: false }
  return { suggestion: s, error }
}

/** Turns the AI's answer into ids DocFlow knows (cases by number, customer by SSM / name). */
async function resolveSuggestion(sb: SupabaseClient, r: WhatsappAiResult, fileKeys: string[], openCases: OpenCase[]): Promise<MailSuggestion> {
  const caseByNumber = new Map(openCases.filter(c => c.case_number).map(c => [c.case_number!.trim(), c]))
  const findCase = (n: string) => caseByNumber.get(n.trim())
  const text = (s: string) => s.trim() || undefined
  const referenceNumbers = cleanReferences((r.references ?? []).filter(x => (REFERENCE_KINDS as readonly string[]).includes(x.kind)))

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
    const key = fileKeys[a.index - 1]
    if (key) s.attachments[key] = { documentType: a.documentType.trim() || 'Other', caseId: findCase(a.caseNumber)?.id }
  }

  const matched = r.caseNumber ? findCase(r.caseNumber) : undefined
  if (s.action === 'existing_case' && matched) s.caseId = matched.id

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

export type WaAssignment = { fileKey: string; caseId: string; documentType: string }
export type WaFileOutcome = {
  filed: string[]; duplicates: string[]; failed: string[]; caseFileIds: string[]
  files: { name: string; caseId: string; caseFileId: string }[]
}

/** Files a person's decision: each chosen file is copied into its case, and the bundle is marked filed. */
export async function fileBundle(
  sb: SupabaseClient, bundleId: string, assignments: WaAssignment[], caseIds: string[], decidedBy: string,
): Promise<WaFileOutcome> {
  const { data: bundle } = await sb.from('whatsapp_bundles').select('*').eq('id', bundleId).single()
  if (!bundle) throw new Error('WhatsApp messages not found')
  const { data: msgRows } = await sb.from('whatsapp_messages').select('id, customer_name, media').eq('bundle_id', bundleId)
  const messages = new Map((msgRows ?? []).map(m => [m.id as string, { name: m.customer_name as string, media: (m.media ?? []) as WaMedia[] }]))
  const outcome: WaFileOutcome = { filed: [], duplicates: [], failed: [], caseFileIds: [], files: [] }
  const from = (msgRows ?? []).find(m => m.customer_name)?.customer_name || bundle.customer_phone

  const allCaseIds = [...new Set([...caseIds, ...assignments.map(a => a.caseId)])]
  const { data: caseRows } = await sb.from('cases').select('id, case_title').in('id', allCaseIds)
  const titles = new Map((caseRows ?? []).map(c => [c.id, c.case_title ?? '']))
  if (allCaseIds.some(c => !titles.has(c))) throw new Error('Case not found — it may still be saving, try again in a moment')

  const changed = new Set<string>()
  for (const a of assignments) {
    const key = parseWaFileKey(a.fileKey)
    const msg = key ? messages.get(key.messageId) : undefined
    const item = key && msg ? msg.media[key.index] : undefined
    if (!key || !msg || !item || item.download_status !== 'stored' || !item.storage_ref) continue
    const name = displayName(key.messageId, item)

    const earlier = (item.filed_to ?? []).find(f => f.caseId === a.caseId)
    if (earlier) {
      outcome.duplicates.push(name)
      outcome.files.push({ name, caseId: a.caseId, caseFileId: earlier.caseFileId })
      continue
    }
    const record = (caseFileId: string) => {
      outcome.files.push({ name, caseId: a.caseId, caseFileId })
      const filing: WaFiling = { caseId: a.caseId, caseFileId, documentType: a.documentType }
      msg.media[key.index] = { ...msg.media[key.index], filed_to: [...(msg.media[key.index].filed_to ?? []), filing] }
      changed.add(key.messageId)
    }
    try {
      if (item.file_hash) {
        const { data: dup } = await sb.from('case_files').select('id').eq('case_id', a.caseId).eq('file_hash', item.file_hash).limit(1)
        if (dup?.length) {
          record(dup[0].id)
          outcome.duplicates.push(name)
          continue
        }
      }
      const content = await readFile(item.storage_ref)
      const fileRef = await saveFile(caseFolder(a.caseId), name, content, item.mime_type)
      const requiredDocumentId = await resolveRequiredDocForCase(sb, a.caseId, a.documentType)
      let aiPrompt: string | null = null
      if (requiredDocumentId) {
        const { data: doc } = await sb.from('required_documents').select('ai_prompt').eq('id', requiredDocumentId).single()
        aiPrompt = doc?.ai_prompt ?? null
      }
      const caseFileId = randomUUID()
      const { error } = await sb.from('case_files').insert({
        id: caseFileId, case_id: a.caseId, file_name: name, file_size: content.length,
        file_type: item.mime_type, document_type: a.documentType, required_document_id: requiredDocumentId,
        uploaded_by: `${from} (WhatsApp)`, uploaded_at: new Date().toISOString(), file_data_url: fileRef,
        ai_scanned: false, ai_status: 'Pending', ai_extracted_data: null, ai_prompt: aiPrompt, file_hash: item.file_hash ?? null,
      })
      if (error) throw new Error(error.message)

      await sb.from('activity_logs').insert({
        id: randomUUID(), case_id: a.caseId, case_title: titles.get(a.caseId) ?? null,
        action_type: 'DOCUMENT_ASSIGNED', title: 'Filed from WhatsApp',
        description: `${name} from WhatsApp (${from}) filed as "${a.documentType}"`,
        changed_by: decidedBy, timestamp: new Date().toISOString(),
      })
      record(caseFileId)
      outcome.filed.push(name)
      outcome.caseFileIds.push(caseFileId)
    } catch (err) {
      console.error('[whatsapp] filing failed:', name, err instanceof Error ? err.message : err)
      outcome.failed.push(name)
    }
  }

  for (const id of changed) await sb.from('whatsapp_messages').update({ media: messages.get(id)!.media }).eq('id', id)

  // A note on cases that got no file, so the decision shows in their history
  const withFile = new Set(outcome.files.map(f => f.caseId))
  for (const caseId of allCaseIds.filter(c => !withFile.has(c))) {
    await sb.from('activity_logs').insert({
      id: randomUUID(), case_id: caseId, case_title: titles.get(caseId) ?? null,
      action_type: 'DOCUMENT_ASSIGNED', title: 'Filed from WhatsApp',
      description: `WhatsApp messages from ${from} linked to this case`,
      changed_by: decidedBy, timestamp: new Date().toISOString(),
    })
  }

  // Reference numbers kept on the case, so later emails and messages carrying them find it.
  // Only when filed to one case (a split's numbers can't be told apart); a number already kept stays put.
  const s = bundle.ai_suggestion as MailSuggestion | null
  if (allCaseIds.length === 1 && s) {
    const references: MailReference[] = cleanReferences([
      ...(s.referenceNumbers ?? splitReferences(s.references)),
      ...(s.policies ?? []).filter(p => p.policyNumber).map(p => ({ kind: 'policy' as const, value: p.policyNumber })),
    ])
    if (references.length) {
      const { error } = await sb.from('case_references').upsert(
        references.map(r => ({ case_id: allCaseIds[0], kind: r.kind, value: r.value, value_normalized: normalizeReference(r.value) })),
        { onConflict: 'kind,value_normalized', ignoreDuplicates: true })
      if (error) console.error('[whatsapp] saving references failed:', error.message)
    }
  }

  await sb.from('whatsapp_bundles').update({
    case_ids: [...new Set([...((bundle.case_ids ?? []) as string[]), ...allCaseIds])], status: 'filed',
    decided_by: decidedBy, decided_at: new Date().toISOString(),
  }).eq('id', bundleId)
  return outcome
}

// ─── Health ─────────────────────────────────────────────────────────────────

export type EndpointStatus = { ok: boolean; message: string }

/** Whether YCloud's webhook endpoint for DocFlow is active (YCloud pauses one that keeps failing). */
export async function checkWebhookEndpoint(): Promise<EndpointStatus> {
  const { apiKey } = whatsappConfig()
  if (!apiKey) return { ok: false, message: 'YCLOUD_API_KEY is not set' }
  try {
    const res = await fetch('https://api.ycloud.com/v2/webhookEndpoints?limit=100', { headers: { 'X-API-Key': apiKey } })
    if (!res.ok) return { ok: false, message: `YCloud answered HTTP ${res.status}` }
    const page = await res.json() as { items?: { url?: string; status?: string }[] }
    const ours = (page.items ?? []).filter(e => (e.url ?? '').includes('/api/whatsapp/webhook'))
    if (ours.length === 0) return { ok: false, message: 'No YCloud webhook endpoint points to /api/whatsapp/webhook' }
    const active = ours.some(e => e.status === 'active')
    return active
      ? { ok: true, message: 'Active' }
      : { ok: false, message: `The YCloud webhook endpoint is ${ours.map(e => e.status ?? 'unknown').join(', ')} — turn it back on in YCloud` }
  } catch (err) {
    return { ok: false, message: `Could not reach YCloud: ${err instanceof Error ? err.message : err}` }
  }
}

export type WhatsappHealth = {
  lastEventAt: string | null
  failedDownloads7d: number
  unmatchedNumbers: number
  recentEvents: { type: string; result: string | null; receivedAt: string }[]
}

export async function whatsappHealth(sb: SupabaseClient): Promise<WhatsappHealth> {
  const since = new Date(Date.now() - 7 * 86400000).toISOString()
  const [events, failed, unmatched] = await Promise.all([
    sb.from('whatsapp_events').select('type, result, received_at').order('received_at', { ascending: false }).limit(5),
    sb.from('whatsapp_messages').select('id').gte('created_at', since).contains('media', [{ download_status: 'failed' }]),
    sb.from('whatsapp_bundles').select('customer_phone').is('customer_id', null).is('contact_id', null).limit(1000),
  ])
  const recent = events.data ?? []
  return {
    lastEventAt: recent[0]?.received_at ?? null,
    failedDownloads7d: failed.data?.length ?? 0,
    unmatchedNumbers: new Set((unmatched.data ?? []).map(b => b.customer_phone)).size,
    recentEvents: recent.map(e => ({ type: e.type, result: e.result, receivedAt: e.received_at })),
  }
}

// ─── Daily ──────────────────────────────────────────────────────────────────

/** Retries failed downloads (with the API key), reads quiet bundles the AI missed, checks the webhook endpoint. */
export async function dailyWhatsapp(sb: SupabaseClient) {
  const since = new Date(Date.now() - RETRY_DAYS * 86400000).toISOString()
  const waiting = await Promise.all((['failed', 'pending'] as const).map(status =>
    sb.from('whatsapp_messages').select('id').gte('created_at', since)
      .contains('media', [{ download_status: status }]).limit(100)))
  const ids = [...new Set(waiting.flatMap(w => (w.data ?? []).map(m => m.id as string)))]
  let retried = 0
  for (const m of ids.map(id => ({ id }))) {
    try {
      await downloadMessageMedia(sb, m.id, { useKeyFirst: true })
      retried++
    } catch (err) {
      console.error('[whatsapp] retry failed:', m.id, err instanceof Error ? err.message : err)
    }
  }

  let analysed = 0
  for (const id of whatsappConfig().aiEnabled ? await bundlesToAnalyse(sb, 20) : []) {
    await analyseBundle(sb, id)
    analysed++
  }

  const endpoint = await checkWebhookEndpoint()
  const health = await whatsappHealth(sb)
  return { retried, analysed, endpoint, failedDownloads7d: health.failedDownloads7d }
}
