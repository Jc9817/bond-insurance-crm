import { NextRequest, NextResponse, after } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { requireUser } from '@/lib/admin-auth'
import { fileMessage, type FileAssignment } from '@/lib/mail-inbox'
import { sharePointStorageEnabled, syncCaseFile } from '@/lib/sharepoint-files'
import { notifyDocFlowWebhook } from '@/lib/n8n'
import { signFileUrlForServer } from '@/lib/storage-server'

// Emails screen: files a decision.
//   { id, assignments: [{ attachmentId, caseId, documentType }], caseIds: [...] }
// Each attachment is copied from the mailbox into its case; the email is
// linked to every case named. Afterwards (in the background) the new files
// are copied to SharePoint and announced to n8n, as for any upload.

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const who = await requireUser()
  if (who instanceof NextResponse) return who

  const body = await req.json().catch(() => ({}))
  const assignments: FileAssignment[] = Array.isArray(body.assignments)
    ? body.assignments.filter((a: FileAssignment) => a && typeof a.attachmentId === 'string' && typeof a.caseId === 'string' && a.caseId)
        .map((a: FileAssignment) => ({ attachmentId: a.attachmentId, caseId: a.caseId, documentType: String(a.documentType || 'Other') }))
    : []
  const caseIds: string[] = Array.isArray(body.caseIds) ? body.caseIds.filter((c: unknown) => typeof c === 'string' && c) : []
  if (typeof body.id !== 'string' || (assignments.length === 0 && caseIds.length === 0)) {
    return NextResponse.json({ error: 'Choose at least one case' }, { status: 400 })
  }

  const sb = serviceClient()
  try {
    const outcome = await fileMessage(sb, body.id, assignments, caseIds, who.name)

    after(async () => {
      for (const caseFileId of outcome.caseFileIds) {
        if (sharePointStorageEnabled()) {
          await syncCaseFile(sb, caseFileId)
            .catch(err => console.error('[sharepoint] sync failed:', caseFileId, err instanceof Error ? err.message : err))
        }
        const { data: f } = await sb.from('case_files').select('*').eq('id', caseFileId).single()
        if (!f) continue
        await notifyDocFlowWebhook({
          event: 'case_file_uploaded', caseId: f.case_id, fileId: f.id, fileName: f.file_name,
          fileType: f.file_type, fileSize: f.file_size, documentType: f.document_type,
          uploadedBy: f.uploaded_by, uploadedAt: f.uploaded_at,
          fileUrl: await signFileUrlForServer(f.file_data_url),
        })
      }
    })
    return NextResponse.json(outcome)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Filing failed' }, { status: 500 })
  }
}
