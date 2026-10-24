'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import type { Policy } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import PageHeader from '@/components/ui/PageHeader'
import { daysUntil, expiryBadge } from '@/components/ui/PoliciesPanel'

// Every policy and bond across all cases (fix list 5.1), with quick filters
// for what is about to expire. Policies are added and renewed on each case's
// Policies tab.

type Filter = 'current' | 'due30' | 'due60' | 'due90' | 'expired' | 'pending' | 'all'

const FILTERS: { key: Filter; label: string; test: (p: Policy) => boolean }[] = [
  { key: 'current', label: 'Active', test: p => p.status === 'Active' },
  { key: 'due30', label: 'Expiring ≤ 30 days', test: p => p.status === 'Active' && inRange(p, 0, 30) },
  { key: 'due60', label: '≤ 60 days', test: p => p.status === 'Active' && inRange(p, 0, 60) },
  { key: 'due90', label: '≤ 90 days', test: p => p.status === 'Active' && inRange(p, 0, 90) },
  { key: 'expired', label: 'Expired', test: p => p.status === 'Expired' || (p.status === 'Active' && (daysUntil(p.expiryDate) ?? 0) < 0) },
  { key: 'pending', label: 'Pending', test: p => p.status === 'Pending' },
  { key: 'all', label: 'All', test: () => true },
]

function inRange(p: Policy, from: number, to: number) {
  const d = daysUntil(p.expiryDate)
  return d !== null && d >= from && d <= to
}

export default function PoliciesPage() {
  const { policies, cases } = useStore()
  const [filter, setFilter] = useState<Filter>('current')
  const [search, setSearch] = useState('')

  const caseById = new Map(cases.map(c => [c.id, c]))
  const q = search.trim().toLowerCase()
  const test = FILTERS.find(f => f.key === filter)!.test
  const rows = policies
    .filter(test)
    .filter(p => {
      if (!q) return true
      const c = caseById.get(p.caseId)
      return [p.policyType, p.policyNumber, p.insurer, c?.caseTitle, c?.customerName].some(v => v?.toLowerCase().includes(q))
    })
    .sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999'))

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader
        title="Policies"
        subtitle={`${policies.filter(p => p.status === 'Active').length} active · ${policies.filter(p => p.status === 'Active' && inRange(p, 0, 60)).length} expiring within 60 days`}
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${filter === f.key ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {f.label} ({policies.filter(f.test).length})
          </button>
        ))}
        <input
          className="input ml-auto w-64"
          placeholder="Search type, number, insurer, case…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card-section overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            No policies here. Add them on each case&apos;s <strong>Policies</strong> tab.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-semibold">Type</th>
                <th className="pb-2 font-semibold">Number</th>
                <th className="pb-2 font-semibold">Case</th>
                <th className="pb-2 font-semibold">Insurer</th>
                <th className="pb-2 font-semibold text-right">Sum Insured</th>
                <th className="pb-2 font-semibold">Expiry</th>
                <th className="pb-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(p => {
                const c = caseById.get(p.caseId)
                const badge = expiryBadge(p)
                return (
                  <tr key={p.id}>
                    <td className="py-2.5 font-medium text-gray-800">{p.policyType}</td>
                    <td className="py-2.5 text-gray-500">{p.policyNumber || '—'}</td>
                    <td className="py-2.5">
                      {c ? (
                        <Link href={`/cases/${c.id}`} className="text-blue-600 hover:underline">
                          {c.caseTitle}
                        </Link>
                      ) : '—'}
                      {c?.customerName && <p className="text-xs text-gray-400">{c.customerName}</p>}
                    </td>
                    <td className="py-2.5 text-gray-500">{p.insurer || '—'}</td>
                    <td className="py-2.5 text-gray-700 text-right whitespace-nowrap">{p.sumInsured != null ? formatCurrency(p.sumInsured) : '—'}</td>
                    <td className="py-2.5 whitespace-nowrap">
                      {p.expiryDate ? formatDate(p.expiryDate) : '—'}
                      {badge && <span className={`ml-2 text-xs font-medium rounded-full px-2 py-0.5 ${badge.className}`}>{badge.text}</span>}
                    </td>
                    <td className="py-2.5 text-gray-600">{p.status}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
