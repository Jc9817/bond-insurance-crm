import { NextRequest, NextResponse, after } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { processSharePointChanges } from '@/lib/graph-intake'
import { trustedNotifications, validationResponse } from '@/lib/graph-webhook'

// Microsoft Graph calls this when something changes in the SharePoint
// document library (fix list 4.2). New files in the _Inbox folder become
// Inbox items and are moved to _Inbox/Processed. Called without a login, so
// it is excluded from the login check in proxy.ts; trusted only through
// GRAPH_WEBHOOK_SECRET (see lib/graph-webhook.ts).

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const validation = validationResponse(req)
  if (validation) return validation

  if ((await trustedNotifications(req)).length) {
    after(async () => {
      try {
        const outcome = await processSharePointChanges(serviceClient())
        if (outcome.added.length || outcome.duplicates.length) {
          console.log(`[sharepoint intake] ${outcome.added.length} added, ${outcome.duplicates.length} duplicates`)
        }
      } catch (err) {
        console.error('[sharepoint intake] failed:', err instanceof Error ? err.message : err)
      }
    })
  }
  return new NextResponse(null, { status: 202 })
}
