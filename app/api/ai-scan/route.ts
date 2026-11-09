import { NextRequest, NextResponse, after } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { requireUser } from '@/lib/admin-auth'
import { MAX_SCAN_BYTES, mediaTypeFor } from '@/lib/document-reader'
import { scanCaseFile, type ScanFile } from '@/lib/document-scan'

// The "AI Scan" button: POST { caseFileId }. Files the AI can't read are
// refused here, with a message; the scan itself runs in the background and
// saves its result on the case file (lib/document-scan.ts).

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const user = await requireUser()
  if (user instanceof NextResponse) return user

  const { caseFileId } = await req.json().catch(() => ({}))
  if (typeof caseFileId !== 'string' || !caseFileId) {
    return NextResponse.json({ error: 'caseFileId required' }, { status: 400 })
  }

  const sb = serviceClient()
  const { data: file } = await sb.from('case_files')
    .select('id, file_name, file_type, file_size, document_type, required_document_id, ai_prompt, file_data_url')
    .eq('id', caseFileId).maybeSingle()
  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  if (!mediaTypeFor(file.file_name, file.file_type ?? '')) {
    return NextResponse.json({ error: 'The AI can only read PDF files and images. Please upload this document as a PDF.' }, { status: 400 })
  }
  if ((file.file_size ?? 0) > MAX_SCAN_BYTES) {
    return NextResponse.json({ error: 'This file is too large for the AI to read (the limit is 24 MB).' }, { status: 400 })
  }

  after(() => scanCaseFile(sb, file as ScanFile))
  return NextResponse.json({ ok: true })
}
