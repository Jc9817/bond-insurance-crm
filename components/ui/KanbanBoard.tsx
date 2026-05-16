'use client'

import Link from 'next/link'
import { Case, CASE_STATUSES, CaseStatus } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import StatusBadge from './StatusBadge'

type Props = {
  cases: Case[]
  onStatusChange: (caseId: string, newStatus: CaseStatus) => void
}

export default function KanbanBoard({ cases, onStatusChange }: Props) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-6">
      {CASE_STATUSES.map(status => {
        const col = cases.filter(c => c.currentStatus === status)
        return (
          <div key={status} className="shrink-0 w-60">
            {/* Column header */}
            <div className="flex items-center justify-between mb-2.5 px-1">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{status}</h3>
              <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-medium">
                {col.length}
              </span>
            </div>
            {/* Cards */}
            <div className="space-y-2 min-h-16">
              {col.map(c => (
                <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 hover:shadow-md transition-shadow">
                  <Link href={`/cases/${c.id}`}>
                    <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 hover:text-blue-600">
                      {c.caseTitle}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{c.customerName}</p>
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="text-xs text-gray-500">{c.caseType}</span>
                      <span className="text-xs font-semibold text-gray-800">{formatCurrency(c.amount)}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{c.personInCharge}</p>
                  </Link>
                  {/* Quick status change */}
                  <div className="mt-3 pt-2.5 border-t border-gray-100">
                    <select
                      value={c.currentStatus}
                      onChange={e => onStatusChange(c.id, e.target.value as CaseStatus)}
                      onClick={e => e.stopPropagation()}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    >
                      {CASE_STATUSES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
