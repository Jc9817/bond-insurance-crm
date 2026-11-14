import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

// The WhatsApp screen's rules, with no database or network code of their
// own, so they are tested on their own (lib/whatsapp-core.test.mjs):
//
// - normalizePhone()   Malaysian numbers in one form (+60…)
// - verifySignature()  is a webhook call really from YCloud?
// - parseEvent()       the parts of a YCloud event DocFlow uses
// - bundling           a text and the photos that follow it are one decision
// - downloadMedia()    fetch a document / photo, check it is complete
//
// DocFlow never sends WhatsApp messages; nothing here does.

// ─── Phone numbers ──────────────────────────────────────────────────────────

/**
 * A phone number in E.164 form, Malaysia by default:
 * "012-345 6789" → "+60123456789", "60123456789" → "+60123456789",
 * "+65 9123 4567" → "+6591234567". Null when it isn't a phone number.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let s = String(raw).trim().replace(/[\s\-().]/g, '')
  if (s.startsWith('00')) s = `+${s.slice(2)}`
  if (!/^\+?\d+$/.test(s)) return null
  if (s.startsWith('+')) s = s.slice(1)
  else if (s.startsWith('0')) s = `60${s.slice(1)}`
  if (s.length < 8 || s.length > 15) return null
  return `+${s}`
}

// ─── Signature ──────────────────────────────────────────────────────────────

export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60

/**
 * YCloud's "YCloud-Signature: t=<unix seconds>,s=<hex>" header, where s is
 * HMAC-SHA256(secret, "<t>.<raw body>") — "Implement a webhook receiver" in
 * YCloud's docs. Calls older than 5 minutes are refused too, so a copied call
 * can't be replayed later.
 */
export function verifySignature(
  header: string | null | undefined, rawBody: string, secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || !secret) return false
  const parts = Object.fromEntries(header.split(',').map(p => {
    const i = p.indexOf('=')
    return i === -1 ? [p.trim(), ''] : [p.slice(0, i).trim(), p.slice(i + 1).trim()]
  }))
  const t = parts.t, s = parts.s
  if (!t || !s || !/^\d+$/.test(t) || !/^[0-9a-f]+$/i.test(s)) return false
  if (Math.abs(nowSeconds - Number(t)) > SIGNATURE_TOLERANCE_SECONDS) return false
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest()
  const given = Buffer.from(s, 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

// ─── Events ─────────────────────────────────────────────────────────────────

export const EVENT_INBOUND = 'whatsapp.inbound_message.received'
// Optional (WHATSAPP_SYNC_BUSINESS_APP): what staff send from the phone, and
// the chat history YCloud passes on when the number is connected
export const EVENT_ECHO = 'whatsapp.smb.message.echoes'
export const EVENT_HISTORY = 'whatsapp.smb.history'

export const MESSAGE_TYPES = ['text', 'document', 'image', 'audio', 'video', 'sticker', 'location', 'other'] as const
export type MessageType = (typeof MESSAGE_TYPES)[number]
const MEDIA_TYPES = ['document', 'image', 'audio', 'video', 'sticker'] as const

export type IncomingMedia = { id: string; link: string; mimeType: string; sha256: string; filename?: string }

export type ParsedMessage = {
  ycloudId: string
  wamid: string
  direction: 'in' | 'out'
  customerPhone: string      // E.164
  businessNumber: string     // E.164
  profileName: string
  sentAt: string             // ISO
  type: MessageType
  body: string               // text or caption
  media?: IncomingMedia
}

export type ParsedEvent =
  | { kind: 'message'; id: string; type: string; message: ParsedMessage }
  | { kind: 'ignore'; id: string; type: string; reason: string }

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const text = (v: unknown) => (typeof v === 'string' ? v : '')

/** A group chat id or a group-like payload (Coexistence doesn't pass groups on, but just in case). */
function looksLikeGroup(m: Json): boolean {
  const ids = [text(m.from), text(m.to)]
  return ids.some(id => id.includes('@g.us')) || 'group' in m || 'groupId' in m
}

/**
 * The message in a YCloud event, or why DocFlow ignores the event.
 * `businessNumber` is WHATSAPP_BUSINESS_NUMBER; `withBusinessApp` turns on the
 * optional echo / history events.
 */
export function parseEvent(body: unknown, opts: { businessNumber: string; withBusinessApp: boolean }): ParsedEvent {
  const e = obj(body)
  const id = text(e.id)
  const type = text(e.type)
  const ignore = (reason: string): ParsedEvent => ({ kind: 'ignore', id, type, reason })

  let raw: Json, direction: 'in' | 'out'
  if (type === EVENT_INBOUND) {
    raw = obj(e.whatsappInboundMessage); direction = 'in'
  } else if ((type === EVENT_ECHO || type === EVENT_HISTORY) && opts.withBusinessApp) {
    if (e.whatsappInboundMessage) { raw = obj(e.whatsappInboundMessage); direction = 'in' }
    else if (e.whatsappMessage) { raw = obj(e.whatsappMessage); direction = 'out' }
    else return ignore('no message (sync progress)')
  } else {
    return ignore('event type not used')
  }

  if (looksLikeGroup(raw)) return ignore('group chat')
  const from = normalizePhone(text(raw.from))
  const to = normalizePhone(text(raw.to))
  const business = normalizePhone(opts.businessNumber)
  if (!from || !to || !business) return ignore('missing phone number')
  const ours = direction === 'in' ? to : from
  if (ours !== business) return ignore('other business number')

  const rawType = text(raw.type)
  const msgType: MessageType = (MESSAGE_TYPES as readonly string[]).includes(rawType) ? rawType as MessageType : 'other'
  let bodyText = ''
  let media: IncomingMedia | undefined
  if (msgType === 'text') bodyText = text(obj(raw.text).body)
  if ((MEDIA_TYPES as readonly string[]).includes(msgType)) {
    const m = obj(raw[msgType])
    bodyText = text(m.caption)
    if (text(m.link) || text(m.id)) {
      media = {
        id: text(m.id), link: text(m.link), mimeType: text(m.mime_type) || 'application/octet-stream',
        sha256: text(m.sha256), ...(text(m.filename) ? { filename: text(m.filename) } : {}),
      }
    }
  }
  if (msgType === 'location') {
    const l = obj(raw.location)
    bodyText = [text(l.name), text(l.address)].filter(Boolean).join(', ')
  }

  const sendTime = text(raw.sendTime) || text(raw.createTime) || text(e.createTime)
  const sentAt = Number.isNaN(Date.parse(sendTime)) ? new Date().toISOString() : new Date(sendTime).toISOString()
  return {
    kind: 'message', id, type,
    message: {
      ycloudId: text(raw.id), wamid: text(raw.wamid), direction,
      customerPhone: direction === 'in' ? from : to, businessNumber: business,
      profileName: text(obj(raw.customerProfile).name), sentAt, type: msgType, body: bodyText, media,
    },
  }
}

// ─── Media ──────────────────────────────────────────────────────────────────

export const MAX_MEDIA_BYTES = 25 * 1024 * 1024

/** Whether a message's file is copied into DocFlow. Stickers never; voice notes and videos only when switched on. */
export function shouldStoreMedia(type: MessageType, storeAudioVideo: boolean): boolean {
  if (type === 'document' || type === 'image') return true
  if (type === 'audio' || type === 'video') return storeAudioVideo
  return false
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic',
  'application/pdf': 'pdf', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'video/mp4': 'mp4',
}

/** A safe file name: the sender's, else "<message id>.<ext>" (photos come without one). */
export function mediaFileName(messageId: string, filename: string | undefined, mimeType: string): string {
  const clean = (filename ?? '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(-120)
  if (clean && clean !== '_') return clean
  const ext = EXTENSIONS[mimeType.split(';')[0].trim().toLowerCase()] ?? 'bin'
  return `${messageId.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`
}

/** Hex SHA-256 — the fingerprint used to spot the same file twice. */
export const fileHash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

/** Whether the bytes match the sha256 YCloud sent (base64, or hex). An empty value can't be checked and passes. */
export function sha256Matches(bytes: Buffer, expected: string): boolean {
  if (!expected) return true
  const digest = createHash('sha256').update(bytes).digest()
  const e = expected.trim()
  if (/^[0-9a-f]{64}$/i.test(e)) return digest.toString('hex') === e.toLowerCase()
  return digest.toString('base64').replace(/=+$/, '') === e.replace(/=+$/, '')
    || digest.toString('base64url') === e.replace(/=+$/, '')
}

export type DownloadResult =
  | { status: 'stored'; bytes: Buffer }
  | { status: 'skipped' | 'failed'; error: string }

type Fetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<Response>

/**
 * Downloads one file. The link works on its own for a few minutes; after
 * that (or when it fails) it is tried again with the YCloud API key, which
 * works for 30 days. Files over the size cap are skipped; a file that doesn't
 * match its sha256 is a failure.
 */
export async function downloadMedia(media: { link: string; sha256: string }, opts: {
  apiKey: string; maxBytes?: number; fetchImpl?: Fetch; useKeyFirst?: boolean
}): Promise<DownloadResult> {
  const maxBytes = opts.maxBytes ?? MAX_MEDIA_BYTES
  const doFetch: Fetch = opts.fetchImpl ?? ((url, init) => fetch(url, init))
  if (!media.link) return { status: 'failed', error: 'No download link' }

  const attempts: (Record<string, string> | undefined)[] = opts.useKeyFirst
    ? [{ 'X-API-Key': opts.apiKey }]
    : [undefined, ...(opts.apiKey ? [{ 'X-API-Key': opts.apiKey }] : [])]

  let lastError = 'Download failed'
  for (const headers of attempts) {
    try {
      const res = await doFetch(media.link, headers ? { headers } : undefined)
      if (!res.ok) { lastError = `Download failed (HTTP ${res.status})`; continue }
      const declared = Number(res.headers.get('content-length') ?? 0)
      if (declared > maxBytes) return { status: 'skipped', error: `Larger than ${Math.round(maxBytes / 1048576)} MB` }
      const bytes = Buffer.from(await res.arrayBuffer())
      if (bytes.length > maxBytes) return { status: 'skipped', error: `Larger than ${Math.round(maxBytes / 1048576)} MB` }
      if (!sha256Matches(bytes, media.sha256)) return { status: 'failed', error: 'File incomplete (sha256 does not match)' }
      return { status: 'stored', bytes }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
  }
  return { status: 'failed', error: lastError }
}

// ─── Bundles ────────────────────────────────────────────────────────────────

// Messages from one phone this close together are one bundle (one decision)
export const BUNDLE_WINDOW_MS = 10 * 60 * 1000
// A bundle is read by the AI once nothing new has come for this long
export const ANALYSE_DELAY_MS = 2 * 60 * 1000

export type BundleState = { lastAt: string; status: string }

/** Whether a message sent at `sentAt` joins this bundle rather than starting a new one. */
export function joinsBundle(bundle: BundleState | null | undefined, sentAt: string): boolean {
  if (!bundle || !['new', 'ready'].includes(bundle.status)) return false
  const gap = Date.parse(sentAt) - Date.parse(bundle.lastAt)
  return gap >= -BUNDLE_WINDOW_MS && gap <= BUNDLE_WINDOW_MS
}

/** Whether a bundle has been quiet long enough to be read by the AI. */
export function quietLongEnough(lastAt: string, now = Date.now()): boolean {
  return now - Date.parse(lastAt) >= ANALYSE_DELAY_MS
}
