import type { SupabaseClient } from '@supabase/supabase-js'
import type { Customer, IntakeSuggestion } from './types'
import { matchCustomer, ssmKey } from './ssm'
import { notifyDocFlowWebhook } from './n8n'
import { signFileUrlForServer } from './storage-server'

// Server-only. AI suggestions for the Unassigned Inbox (fix list 3.3).
//
// 1. requestIntakeClassification() sends an Inbox item to the n8n workflow at
//    N8N_INTAKE_WEBHOOK_URL with a signed file link and the document types
//    to choose from (the Required Documents names in Settings).
// 2. n8n reads the document and posts what it found to /api/intake/callback,
//    which calls applyIntakeClassification(): DocFlow matches the customer
//    (SSM number first, then name), the case (that customer's open cases) and
//    the checklist slot, and files the item as "suggested" or "needs_review".
//
// The request/response contract for the n8n workflow is in
// docs/n8n-intake-classify.md.

/** At or above this AI certainty (0–1), a clear match is offered for one-click approval. */
export const AI_CONFIDENCE_THRESHOLD = 0.8

/** What n8n reports back for one Inbox item. */
export type ClassificationResult = {
  documentType?: string
  customerName?: string
  ssmNumber?: string
  projectName?: string
  confidence?: number          // 0–1
  extracted?: Record<string, unknown>
  error?: string
}

/** Names of the active Required Documents across all active workflow templates. */
export async function activeDocumentTypes(sb: SupabaseClient): Promise<string[]> {
  const { data: templates } = await sb.from('workflow_templates').select('id').eq('is_active', true)
  const ids = (templates ?? []).map(t => t.id)
  if (ids.length === 0) return []
  const { data: docs } = await sb.from('required_documents').select('name').in('template_id', ids).eq('is_active', true)
  return [...new Set((docs ?? []).map(d => String(d.name)).filter(Boolean))].sort()
}

/** The checklist slot (required_documents.id) named documentType in a case's workflow template. */
export async function resolveRequiredDocForCase(sb: SupabaseClient, caseId: string, documentType: string): Promise<string | null> {
  const { data: caseRow } = await sb.from('cases').select('case_type, workflow_template_id').eq('id', caseId).single()
  if (!caseRow) return null

  let templateId = caseRow.workflow_template_id as string | null
  if (!templateId) {
    const { data: templates } = await sb
      .from('workflow_templates').select('id, business_type')
      .eq('case_type', caseRow.case_type).eq('is_active', true)
    if (!templates || templates.length === 0) return null
    templateId = (templates.find(t => !t.business_type) ?? templates[0]).id
  }

  const { data: docs } = await sb
    .from('required_documents').select('id, name')
    .eq('template_id', templateId).eq('is_active', true)
  if (!docs || docs.length === 0) return null

  const needle = documentType.toLowerCase()
  const match = docs.find(d => d.name.toLowerCase() === needle)
    ?? docs.find(d => d.name.toLowerCase().includes(needle) || needle.includes(d.name.toLowerCase()))
  return match?.id ?? null
}

/**
 * Sends an Inbox item to n8n to be read. Returns false (item left as
 * "received", to be filed by hand) when the n8n workflow isn't set up.
 */
export async function requestIntakeClassification(sb: SupabaseClient, itemId: string): Promise<boolean> {
  const webhookUrl = process.env.N8N_INTAKE_WEBHOOK_URL
  if (!webhookUrl) return false

  const { data: item } = await sb
    .from('intake_items').select('id, file_name, file_type, file_ref, sender, source').eq('id', itemId).single()
  if (!item?.file_ref) return false

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const result = await notifyDocFlowWebhook({
    event: 'intake_classify_requested',
    intakeItemId: item.id,
    fileName: item.file_name,
    fileType: item.file_type,
    fileUrl: await signFileUrlForServer(item.file_ref),
    source: item.source,
    sender: item.sender,
    documentTypes: await activeDocumentTypes(sb),
    callbackUrl: `${appUrl}/api/intake/callback`,
  }, webhookUrl)
  if (!result.ok) return false

  await sb.from('intake_items').update({ status: 'processing' }).eq('id', itemId)
  return true
}

// Words that say nothing about which contract a document belongs to
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'of', 'to', 'at', 'di', 'dan', 'bagi', 'untuk', 'sdn', 'bhd', 'berhad',
  'project', 'projek', 'works', 'kerja', 'kerja2', 'cadangan', 'proposed', 'contract', 'kontrak',
])
const words = (s: string) =>
  new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP_WORDS.has(w)))

/** Share of the shorter title's words found in the other (0–1). */
function titleOverlap(a: string, b: string): number {
  const wa = words(a), wb = words(b)
  if (wa.size === 0 || wb.size === 0) return 0
  let shared = 0
  for (const w of wa) if (wb.has(w)) shared++
  return shared / Math.min(wa.size, wb.size)
}

/** Turns what n8n read into a suggestion and decides "suggested" vs "needs_review". */
export async function applyIntakeClassification(sb: SupabaseClient, itemId: string, r: ClassificationResult) {
  if (r.error) {
    await sb.from('intake_items').update({
      status: 'needs_review',
      ai_suggestion: { note: `The AI could not read this document: ${r.error}` } satisfies IntakeSuggestion,
      confidence: null,
    }).eq('id', itemId)
    return
  }

  const confidence = typeof r.confidence === 'number' ? Math.max(0, Math.min(1, r.confidence)) : null
  const suggestion: IntakeSuggestion = {
    documentType: r.documentType || undefined,
    projectName: r.projectName || undefined,
    extracted: r.extracted,
  }
  const notes: string[] = []

  // Customer: SSM number first, then name
  const { data: customerRows } = await sb.from('customers').select('id, customer_name, company_registration_no')
  const customers = (customerRows ?? []).map(c => ({
    id: c.id, customerName: c.customer_name ?? '', companyRegistrationNo: c.company_registration_no ?? '',
  })) as Customer[]
  const customer = matchCustomer(customers, { ssm: r.ssmNumber, name: r.customerName })

  if (customer) {
    suggestion.customer = { id: customer.id, name: customer.customerName, ssm: customer.companyRegistrationNo || undefined, isNew: false }

    // Case: the customer's open case whose title best matches the project
    const { data: openCases } = await sb
      .from('cases').select('id, case_title, created_at')
      .eq('customer_id', customer.id).is('archived_at', null).neq('current_status', 'Done')
      .order('created_at', { ascending: false })
    const cases = openCases ?? []
    const best = r.projectName
      ? cases.map(c => ({ c, score: titleOverlap(r.projectName!, c.case_title ?? '') })).sort((a, b) => b.score - a.score)[0]
      : undefined
    const chosen = best && best.score >= 0.5 ? best.c : cases.length === 1 ? cases[0] : undefined
    if (chosen) {
      suggestion.case = { id: chosen.id, title: chosen.case_title, isNew: false }
    } else {
      notes.push(cases.length === 0
        ? `${customer.customerName} has no open case — choose one or create it.`
        : `${customer.customerName} has ${cases.length} open cases — choose the right one.`)
    }
  } else if (r.customerName?.trim()) {
    // A customer DocFlow doesn't know yet: suggest creating it, with a new case
    suggestion.customer = { name: r.customerName.trim(), ssm: r.ssmNumber && ssmKey(r.ssmNumber) ? r.ssmNumber : undefined, isNew: true }
    const now = new Date()
    const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`
    suggestion.case = { title: `${yearMonth} - ${r.projectName?.trim() || r.customerName.trim()}`, isNew: true }
    notes.push('New customer and case — check the details before approving.')
  } else {
    notes.push('The AI could not tell which customer this is for.')
  }

  if (suggestion.case?.id && suggestion.documentType) {
    suggestion.requiredDocumentId = await resolveRequiredDocForCase(sb, suggestion.case.id, suggestion.documentType) ?? undefined
  }
  if (!suggestion.documentType) notes.push('The AI could not tell what kind of document this is.')
  if (confidence !== null && confidence < AI_CONFIDENCE_THRESHOLD) {
    notes.push(`The AI is only ${Math.round(confidence * 100)}% sure.`)
  }

  // One-click approval only for a confident, complete match to existing records
  const ready = confidence !== null && confidence >= AI_CONFIDENCE_THRESHOLD
    && !!suggestion.documentType && !!suggestion.customer && !suggestion.customer.isNew && !!suggestion.case?.id
  if (notes.length) suggestion.note = notes.join(' ')

  await sb.from('intake_items').update({
    status: ready ? 'suggested' : 'needs_review',
    ai_suggestion: suggestion,
    confidence,
  }).eq('id', itemId)
}
