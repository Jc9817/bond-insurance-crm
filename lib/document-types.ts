import type { SupabaseClient } from '@supabase/supabase-js'

// Server-only. The document types DocFlow files by: the names of the Required
// Documents (checklist slots) in Settings. Used when filing from the Emails
// screen (lib/mail-inbox.ts) and by the AI scan callback.

/** Names of the active Required Documents across all active workflow templates. */
export async function activeDocumentTypes(sb: SupabaseClient): Promise<string[]> {
  const { data: templates } = await sb.from('workflow_templates').select('id').eq('is_active', true)
  const ids = (templates ?? []).map(t => t.id)
  if (ids.length === 0) return []
  const { data: docs } = await sb.from('required_documents').select('name').in('template_id', ids).eq('is_active', true)
  return [...new Set((docs ?? []).map(d => String(d.name)).filter(Boolean))].sort()
}

/** The checklist slot (required_documents.id) named documentType in a case's workflow template. */
export async function resolveRequiredDocForCase(sb: SupabaseClient, caseId: string, documentType: string): Promise<string | null> {
  const { data: caseRow } = await sb.from('cases').select('case_type, workflow_template_id').eq('id', caseId).single()
  if (!caseRow) return null

  let templateId = caseRow.workflow_template_id as string | null
  if (!templateId) {
    const { data: templates } = await sb
      .from('workflow_templates').select('id, business_type')
      .eq('case_type', caseRow.case_type).eq('is_active', true)
    if (!templates || templates.length === 0) return null
    templateId = (templates.find(t => !t.business_type) ?? templates[0]).id
  }

  const { data: docs } = await sb
    .from('required_documents').select('id, name')
    .eq('template_id', templateId).eq('is_active', true)
  if (!docs || docs.length === 0) return null

  const needle = documentType.toLowerCase()
  const match = docs.find(d => d.name.toLowerCase() === needle)
    ?? docs.find(d => d.name.toLowerCase().includes(needle) || needle.includes(d.name.toLowerCase()))
  return match?.id ?? null
}
