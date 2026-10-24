import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-service'
import { requireAdmin } from '@/lib/admin-auth'
import { casesPastRetention, deleteCasesPermanently } from '@/lib/retention'
import { generateId } from '@/lib/utils'

// Settings → Data Retention (Admins only, fix list 5.6).
//   GET                      cases past their keep period
//   POST { caseIds: [...] }  delete those cases for good (files included)

export const maxDuration = 60

export async function GET() {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  try {
    return NextResponse.json({ cases: await casesPastRetention(serviceClient()) })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { caseIds } = await req.json().catch(() => ({}))
  if (!Array.isArray(caseIds) || caseIds.length === 0 || !caseIds.every(id => typeof id === 'string')) {
    return NextResponse.json({ error: 'caseIds required' }, { status: 400 })
  }

  const sb = serviceClient()
  try {
    const deleted = await deleteCasesPermanently(sb, caseIds)
    // A record that it happened, outlasting the cases themselves
    if (deleted.length) {
      await sb.from('activity_logs').insert(deleted.map(c => ({
        id: generateId(),
        title: 'Case deleted (data retention)',
        description: `${c.caseNumber} ${c.caseTitle} (${c.customerName || 'no customer'}) — ${c.rule}, keep period ended ${c.keepUntil}`,
        changed_by: admin.name,
        timestamp: new Date().toISOString(),
      })))
    }
    return NextResponse.json({ deleted: deleted.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
