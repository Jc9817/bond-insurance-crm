'use client'

import Link from 'next/link'
import { useStore } from '@/lib/store'
import { CASE_STATUSES } from '@/lib/types'
import { getDaysUntil, formatDate, formatCurrency, timeAgo } from '@/lib/utils'
import StatCard from '@/components/ui/StatCard'
import StatusBadge from '@/components/ui/StatusBadge'
import PageHeader from '@/components/ui/PageHeader'

export default function HomePage() {
  const { customers, cases, followUps } = useStore()

  const today = new Date()
  const dateLabel = today.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const activeCases = cases.filter(c => c.currentStatus !== 'Closed')
  const openFollowUps = followUps.filter(f => f.status === 'Open')
  const overdueFollowUps = openFollowUps.filter(f => {
    const d = getDaysUntil(f.dueDate)
    return d !== null && d < 0
  })
  const dueTodayFollowUps = openFollowUps.filter(f => getDaysUntil(f.dueDate) === 0)
  const casesNeedingAction = cases.filter(c =>
    c.currentStatus === 'Waiting Documents' || c.currentStatus === 'Sent to Customer'
  )
  const recentCases = [...cases]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)

  const casesByStatus = CASE_STATUSES.map(s => ({
    status: s,
    count: cases.filter(c => c.currentStatus === s).length,
  })).filter(x => x.count > 0)
  const maxCount = Math.max(...casesByStatus.map(x => x.count), 1)

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      {/* Greeting */}
      <div className="mb-8">
        <p className="text-sm text-gray-400 mb-1">{dateLabel}</p>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Good day.</h1>
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
          <Link href="/followups?tab=Overdue" className="mt-3 inline-block text-xs font-medium text-red-600 hover:underline">
            See all overdue follow-ups →
          </Link>
        </div>
      )}

      {/* Due today */}
      {dueTodayFollowUps.length > 0 && overdueFollowUps.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
          <p className="text-sm font-semibold text-amber-700 mb-1">
            {dueTodayFollowUps.length} follow-up{dueTodayFollowUps.length > 1 ? 's' : ''} due today
          </p>
          {dueTodayFollowUps.map(f => (
            <p key={f.id} className="text-sm text-amber-800 mt-1">· {f.title} <span className="text-amber-500">({f.personInCharge})</span></p>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Customers" value={customers.length} />
        <StatCard label="Active Cases" value={activeCases.length} sub="not closed" color="blue" />
        <StatCard label="Open Follow-Ups" value={openFollowUps.length} color={overdueFollowUps.length > 0 ? 'amber' : 'default'} />
        <StatCard label="Overdue Follow-Ups" value={overdueFollowUps.length} color={overdueFollowUps.length > 0 ? 'red' : 'default'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Cases by status */}
        <div className="card-section">
          <h2 className="text-base font-semibold text-gray-800 mb-5">Cases by Status</h2>
          <div className="space-y-3">
            {casesByStatus.map(({ status, count }) => (
              <div key={status} className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-36 shrink-0">{status}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-700 w-4 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cases needing action */}
        <div className="card-section">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-800">Needs Your Action</h2>
            <span className="text-xs text-gray-400">{casesNeedingAction.length} cases</span>
          </div>
          {casesNeedingAction.length === 0 ? (
            <p className="text-sm text-gray-400">All cases are up to date.</p>
          ) : (
            <div className="space-y-3">
              {casesNeedingAction.slice(0, 4).map(c => (
                <Link key={c.id} href={`/cases/${c.id}`} className="block group">
                  <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600 line-clamp-1">{c.caseTitle}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StatusBadge status={c.currentStatus} />
                    <span className="text-xs text-gray-400">{c.customerName}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Open follow-ups today */}
        <div className="card-section">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-800">Open Follow-Ups</h2>
            <Link href="/followups" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          {openFollowUps.length === 0 ? (
            <p className="text-sm text-gray-400">No open follow-ups.</p>
          ) : (
            <div className="space-y-3">
              {openFollowUps.slice(0, 5).map(f => {
                const d = getDaysUntil(f.dueDate)
                const isOD = d !== null && d < 0
                return (
                  <div key={f.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 line-clamp-1">{f.title}</p>
                      <p className="text-xs text-gray-400">{f.personInCharge}</p>
                    </div>
                    {isOD ? (
                      <span className="text-xs text-red-500 font-medium shrink-0">{Math.abs(d!)}d overdue</span>
                    ) : d === 0 ? (
                      <span className="text-xs text-amber-600 font-medium shrink-0">Today</span>
                    ) : d !== null ? (
                      <span className="text-xs text-gray-400 shrink-0">{formatDate(f.dueDate)}</span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent cases */}
      <div className="card-section">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-800">Recent Cases</h2>
          <Link href="/cases" className="text-xs text-blue-600 hover:underline">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-th pl-0">Case</th>
                <th className="table-th">Customer</th>
                <th className="table-th">Type</th>
                <th className="table-th">Amount</th>
                <th className="table-th">Person in Charge</th>
                <th className="table-th">Current Status</th>
                <th className="table-th">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentCases.map(c => (
                <tr key={c.id} className="group hover:bg-stone-50 transition-colors">
                  <td className="table-td pl-0">
                    <Link href={`/cases/${c.id}`} className="font-semibold text-gray-900 hover:text-blue-600 line-clamp-1 max-w-[220px] block">
                      {c.caseTitle}
                    </Link>
                  </td>
                  <td className="table-td text-gray-500">{c.customerName}</td>
                  <td className="table-td text-gray-500 whitespace-nowrap">{c.caseType}</td>
                  <td className="table-td font-medium text-gray-800 whitespace-nowrap">{formatCurrency(c.amount)}</td>
                  <td className="table-td text-gray-500 whitespace-nowrap">{c.personInCharge}</td>
                  <td className="table-td"><StatusBadge status={c.currentStatus} /></td>
                  <td className="table-td text-gray-400 whitespace-nowrap text-xs">{timeAgo(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
