// Tests for lib/whatsapp-events.ts — run with: npm test
// A tiny stand-in for the Supabase client with whatsapp_events' unique event id.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { claimEvent } from './whatsapp-events.ts'

function fakeClient() {
  const ids = new Set()
  return {
    ids,
    from: () => ({
      insert: async row => {
        if (ids.has(row.event_id)) return { error: { code: '23505', message: 'duplicate key' } }
        ids.add(row.event_id)
        return { error: null }
      },
    }),
  }
}

test('claimEvent: a repeat of the same event is ignored', async () => {
  const sb = fakeClient()
  assert.equal(await claimEvent(sb, 'evt_1', 'whatsapp.inbound_message.received'), true)
  assert.equal(await claimEvent(sb, 'evt_1', 'whatsapp.inbound_message.received'), false)
  assert.equal(await claimEvent(sb, 'evt_2', 'whatsapp.inbound_message.received'), true)
})

test('claimEvent: other database errors are not swallowed', async () => {
  const sb = { from: () => ({ insert: async () => ({ error: { code: '42P01', message: 'relation does not exist' } }) }) }
  await assert.rejects(claimEvent(sb, 'evt_1', 'x'), /relation does not exist/)
})
