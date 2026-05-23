'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import type { Case, CaseStatus } from '@/lib/types'
import { CASE_STATUSES, CASE_TYPES } from '@/lib/types'
import { formatCurrency, timeAgo } from '@/lib/utils'
import { getWorkflowTemplate, getCaseReadiness, getMissingRequiredDocs } from '@/lib/workflow'
import PageHeader from '@/components/ui/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import KanbanBoard from '@/components/ui/KanbanBoard'

type FormData = Omit<Case, 'id' | 'createdAt'>
const emptyCase = (customers: { id: string; customerName: string }[]): FormData => ({
  caseTitle: '',
  customerId: customers[0]?.id ?? '',
  customerName: customers[0]?.customerName ?? '',
  caseType: '',
  amount: 0,
  personInCharge: '',
  currentStatus: 'New',
  currentWorkflowStepId: '',
  result: '',
  closingRemarks: '',
})

function CaseForm({ initial, customers, pics, onSave, onCancel }: {
  initial: FormData
  customers: { id: string; customerName: string; businessType?: string }[]
  pics: { name: string }[]
  onSave: (d: FormData) => void
  onCancel: () => void
}) {
  const { workflowTemplates } = useStore()
  const [form, setForm] = useState<FormData>(initial)
  const [error, setError] = useState('')

  const set = (k: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      if (k === 'customerId') {
        const c = customers.find(x => x.id === e.target.value)
        setForm(prev => {
          const caseType = prev.caseType
          if (caseType) {
            const template = getWorkflowTemplate(caseType, workflowTemplates, c?.businessType)
            const firstStep = template?.workflowSteps.filter(s => s.isActive).sort((a, b) => a.order - b.order)[0]
            return { ...prev, customerId: e.target.value, customerName: c?.customerName ?? '', currentWorkflowStepId: firstStep?.id ?? prev.currentWorkflowStepId }
          }
          return { ...prev, customerId: e.target.value, customerName: c?.customerName ?? '' }
        })
      } else if (k === 'amount') {
        setForm(prev => ({ ...prev, amount: Number(e.target.value) }))
      } else if (k === 'caseType') {
        const c = customers.find(x => x.id === form.customerId)
        const template = getWorkflowTemplate(e.target.value, workflowTemplates, c?.businessType)
        const firstStep = template?.workflowSteps.filter(s => s.isActive).sort((a, b) => a.order - b.order)[0]
        setForm(prev => ({ ...prev, caseType: e.target.value, currentWorkflowStepId: firstStep?.id ?? '' }))
      } else {
        setForm(prev => ({ ...prev, [k]: e.target.value }))
      }
    }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.caseTitle.trim()) { setError('Case title is required.'); return }
    if (!form.customerId) { setError('Please select a customer.'); return }
    onSave(form)
  }

  return (
    <form onSubmit={submit} className="px-6 py-5 space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
      <div>
        <label className="label">Case Title *</label>
        <input className="input" value={form.caseTitle} onChange={set('caseTitle')} placeholder="e.g. Performance Bond — Project XYZ" />
      </div>
      <div>
        <label className="label">Customer *</label>
        <select className="input" value={form.customerId} onChange={set('customerId')}>
          <option value="">— Select Customer —</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.customerName}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Case Type</label>
          <select className="input" value={form.caseType} onChange={set('caseType')}>
            <option value="">— Select Type —</option>
            {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Amount (RM)</label>
          <input className="input" type="number" min={0} value={form.amount || ''} onChange={set('amount')} placeholder="0" />
        </div>
        <div>
          <label className="label">Person in Charge</label>
          <select className="input" value={form.personInCharge} onChange={set('personInCharge')}>
            <option value="">— Select —</option>
            {pics.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Current Status</label>
          <select className="input" value={form.currentStatus} onChange={set('currentStatus')}>
            {CASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" className="btn-primary flex-1">Save Case</button>
      </div>
    </form>
  )
}

export default function CasesPage() {
  const { cases, customers, pics, caseFiles, followUps, workflowTemplates, addCase, updateCase, deleteCase } = useStore()
  const [view, setView] = useState<'list' | 'board'>('list')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [selected, setSelected] = useState<Case | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const filtered = cases.filter(c => {
    const matchStatus = statusFilter === 'All' || c.currentStatus === statusFilter
    const matchSearch = search === '' || [c.caseTitle, c.customerName, c.caseType, c.personInCharge].some(f =>
      f?.toLowerCase().includes(search.toLowerCase())
    )
    return matchStatus && matchSearch
  })

  const closeModal = () => { setModal(null); setSelected(null) }

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader
        title="Cases"
        subtitle={`${cases.length} total cases`}
        action={<button className="btn-primary" onClick={() => setModal('add')}>+ New Case</button>}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cases…" className="input w-64" />
        <select className="input w-52" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="All">All Statuses</option>
          {CASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="ml-auto flex rounded-xl border border-gray-200 overflow-hidden bg-white">
          {(['list', 'board'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-4 py-2 text-sm font-medium transition-colors capitalize ${view === v ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {v === 'board' ? 'Board View' : 'List View'}
            </button>
          ))}
        </div>
      </div>

      {view === 'board' ? (
        <KanbanBoard
          cases={filtered}
          caseFiles={caseFiles}
          followUps={followUps}
          workflowTemplates={workflowTemplates}
          onStatusChange={(caseId, newStatus) => updateCase(caseId, { currentStatus: newStatus })}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-stone-50">
                <th className="table-th">Case Title</th>
                <th className="table-th">Customer</th>
                <th className="table-th">Type</th>
                <th className="table-th">Amount</th>
                <th className="table-th">Person in Charge</th>
                <th className="table-th">Status</th>
                <th className="table-th">Readiness</th>
                <th className="table-th">Added</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-gray-400">No cases found.</td></tr>
              ) : filtered.map(c => {
                const cust = customers.find(cu => cu.id === c.customerId)
                const template = getWorkflowTemplate(c.caseType, workflowTemplates, cust?.businessType)
                const readiness = getCaseReadiness(c, template, caseFiles, followUps)
                const missing = getMissingRequiredDocs(c.id, template, caseFiles)
                return (
                  <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                    <td className="table-td">
                      <Link href={`/cases/${c.id}`} className="font-semibold text-gray-900 hover:text-blue-600 line-clamp-1 max-w-[240px] block">
                        {c.caseTitle}
                      </Link>
                    </td>
                    <td className="table-td text-gray-500 whitespace-nowrap">{c.customerName}</td>
                    <td className="table-td text-gray-500 whitespace-nowrap">{c.caseType || '—'}</td>
                    <td className="table-td font-semibold text-gray-800 whitespace-nowrap">{formatCurrency(c.amount)}</td>
                    <td className="table-td text-gray-500 whitespace-nowrap">{c.personInCharge || '—'}</td>
                    <td className="table-td"><StatusBadge status={c.currentStatus} /></td>
                    <td className="table-td whitespace-nowrap">
                      {template ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className={`h-full rounded-full ${readiness >= 70 ? 'bg-green-400' : readiness >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${readiness}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 font-medium">{readiness}%</span>
                          {missing.length > 0 && (
                            <span className="text-xs text-red-500 font-medium">{missing.length} missing</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="table-td text-gray-400 whitespace-nowrap text-xs">{timeAgo(c.createdAt)}</td>
                    <td className="table-td whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Link href={`/cases/${c.id}`} className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700">View</Link>
                        <button onClick={() => { setSelected(c); setModal('edit') }} className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700">Edit</button>
                        {deleteId === c.id ? (
                          <>
                            <button onClick={() => { deleteCase(c.id); setDeleteId(null) }} className="btn-xs bg-red-600 text-white hover:bg-red-700">Confirm</button>
                            <button onClick={() => setDeleteId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
                          </>
                        ) : (
                          <button onClick={() => setDeleteId(c.id)} className="btn-xs bg-red-50 text-red-600 hover:bg-red-100">Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <Modal isOpen={modal === 'add'} onClose={closeModal} title="New Case" maxWidth="lg">
        <CaseForm initial={emptyCase(customers)} customers={customers} pics={pics} onSave={d => { addCase(d); closeModal() }} onCancel={closeModal} />
      </Modal>

      <Modal isOpen={modal === 'edit'} onClose={closeModal} title="Edit Case" maxWidth="lg">
        {selected && (
          <CaseForm
            initial={{ caseTitle: selected.caseTitle, customerId: selected.customerId, customerName: selected.customerName, caseType: selected.caseType, amount: selected.amount, personInCharge: selected.personInCharge, currentStatus: selected.currentStatus, currentWorkflowStepId: selected.currentWorkflowStepId ?? '', result: selected.result, closingRemarks: selected.closingRemarks }}
            customers={customers}
            pics={pics}
            onSave={d => { updateCase(selected.id, d); closeModal() }}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </div>
  )
}
