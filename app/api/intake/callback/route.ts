import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { applyIntakeClassification, type ClassificationResult } from '@/lib/intake-ai'

// n8n posts here when it has read an Inbox item sent by
// requestIntakeClassification() (lib/intake-ai.ts). Called without a login,
// so it is excluded from the login check in proxy.ts and secured with the
// same shared secret as the AI-scan callback. Contract:
// docs/n8n-intake-classify.md.

const CALLBACK_SECRET = process.env.N8N_CALLBACK_SECRET

export async function POST(req: NextRequest) {
  if (!CALLBACK_SECRET || req.headers.get('x-callback-secret') !== CALLBACK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const intakeItemId = typeof body.intakeItemId === 'string' ? body.intakeItemId : ''
  if (!intakeItemId) return NextResponse.json({ error: 'intakeItemId is required' }, { status: 400 })

  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  const result: ClassificationResult = {
    documentType: str(body.documentType),
    customerName: str(body.customerName),
    ssmNumber: str(body.ssmNumber),
    projectName: str(body.projectName),
    confidence: typeof body.confidence === 'number' ? body.confidence : Number(body.confidence) || undefined,
    extracted: body.extracted && typeof body.extracted === 'object' ? body.extracted : undefined,
    error: str(body.error),
  }

  try {
    await applyIntakeClassification(serviceClient(), intakeItemId, result)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Could not save the suggestion'
    console.error('[intake/callback]', error)
    return NextResponse.json({ error }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
