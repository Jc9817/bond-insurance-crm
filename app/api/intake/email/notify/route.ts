import { NextRequest, NextResponse, after } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { processMailMessage } from '@/lib/graph-intake'
import { trustedNotifications, validationResponse } from '@/lib/graph-webhook'

// Microsoft Graph calls this when a new email reaches MAIL_INTAKE_MAILBOX
// (fix list 4.1). Its attachments become Inbox items. Called without a
// login, so it is excluded from the login check in proxy.ts; trusted only
// through GRAPH_WEBHOOK_SECRET (see lib/graph-webhook.ts).

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const validation = validationResponse(req)
  if (validation) return validation

  const messageIds = (await trustedNotifications(req))
    .map(n => n.resourceData?.id)
    .filter((id): id is string => !!id)

  if (messageIds.length) {
    after(async () => {
      const sb = serviceClient()
      for (const id of messageIds) {
        try {
          const outcome = await processMailMessage(sb, id)
          if (outcome.added.length || outcome.duplicates.length) {
            console.log(`[mail intake] ${id}: ${outcome.added.length} added, ${outcome.duplicates.length} duplicates`)
          }
        } catch (err) {
          console.error('[mail intake] message failed:', id, err instanceof Error ? err.message : err)
        }
      }
    })
  }
  return new NextResponse(null, { status: 202 })
}
