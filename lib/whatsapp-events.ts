import type { SupabaseClient } from '@supabase/supabase-js'

// Server-only. YCloud retries an event when DocFlow is slow or answers with
// an error, so each event id is recorded once in whatsapp_events and a repeat
// is dropped. Kept apart so it is tested on its own (lib/whatsapp-events.test.mjs).

/** Records an event id. False when it was already seen (YCloud retried). */
export async function claimEvent(sb: SupabaseClient, eventId: string, type: string): Promise<boolean> {
  const { error } = await sb.from('whatsapp_events').insert({ event_id: eventId, type })
  if (!error) return true
  if (error.code === '23505') return false   // unique violation: seen before
  throw new Error(`Could not record the event: ${error.message}`)
}

/** What DocFlow did with an event (shown to Admins; never message content). */
export async function finishEvent(sb: SupabaseClient, eventId: string, result: string): Promise<void> {
  await sb.from('whatsapp_events').update({ result: result.slice(0, 200), processed_at: new Date().toISOString() }).eq('event_id', eventId)
}
