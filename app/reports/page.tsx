'use client'

import { useStore } from '@/lib/store'
import { CASE_STATUSES, CASE_TYPES } from '@/lib/types'
import { getDaysUntil, formatCurrency } from '@/lib/utils'
import StatCard from '@/components/ui/StatCard'
import PageHeader from '@/components/ui/PageHeader'

export default function ReportsPage() {
  const { cases, followUps, customers } = useStore()

  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()

  const casesThisMonth = cases.filter(c => {
    const d = new Date(c.createdAt)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  })

  const closedCases = cases.filter(c => c.currentStatus === 'Closed')
  const wonCases = cases.filter(c => c.result === 'Won')
  const lostCases = cases.filter(c => c.result === 'Lost')
  const activeCases = cases.filter(c => c.currentStatus !== 'Closed')

  const openFollowUps = followUps.filter(f => f.status === 'Open')
  const overdueFollowUps = openFollowUps.filter(f => {
    const d = getDaysUntil(f.dueDate)
    return d !== null && d < 0
  })

  const winRate = wonCases.length + lostCases.length > 0
    ? Math.round((wonCases.length / (wonCases.length + lostCases.length)) * 100)
    : null

  const byStatus = CASE_STATUSES.map(s => ({
    status: s,
    count: cases.filter(c => c.currentStatus === s).length,
  })).filter(x => x.count > 0)
  const maxStatus = Math.max(...byStatus.map(x => x.count), 1)

  const byType = CASE_TYPES.map(t => ({
    type: t,
    count: cases.filter(c => c.caseType === t).length,
  })).filter(x => x.count > 0)
  const maxType = Math.max(...byType.map(x => x.count), 1)

  const byPic = [...new Set(cases.map(c => c.personInCharge).filter(Boolean))].map(pic => ({
    pic,
    total: cases.filter(c => c.personInCharge === pic).length,
    active: cases.filter(c => c.personInCharge === pic && c.currentStatus !== 'Closed').length,
    won: cases.filter(c => c.personInCharge === pic && c.result === 'Won').length,
  }))

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader title="Reports" subtitle="Operational summary" />

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Customers" value={customers.length} />
        <StatCard label="Active Cases" value={activeCases.length} sub="not yet closed" color="blue" />
        <StatCard label="Cases Opened This Month" value={casesThisMonth.length} />
        <StatCard label="Cases Closed (All Time)" value={closedCases.length} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Won Cases" value={wonCases.length} color="green" />
        <StatCard label="Lost Cases" value={lostCases.length} color="red" />
        <StatCard label="Open Follow-Ups" value={openFollowUps.length} />
        <StatCard label="Overdue Follow-Ups" value={overdueFollowUps.length} color={overdueFollowUps.length > 0 ? 'red' : 'default'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Cases by status */}
        <div className="card-section">
          <h2 className="text-base font-semibold text-gray-800 mb-5">Cases by Current Status</h2>
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

        {/* Cases by type */}
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
          <h2 className="text-base font-semibold text-gray-800 mb-5">Results (Won vs Lost)</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-medium text-green-700">Won</span>
                <span className="font-bold text-gray-800">{wonCases.length}</span>
              </div>
              <div className="bg-gray-100 rounded-full h-2">
                <div className="h-full bg-green-400 rounded-full transition-all"
                  style={{ width: wonCases.length + lostCases.length > 0 ? `${(wonCases.length / (wonCases.length + lostCases.length)) * 100}%` : '0%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-medium text-red-600">Lost</span>
                <span className="font-bold text-gray-800">{lostCases.length}</span>
              </div>
              <div className="bg-gray-100 rounded-full h-2">
                <div className="h-full bg-red-400 rounded-full transition-all"
                  style={{ width: wonCases.length + lostCases.length > 0 ? `${(lostCases.length / (wonCases.length + lostCases.length)) * 100}%` : '0%' }} />
              </div>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">Win Rate</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{winRate !== null ? `${winRate}%` : '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cases by PIC */}
      <div className="card-section">
        <h2 className="text-base font-semibold text-gray-800 mb-5">Cases by Person in Charge</h2>
        {byPic.length === 0 ? (
          <p className="text-sm text-gray-400">No cases assigned yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="pb-3 font-semibold">Person in Charge</th>
                <th className="pb-3 font-semibold text-right">Total Cases</th>
                <th className="pb-3 font-semibold text-right">Active</th>
                <th className="pb-3 font-semibold text-right">Won</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {byPic.map(row => (
                <tr key={row.pic}>
                  <td className="py-3 font-semibold text-gray-800">{row.pic}</td>
                  <td className="py-3 text-right text-gray-600">{row.total}</td>
                  <td className="py-3 text-right text-blue-600 font-medium">{row.active}</td>
                  <td className="py-3 text-right text-green-600 font-medium">{row.won}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
