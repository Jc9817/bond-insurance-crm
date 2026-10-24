import type { SupabaseClient } from '@supabase/supabase-js'
import { GraphError, graphConfigured, graphDownload, graphRequest } from './msGraph'
import { addReceivedFile, emptyOutcome, type IntakeOutcome } from './intake-files'

// Server-only. Documents arriving by email (fix list 4.1) and through the
// SharePoint _Inbox folder (4.2) become Inbox items automatically.
//
// How it works: DocFlow holds two Microsoft Graph "subscriptions" — standing
// requests for Microsoft to call DocFlow when something changes:
//   mail        a new message in MAIL_INTAKE_MAILBOX's Inbox
//               -> /api/intake/email/notify -> processMailMessage()
//   sharepoint  a change in the SHAREPOINT_DRIVE_ID document library
//               -> /api/intake/sharepoint/notify -> processSharePointChanges(),
//               which takes in new files from the _Inbox folder and moves
//               them into _Inbox/Processed
// Subscriptions expire, so the daily job renews them (ensureSubscriptions).
//
// Settings (Vercel environment variables):
//   MAIL_INTAKE_MAILBOX      e.g. operation@tridentmanagement.com.my
//   SHAREPOINT_DRIVE_ID      Graph drive id of the Customers library
//   SHAREPOINT_INBOX_FOLDER  folder name at the library root (default _Inbox)
//   GRAPH_WEBHOOK_SECRET     any long random text; Microsoft echoes it back
//                            on every notification so DocFlow can trust it
// Permissions on the Azure app: Mail.Read (scoped to operation@ like
// Mail.Send, see fix list 1.3) and Sites.Selected with write access to the
// Operations site.

const SUBSCRIPTION_DAYS = 3                     // renewed daily, well inside Graph's limits
const RENEW_WHEN_HOURS_LEFT = 36
const PROCESSED_FOLDER = 'Processed'

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
const mailbox = () => process.env.MAIL_INTAKE_MAILBOX ?? ''
const driveId = () => process.env.SHAREPOINT_DRIVE_ID ?? ''
const inboxFolderName = () => process.env.SHAREPOINT_INBOX_FOLDER || '_Inbox'
export const graphWebhookSecret = () => process.env.GRAPH_WEBHOOK_SECRET ?? ''

export const mailIntakeEnabled = () => graphConfigured() && !!mailbox() && !!graphWebhookSecret() && !!appUrl()
export const sharePointIntakeEnabled = () => graphConfigured() && !!driveId() && !!graphWebhookSecret() && !!appUrl()

type Kind = 'mail' | 'sharepoint'

// ─── Subscriptions ──────────────────────────────────────────────────────────

async function ensureSubscription(sb: SupabaseClient, kind: Kind, resource: string, changeType: string, notifyPath: string) {
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

/** Creates or renews the mail and SharePoint subscriptions that are switched on. */
export async function ensureSubscriptions(sb: SupabaseClient): Promise<string[]> {
  const report: string[] = []
  if (mailIntakeEnabled()) {
    try {
      report.push(await ensureSubscription(sb, 'mail',
        `users/${mailbox()}/mailFolders('Inbox')/messages`, 'created', '/api/intake/email/notify'))
    } catch (err) {
      report.push(`mail: FAILED — ${err instanceof Error ? err.message : err}`)
    }
  } else {
    report.push('mail: not set up (MAIL_INTAKE_MAILBOX / GRAPH_WEBHOOK_SECRET)')
  }
  if (sharePointIntakeEnabled()) {
    try {
      report.push(await ensureSubscription(sb, 'sharepoint',
        `drives/${driveId()}/root`, 'updated', '/api/intake/sharepoint/notify'))
      await initDeltaLink(sb)
    } catch (err) {
      report.push(`sharepoint: FAILED — ${err instanceof Error ? err.message : err}`)
    }
  } else {
    report.push('sharepoint: not set up (SHAREPOINT_DRIVE_ID / GRAPH_WEBHOOK_SECRET)')
  }
  return report
}

// ─── Email (4.1) ────────────────────────────────────────────────────────────

type MailMessage = {
  id: string; subject?: string; internetMessageId?: string; hasAttachments?: boolean
  from?: { emailAddress?: { name?: string; address?: string } }
}
type MailAttachment = {
  '@odata.type': string; name?: string; isInline?: boolean; contentBytes?: string
}

/** Takes in one new email's attachments (each document becomes an Inbox item). */
export async function processMailMessage(sb: SupabaseClient, messageId: string): Promise<IntakeOutcome> {
  const outcome = emptyOutcome()
  const { data: seen } = await sb.from('intake_items').select('id').eq('source_meta->>messageId', messageId).limit(1)
  if (seen?.length) return outcome   // Microsoft can notify twice

  const base = `/users/${encodeURIComponent(mailbox())}/messages/${encodeURIComponent(messageId)}`
  const msg = await graphRequest<MailMessage>('GET', `${base}?$select=id,subject,from,internetMessageId,hasAttachments`)
  if (!msg.hasAttachments) return outcome

  const from = msg.from?.emailAddress
  const sender = from?.name && from.address ? `${from.name} <${from.address}>` : from?.address ?? 'Email'
  const { value: attachments } = await graphRequest<{ value: MailAttachment[] }>('GET', `${base}/attachments`)

  for (const a of attachments) {
    // Files only — not embedded emails, cloud links or inline signature images
    if (a['@odata.type'] !== '#microsoft.graph.fileAttachment' || a.isInline || !a.contentBytes || !a.name) continue
    try {
      await addReceivedFile(sb, {
        source: 'email', sender, fileName: a.name, content: Buffer.from(a.contentBytes, 'base64'),
        sourceMeta: { messageId, internetMessageId: msg.internetMessageId, subject: msg.subject, from: from?.address },
      }, outcome)
    } catch (err) {
      console.error('[mail intake]', a.name, err instanceof Error ? err.message : err)
      outcome.skipped.push(a.name)
    }
  }
  return outcome
}

// ─── SharePoint _Inbox folder (4.2) ─────────────────────────────────────────

type DriveItem = {
  id: string; name: string; webUrl?: string; deleted?: unknown; file?: unknown
  parentReference?: { id?: string }
  createdBy?: { user?: { displayName?: string } }
  lastModifiedBy?: { user?: { displayName?: string } }
}

/** Starts change tracking from "now" the first time, so old files aren't all taken in. */
async function initDeltaLink(sb: SupabaseClient) {
  const { data: row } = await sb.from('graph_subscriptions').select('delta_link').eq('kind', 'sharepoint').maybeSingle()
  if (row?.delta_link) return
  const res = await graphRequest<{ '@odata.deltaLink'?: string }>('GET', `/drives/${driveId()}/root/delta?token=latest`)
  if (res['@odata.deltaLink']) {
    await sb.from('graph_subscriptions').update({ delta_link: res['@odata.deltaLink'] }).eq('kind', 'sharepoint')
  }
}

async function folderId(path: string): Promise<string | null> {
  try {
    return (await graphRequest<DriveItem>('GET', `/drives/${driveId()}/root:/${encodeURI(path)}`)).id
  } catch (err) {
    if (err instanceof GraphError && err.status === 404) return null
    throw err
  }
}

/** The _Inbox folder's id and its Processed subfolder's id (created if missing). */
async function inboxFolders(): Promise<{ inboxId: string; processedId: string }> {
  const inbox = inboxFolderName()
  const inboxId = await folderId(inbox)
  if (!inboxId) throw new Error(`SharePoint folder "${inbox}" not found at the library root`)
  let processedId = await folderId(`${inbox}/${PROCESSED_FOLDER}`)
  if (!processedId) {
    processedId = (await graphRequest<DriveItem>('POST', `/drives/${driveId()}/items/${inboxId}/children`, {
      name: PROCESSED_FOLDER, folder: {}, '@microsoft.graph.conflictBehavior': 'fail',
    })).id
  }
  return { inboxId, processedId }
}

/** Takes in every new file in the _Inbox folder since the last check. */
export async function processSharePointChanges(sb: SupabaseClient): Promise<IntakeOutcome> {
  const outcome = emptyOutcome()
  const { data: row } = await sb.from('graph_subscriptions').select('delta_link').eq('kind', 'sharepoint').maybeSingle()
  if (!row?.delta_link) {
    await initDeltaLink(sb)
    return outcome
  }

  const { inboxId, processedId } = await inboxFolders()
  let link: string | undefined = row.delta_link
  let nextDelta: string | undefined

  while (link) {
    const page: { value: DriveItem[]; '@odata.nextLink'?: string; '@odata.deltaLink'?: string } =
      await graphRequest('GET', link)
    for (const item of page.value) {
      if (!item.file || item.deleted || item.parentReference?.id !== inboxId) continue
      await takeInDriveItem(sb, item, processedId, outcome)
    }
    link = page['@odata.nextLink']
    nextDelta = page['@odata.deltaLink'] ?? nextDelta
  }

  if (nextDelta) {
    await sb.from('graph_subscriptions').update({ delta_link: nextDelta, updated_at: new Date().toISOString() }).eq('kind', 'sharepoint')
  }
  return outcome
}

async function takeInDriveItem(sb: SupabaseClient, item: DriveItem, processedId: string, outcome: IntakeOutcome) {
  const { data: seen } = await sb.from('intake_items').select('id').eq('source_meta->>driveItemId', item.id).limit(1)
  if (!seen?.length) {
    try {
      const content = await graphDownload(`/drives/${driveId()}/items/${item.id}/content`)
      await addReceivedFile(sb, {
        source: 'sharepoint',
        sender: item.createdBy?.user?.displayName || item.lastModifiedBy?.user?.displayName || 'SharePoint',
        fileName: item.name, content,
        sourceMeta: { driveItemId: item.id, webUrl: item.webUrl },
      }, outcome)
    } catch (err) {
      console.error('[sharepoint intake]', item.name, err instanceof Error ? err.message : err)
      outcome.skipped.push(item.name)
      return   // leave it in _Inbox to be tried again
    }
  }
  // Empty the _Inbox: keep the original in _Inbox/Processed
  try {
    await graphRequest('PATCH', `/drives/${driveId()}/items/${item.id}?@microsoft.graph.conflictBehavior=rename`, {
      parentReference: { id: processedId },
    })
  } catch (err) {
    console.error('[sharepoint intake] move to Processed failed:', item.name, err instanceof Error ? err.message : err)
  }
}
