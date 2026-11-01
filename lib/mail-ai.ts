import Anthropic from '@anthropic-ai/sdk'
import { CASE_TYPES, MAIL_ACTIONS, REQUEST_TYPES } from './types'

// Server-only. Claude reads one email from the shared mailbox — its text and
// its PDF / image attachments — and says what it is (Emails screen):
// a new case, part of an existing open case, split across several cases, or
// not a case; plus the details it can find and a document type for each
// attachment. lib/mail-inbox.ts turns the answer into a MailSuggestion.

const MODEL = 'claude-opus-5-5'

// Attachments Claude can read directly; anything else is judged by its name
const READABLE: Record<string, 'document' | 'image'> = {
  'application/pdf': 'document',
  'image/jpeg': 'image', 'image/png': 'image', 'image/gif': 'image', 'image/webp': 'image',
}
export const isReadable = (contentType: string) => !!READABLE[contentType.toLowerCase()]

export type EmailForAi = {
  subject: string
  from: string
  to: string
  cc: string
  receivedAt: string
  body: string
  attachments: { name: string; contentType: string; content?: Buffer }[]   // content only for readable files sent
  openCases: { caseNumber: string; title: string; customer: string; principal: string; amount: number }[]
  documentTypes: string[]
}

/** What Claude answers (the schema below). Unknown text is "", unknown numbers 0. */
export type EmailAiResult = {
  action: (typeof MAIL_ACTIONS)[number]
  summary: string
  confidence: number
  customerName: string
  ssmNumber: string
  caseNumber: string
  caseTitle: string
  caseType: string
  requestType: string
  principal: string
  amount: number
  coverTypes: string
  references: string
  policies: { policyType: string; policyNumber: string; insurer: string; sumInsured: number; startDate: string; expiryDate: string }[]
  attachments: { index: number; documentType: string; caseNumber: string }[]
}

const str = (description: string) => ({ type: 'string', description })

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'action', 'summary', 'confidence', 'customerName', 'ssmNumber', 'caseNumber', 'caseTitle',
    'caseType', 'requestType', 'principal', 'amount', 'coverTypes', 'references', 'policies', 'attachments',
  ],
  properties: {
    action: { type: 'string', enum: [...MAIL_ACTIONS] },
    summary: str('One short line in plain English saying what the email is and why you chose the action, e.g. "BSN purchase order + 2 cover notes; no open case for KY Jaya"'),
    confidence: { type: 'number', description: 'How sure you are of the action and case, 0 to 1' },
    customerName: str('Our customer (the contractor applying for the bond / insurance), "" if unknown'),
    ssmNumber: str('The customer\'s SSM company registration number, "" if not shown'),
    caseNumber: str('For existing_case: the open case number it belongs to, else ""'),
    caseTitle: str('For create_case: a short project title, e.g. "Roller shutter, BSN Terengganu", else ""'),
    caseType: { type: 'string', enum: [...CASE_TYPES, ''], description: 'For create_case: the workflow, else ""' },
    requestType: { type: 'string', enum: [...REQUEST_TYPES, ''], description: 'For create_case, else ""' },
    principal: str('The employer / project owner the work is for, "" if unknown'),
    amount: { type: 'number', description: 'Contract value in RM, 0 if unknown' },
    coverTypes: str('Bonds / covers involved, e.g. "CAR + WC" or "Performance Bond", "" if none'),
    references: str('Reference numbers worth keeping (RFQ, PO, tender, LOA numbers), "" if none'),
    policies: {
      type: 'array',
      description: 'Each cover note, policy or bond issued in this email (not quotations)',
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
      description: 'One entry per attachment listed in the email',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['index', 'documentType', 'caseNumber'],
        properties: {
          index: { type: 'integer', description: 'The attachment number from the list' },
          documentType: str('One of the document type names given, or "Other"'),
          caseNumber: str('For split: the open case this attachment belongs to, else ""'),
        },
      },
    },
  },
}

const SYSTEM = `You sort incoming emails for Trident Management, a Malaysian bond and insurance broker. Staff, customers and insurers send emails to the shared operations mailbox. Decide what each email is:

- create_case: a new contract or project needing bonds or insurance that is not among the open cases — typically a letter of award, purchase order, tender result, or an insurer's quotation / cover note for a project not in the list.
- existing_case: it belongs to one of the open cases. Match on case number, project, customer, cover note / policy / bond numbers and reference numbers. When the project matches an open case, prefer existing_case over create_case.
- split: it covers several open cases at once, e.g. one payment advice or statement for several projects. Give each attachment its case.
- not_case: nothing to file — newsletters, marketing, performance reports, system notices, internal chatter.

Extract the details you can find from the email and its attachments. For each attachment pick a document type from the given list (exact name), or "Other". Never invent numbers or dates: leave text "" and numbers 0 when not shown. Dates are YYYY-MM-DD.`

function prompt(e: EmailForAi): string {
  const attachments = e.attachments.length
    ? e.attachments.map((a, i) => `${i + 1}. ${a.name}${a.content ? '' : ' (not attached here — judge by its name)'}`).join('\n')
    : '(none)'
  const cases = e.openCases.length
    ? e.openCases.map(c => `${c.caseNumber} | ${c.title} | customer: ${c.customer}${c.principal ? ` | contractor: ${c.principal}` : ''}${c.amount ? ` | RM ${c.amount}` : ''}`).join('\n')
    : '(none)'
  return `EMAIL
From: ${e.from}
To: ${e.to}${e.cc ? `\nCc: ${e.cc}` : ''}
Received: ${e.receivedAt}
Subject: ${e.subject}

${e.body || '(no text)'}

ATTACHMENTS (the readable ones are attached above, in this order)
${attachments}

OPEN CASES (case number | title | customer)
${cases}

DOCUMENT TYPES
${e.documentTypes.join('\n') || '(none set up — use "Other")'}`
}

/** Asks Claude what the email is. Throws if Claude declines or returns nothing usable. */
export async function readEmail(e: EmailForAi): Promise<EmailAiResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const files: Anthropic.ContentBlockParam[] = e.attachments.flatMap((a): Anthropic.ContentBlockParam[] => {
    if (!a.content) return []
    const data = a.content.toString('base64')
    const kind = READABLE[a.contentType.toLowerCase()]
    if (kind === 'document') {
      return [{ type: 'document', title: a.name, source: { type: 'base64', media_type: 'application/pdf', data } }]
    }
    if (kind === 'image') {
      const media_type = a.contentType.toLowerCase() as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      return [{ type: 'image', source: { type: 'base64', media_type, data } }]
    }
    return []
  })

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: [...files, { type: 'text', text: prompt(e) }] }],
  })

  if (response.stop_reason === 'refusal') throw new Error('The AI declined to read this email')
  const text = response.content.find(b => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error('The AI returned no answer')
  return JSON.parse(text.text) as EmailAiResult
}
