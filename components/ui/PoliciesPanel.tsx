'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import type { Case, Policy, PolicyStatus } from '@/lib/types'
import { POLICY_STATUSES } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import Modal from './Modal'

// A case's policies and bonds (fix list 5.1): one row each — e.g. the
// performance bond, CAR and TPL for one contract. "Renew" starts the next
// year's policy as a new row and marks the old one Renewed.

const STATUS_STYLES: Record<PolicyStatus, string> = {
  Pending: 'bg-gray-100 text-gray-600',
  Active: 'bg-green-100 text-green-700',
  Renewed: 'bg-blue-50 text-blue-600',
  Expired: 'bg-red-100 text-red-700',
  Cancelled: 'bg-gray-100 text-gray-400',
}

/** Days from today to a YYYY-MM-DD date (negative once past). */
export function daysUntil(date?: string): number | null {
  if (!date) return null
  const now = new Date()   // today's local date, compared as calendar days
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((Date.parse(`${date.slice(0, 10)}T00:00:00Z`) - today) / 86400000)
}

/** Badge text and colour for how soon a policy expires. */
export function expiryBadge(p: Policy): { text: string; className: string } | null {
  if (p.status !== 'Active' && p.status !== 'Pending') return null
  const days = daysUntil(p.expiryDate)
  if (days === null) return null
  if (days < 0) return { text: `Expired ${-days}d ago`, className: 'bg-red-100 text-red-700' }
  if (days <= 30) return { text: `Expires in ${days}d`, className: 'bg-red-100 text-red-700' }
  if (days <= 60) return { text: `Expires in ${days}d`, className: 'bg-amber-100 text-amber-700' }
  return null
}

const addDays = (date: string, days: number) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
const addYear = (date: string) => {
  const d = new Date(date)
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

type FormData = {
  policyType: string; policyNumber: string; insurer: string
  sumInsured: string; premium: string; startDate: string; expiryDate: string
  status: PolicyStatus; caseFileId: string; notes: string
}

const toForm = (p?: Partial<Policy>): FormData => ({
  policyType: p?.policyType ?? '', policyNumber: p?.policyNumber ?? '', insurer: p?.insurer ?? '',
  sumInsured: p?.sumInsured != null ? String(p.sumInsured) : '', premium: p?.premium != null ? String(p.premium) : '',
  startDate: p?.startDate ?? '', expiryDate: p?.expiryDate ?? '', status: p?.status ?? 'Active',
  caseFileId: p?.caseFileId ?? '', notes: p?.notes ?? '',
})

const fromForm = (f: FormData) => ({
  policyType: f.policyType.trim(), policyNumber: f.policyNumber.trim(), insurer: f.insurer,
  sumInsured: f.sumInsured ? Number(f.sumInsured) : undefined, premium: f.premium ? Number(f.premium) : undefined,
  startDate: f.startDate || undefined, expiryDate: f.expiryDate || undefined, status: f.status,
  caseFileId: f.caseFileId || undefined, notes: f.notes,
})

function PolicyModal({ title, initial, caseId, onSave, onClose }: {
  title: string; initial: FormData; caseId: string; onSave: (f: FormData) => void; onClose: () => void
}) {
  const { products, settingsData, caseFiles } = useStore()
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')
  const set = (k: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }))
  const files = caseFiles.filter(f => f.caseId === caseId)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.policyType.trim()) { setError('Type is required (e.g. Performance Bond).'); return }
    if (form.startDate && form.expiryDate && form.expiryDate < form.startDate) { setError('Expiry date is before the start date.'); return }
    onSave(form)
  }

  return (
    <Modal isOpen onClose={onClose} title={title}>
      <form onSubmit={submit} className="px-6 py-5 space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Type *</label>
            <input className="input" list="policy-types" value={form.policyType} onChange={set('policyType')} placeholder="e.g. Performance Bond" />
            <datalist id="policy-types">
              {products.filter(p => p.isActive).map(p => <option key={p.id} value={p.name} />)}
            </datalist>
          </div>
          <div>
            <label className="label">Policy / Bond No.</label>
            <input className="input" value={form.policyNumber} onChange={set('policyNumber')} />
          </div>
          <div>
            <label className="label">Insurer</label>
            <select className="input" value={form.insurer} onChange={set('insurer')}>
              <option value="">— Select —</option>
              {settingsData.insurers.filter(i => i.isActive || i.name === form.insurer).map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={set('status')}>
              {POLICY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Sum Insured (RM)</label>
            <input className="input" type="number" min="0" step="0.01" value={form.sumInsured} onChange={set('sumInsured')} />
          </div>
          <div>
            <label className="label">Premium (RM)</label>
            <input className="input" type="number" min="0" step="0.01" value={form.premium} onChange={set('premium')} />
          </div>
          <div>
            <label className="label">Start Date</label>
            <input className="input" type="date" value={form.startDate} onChange={set('startDate')} />
          </div>
          <div>
            <label className="label">Expiry Date</label>
            <input className="input" type="date" value={form.expiryDate} onChange={set('expiryDate')} />
          </div>
        </div>
        <div>
          <label className="label">Policy document</label>
          <select className="input" value={form.caseFileId} onChange={set('caseFileId')}>
            <option value="">— None —</option>
            {files.map(f => <option key={f.id} value={f.id}>{f.fileName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={set('notes')} />
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" className="btn-primary flex-1">Save</button>
        </div>
      </form>
    </Modal>
  )
}

export default function PoliciesPanel({ caseItem }: { caseItem: Case }) {
  const { policies, caseFiles, addPolicy, updatePolicy, deletePolicy, renewPolicy, addActivityLog } = useStore()
  const { currentUser } = useAuth()
  const changedBy = currentUser?.fullName ?? 'Unknown'
  const [modal, setModal] = useState<{ mode: 'add' | 'edit' | 'renew'; policy?: Policy } | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const all = policies.filter(p => p.caseId === caseItem.id)
  const current = all.filter(p => p.status !== 'Renewed')
  const history = all.filter(p => p.status === 'Renewed')
  const sortByExpiry = (a: Policy, b: Policy) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999')

  const log = (title: string, description: string) =>
    addActivityLog({ caseId: caseItem.id, caseTitle: caseItem.caseTitle, actionType: 'CASE_UPDATED', title, description, changedBy })

  const save = (f: FormData) => {
    const data = fromForm(f)
    const label = `${data.policyType}${data.policyNumber ? ` ${data.policyNumber}` : ''}`
    if (modal?.mode === 'add') {
      addPolicy({ ...data, caseId: caseItem.id })
      log('Policy added', label)
    } else if (modal?.mode === 'edit' && modal.policy) {
      updatePolicy(modal.policy.id, data)
      log('Policy updated', label)
    } else if (modal?.mode === 'renew' && modal.policy) {
      renewPolicy(modal.policy.id, data)
      log('Policy renewed', `${label}${data.expiryDate ? ` — now expires ${formatDate(data.expiryDate)}` : ''}`)
    }
    setModal(null)
  }

  const renewForm = (p: Policy): FormData => toForm({
    ...p, policyNumber: '', status: 'Active', caseFileId: undefined, notes: '',
    startDate: p.expiryDate ? addDays(p.expiryDate, 1) : undefined,
    expiryDate: p.expiryDate ? addYear(p.expiryDate) : undefined,
  })

  const Row = ({ p, past }: { p: Policy; past?: boolean }) => {
    const badge = expiryBadge(p)
    const file = caseFiles.find(f => f.id === p.caseFileId)
    return (
      <div className={`rounded-xl border px-4 py-3 ${past ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-semibold ${past ? 'text-gray-500' : 'text-gray-800'}`}>{p.policyType}</p>
              {p.policyNumber && <span className="text-xs text-gray-500">No. {p.policyNumber}</span>}
              <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${STATUS_STYLES[p.status]}`}>{p.status}</span>
              {badge && <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${badge.className}`}>{badge.text}</span>}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {[
                p.insurer,
                p.sumInsured != null ? `Sum insured ${formatCurrency(p.sumInsured)}` : '',
                p.premium != null ? `Premium ${formatCurrency(p.premium)}` : '',
                p.startDate || p.expiryDate ? `${p.startDate ? formatDate(p.startDate) : '?'} → ${p.expiryDate ? formatDate(p.expiryDate) : '?'}` : '',
              ].filter(Boolean).join(' · ') || 'No details yet'}
            </p>
            {file && <p className="text-xs text-gray-400 mt-0.5">Document: {file.fileName}</p>}
            {p.notes && <p className="text-xs text-gray-400 mt-0.5">{p.notes}</p>}
          </div>
          {!past && (
            <div className="flex gap-1.5 shrink-0">
              {(p.status === 'Active' || p.status === 'Expired') && (
                <button onClick={() => setModal({ mode: 'renew', policy: p })} className="btn-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100">Renew</button>
              )}
              <button onClick={() => setModal({ mode: 'edit', policy: p })} className="btn-xs bg-gray-100 text-gray-700 hover:bg-gray-200">Edit</button>
              {deleteId === p.id ? (
                <>
                  <button onClick={() => { deletePolicy(p.id); log('Policy deleted', p.policyType); setDeleteId(null) }} className="btn-xs bg-red-600 text-white">Confirm</button>
                  <button onClick={() => setDeleteId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
                </>
              ) : (
                <button onClick={() => setDeleteId(p.id)} className="btn-xs text-gray-300 hover:text-red-400">✕</button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Policies &amp; Bonds</h3>
          <p className="text-xs text-gray-400 mt-0.5">Each policy or bond for this contract, with its own number, insurer and dates.</p>
        </div>
        <button onClick={() => setModal({ mode: 'add' })} className="btn-primary text-sm">+ Add Policy</button>
      </div>

      {current.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center border-2 border-dashed border-gray-200 rounded-2xl">No policies recorded yet.</p>
      ) : (
        current.sort(sortByExpiry).map(p => <Row key={p.id} p={p} />)
      )}

      {history.length > 0 && (
        <div>
          <button onClick={() => setShowHistory(v => !v)} className="text-xs text-gray-500 hover:underline">
            {showHistory ? 'Hide' : 'Show'} {history.length} earlier (renewed) polic{history.length === 1 ? 'y' : 'ies'}
          </button>
          {showHistory && <div className="space-y-2 mt-2">{history.sort(sortByExpiry).map(p => <Row key={p.id} p={p} past />)}</div>}
        </div>
      )}

      {modal && (
        <PolicyModal
          title={modal.mode === 'add' ? 'Add Policy' : modal.mode === 'edit' ? 'Edit Policy' : `Renew ${modal.policy?.policyType ?? 'Policy'}`}
          initial={modal.mode === 'add' ? toForm() : modal.mode === 'edit' ? toForm(modal.policy) : renewForm(modal.policy!)}
          caseId={caseItem.id}
          onSave={save}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
