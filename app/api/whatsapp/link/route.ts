import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { requireUser } from '@/lib/admin-auth'
import { linkPhone } from '@/lib/whatsapp-intake'
import { normalizePhone } from '@/lib/whatsapp-core'

// WhatsApp screen: "Link to customer / contact" for an unknown number.
//   { phone, customerId?, contactId? }
// Remembered in whatsapp_phone_links (the contact itself is not changed), so
// the next message from the number matches.

export async function POST(req: NextRequest) {
  const who = await requireUser()
  if (who instanceof NextResponse) return who
  const body = await req.json().catch(() => ({}))
  const phone = normalizePhone(typeof body.phone === 'string' ? body.phone : '')
  const customerId = typeof body.customerId === 'string' && body.customerId ? body.customerId : undefined
  const contactId = typeof body.contactId === 'string' && body.contactId ? body.contactId : undefined
  if (!phone || (!customerId && !contactId)) {
    return NextResponse.json({ error: 'Choose a customer or contact' }, { status: 400 })
  }
  try {
    await linkPhone(serviceClient(), phone, { customerId, contactId }, who.name)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not link the number' }, { status: 500 })
  }
}
