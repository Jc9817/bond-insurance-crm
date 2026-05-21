'use client'

import Link from 'next/link'
import { Case, CaseFile, FollowUp, WorkflowTemplate, CASE_STATUSES, CaseStatus } from '@/lib/types'
import { formatCurrency, getDaysUntil } from '@/lib/utils'
import { getWorkflowTemplate, getCaseReadiness, getMissingRequiredDocs } from '@/lib/workflow'
import StatusBadge from './StatusBadge'

type Props = {
  cases: Case[]
  caseFiles: CaseFile[]
  followUps: FollowUp[]
  workflowTemplates: WorkflowTemplate[]
  onStatusChange: (caseId: string, newStatus: CaseStatus) => void
}

export default function KanbanBoard({ cases, caseFiles, followUps, workflowTemplates, onStatusChange }: Props) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-6">
      {CASE_STATUSES.map(status => {
        const col = cases.filter(c => c.currentStatus === status)
        return (
          <div key={status} className="shrink-0 w-64">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{status}</h3>
              <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-medium">{col.length}</span>
            </div>
            <div className="space-y-2 min-h-16">
              {col.map(c => {
                const template = getWorkflowTemplate(c.caseType, workflowTemplates)
                const readiness = getCaseReadiness(c, template, caseFiles, followUps)
                const missing = getMissingRequiredDocs(c.id, template, caseFiles)
                const overdueFollowUps = followUps.filter(f =>
                  f.caseId === c.id && f.status === 'Open' &&
                  getDaysUntil(f.dueDate) !== null && (getDaysUntil(f.dueDate) as number) < 0
                )
                const hasWarning = missing.length > 0 || overdueFollowUps.length > 0
                const isHealthy = readiness >= 70 && !hasWarning

                return (
                  <div key={c.id} className={`bg-white rounded-xl border shadow-sm p-3.5 hover:shadow-md transition-shadow ${
                    overdueFollowUps.length > 0 ? 'border-red-200' :
                    missing.length > 0 ? 'border-amber-200' :
                    'border-gray-100'
                  }`}>
                    <Link href={`/cases/${c.id}`}>
                      <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 hover:text-blue-600">
                        {c.caseTitle}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{c.customerName}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">{c.caseType}</span>
                        <span className="text-xs font-semibold text-gray-800">{formatCurrency(c.amount)}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{c.personInCharge}</p>

                      {/* Readiness + indicators */}
                      {template && (
                        <div className="mt-2.5 pt-2.5 border-t border-gray-100 space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 bg-gray-100 rounded-full h-1 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${readiness >= 70 ? 'bg-green-400' : readiness >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                                style={{ width: `${readiness}%` }}
                              />
                            </div>
                            <span className={`text-xs font-semibold ${readiness >= 70 ? 'text-green-600' : readiness >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                              {readiness}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {missing.length > 0 && (
                              <span className="text-xs text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 font-medium">
                                {missing.length} doc{missing.length > 1 ? 's' : ''} missing
                              </span>
                            )}
                            {overdueFollowUps.length > 0 && (
                              <span className="text-xs text-red-600 bg-red-50 rounded px-1.5 py-0.5 font-medium">
                                {overdueFollowUps.length} overdue
                              </span>
                            )}
                            {isHealthy && (
                              <span className="text-xs text-green-700 bg-green-50 rounded px-1.5 py-0.5 font-medium">Ready</span>
                            )}
                          </div>
                        </div>
                      )}
                    </Link>

                    {/* Quick status change */}
                    <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                      <select
                        value={c.currentStatus}
                        onChange={e => onStatusChange(c.id, e.target.value as CaseStatus)}
                        onClick={e => e.stopPropagation()}
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        {CASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
