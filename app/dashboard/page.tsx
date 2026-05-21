'use client'

import Link from 'next/link'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { getDaysUntil, formatCurrency, timeAgo } from '@/lib/utils'
import { getWorkflowTemplate, getCaseReadiness, getMissingRequiredDocs, getStuckDays } from '@/lib/workflow'
import { getActionMeta, ACTION_COLOR_DOT } from '@/lib/activity'
import StatCard from '@/components/ui/StatCard'
import StatusBadge from '@/components/ui/StatusBadge'

export default function HomePage() {
  const { customers, cases, followUps, activityLogs, caseFiles, workflowTemplates } = useStore()
  const { currentUser } = useAuth()

  const today = new Date()
  const dateLabel = today.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const greeting = currentUser ? `, ${currentUser.fullName.split(' ')[0]}` : ''

  const activeCases = cases.filter(c => c.currentStatus !== 'Closed')
  const openFollowUps = followUps.filter(f => f.status === 'Open')
  const overdueFollowUps = openFollowUps.filter(f => {
    const d = getDaysUntil(f.dueDate)
    return d !== null && d < 0
  })
  const dueTodayFollowUps = openFollowUps.filter(f => getDaysUntil(f.dueDate) === 0)

  const thisMonth = today.getMonth()
  const thisYear = today.getFullYear()
  const wonThisMonth = cases.filter(c => {
    if (c.result !== 'Won' || !c.closedAt) return false
    const d = new Date(c.closedAt)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  })

  const casesWithMissingDocs = activeCases.filter(c => {
    const template = getWorkflowTemplate(c.caseType, workflowTemplates)
    if (!template) return false
    return getMissingRequiredDocs(c.id, template, caseFiles).length > 0
  })

  const casesReadyToMove = activeCases.filter(c => {
    const template = getWorkflowTemplate(c.caseType, workflowTemplates)
    if (!template) return false
    const missing = getMissingRequiredDocs(c.id, template, caseFiles)
    const caseOD = overdueFollowUps.some(f => f.caseId === c.id)
    return missing.length === 0 && !caseOD
  })

  const stuckCases = activeCases.filter(c => getStuckDays(c) > 14)

  const needsAttentionCases = activeCases.filter(c => {
    const hasOD = overdueFollowUps.some(f => f.caseId === c.id)
    const template = getWorkflowTemplate(c.caseType, workflowTemplates)
    const hasMissingDocs = template ? getMissingRequiredDocs(c.id, template, caseFiles).length > 0 : false
    const isStuck = getStuckDays(c) > 14
    return hasOD || hasMissingDocs || isStuck
  }).slice(0, 8)

  const recentActivity = activityLogs.slice(0, 10)

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      {/* Greeting */}
      <div className="mb-8">
        <p className="text-sm text-gray-400 mb-1">{dateLabel}</p>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Good day{greeting}.</h1>
        <p className="text-gray-500 mt-1">Here is what needs your attention today.</p>
      </div>

      {/* Overdue alert */}
      {overdueFollowUps.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6">
          <p className="text-sm font-semibold text-red-700 mb-3">
            {overdueFollowUps.length} overdue follow-up{overdueFollowUps.length > 1 ? 's' : ''} — please action these first
          </p>
          <div className="space-y-2">
            {overdueFollowUps.slice(0, 3).map(f => {
              const d = getDaysUntil(f.dueDate)!
              return (
                <div key={f.id} className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-900">{f.title}</p>
                    <p className="text-xs text-red-500 mt-0.5">{f.customerName} · {f.personInCharge}</p>
                  </div>
                  <span className="text-xs font-semibold text-red-600 bg-red-100 rounded-full px-2.5 py-1 shrink-0 ml-3">
                    {Math.abs(d)}d overdue
                  </span>
                </div>
              )
            })}
          </div>
          <Link href="/followups" className="mt-3 inline-block text-xs font-medium text-red-600 hover:underline">
            See all overdue follow-ups →
          </Link>
        </div>
      )}

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Active Cases" value={activeCases.length} color="blue" sub="not closed" />
        <StatCard label="Overdue Follow-Ups" value={overdueFollowUps.length} color={overdueFollowUps.length > 0 ? 'red' : 'default'} />
        <StatCard label="Missing Documents" value={casesWithMissingDocs.length} color={casesWithMissingDocs.length > 0 ? 'amber' : 'default'} sub="cases affected" />
        <StatCard label="Won This Month" value={wonThisMonth.length} color="green" />
      </div>

      {/* KPI Cards Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Customers" value={customers.length} />
        <StatCard label="Open Follow-Ups" value={openFollowUps.length} />
        <StatCard label="Ready to Move" value={casesReadyToMove.length} color={casesReadyToMove.length > 0 ? 'green' : 'default'} sub="docs complete" />
        <StatCard label="Stuck Cases" value={stuckCases.length} color={stuckCases.length > 0 ? 'amber' : 'default'} sub=">14 days" />
      </div>

      {/* Needs Attention + Today's Follow-Ups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 card-section">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-800">Needs Attention</h2>
            <span className="text-xs text-gray-400">{needsAttentionCases.length} cases</span>
          </div>
          {needsAttentionCases.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm font-medium text-gray-600">All caught up</p>
              <p className="text-xs text-gray-400 mt-1">No cases need immediate attention.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {needsAttentionCases.map(c => {
                const template = getWorkflowTemplate(c.caseType, workflowTemplates)
                const missing = template ? getMissingRequiredDocs(c.id, template, caseFiles) : []
                const hasOD = overdueFollowUps.some(f => f.caseId === c.id)
                const isStuck = getStuckDays(c) > 14
                const readiness = getCaseReadiness(c, template, caseFiles, followUps)
                return (
                  <Link key={c.id} href={`/cases/${c.id}`} className="block group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 line-clamp-1">{c.caseTitle}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <StatusBadge status={c.currentStatus} />
                          <span className="text-xs text-gray-400">{c.customerName}</span>
                          {missing.length > 0 && (
                            <span className="text-xs text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 font-medium">{missing.length} docs missing</span>
                          )}
                          {hasOD && (
                            <span className="text-xs text-red-600 bg-red-50 rounded px-1.5 py-0.5 font-medium">Follow-up overdue</span>
                          )}
                          {isStuck && !hasOD && (
                            <span className="text-xs text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 font-medium">{getStuckDays(c)}d no update</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`text-sm font-bold ${readiness >= 70 ? 'text-green-600' : readiness >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                          {readiness}%
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Today's Follow-Ups */}
        <div className="card-section">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-800">Today&rsquo;s Follow-Ups</h2>
            <span className="text-xs text-gray-400">{dueTodayFollowUps.length}</span>
          </div>
          {dueTodayFollowUps.length === 0 ? (
            <p className="text-sm text-gray-400">Nothing due today.</p>
          ) : (
            <div className="space-y-3">
              {dueTodayFollowUps.map(f => (
                <div key={f.id} className="border-l-2 border-amber-400 pl-3">
                  <p className="text-sm font-medium text-gray-800 line-clamp-1">{f.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{f.personInCharge} · {f.customerName}</p>
                </div>
              ))}
            </div>
          )}

          {openFollowUps.length > dueTodayFollowUps.length && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500">Upcoming</p>
                <Link href="/followups" className="text-xs text-blue-600 hover:underline">View all</Link>
              </div>
              <div className="space-y-2">
                {openFollowUps.filter(f => getDaysUntil(f.dueDate) !== 0 && (getDaysUntil(f.dueDate) ?? -1) >= 0).slice(0, 4).map(f => {
                  const d = getDaysUntil(f.dueDate)
                  return (
                    <div key={f.id} className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-700 line-clamp-1 flex-1">{f.title}</p>
                      <span className="text-xs text-gray-400 shrink-0">{d}d</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Document Gaps + Ready to Move */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card-section">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-800">Document Gaps</h2>
            <Link href="/cases" className="text-xs text-blue-600 hover:underline">View cases</Link>
          </div>
          {casesWithMissingDocs.length === 0 ? (
            <p className="text-sm text-gray-400">All cases have complete documents.</p>
          ) : (
            <div className="space-y-3">
              {casesWithMissingDocs.slice(0, 5).map(c => {
                const template = getWorkflowTemplate(c.caseType, workflowTemplates)
                const missing = template ? getMissingRequiredDocs(c.id, template, caseFiles) : []
                return (
                  <Link key={c.id} href={`/cases/${c.id}`} className="block group">
                    <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600 line-clamp-1">{c.caseTitle}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{c.customerName}</span>
                      <span className="text-xs text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 font-medium">{missing.length} missing</span>
                      {missing[0] && <span className="text-xs text-gray-400 truncate">{missing[0].name}</span>}
                    </div>
                  </Link>
                )
              })}
              {casesWithMissingDocs.length > 5 && (
                <Link href="/cases" className="block text-xs text-blue-600 hover:underline">{casesWithMissingDocs.length - 5} more cases →</Link>
              )}
            </div>
          )}
        </div>

        <div className="card-section">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-800">Ready to Move</h2>
            <span className="text-xs text-gray-400">{casesReadyToMove.length} cases</span>
          </div>
          {casesReadyToMove.length === 0 ? (
            <p className="text-sm text-gray-400">No cases fully ready at this time.</p>
          ) : (
            <div className="space-y-3">
              {casesReadyToMove.slice(0, 5).map(c => {
                const template = getWorkflowTemplate(c.caseType, workflowTemplates)
                const readiness = getCaseReadiness(c, template, caseFiles, followUps)
                return (
                  <Link key={c.id} href={`/cases/${c.id}`} className="block group">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600 line-clamp-1">{c.caseTitle}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <StatusBadge status={c.currentStatus} />
                          <span className="text-xs text-gray-400">{c.personInCharge}</span>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-green-600 shrink-0">{readiness}%</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card-section">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-800">Recent Activity</h2>
          <span className="text-xs text-gray-400">{recentActivity.length} entries</span>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-gray-400">No activity yet.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-3">
            {recentActivity.map(log => {
              const meta = getActionMeta(log.actionType)
              const dotColor = ACTION_COLOR_DOT[meta.color]
              return (
                <div key={log.id} className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium text-gray-800">{log.title}</p>
                      {log.oldValue && log.newValue && (
                        <span className="text-xs text-gray-400">
                          <span className="line-through">{log.oldValue}</span>
                          {' → '}
                          <span className="font-medium text-gray-600">{log.newValue}</span>
                        </span>
                      )}
                    </div>
                    {log.caseTitle && (
                      <p className="text-xs text-gray-500 truncate">{log.caseTitle}</p>
                    )}
                    {log.description && !log.caseTitle && (
                      <p className="text-xs text-gray-400 truncate">{log.description}</p>
                    )}
                    <p className="text-xs text-gray-300">{log.changedBy} · {timeAgo(log.timestamp)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
