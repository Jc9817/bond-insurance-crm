import type { SupabaseClient } from '@supabase/supabase-js'
import { mediaTypeFor, readDocument } from './document-reader'
import { readFile } from './storage-server'

// Server-only. The "AI Scan" button (/api/ai-scan): reads one case file with
// Claude and saves what it found on the file. Every scan ends as Extracted or
// Failed; the case page checks for the result while it is Processing.

export type ScanFile = {
  id: string
  file_name: string
  file_type: string | null
  document_type: string | null
  required_document_id: string | null
  ai_prompt: string | null
  file_data_url: string
}

/** The file's own instructions if it has any, else its checklist slot's (Settings). */
async function instructionsFor(sb: SupabaseClient, file: ScanFile): Promise<string | null> {
  if (file.ai_prompt?.trim()) return file.ai_prompt
  if (!file.required_document_id) return null
  const { data } = await sb.from('required_documents').select('ai_prompt').eq('id', file.required_document_id).maybeSingle()
  return data?.ai_prompt ?? null
}

export async function scanCaseFile(sb: SupabaseClient, file: ScanFile): Promise<void> {
  try {
    const mediaType = mediaTypeFor(file.file_name, file.file_type ?? '')
    if (!mediaType) throw new Error('Not a file type the AI can read')

    const extracted = await readDocument({
      fileName: file.file_name,
      documentType: file.document_type ?? 'Document',
      mediaType,
      content: await readFile(file.file_data_url),
      instructions: await instructionsFor(sb, file),
    })
    const { error } = await sb.from('case_files')
      .update({ ai_status: 'Extracted', ai_scanned: true, ai_extracted_data: extracted }).eq('id', file.id)
    if (error) throw new Error(error.message)
  } catch (err) {
    console.error('[ai-scan] failed:', file.id, err instanceof Error ? err.message : err)
    await sb.from('case_files').update({ ai_status: 'Failed' }).eq('id', file.id)
  }
}
