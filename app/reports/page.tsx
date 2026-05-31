'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { CASE_STATUSES, CASE_TYPES, type Case } from '@/lib/types'
import { getDaysUntil, formatCurrency, formatDate } from '@/lib/utils'
import { getWorkflowTemplate, getMissingRequiredDocs, getStuckDays, getCaseReadiness } from '@/lib/workflow'
import StatCard from '@/components/ui/StatCard'
import StatusBadge from '@/components/ui/StatusBadge'
import PageHeader from '@/components/ui/PageHeader'
import Link from 'next/link'

type ReportTab = 'strategic' | 'operational' | 'insurer'

export default function ReportsPage() {
  const { cases, followUps, customers, caseFiles, workflowTemplates } = useStore()
  const [tab, setTab] = useState<ReportTab>('strategic')

  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()

  // Core metrics
  const closedCases = cases.filter(c => c.currentStatus === 'Closed')
  const wonCases = cases.filter(c => c.result === 'Won')
  const lostCases = cases.filter(c => c.result === 'Lost')
  const activeCases = cases.filter(c => c.currentStatus !== 'Closed')
  const casesThisMonth = cases.filter(c => {
    const d = new Date(c.createdAt)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  })
  const closedThisMonth = closedCases.filter(c => {
    if (!c.closedAt) return false
    const d = new Date(c.closedAt)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  })
  const wonThisMonth = wonCases.filter(c => {
    if (!c.closedAt) return false
    const d = new Date(c.closedAt)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  })

  const openFollowUps = followUps.filter(f => f.status === 'Open')
  const overdueFollowUps = openFollowUps.filter(f => {
    const d = getDaysUntil(f.dueDate)
    return d !== null && d < 0
  })
  const dueTodayFollowUps = openFollowUps.filter(f => getDaysUntil(f.dueDate) === 0)
  const dueThisWeekFollowUps = openFollowUps.filter(f => {
    const d = getDaysUntil(f.dueDate)
    return d !== null && d >= 0 && d <= 7
  })

  const winRate = wonCases.length + lostCases.length > 0
    ? Math.round((wonCases.length / (wonCases.length + lostCases.length)) * 100)
    : null

  // By status
  const byStatus = CASE_STATUSES.map(s => ({
    status: s,
    count: cases.filter(c => c.currentStatus === s).length,
  })).filter(x => x.count > 0)
  const maxStatus = Math.max(...byStatus.map(x => x.count), 1)

  // By type
  const byType = CASE_TYPES.map(t => ({
    type: t,
    count: cases.filter(c => c.caseType === t).length,
  })).filter(x => x.count > 0)
  const maxType = Math.max(...byType.map(x => x.count), 1)

  // Case lifecycle timing
  const closedWithDates = closedCases.filter(c => c.closedAt)
  const avgDaysToClose = closedWithDates.length > 0
    ? Math.round(closedWithDates.reduce((sum, c) => {
        return sum + (new Date(c.closedAt!).getTime() - new Date(c.createdAt).getTime()) / 86400000
      }, 0) / closedWithDates.length)
    : null
  const wonWithDates = wonCases.filter(c => c.closedAt)
  const avgDaysWon = wonWithDates.length > 0
    ? Math.round(wonWithDates.reduce((sum, c) => {
        return sum + (new Date(c.closedAt!).getTime() - new Date(c.createdAt).getTime()) / 86400000
      }, 0) / wonWithDates.length)
    : null
  const lostWithDates = lostCases.filter(c => c.closedAt)
  const avgDaysLost = lostWithDates.length > 0
    ? Math.round(lostWithDates.reduce((sum, c) => {
        return sum + (new Date(c.closedAt!).getTime() - new Date(c.createdAt).getTime()) / 86400000
      }, 0) / lostWithDates.length)
    : null

  // By PIC
  const byPic = [...new Set(cases.map(c => c.personInCharge).filter(Boolean))].map(pic => {
    const picCases = cases.filter(c => c.personInCharge === pic)
    const picOD = overdueFollowUps.filter(f => f.personInCharge === pic).length
    const picClosed = picCases.filter(c => c.closedAt)
    const picAvgDays = picClosed.length > 0
      ? Math.round(picClosed.reduce((sum, c) => {
          return sum + (new Date(c.closedAt!).getTime() - new Date(c.createdAt).getTime()) / 86400000
        }, 0) / picClosed.length)
      : null
    return {
      pic,
      total: picCases.length,
      active: picCases.filter(c => c.currentStatus !== 'Closed').length,
      won: picCases.filter(c => c.result === 'Won').length,
      lost: picCases.filter(c => c.result === 'Lost').length,
      overdueFollowUps: picOD,
      avgDays: picAvgDays,
    }
  })

  // Total value
  const totalAmount = cases.reduce((sum, c) => sum + c.amount, 0)
  const wonAmount = wonCases.reduce((sum, c) => sum + (c.finalAmount ?? c.amount), 0)
  const lostAmount = lostCases.reduce((sum, c) => sum + c.amount, 0)

  // Loss reasons
  const lossReasons = lostCases
    .filter(c => c.lossReason)
    .reduce<Record<string, number>>((acc, c) => {
      const reason = c.lossReason!
      acc[reason] = (acc[reason] ?? 0) + 1
      return acc
    }, {})

  // Operational
  const casesWithMissingDocs = activeCases.filter(c => {
    const template = getWorkflowTemplate(c.caseType, workflowTemplates)
    if (!template) return false
    return getMissingRequiredDocs(c.id, template, caseFiles).length > 0
  })
  const stuckCases = activeCases.filter(c => getStuckDays(c) > 14)
  const readyToMove = activeCases.filter(c => {
    const template = getWorkflowTemplate(c.caseType, workflowTemplates)
    if (!template) return false
    return getMissingRequiredDocs(c.id, template, caseFiles).length === 0 &&
      !overdueFollowUps.some(f => f.caseId === c.id)
  })
  const waitingCustomer = activeCases.filter(c =>
    c.currentStatus === 'Sent to Customer' || c.currentStatus === 'Quoted'
  )
  const waitingInsurer = activeCases.filter(c =>
    c.currentStatus === 'Submitted'
  )

  // Insurer view — group all non-closed cases that have a target insurer set
  const insurerGroups = activeCases
    .filter(c => c.finalInsurer)
    .reduce<Record<string, Case[]>>((acc, c) => {
      const key = c.finalInsurer!
      if (!acc[key]) acc[key] = []
      acc[key].push(c)
      return acc
    }, {})
  const insurerNames = Object.keys(insurerGroups).sort()
  const unassignedSubmitted = activeCases.filter(c => c.currentStatus === 'Submitted' && !c.finalInsurer)

  const copyInsurerSummary = (insurerName: string, caseList: Case[]) => {
    const today = new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
    const rows = caseList.map((c, i) => {
      const daysSince = Math.floor((Date.now() - new Date(c.updatedAt ?? c.createdAt).getTime()) / 86400000)
      return `${i + 1}. ${c.customerName}${c.bondPrincipal && c.bondPrincipal !== c.customerName ? ` (Principal: ${c.bondPrincipal})` : ''}\n   Type: ${c.caseType} | Amount: ${formatCurrency(c.amount)} | Status: ${c.currentStatus} | Pending: ${daysSince}d`
    })
    const total = caseList.reduce((s, c) => s + c.amount, 0)
    const text = [
      `Bond Insurance — Pending Submission Summary`,
      `Date: ${today}`,
      `Insurer: ${insurerName}`,
      ``,
      ...rows,
      ``,
      `Total: ${caseList.length} case${caseList.length !== 1 ? 's' : ''} | ${formatCurrency(total)}`,
      ``,
      `Kindly advise on the status of the above applications at your earliest convenience.`,
      ``,
      `Thank you.`,
    ].join('\n')
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader title="Reports" subtitle="Business performance and operational overview" />

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {([
          { key: 'strategic' as const, label: 'Strategic View' },
          { key: 'operational' as const, label: 'Operational View' },
          { key: 'insurer' as const, label: `Insurer Summary${insurerNames.length > 0 ? ` (${insurerNames.length})` : ''}` },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ STRATEGIC VIEW ══════════ */}
      {tab === 'strategic' && (
        <div className="space-y-6">
          {/* Top KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Cases" value={cases.length} />
            <StatCard label="Closed Cases" value={closedCases.length} />
            <StatCard label="Won Cases" value={wonCases.length} color="green" />
            <StatCard label="Lost Cases" value={lostCases.length} color="red" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Win Rate" value={winRate !== null ? `${winRate}%` : '—'} color={winRate !== null && winRate >= 50 ? 'green' : 'default'} />
            <StatCard label="Opened This Month" value={casesThisMonth.length} />
            <StatCard label="Closed This Month" value={closedThisMonth.length} />
            <StatCard label="Won This Month" value={wonThisMonth.length} color="green" />
          </div>

          {/* Value summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card-section">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Total Portfolio Value</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
            </div>
            <div className="card-section">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Won — Confirmed Value</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(wonAmount)}</p>
            </div>
            <div className="card-section">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Lost — Value</p>
              <p className="text-2xl font-bold text-red-500">{formatCurrency(lostAmount)}</p>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* By status */}
            <div className="card-section">
              <h2 className="text-base font-semibold text-gray-800 mb-5">Cases by Status</h2>
              <div className="space-y-3">
                {byStatus.map(({ status, count }) => (
                  <div key={status} className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 w-36 shrink-0">{status}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(count / maxStatus) * 100}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-5 text-right">{count}</span>
                  </div>
                ))}
                {byStatus.length === 0 && <p className="text-sm text-gray-400">No cases yet.</p>}
              </div>
            </div>

            {/* By type */}
            <div className="card-section">
              <h2 className="text-base font-semibold text-gray-800 mb-5">Cases by Type</h2>
              <div className="space-y-3">
                {byType.map(({ type, count }) => (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 w-36 shrink-0 truncate">{type}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-violet-400 rounded-full" style={{ width: `${(count / maxType) * 100}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-5 text-right">{count}</span>
                  </div>
                ))}
                {byType.length === 0 && <p className="text-sm text-gray-400">No cases yet.</p>}
              </div>
            </div>

            {/* Win / Loss */}
            <div className="card-section">
              <h2 className="text-base font-semibold text-gray-800 mb-5">Won vs Lost</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-green-700">Won</span>
                    <span className="font-bold text-gray-800">{wonCases.length}</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div className="h-full bg-green-400 rounded-full" style={{ width: wonCases.length + lostCases.length > 0 ? `${(wonCases.length / (wonCases.length + lostCases.length)) * 100}%` : '0%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-red-600">Lost</span>
                    <span className="font-bold text-gray-800">{lostCases.length}</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: wonCases.length + lostCases.length > 0 ? `${(lostCases.length / (wonCases.length + lostCases.length)) * 100}%` : '0%' }} />
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400">Win Rate</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{winRate !== null ? `${winRate}%` : '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Case Lifecycle Timing */}
          {avgDaysToClose !== null && (
            <div className="card-section">
              <h2 className="text-base font-semibold text-gray-800 mb-5">Case Lifecycle Timing</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Avg. Days to Close</p>
                  <p className="text-3xl font-bold text-gray-900">{avgDaysToClose}d</p>
                  <p className="text-xs text-gray-400 mt-1">across {closedWithDates.length} closed case{closedWithDates.length !== 1 ? 's' : ''}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Avg. Days — Won</p>
                  <p className={`text-3xl font-bold ${avgDaysWon !== null ? 'text-green-600' : 'text-gray-300'}`}>
                    {avgDaysWon !== null ? `${avgDaysWon}d` : '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{wonWithDates.length} won case{wonWithDates.length !== 1 ? 's' : ''}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Avg. Days — Lost</p>
                  <p className={`text-3xl font-bold ${avgDaysLost !== null ? 'text-red-500' : 'text-gray-300'}`}>
                    {avgDaysLost !== null ? `${avgDaysLost}d` : '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{lostWithDates.length} lost case{lostWithDates.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>
          )}

          {/* Loss Reasons */}
          {Object.keys(lossReasons).length > 0 && (
            <div className="card-section">
              <h2 className="text-base font-semibold text-gray-800 mb-5">Top Loss Reasons</h2>
              <div className="space-y-2">
                {Object.entries(lossReasons).sort(([, a], [, b]) => b - a).map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{reason}</span>
                    <span className="text-sm font-semibold text-red-600">{count} case{count > 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Person in Charge Performance */}
          <div className="card-section">
            <h2 className="text-base font-semibold text-gray-800 mb-5">Person in Charge Performance</h2>
            {byPic.length === 0 ? (
              <p className="text-sm text-gray-400">No cases assigned yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                    <th className="pb-3 font-semibold">Person</th>
                    <th className="pb-3 font-semibold text-right">Total</th>
                    <th className="pb-3 font-semibold text-right">Active</th>
                    <th className="pb-3 font-semibold text-right">Won</th>
                    <th className="pb-3 font-semibold text-right">Lost</th>
                    <th className="pb-3 font-semibold text-right">Avg. Days</th>
                    <th className="pb-3 font-semibold text-right">Overdue FUs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {byPic.map(row => (
                    <tr key={row.pic}>
                      <td className="py-3 font-semibold text-gray-800">{row.pic}</td>
                      <td className="py-3 text-right text-gray-600">{row.total}</td>
                      <td className="py-3 text-right text-blue-600 font-medium">{row.active}</td>
                      <td className="py-3 text-right text-green-600 font-medium">{row.won}</td>
                      <td className="py-3 text-right text-red-500 font-medium">{row.lost}</td>
                      <td className="py-3 text-right text-gray-500">{row.avgDays !== null ? `${row.avgDays}d` : '—'}</td>
                      <td className="py-3 text-right">
                        <span className={row.overdueFollowUps > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{row.overdueFollowUps}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══════════ OPERATIONAL VIEW ══════════ */}
      {tab === 'operational' && (
        <div className="space-y-6">
          {/* Operational KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Active Cases" value={activeCases.length} color="blue" />
            <StatCard label="Overdue Follow-Ups" value={overdueFollowUps.length} color={overdueFollowUps.length > 0 ? 'red' : 'default'} />
            <StatCard label="Missing Documents" value={casesWithMissingDocs.length} color={casesWithMissingDocs.length > 0 ? 'amber' : 'default'} />
            <StatCard label="Stuck Cases" value={stuckCases.length} color={stuckCases.length > 0 ? 'amber' : 'default'} sub=">14 days" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Due Today" value={dueTodayFollowUps.length} color={dueTodayFollowUps.length > 0 ? 'amber' : 'default'} />
            <StatCard label="Due This Week" value={dueThisWeekFollowUps.length} />
            <StatCard label="Ready to Move" value={readyToMove.length} color={readyToMove.length > 0 ? 'green' : 'default'} />
            <StatCard label="Open Follow-Ups" value={openFollowUps.length} />
          </div>

          {/* Cases by Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card-section">
              <h2 className="text-base font-semibold text-gray-800 mb-5">Active Cases by Status</h2>
              <div className="space-y-3">
                {CASE_STATUSES.filter(s => s !== 'Closed').map(s => {
                  const count = activeCases.filter(c => c.currentStatus === s).length
                  const max = Math.max(...CASE_STATUSES.map(st => activeCases.filter(c => c.currentStatus === st).length), 1)
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 w-36 shrink-0">{s}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                      <span className="text-sm font-semibold text-gray-700 w-5 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Waiting buckets */}
            <div className="card-section">
              <h2 className="text-base font-semibold text-gray-800 mb-5">Waiting For</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Waiting for Customer</p>
                    <p className="text-xs text-gray-400 mt-0.5">Quoted or Sent to Customer</p>
                  </div>
                  <span className="text-xl font-bold text-amber-600">{waitingCustomer.length}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Waiting for Insurer</p>
                    <p className="text-xs text-gray-400 mt-0.5">Submitted to insurer</p>
                  </div>
                  <span className="text-xl font-bold text-blue-600">{waitingInsurer.length}</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Ready to Move</p>
                    <p className="text-xs text-gray-400 mt-0.5">Docs complete, no overdue FUs</p>
                  </div>
                  <span className="text-xl font-bold text-green-600">{readyToMove.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Overdue Follow-Ups list */}
          {overdueFollowUps.length > 0 && (
            <div className="card-section">
              <h2 className="text-base font-semibold text-gray-800 mb-5">Overdue Follow-Ups</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="pb-3 font-semibold">Task</th>
                    <th className="pb-3 font-semibold">Customer / Case</th>
                    <th className="pb-3 font-semibold">Person</th>
                    <th className="pb-3 font-semibold text-right">Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {overdueFollowUps.map(f => {
                    const d = getDaysUntil(f.dueDate)!
                    return (
                      <tr key={f.id}>
                        <td className="py-3 font-medium text-gray-800">{f.title}</td>
                        <td className="py-3 text-gray-500">
                          <p>{f.customerName}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[200px]">{f.caseTitle}</p>
                        </td>
                        <td className="py-3 text-gray-500">{f.personInCharge}</td>
                        <td className="py-3 text-right font-semibold text-red-600">{Math.abs(d)}d late</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Stuck Cases */}
          {stuckCases.length > 0 && (
            <div className="card-section">
              <h2 className="text-base font-semibold text-gray-800 mb-5">Stuck Cases <span className="text-sm font-normal text-gray-400">(no update for 14+ days)</span></h2>
              <div className="space-y-3">
                {stuckCases.map(c => {
                  const template = getWorkflowTemplate(c.caseType, workflowTemplates)
                  const readiness = getCaseReadiness(c, template, caseFiles, followUps)
                  return (
                    <Link key={c.id} href={`/cases/${c.id}`} className="flex items-center justify-between group">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600 line-clamp-1">{c.caseTitle}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <StatusBadge status={c.currentStatus} />
                          <span className="text-xs text-gray-400">{c.customerName}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right ml-3">
                        <span className="text-xs font-semibold text-amber-600">{getStuckDays(c)}d</span>
                        <p className="text-xs text-gray-400">no update</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Document Gaps */}
          {casesWithMissingDocs.length > 0 && (
            <div className="card-section">
              <h2 className="text-base font-semibold text-gray-800 mb-5">Cases with Missing Documents</h2>
              <div className="space-y-3">
                {casesWithMissingDocs.map(c => {
                  const template = getWorkflowTemplate(c.caseType, workflowTemplates)
                  const missing = template ? getMissingRequiredDocs(c.id, template, caseFiles) : []
                  return (
                    <Link key={c.id} href={`/cases/${c.id}`} className="flex items-center justify-between group">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600 line-clamp-1">{c.caseTitle}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">{c.customerName} · {c.personInCharge}</span>
                        </div>
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          {missing.slice(0, 3).map(d => (
                            <span key={d.id} className="text-xs bg-amber-50 text-amber-700 rounded px-1.5 py-0.5">{d.name}</span>
                          ))}
                          {missing.length > 3 && <span className="text-xs text-gray-400">+{missing.length - 3} more</span>}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-amber-600 shrink-0 ml-3">{missing.length} missing</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ INSURER SUMMARY ══════════ */}
      {tab === 'insurer' && (
        <div className="space-y-6">
          {/* Overview KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Insurers Active" value={insurerNames.length} color="blue" />
            <StatCard label="Cases Assigned" value={activeCases.filter(c => c.finalInsurer).length} />
            <StatCard label="Unassigned Submitted" value={unassignedSubmitted.length} color={unassignedSubmitted.length > 0 ? 'amber' : 'default'} />
            <StatCard label="Total Pending Value" value={`RM ${(activeCases.filter(c => c.finalInsurer).reduce((s, c) => s + c.amount, 0) / 1000).toFixed(0)}k`} />
          </div>

          {insurerNames.length === 0 && unassignedSubmitted.length === 0 && (
            <div className="card-section text-center py-12">
              <p className="text-gray-400 text-sm">No cases have been assigned to an insurer yet.</p>
              <p className="text-gray-400 text-xs mt-1">Open a case → Case Info → Edit → set the Target Insurer.</p>
            </div>
          )}

          {/* Insurer cards */}
          {insurerNames.map(insurerName => {
            const caseList = insurerGroups[insurerName]
            const totalVal = caseList.reduce((s, c) => s + c.amount, 0)
            const avgDays = Math.round(caseList.reduce((s, c) => s + Math.floor((Date.now() - new Date(c.updatedAt ?? c.createdAt).getTime()) / 86400000), 0) / caseList.length)
            const byStatus: Record<string, number> = {}
            caseList.forEach(c => { byStatus[c.currentStatus] = (byStatus[c.currentStatus] ?? 0) + 1 })
            return (
              <InsurerCard
                key={insurerName}
                name={insurerName}
                cases={caseList}
                totalValue={totalVal}
                avgDays={avgDays}
                byStatus={byStatus}
                onCopy={() => copyInsurerSummary(insurerName, caseList)}
              />
            )
          })}

          {/* Unassigned submitted cases */}
          {unassignedSubmitted.length > 0 && (
            <div className="card-section border-l-4 border-amber-400">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-800">Submitted — No Insurer Set</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{unassignedSubmitted.length} case{unassignedSubmitted.length !== 1 ? 's' : ''} in Submitted status without a target insurer</p>
                </div>
                <span className="text-xl font-bold text-amber-600">{unassignedSubmitted.length}</span>
              </div>
              <div className="space-y-2">
                {unassignedSubmitted.map(c => (
                  <Link key={c.id} href={`/cases/${c.id}`} className="flex items-center justify-between group py-2 border-t border-gray-50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600 truncate">{c.caseTitle}</p>
                      <p className="text-xs text-gray-400">{c.customerName} · {c.personInCharge}</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 shrink-0 ml-3">{formatCurrency(c.amount)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type InsurerCardProps = {
  name: string
  cases: Case[]
  totalValue: number
  avgDays: number
  byStatus: Record<string, number>
  onCopy: () => void
}

function InsurerCard({ name, cases, totalValue, avgDays, byStatus, onCopy }: InsurerCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card-section">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-800">{name}</h2>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {Object.entries(byStatus).map(([status, count]) => (
              <span key={status} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 font-medium">{status}: {count}</span>
            ))}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${copied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Copy Summary
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-4 py-3 border-y border-gray-100 mb-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Cases</p>
          <p className="text-xl font-bold text-gray-900 mt-0.5">{cases.length}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Value</p>
          <p className="text-xl font-bold text-gray-900 mt-0.5">{formatCurrency(totalValue)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Avg. Pending</p>
          <p className="text-xl font-bold text-gray-900 mt-0.5">{avgDays}d</p>
        </div>
      </div>

      {/* Case list */}
      <div className="space-y-0">
        {(expanded ? cases : cases.slice(0, 5)).map((c, i) => {
          const daysPending = Math.floor((Date.now() - new Date(c.updatedAt ?? c.createdAt).getTime()) / 86400000)
          return (
            <div key={c.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
              <span className="text-xs text-gray-300 w-4 shrink-0 font-medium">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <Link href={`/cases/${c.id}`} className="text-sm font-medium text-gray-800 hover:text-blue-600 truncate block">
                  {c.caseTitle}
                </Link>
                <p className="text-xs text-gray-400 truncate">
                  {c.customerName}{c.bondPrincipal && c.bondPrincipal !== c.customerName ? ` → ${c.bondPrincipal}` : ''} · {c.caseType} · {c.personInCharge}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-gray-700">{formatCurrency(c.amount)}</p>
                <div className="flex items-center gap-1.5 justify-end mt-0.5">
                  <StatusBadge status={c.currentStatus} size="sm" />
                  <span className={`text-xs font-medium ${daysPending > 14 ? 'text-red-500' : daysPending > 7 ? 'text-amber-500' : 'text-gray-400'}`}>{daysPending}d</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {cases.length > 5 && (
        <button onClick={() => setExpanded(p => !p)} className="mt-3 text-xs text-blue-600 hover:underline">
          {expanded ? 'Show less' : `Show all ${cases.length} cases`}
        </button>
      )}
    </div>
  )
}
