'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'

// Settings → Data Retention (Admins only, fix list 5.6). Lists closed cases
// whose keep period has ended (the daily job has already archived them) and
// lets an Admin delete them for good after review. See docs/PDPA-note.md.

type DueCase = {
  id: string; caseNumber: string; caseTitle: string; customerName: string
  rule: string; keepUntil: string; archived: boolean
}

export default function RetentionPanel() {
  const [cases, setCases] = useState<DueCase[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/retention')
      .then(async res => {
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) { setMessage(data.error ?? 'Could not load the list.'); setCases([]); return }
        setCases(data.cases ?? [])
      })
      .catch(() => { if (!cancelled) { setMessage('Could not load the list.'); setCases([]) } })
    return () => { cancelled = true }
  }, [reloadKey])

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const deleteSelected = async () => {
    setBusy(true)
    setMessage('')
    const res = await fetch('/api/admin/retention', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseIds: [...selected] }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    setConfirming(false)
    setSelected(new Set())
    setMessage(res.ok ? `${data.deleted} case${data.deleted === 1 ? '' : 's'} deleted for good. Reload DocFlow to update the lists.` : data.error ?? 'Delete failed.')
    setReloadKey(k => k + 1)
  }

  return (
    <div className="card-section">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Data Retention</h2>
      <p className="text-sm text-gray-500 mb-4">
        Closed cases are kept for 7 years after their last policy expires (or after closing if they had no policy);
        lost and cancelled cases for 2 years. Cases past that are archived automatically and listed here. Deleting
        removes the case, its files (including SharePoint copies), notes, emails, history and policies for good.
      </p>

      {message && <p className="text-sm bg-gray-50 rounded-xl p-3 mb-4 text-gray-700">{message}</p>}

      {cases === null ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : cases.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">No cases have reached the end of their keep period.</p>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3 text-sm">
            <button
              onClick={() => setSelected(selected.size === cases.length ? new Set() : new Set(cases.map(c => c.id)))}
              className="text-violet-600 hover:underline"
            >
              {selected.size === cases.length ? 'Clear selection' : `Select all ${cases.length}`}
            </button>
            {selected.size > 0 && !confirming && (
              <button onClick={() => setConfirming(true)} className="btn-xs bg-red-600 hover:bg-red-700 text-white">
                Delete permanently ({selected.size})
              </button>
            )}
          </div>

          {confirming && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 space-y-3">
              <p className="text-sm text-red-700">
                Delete {selected.size} case{selected.size === 1 ? '' : 's'} and all their documents for good? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button onClick={deleteSelected} disabled={busy} className="btn-xs bg-red-600 hover:bg-red-700 text-white disabled:opacity-60">
                  {busy ? 'Deleting…' : 'Yes, delete for good'}
                </button>
                <button onClick={() => setConfirming(false)} disabled={busy} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
              </div>
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 w-8"></th>
                <th className="pb-2 font-semibold">Case</th>
                <th className="pb-2 font-semibold">Customer</th>
                <th className="pb-2 font-semibold">Rule</th>
                <th className="pb-2 font-semibold">Keep period ended</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {cases.map(c => (
                <tr key={c.id}>
                  <td className="py-2.5"><input type="checkbox" className="accent-red-600" checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></td>
                  <td className="py-2.5 font-medium text-gray-800">{c.caseNumber} {c.caseTitle}</td>
                  <td className="py-2.5 text-gray-500">{c.customerName || '—'}</td>
                  <td className="py-2.5 text-gray-500">{c.rule}</td>
                  <td className="py-2.5 text-gray-500 whitespace-nowrap">{formatDate(c.keepUntil)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
