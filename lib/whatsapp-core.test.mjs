// Tests for lib/whatsapp-core.ts — run with: npm test
// The events are made up, in the shape of YCloud's "WhatsApp inbound message
// webhook examples". No real numbers or customer data.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import {
  ANALYSE_DELAY_MS, BUNDLE_WINDOW_MS, downloadMedia, joinsBundle, mediaFileName, normalizePhone, parseEvent,
  quietLongEnough, sha256Matches, shouldStoreMedia, verifySignature,
} from './whatsapp-core.ts'

const BUSINESS = '+60100000001'
const CUSTOMER = '+60100000002'
const opts = { businessNumber: BUSINESS, withBusinessApp: false }

const inbound = (message, id = 'evt_1') => ({
  id, type: 'whatsapp.inbound_message.received', apiVersion: 'v2', createTime: '2026-11-14T02:00:00.000Z',
  whatsappInboundMessage: {
    id: 'msg_1', wamid: 'wamid.TEST1', wabaId: 'waba_1', from: CUSTOMER, to: BUSINESS,
    sendTime: '2026-11-14T02:00:00.000Z', customerProfile: { name: 'Test Sender' }, ...message,
  },
})

// ─── Phone numbers ──────────────────────────────────────────────────────────

test('normalizePhone: Malaysian forms', () => {
  assert.equal(normalizePhone('012-345 6789'), '+60123456789')
  assert.equal(normalizePhone('(012) 345-6789'), '+60123456789')
  assert.equal(normalizePhone('60123456789'), '+60123456789')
  assert.equal(normalizePhone('+60 12-345 6789'), '+60123456789')
  assert.equal(normalizePhone('0060123456789'), '+60123456789')
  assert.equal(normalizePhone('03-1234 5678'), '+60312345678')
})

test('normalizePhone: other countries and rubbish', () => {
  assert.equal(normalizePhone('+65 9123 4567'), '+6591234567')
  assert.equal(normalizePhone(''), null)
  assert.equal(normalizePhone(null), null)
  assert.equal(normalizePhone('call me'), null)
  assert.equal(normalizePhone('123'), null)
})

// ─── Signature ──────────────────────────────────────────────────────────────

const SECRET = 'whsec_test_only'
const sign = (body, t, secret = SECRET) => `t=${t},s=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`

test('verifySignature: accepts a correct signature', () => {
  const body = JSON.stringify(inbound({ type: 'text', text: { body: 'hello' } }))
  assert.equal(verifySignature(sign(body, 1_800_000_000), body, SECRET, 1_800_000_010), true)
})

test('verifySignature: refuses a wrong secret, a changed body, an old call, a bad header', () => {
  const body = '{"id":"evt_1"}'
  const now = 1_800_000_000
  assert.equal(verifySignature(sign(body, now, 'other'), body, SECRET, now), false)
  assert.equal(verifySignature(sign(body, now), body + ' ', SECRET, now), false)
  assert.equal(verifySignature(sign(body, now - 600), body, SECRET, now), false)
  assert.equal(verifySignature('nonsense', body, SECRET, now), false)
  assert.equal(verifySignature(null, body, SECRET, now), false)
  assert.equal(verifySignature(sign(body, now), body, '', now), false)
})

// ─── Events ─────────────────────────────────────────────────────────────────

test('parseEvent: a text message', () => {
  const e = parseEvent(inbound({ type: 'text', text: { body: 'SSM for Jalan Rawang' } }), opts)
  assert.equal(e.kind, 'message')
  assert.equal(e.message.direction, 'in')
  assert.equal(e.message.customerPhone, CUSTOMER)
  assert.equal(e.message.body, 'SSM for Jalan Rawang')
  assert.equal(e.message.profileName, 'Test Sender')
  assert.equal(e.message.media, undefined)
})

test('parseEvent: a document with caption and file name', () => {
  const e = parseEvent(inbound({
    type: 'document',
    document: { link: 'https://media.example/doc', caption: 'LOA', filename: 'LOA.pdf', id: 'media_1', sha256: 'abc', mime_type: 'application/pdf' },
  }), opts)
  assert.equal(e.message.type, 'document')
  assert.equal(e.message.body, 'LOA')
  assert.deepEqual(e.message.media, { id: 'media_1', link: 'https://media.example/doc', mimeType: 'application/pdf', sha256: 'abc', filename: 'LOA.pdf' })
})

test('parseEvent: ignores other numbers, groups, other events, and sync events unless switched on', () => {
  assert.equal(parseEvent(inbound({ type: 'text', to: '+60100000009', text: { body: 'x' } }), opts).kind, 'ignore')
  assert.equal(parseEvent(inbound({ type: 'text', from: '1203630@g.us', text: { body: 'x' } }), opts).kind, 'ignore')
  assert.equal(parseEvent({ id: 'e', type: 'whatsapp.message.updated' }, opts).kind, 'ignore')

  const echo = {
    id: 'evt_2', type: 'whatsapp.smb.message.echoes',
    whatsappMessage: { id: 'm2', wamid: 'wamid.TEST2', from: BUSINESS, to: CUSTOMER, type: 'text', text: { body: 'Received, thanks' }, sendTime: '2026-11-14T02:05:00Z' },
  }
  assert.equal(parseEvent(echo, opts).kind, 'ignore')
  const on = parseEvent(echo, { ...opts, withBusinessApp: true })
  assert.equal(on.kind, 'message')
  assert.equal(on.message.direction, 'out')
  assert.equal(on.message.customerPhone, CUSTOMER)
})

// ─── Media ──────────────────────────────────────────────────────────────────

test('shouldStoreMedia and mediaFileName', () => {
  assert.equal(shouldStoreMedia('document', false), true)
  assert.equal(shouldStoreMedia('image', false), true)
  assert.equal(shouldStoreMedia('audio', false), false)
  assert.equal(shouldStoreMedia('audio', true), true)
  assert.equal(shouldStoreMedia('sticker', true), false)
  assert.equal(mediaFileName('msg_1', 'My LOA (signed).pdf', 'application/pdf'), 'My_LOA_signed_.pdf')
  assert.equal(mediaFileName('msg_1', undefined, 'image/jpeg'), 'msg_1.jpg')
  assert.equal(mediaFileName('msg_1', '', 'image/png; q=1'), 'msg_1.png')
})

const bytes = Buffer.from('%PDF-1.4 made-up test file')
const b64 = createHash('sha256').update(bytes).digest('base64')
const hex = createHash('sha256').update(bytes).digest('hex')
const ok = body => new Response(body, { status: 200, headers: { 'content-length': String(body.length) } })

test('sha256Matches: base64 or hex', () => {
  assert.equal(sha256Matches(bytes, b64), true)
  assert.equal(sha256Matches(bytes, hex), true)
  assert.equal(sha256Matches(bytes, 'wrong'), false)
  assert.equal(sha256Matches(bytes, ''), true)
})

test('downloadMedia: works straight from the link', async () => {
  const calls = []
  const r = await downloadMedia({ link: 'https://media.example/1', sha256: b64 }, {
    apiKey: 'key', fetchImpl: async (url, init) => { calls.push(init?.headers ?? null); return ok(bytes) },
  })
  assert.equal(r.status, 'stored')
  assert.deepEqual(r.bytes, bytes)
  assert.deepEqual(calls, [null])
})

test('downloadMedia: expired link falls back to the API key', async () => {
  const calls = []
  const r = await downloadMedia({ link: 'https://media.example/1', sha256: b64 }, {
    apiKey: 'key',
    fetchImpl: async (url, init) => {
      calls.push(init?.headers ?? null)
      return init?.headers?.['X-API-Key'] === 'key' ? ok(bytes) : new Response('expired', { status: 403 })
    },
  })
  assert.equal(r.status, 'stored')
  assert.deepEqual(calls, [null, { 'X-API-Key': 'key' }])
})

test('downloadMedia: sha256 mismatch fails, too large is skipped', async () => {
  const mismatch = await downloadMedia({ link: 'https://media.example/1', sha256: 'AAAA' }, { apiKey: 'key', fetchImpl: async () => ok(bytes) })
  assert.equal(mismatch.status, 'failed')
  assert.match(mismatch.error, /sha256/)
  const big = await downloadMedia({ link: 'https://media.example/1', sha256: b64 }, { apiKey: 'key', maxBytes: 5, fetchImpl: async () => ok(bytes) })
  assert.equal(big.status, 'skipped')
  const none = await downloadMedia({ link: '', sha256: b64 }, { apiKey: 'key', fetchImpl: async () => ok(bytes) })
  assert.equal(none.status, 'failed')
})

// ─── Bundles ────────────────────────────────────────────────────────────────

test('joinsBundle: within 10 minutes of the last message, open bundles only', () => {
  const lastAt = '2026-11-14T02:00:00.000Z'
  const at = ms => new Date(Date.parse(lastAt) + ms).toISOString()
  assert.equal(joinsBundle({ lastAt, status: 'new' }, at(60_000)), true)
  assert.equal(joinsBundle({ lastAt, status: 'ready' }, at(BUNDLE_WINDOW_MS)), true)
  assert.equal(joinsBundle({ lastAt, status: 'new' }, at(BUNDLE_WINDOW_MS + 1)), false)
  assert.equal(joinsBundle({ lastAt, status: 'filed' }, at(60_000)), false)
  assert.equal(joinsBundle({ lastAt, status: 'not_case' }, at(60_000)), false)
  assert.equal(joinsBundle(null, at(0)), false)
  // A message delivered late (sent a little before the last one) still joins
  assert.equal(joinsBundle({ lastAt, status: 'new' }, at(-30_000)), true)
})

test('quietLongEnough: 2 minutes after the last message', () => {
  const lastAt = '2026-11-14T02:00:00.000Z'
  assert.equal(quietLongEnough(lastAt, Date.parse(lastAt) + ANALYSE_DELAY_MS - 1), false)
  assert.equal(quietLongEnough(lastAt, Date.parse(lastAt) + ANALYSE_DELAY_MS), true)
})
