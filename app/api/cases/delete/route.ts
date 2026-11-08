import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { requireAdmin } from '@/lib/admin-auth'
import { deleteCaseAndFiles } from '@/lib/retention'
import { generateId } from '@/lib/utils'

// Deletes one case for good, files included. Admins only;
// the double confirmation is in components/ui/DeleteCaseModal.tsx.
//   POST { caseId }

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { caseId } = await req.json().catch(() => ({}))
  if (typeof caseId !== 'string' || !caseId) {
    return NextResponse.json({ error: 'caseId required' }, { status: 400 })
  }

  const sb = serviceClient()
  const { data: row } = await sb.from('cases').select('case_number, case_title, customer_name').eq('id', caseId).maybeSingle()
  if (!row) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

  try {
    await deleteCaseAndFiles(sb, caseId)
    // A record that it happened, outlasting the case itself
    await sb.from('activity_logs').insert({
      id: generateId(),
      title: 'Case deleted',
      description: `${row.case_number ?? ''} ${row.case_title} (${row.customer_name || 'no customer'})`.trim(),
      changed_by: admin.name,
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
