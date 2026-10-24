import { NextRequest, NextResponse } from 'next/server'
import { graphWebhookSecret } from './graph-intake'

// Server-only. Shared handling for Microsoft Graph change notifications
// (/api/intake/email/notify and /api/intake/sharepoint/notify).
//
// - When a subscription is created, Microsoft first calls with
//   ?validationToken=… and expects it echoed back as plain text within 10s.
// - After that, each call carries { value: [notification, …] }. Every
//   notification must carry our GRAPH_WEBHOOK_SECRET as clientState;
//   anything else is ignored. Microsoft wants an answer within 3 seconds, so
//   callers do the actual work with after().

export type GraphNotification = {
  subscriptionId?: string
  clientState?: string
  changeType?: string
  resource?: string
  resourceData?: { id?: string }
}

/** The validation reply, or null when this is a normal notification call. */
export function validationResponse(req: NextRequest): NextResponse | null {
  const token = req.nextUrl.searchParams.get('validationToken')
  if (token === null) return null
  return new NextResponse(token, { status: 200, headers: { 'Content-Type': 'text/plain' } })
}

/** Notifications in the body that carry our secret. */
export async function trustedNotifications(req: NextRequest): Promise<GraphNotification[]> {
  const secret = graphWebhookSecret()
  if (!secret) return []
  const body = await req.json().catch(() => ({}))
  const value: GraphNotification[] = Array.isArray(body?.value) ? body.value : []
  return value.filter(n => n.clientState === secret)
}
