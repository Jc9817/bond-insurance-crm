import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveRequiredDocForCase } from '@/lib/intake-ai'

// n8n calls this when it finishes (or fails) extracting a document that was
// triggered via POST /api/notify-n8n { event: 'ai_scan_requested', ... }.
// Secured with a shared secret — not a Supabase key — since n8n is an
// external caller, same pattern as the Telegram webhook's secret token.

const CALLBACK_SECRET = process.env.N8N_CALLBACK_SECRET

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseKey = serviceRoleKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// n8n classifies the document (e.g. "Bank Statement") but only knows our
// data by name, not by internal id — resolve that name to the matching
// checklist slot (requiredDocumentId) in the case's own workflow template,
// the same lookup the Inbox suggestions use (lib/intake-ai.ts).
async function resolveRequiredDoc(caseFileId: string, documentType: string): Promise<string | null> {
  const { data: file } = await supabase.from('case_files').select('case_id').eq('id', caseFileId).single()
  return file ? resolveRequiredDocForCase(supabase, file.case_id, documentType) : null
}

export async function POST(req: NextRequest) {
  if (!CALLBACK_SECRET || req.headers.get('x-callback-secret') !== CALLBACK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { caseFileId, status, extractedData, error, documentType } = await req.json()

  if (!caseFileId || (status !== 'Extracted' && status !== 'Failed')) {
    return NextResponse.json({ error: "caseFileId and status ('Extracted' | 'Failed') are required" }, { status: 400 })
  }

  const update: Record<string, unknown> = status === 'Extracted'
    ? { ai_status: 'Extracted', ai_scanned: true, ai_extracted_data: extractedData ?? null }
    : { ai_status: 'Failed' }

  // Optional — only re-tag when n8n actually classified the document.
  if (documentType) {
    update.document_type = documentType
    const requiredDocumentId = await resolveRequiredDoc(caseFileId, documentType)
    if (requiredDocumentId) update.required_document_id = requiredDocumentId
  }

  const { error: dbError } = await supabase.from('case_files').update(update).eq('id', caseFileId)

  if (dbError) {
    console.error('[ai-scan/callback] update failed:', dbError.message)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  if (status === 'Failed' && error) {
    console.error('[ai-scan/callback] n8n reported extraction failure:', error)
  }

  return NextResponse.json({ ok: true })
}
