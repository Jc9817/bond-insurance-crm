import Anthropic from '@anthropic-ai/sdk'
import { CASE_TYPES, MAIL_ACTIONS, REFERENCE_KINDS, REQUEST_TYPES } from './types'
import type { EmailAiResult } from './mail-ai'

// Server-only. Claude reads one WhatsApp bundle — a customer's texts and
// captions in order, plus the PDFs and photos they sent — and says what it
// is, in the same shape as the Emails screen's reading (lib/mail-ai.ts), so
// the same decision panel and filing rules apply.
//
// Claude Haiku 5.5 reads it first. When Haiku is unsure, or says a photo
// can't be read, Claude Sonnet 5.5 reads it again.
//
// Personal data: the prompt forbids copying IC / passport / bank account
// numbers into any field. Those documents stay files only.

const FIRST_MODEL = 'claude-haiku-5-5'
const SECOND_MODEL = 'claude-sonnet-5-5'
const LOW_CONFIDENCE = 0.6

const READABLE: Record<string, 'document' | 'image'> = {
  'application/pdf': 'document',
  'image/jpeg': 'image', 'image/png': 'image', 'image/gif': 'image', 'image/webp': 'image',
}
export const isReadableFile = (mimeType: string) => !!READABLE[mimeType.split(';')[0].trim().toLowerCase()]

export type BundleForAi = {
  senderPhone: string
  senderName: string          // matched contact / customer, else the WhatsApp profile name, else ""
  matchedCustomer: string     // the customer the number belongs to, "" if unknown
  messages: { sentAt: string; text: string; file?: string }[]   // in order; file = the file's number + name
  files: { name: string; mimeType: string; content?: Buffer }[]  // content only for readable files sent
  openCases: { caseNumber: string; title: string; customer: string; principal: string; amount: number; sendersCustomer: boolean }[]
  documentTypes: string[]
}

export type WhatsappAiResult = EmailAiResult & { unreadable: boolean; model: string }

const str = (description: string) => ({ type: 'string', description })

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'action', 'summary', 'confidence', 'unreadable', 'customerName', 'ssmNumber', 'caseNumber', 'caseTitle',
    'caseType', 'requestType', 'principal', 'amount', 'coverTypes', 'references', 'policies', 'attachments',
  ],
  properties: {
    action: { type: 'string', enum: [...MAIL_ACTIONS] },
    summary: str('One short line in plain English: what was sent and why you chose the action, e.g. "SSM + 2 IC copies for the Jalan Rawang case". Name document TYPES only, never any IC, passport or bank account number.'),
    confidence: { type: 'number', description: 'How sure you are of the action and case, 0 to 1' },
    unreadable: { type: 'boolean', description: 'true if a photo or file you were given is too blurry, cut off or dark to read' },
    customerName: str('Our customer (the contractor applying for the bond / insurance), "" if unknown'),
    ssmNumber: str('The customer\'s SSM company registration number, "" if not shown'),
    caseNumber: str('For existing_case: the open case number it belongs to, else ""'),
    caseTitle: str('For create_case: a short project title, e.g. "Roller shutter, BSN Terengganu", else ""'),
    caseType: { type: 'string', enum: [...CASE_TYPES, ''], description: 'For create_case: the workflow, else ""' },
    requestType: { type: 'string', enum: [...REQUEST_TYPES, ''], description: 'For create_case, else ""' },
    principal: str('The employer / project owner the work is for, "" if unknown'),
    amount: { type: 'number', description: 'Contract value in RM, 0 if unknown' },
    coverTypes: str('Bonds / covers involved, e.g. "CAR + WC" or "Performance Bond", "" if none'),
    references: {
      type: 'array',
      description: 'Every quotation, cover note, policy, bond, RFQ, PO, tender or LOA number, each once. Never IC, passport, phone or bank account numbers.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'value'],
        properties: {
          kind: { type: 'string', enum: [...REFERENCE_KINDS] },
          value: str('The number as written, without its label'),
        },
      },
    },
    policies: {
      type: 'array',
      description: 'Each cover note, policy or bond issued (not quotations)',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['policyType', 'policyNumber', 'insurer', 'sumInsured', 'startDate', 'expiryDate'],
        properties: {
          policyType: str('e.g. CAR, WC, Performance Bond'),
          policyNumber: str('Cover note / policy / bond number'),
          insurer: str('Insurer name, "" if unknown'),
          sumInsured: { type: 'number', description: 'RM, 0 if unknown' },
          startDate: str('YYYY-MM-DD, "" if unknown'),
          expiryDate: str('YYYY-MM-DD, "" if unknown'),
        },
      },
    },
    attachments: {
      type: 'array',
      description: 'One entry per file listed',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['index', 'documentType', 'caseNumber'],
        properties: {
          index: { type: 'integer', description: 'The file number from the list' },
          documentType: str('One of the document type names given, or "Other"'),
          caseNumber: str('For split: the open case this file belongs to, else ""'),
        },
      },
    },
  },
}

const SYSTEM = `You sort WhatsApp messages for Trident Management, a Malaysian bond and insurance broker. Customers (contractors) send the agency's WhatsApp number texts, photos and PDFs — often a short text such as "SSM for Jalan Rawang" followed by several photos. You get one such burst at a time. Decide what it is:

- create_case: documents for a new contract or project needing bonds or insurance that is not among the open cases — e.g. a letter of award or purchase order for a new project.
- existing_case: it belongs to one of the open cases. Cases marked SENDER'S are the sender's own customer's cases: when the sender is known, prefer one of those. Match on project names, case numbers and reference numbers.
- split: the files belong to several open cases. Give each file its case.
- not_case: nothing to file — greetings, questions, payment chatter, stickers.

Texts may be in English, Malay or Chinese, and short or informal.

List every quotation, cover note, policy, bond, RFQ, PO, tender and LOA number you see. For each file pick a document type from the given list (exact name), or "Other". Never invent numbers or dates: leave text "" and numbers 0 when not shown. Dates are YYYY-MM-DD.

Personal data: never write an IC (MyKad), passport, phone or bank account number, or a bank balance, into any field — not the summary, not the references. Describe such documents by type only ("IC copy", "bank statement").

Set unreadable to true if a photo or file is too blurry, cut off or dark to read.`

function prompt(b: BundleForAi): string {
  const messages = b.messages.map(m => `[${m.sentAt}] ${m.text || '(no text)'}${m.file ? `  — sent file ${m.file}` : ''}`).join('\n') || '(none)'
  const files = b.files.length
    ? b.files.map((f, i) => `${i + 1}. ${f.name}${f.content ? '' : ' (not attached here — judge by its name)'}`).join('\n')
    : '(none)'
  const cases = b.openCases.length
    ? b.openCases.map(c => `${c.sendersCustomer ? "SENDER'S | " : ''}${c.caseNumber} | ${c.title} | customer: ${c.customer}${c.principal ? ` | contractor: ${c.principal}` : ''}${c.amount ? ` | RM ${c.amount}` : ''}`).join('\n')
    : '(none)'
  return `WHATSAPP MESSAGES (oldest first)
From: ${b.senderName || 'unknown sender'} (${b.senderPhone})
Sender's customer in DocFlow: ${b.matchedCustomer || '(not known)'}

${messages}

FILES (the readable ones are attached above, in this order)
${files}

OPEN CASES (case number | title | customer)
${cases}

DOCUMENT TYPES
${b.documentTypes.join('\n') || '(none set up — use "Other")'}`
}

async function ask(client: Anthropic, model: string, b: BundleForAi): Promise<WhatsappAiResult> {
  const files: Anthropic.ContentBlockParam[] = b.files.flatMap((f): Anthropic.ContentBlockParam[] => {
    if (!f.content) return []
    const mime = f.mimeType.split(';')[0].trim().toLowerCase()
    const data = f.content.toString('base64')
    if (READABLE[mime] === 'document') {
      return [{ type: 'document', title: f.name, source: { type: 'base64', media_type: 'application/pdf', data } }]
    }
    if (READABLE[mime] === 'image') {
      return [{ type: 'image', source: { type: 'base64', media_type: mime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data } }]
    }
    return []
  })

  const response = await client.messages.create({
    model,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: [...files, { type: 'text', text: prompt(b) }] }],
  })
  if (response.stop_reason === 'refusal') throw new Error('The AI declined to read these messages')
  const text = response.content.find(block => block.type === 'text')
  if (!text || text.type !== 'text') throw new Error('The AI returned no answer')
  return { ...(JSON.parse(text.text) as Omit<WhatsappAiResult, 'model'>), model }
}

/** Asks Claude what a WhatsApp bundle is: Haiku first, Sonnet when Haiku is unsure or can't read a photo. */
export async function readWhatsappBundle(b: BundleForAi): Promise<WhatsappAiResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
  const client = new Anthropic({ apiKey })

  let first: WhatsappAiResult | undefined
  try {
    first = await ask(client, FIRST_MODEL, b)
    if (!first.unreadable && Number(first.confidence) >= LOW_CONFIDENCE) return first
  } catch (err) {
    console.error('[whatsapp] first AI reading failed:', err instanceof Error ? err.message : err)
  }
  try {
    return await ask(client, SECOND_MODEL, b)
  } catch (err) {
    if (first) return first
    throw err
  }
}
