import { NextRequest, NextResponse, after } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { analyseMessage, importMessage } from '@/lib/mail-inbox'
import { trustedNotifications, validationResponse } from '@/lib/graph-webhook'

// Microsoft Graph calls this when a new email reaches MAIL_INTAKE_MAILBOX.
// The email is added to the Emails screen and the AI reads it; its
// attachments stay in the mailbox until someone files them. Called without a
// login, so it is excluded from the login check in proxy.ts; trusted only
// through GRAPH_WEBHOOK_SECRET (see lib/graph-webhook.ts).

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const validation = validationResponse(req)
  if (validation) return validation

  const messageIds = (await trustedNotifications(req))
    .map(n => n.resourceData?.id)
    .filter((id): id is string => !!id)

  if (messageIds.length) {
    after(async () => {
      const sb = serviceClient()
      for (const graphId of messageIds) {
        try {
          const { id, isNew } = await importMessage(sb, graphId)
          if (isNew) await analyseMessage(sb, id)   // Microsoft can notify twice
        } catch (err) {
          console.error('[mail] new email failed:', graphId, err instanceof Error ? err.message : err)
        }
      }
    })
  }
  return new NextResponse(null, { status: 202 })
}
