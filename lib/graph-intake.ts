import type { SupabaseClient } from '@supabase/supabase-js'
import { GraphError, graphConfigured, graphRequest } from './msGraph'

// Server-only. New emails (fix list 4.1) are added to the Emails screen
// (lib/mail-inbox.ts) as they arrive.
//
// How it works: DocFlow holds a Microsoft Graph "subscription" — a standing
// request for Microsoft to call DocFlow when a new message reaches
// MAIL_INTAKE_MAILBOX's Inbox -> /api/intake/email/notify -> importMessage()
// + analyseMessage(). Subscriptions expire, so the daily job renews it
// (ensureSubscriptions). The address stays /api/intake/email/notify: the live
// subscription points there.
//
// Settings (Vercel environment variables):
//   MAIL_INTAKE_MAILBOX      e.g. operation@tridentmanagement.com.my
//   GRAPH_WEBHOOK_SECRET     any long random text; Microsoft echoes it back
//                            on every notification so DocFlow can trust it
// Permissions: Mail.Read on operation@ only (RBAC for Applications, fix list 1.3).

const SUBSCRIPTION_DAYS = 3                     // renewed daily, well inside Graph's limits
const RENEW_WHEN_HOURS_LEFT = 36

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
const mailbox = () => process.env.MAIL_INTAKE_MAILBOX ?? ''
export const graphWebhookSecret = () => process.env.GRAPH_WEBHOOK_SECRET ?? ''

export const mailIntakeEnabled = () => graphConfigured() && !!mailbox() && !!graphWebhookSecret() && !!appUrl()

async function ensureSubscription(sb: SupabaseClient, kind: 'mail', resource: string, changeType: string, notifyPath: string) {
  const { data: row } = await sb.from('graph_subscriptions').select('*').eq('kind', kind).maybeSingle()
  const expirationDateTime = new Date(Date.now() + SUBSCRIPTION_DAYS * 86400000).toISOString()

  const hoursLeft = row?.expires_at ? (Date.parse(row.expires_at) - Date.now()) / 3600000 : 0
  if (row?.subscription_id && row.resource === resource && hoursLeft > RENEW_WHEN_HOURS_LEFT) {
    return `${kind}: active until ${row.expires_at}`
  }

  let subscriptionId: string | null = null
  if (row?.subscription_id && row.resource === resource) {
    try {
      await graphRequest('PATCH', `/subscriptions/${row.subscription_id}`, { expirationDateTime })
      subscriptionId = row.subscription_id
    } catch (err) {
      if (!(err instanceof GraphError && err.status === 404)) throw err   // gone: create a new one
    }
  }
  if (!subscriptionId) {
    // Microsoft calls notificationUrl once with a validationToken before this returns
    const created = await graphRequest<{ id: string }>('POST', '/subscriptions', {
      changeType,
      notificationUrl: `${appUrl()}${notifyPath}`,
      resource,
      expirationDateTime,
      clientState: graphWebhookSecret(),
    })
    subscriptionId = created.id
  }

  await sb.from('graph_subscriptions').upsert({
    kind, subscription_id: subscriptionId, resource, expires_at: expirationDateTime,
    updated_at: new Date().toISOString(),
  })
  return `${kind}: subscription ${row?.subscription_id === subscriptionId ? 'renewed' : 'created'} until ${expirationDateTime}`
}

/** Creates or renews the new-email subscription, when switched on. */
export async function ensureSubscriptions(sb: SupabaseClient): Promise<string[]> {
  if (!mailIntakeEnabled()) return ['mail: not set up (MAIL_INTAKE_MAILBOX / GRAPH_WEBHOOK_SECRET)']
  try {
    return [await ensureSubscription(sb, 'mail',
      `users/${mailbox()}/mailFolders('Inbox')/messages`, 'created', '/api/intake/email/notify')]
  } catch (err) {
    return [`mail: FAILED — ${err instanceof Error ? err.message : err}`]
  }
}
