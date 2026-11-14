import type { MailSuggestion } from './types'

// ─── WhatsApp screen (whatsapp_messages / whatsapp_bundles) ──────────────────
// Stored as written in the database (snake_case inside the media list).

export type WaDownloadStatus = 'pending' | 'stored' | 'failed' | 'skipped'

export type WaFiling = { caseId: string; caseFileId: string; documentType: string }

export type WaMedia = {
  media_id: string
  filename: string
  mime_type: string
  sha256: string           // as YCloud sent it
  size: number
  link?: string            // YCloud's download link; works with the API key for 30 days
  file_hash?: string       // hex SHA-256 of the stored file — the same file is stored once
  storage_ref?: string     // "storage:<path>" (lib/storage.ts)
  download_status: WaDownloadStatus
  error?: string
  filed_to?: WaFiling[]
}

export type WaMessage = {
  id: string
  direction: 'in' | 'out'
  customerPhone: string
  customerName: string     // WhatsApp profile name
  contactId?: string
  customerId?: string
  type: string
  body: string
  sentAt: string
  media: WaMedia[]
  bundleId?: string
}

export const WA_STATUSES = ['new', 'analysing', 'ready', 'filed', 'not_case'] as const
export type WaStatus = (typeof WA_STATUSES)[number]

export type WaBundle = {
  id: string
  customerPhone: string
  contactId?: string
  customerId?: string
  firstAt: string
  lastAt: string
  messageCount: number
  status: WaStatus
  aiSuggestion?: MailSuggestion | null   // attachments keyed by waFileKey()
  aiError?: string
  caseIds: string[]
  decidedBy?: string
  decidedAt?: string
}

/** One file of a bundle: "<message id>:<index in its media list>". */
export const waFileKey = (messageId: string, index: number) => `${messageId}:${index}`
export function parseWaFileKey(key: string): { messageId: string; index: number } | null {
  const i = key.lastIndexOf(':')
  if (i <= 0) return null
  const index = Number(key.slice(i + 1))
  return Number.isInteger(index) && index >= 0 ? { messageId: key.slice(0, i), index } : null
}
