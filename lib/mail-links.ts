import type { MailAttachment, MailReference, MailSuggestion, ReferenceKind } from './types'

// How the Emails screen ties emails to cases beyond what the AI reads:
//
// - Threads: replies share Outlook's conversation id. Once an email is filed,
//   its conversation id is recorded against those cases (case_conversations),
//   so a later reply in the same thread is suggested for the same case(s).
// - References: the quote / cover note / policy / RFQ / PO / tender / LOA
//   numbers of a filed email are kept against its case (case_references).
//   A new email carrying one of them — e.g. a forward, which starts a new
//   thread — is suggested for that case, naming the reference.
//
// The person can always change the suggestion. Database access goes through
// CaseLinkStore (lib/mail-inbox.ts has the Supabase one), so this file has no
// server code and is tested on its own (lib/mail-links.test.mjs).

const KIND_LABELS: Record<ReferenceKind, string> = {
  quote: 'Quote ref', cover_note: 'Cover note', policy: 'Policy', rfq: 'RFQ',
  po: 'PO', tender: 'Tender', loa: 'LOA', other: 'Reference',
}

// Shorter numbers match too much by chance to be trusted
const MIN_REFERENCE_LENGTH = 5
const MAX_TEXT_CANDIDATES = 200

/**
 * The form references are compared in: label dropped ("QTS: ", "Ref No: ",
 * "PO#"), upper case, letters and digits only. "QTS: B62716/26" → "B6271626".
 */
export function normalizeReference(raw: string): string {
  const v = raw.toUpperCase().trim().replace(/^[A-Z .]{0,20}[:#]\s*/, '')
  return v.replace(/[^A-Z0-9]/g, '')
}

const usable = (normalized: string) => normalized.length >= MIN_REFERENCE_LENGTH && /\d/.test(normalized)

/** Reference-like words in free text (subject, body, file names), normalized — used only to look up. */
export function referenceCandidates(text: string): string[] {
  const found = new Set<string>()
  for (const m of text.toUpperCase().matchAll(/[A-Z0-9][A-Z0-9/.-]*[A-Z0-9]/g)) {
    const n = normalizeReference(m[0])
    if (usable(n)) found.add(n)
    if (found.size >= MAX_TEXT_CANDIDATES) break
  }
  return [...found]
}

/** The references worth keeping, without repeats (by normalized value). */
export function cleanReferences(refs: MailReference[]): MailReference[] {
  const seen = new Set<string>()
  return refs
    .map(r => ({ kind: r.kind, value: r.value.trim() }))
    .filter(r => {
      const n = normalizeReference(r.value)
      if (!usable(n) || seen.has(n)) return false
      seen.add(n)
      return true
    })
}

/** References from a suggestion made before they were listed by kind ("QTS: B62716/26; KL40465"). */
export function splitReferences(text?: string): MailReference[] {
  return (text ?? '').split(/[;,\n]/).map(v => v.trim()).filter(Boolean).map(value => ({ kind: 'other' as const, value }))
}

/** A store over rows already loaded — to check many emails with a few queries. */
export function loadedStore(conversations: { caseId: string; conversationId: string }[], references: StoredReference[]): CaseLinkStore {
  return {
    async casesForConversation(id) { return conversations.filter(c => c.conversationId === id).map(c => c.caseId) },
    async findReferences(normalized) { return references.filter(r => normalized.includes(r.valueNormalized)) },
    async link() { throw new Error('read only') },
  }
}

export const describeReference =(r: MailReference) => `${KIND_LABELS[r.kind] ?? 'Reference'} ${r.value}`

// ─── Store ──────────────────────────────────────────────────────────────────

export type StoredReference = { caseId: string; kind: ReferenceKind; value: string; valueNormalized: string }

export interface CaseLinkStore {
  /** Cases an email of this thread was filed to, most recent first. */
  casesForConversation(conversationId: string): Promise<string[]>
  /** Stored references whose normalized value is one of these. */
  findReferences(normalized: string[]): Promise<StoredReference[]>
  /** Records the thread against each case, and the references against `referencesCaseId`. */
  link(caseIds: string[], conversationId: string | null, references: MailReference[], referencesCaseId: string | null, mailId: string): Promise<void>
}

// ─── Matching ───────────────────────────────────────────────────────────────

export type CaseMatch =
  | { by: 'thread'; caseIds: string[] }
  | { by: 'reference'; caseId: string; reference: MailReference }

/**
 * Looks for a case this email belongs to: first by thread, then by every
 * reference the AI found plus reference-like words in the email's text.
 */
export async function findCaseMatch(store: CaseLinkStore, email: {
  conversationId?: string | null
  references: MailReference[]
  text: string
}): Promise<CaseMatch | undefined> {
  if (email.conversationId) {
    const caseIds = await store.casesForConversation(email.conversationId)
    if (caseIds.length) return { by: 'thread', caseIds }
  }

  const wanted = [...new Set([
    ...email.references.map(r => normalizeReference(r.value)).filter(usable),
    ...referenceCandidates(email.text),
  ])]
  if (wanted.length === 0) return undefined
  const hits = await store.findReferences(wanted)
  if (hits.length === 0) return undefined

  // The case with the most matching references; the first found on a tie
  const byCase = new Map<string, StoredReference[]>()
  for (const h of hits) byCase.set(h.caseId, [...(byCase.get(h.caseId) ?? []), h])
  const [caseId, refs] = [...byCase.entries()].sort((a, b) => b[1].length - a[1].length)[0]
  return { by: 'reference', caseId, reference: { kind: refs[0].kind, value: refs[0].value } }
}

/**
 * Records a filed email: its thread against every case it was filed to, and
 * its references against the case — only when it went to one case, since a
 * split email's numbers can't be told apart. A number already kept for a
 * case stays with that case.
 */
export function recordFiling(store: CaseLinkStore, filed: {
  mailId: string
  caseIds: string[]
  conversationId?: string | null
  references: MailReference[]
}): Promise<void> {
  const one = filed.caseIds.length === 1 ? filed.caseIds[0] : null
  return store.link(filed.caseIds, filed.conversationId ?? null, one ? cleanReferences(filed.references) : [], one, filed.mailId)
}

const THREAD_CONFIDENCE = 0.95
const REFERENCE_CONFIDENCE = 0.9

/**
 * Puts a thread or reference match into the AI's suggestion. A thread wins
 * over the AI; a reference replaces "create new case" / "not a case" / an
 * existing case the AI could not name. Attachment document types are kept.
 */
export function applyCaseMatch(
  s: MailSuggestion, match: CaseMatch | undefined, caseLabel: (id: string) => string,
): MailSuggestion {
  if (!match) return s

  if (match.by === 'thread') {
    const reason = `Same email thread as ${match.caseIds.map(caseLabel).join(', ')}`
    const inThread = new Set(match.caseIds)
    const attachments = Object.fromEntries(Object.entries(s.attachments).map(([id, a]) =>
      [id, { ...a, caseId: a.caseId && inThread.has(a.caseId) ? a.caseId : undefined }]))
    const confidence = Math.max(s.confidence, THREAD_CONFIDENCE)

    // Several cases: the one the AI named, else split when the AI split
    // between them, else the most recent
    const aiCase = s.action === 'existing_case' && s.caseId && inThread.has(s.caseId) ? s.caseId : undefined
    const aiSplit = s.action === 'split' && Object.values(attachments).some(a => a.caseId)
    if (match.caseIds.length > 1 && !aiCase && aiSplit) {
      return { ...s, action: 'split', caseId: undefined, caseTitle: undefined, attachments, confidence, matchReason: reason }
    }
    return {
      ...s, action: 'existing_case', caseId: aiCase ?? match.caseIds[0], caseTitle: undefined,
      attachments, confidence, matchReason: reason,
    }
  }

  const reason = `${describeReference(match.reference)} is on ${caseLabel(match.caseId)}`
  if (s.action === 'split' || (s.action === 'existing_case' && s.caseId && s.caseId !== match.caseId)) return s
  return {
    ...s, action: 'existing_case', caseId: match.caseId, caseTitle: undefined,
    confidence: Math.max(s.confidence, REFERENCE_CONFIDENCE), matchReason: reason,
  }
}

/** An email's attachments with a deleted case's filings taken off. */
export function withoutCaseFilings(attachments: MailAttachment[], caseId: string): MailAttachment[] {
  return attachments.map(({ filedTo, alsoFiledTo, ...file }) => {
    const [first, ...rest] = [...(filedTo ? [filedTo] : []), ...(alsoFiledTo ?? [])].filter(f => f.caseId !== caseId)
    return { ...file, ...(first ? { filedTo: first } : {}), ...(rest.length ? { alsoFiledTo: rest } : {}) }
  })
}

// ─── Threads on the Emails screen ───────────────────────────────────────────

export type Thread<T> = { key: string; messages: T[]; latest: T }

/** One entry per conversation, newest thread first; messages oldest first. */
export function groupThreads<T extends { id: string; conversationId?: string; receivedAt: string }>(mails: T[]): Thread<T>[] {
  const byKey = new Map<string, T[]>()
  for (const m of mails) {
    const key = m.conversationId || m.id
    byKey.set(key, [...(byKey.get(key) ?? []), m])
  }
  return [...byKey.entries()]
    .map(([key, list]) => {
      const messages = [...list].sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt))
      return { key, messages, latest: messages[messages.length - 1] }
    })
    .sort((a, b) => Date.parse(b.latest.receivedAt) - Date.parse(a.latest.receivedAt))
}
