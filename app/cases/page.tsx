'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useStore } from '@/lib/store'
import type { Case, CaseStatus, CaseProduct } from '@/lib/types'
import { CASE_STATUSES, CASE_TYPES, WAITING_FOR_OPTIONS, REQUEST_TYPES } from '@/lib/types'
import { formatCurrency, timeAgo, formatDate } from '@/lib/utils'
import { getWorkflowTemplate, getMissingRequiredDocs, getRequiredDocs } from '@/lib/workflow'
import PageHeader from '@/components/ui/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import KanbanBoard from '@/components/ui/KanbanBoard'
import SearchableSelect from '@/components/ui/SearchableSelect'

type FormData = Omit<Case, 'id' | 'createdAt'>
const emptyCase = (customers: { id: string; customerName: string }[]): FormData => ({
  caseTitle: '',
  customerId: customers[0]?.id ?? '',
  customerName: customers[0]?.customerName ?? '',
  bondPrincipal: '',
  caseType: '',
  amount: 0,
  personInCharge: '',
  currentStatus: 'Created',
  currentWorkflowStepId: '',
  result: '',
  closingRemarks: '',
  bondExpiryDate: '',
  waitingFor: null,
  requestType: '',
  selectedProducts: [],
})

function CaseForm({ initial, customers, pics, onSave, onCancel }: {
  initial: FormData
  customers: { id: string; customerName: string; businessType?: string }[]
  pics: { name: string }[]
  onSave: (d: FormData) => void
  onCancel: () => void
}) {
  const { workflowTemplates, settingsData, products, productPackages } = useStore()
  const [form, setForm] = useState<FormData>(initial)
  const [error, setError] = useState('')
  const [selectedPkgId, setSelectedPkgId] = useState('')

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
      } else if (k === 'waitingFor') {
        setForm(prev => ({ ...prev, waitingFor: (e.target.value || null) as FormData['waitingFor'] }))
      } else {
        setForm(prev => ({ ...prev, [k]: e.target.value }))
      }
    }

  const applyPackage = (pkgId: string) => {
    setSelectedPkgId(pkgId)
    const pkg = productPackages.find(p => p.id === pkgId)
    if (!pkg) return
    const prods: CaseProduct[] = pkg.productIds
      .map(id => products.find(p => p.id === id))
      .filter(Boolean)
      .map(p => ({ productId: p!.id, productName: p!.name, category: p!.category }))
    setForm(prev => ({ ...prev, selectedProducts: prods }))
  }

  const toggleProduct = (prod: { id: string; name: string; category: string }) => {
    setForm(prev => {
      const already = prev.selectedProducts?.some(p => p.productId === prod.id)
      const next = already
        ? (prev.selectedProducts ?? []).filter(p => p.productId !== prod.id)
        : [...(prev.selectedProducts ?? []), { productId: prod.id, productName: prod.name, category: prod.category }]
      return { ...prev, selectedProducts: next }
    })
    setSelectedPkgId('') // clear package selection when user manually changes
  }

  const removeProduct = (productId: string) => {
    setForm(prev => ({ ...prev, selectedProducts: (prev.selectedProducts ?? []).filter(p => p.productId !== productId) }))
    setSelectedPkgId('')
  }

  const activeProducts = products.filter(p => p.isActive)
  const bondProducts = activeProducts.filter(p => p.category === 'Bond')
  const insProducts = activeProducts.filter(p => p.category === 'Insurance')
  const otherProducts = activeProducts.filter(p => p.category === 'Other')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.caseTitle.trim()) { setError('Case title is required.'); return }
    if (!form.customerId) { setError('Please select a main contractor.'); return }
    if (!form.requestType) { setError('Please select a request type.'); return }
    onSave(form)
  }

  return (
    <form onSubmit={submit} className="px-6 py-5 space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}

      {/* ── Core fields ── */}
      <div>
        <label className="label">Case Title *</label>
        <input className="input" value={form.caseTitle} onChange={set('caseTitle')} placeholder="e.g. Performance Bond — Project XYZ" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Request Type *</label>
          <select className="input" value={form.requestType ?? ''} onChange={e => setForm(prev => ({ ...prev, requestType: e.target.value }))}>
            <option value="">— Select —</option>
            {REQUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Workflow Type</label>
          <select className="input" value={form.caseType} onChange={set('caseType')}>
            <option value="">— Select —</option>
            {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <p className="text-xs text-gray-400 mt-1">Determines the workflow checklist.</p>
        </div>
      </div>
      <div>
        <label className="label">Main Contractor *</label>
        <SearchableSelect
          required
          value={form.customerId}
          options={customers.map(c => ({ value: c.id, label: c.customerName }))}
          onChange={val => set('customerId')({ target: { value: val } } as React.ChangeEvent<HTMLSelectElement>)}
          placeholder="— Search contractor —"
        />
      </div>
      <div>
        <label className="label">Contractor <span className="text-gray-400 font-normal">(optional)</span></label>
        <SearchableSelect
          value={form.bondPrincipal || ''}
          options={[
            { value: '', label: '— Same as Main Contractor —' },
            ...customers.map(c => ({ value: c.customerName, label: c.customerName })),
          ]}
          onChange={val => setForm(prev => ({ ...prev, bondPrincipal: val }))}
          placeholder="— Same as Main Contractor —"
        />
        <p className="text-xs text-gray-400 mt-1">Select only if a sub-contractor is executing the works under the Main Contractor&apos;s name or licence.</p>
      </div>

      {/* ── Product selection ── */}
      <div>
        <label className="label">Products</label>

        {/* Package quick-select */}
        <div className="mb-3">
          <select
            className="input text-sm"
            value={selectedPkgId}
            onChange={e => applyPackage(e.target.value)}
          >
            <option value="">— Quick-select a package to pre-fill products —</option>
            {productPackages.filter(p => p.isActive).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Selected products chips */}
        {(form.selectedProducts ?? []).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {(form.selectedProducts ?? []).map(sp => {
              const isBond = sp.category === 'Bond'
              return (
                <span key={sp.productId} className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 ${isBond ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {sp.productName}
                  <button type="button" onClick={() => removeProduct(sp.productId)} className="hover:opacity-70 leading-none">✕</button>
                </span>
              )
            })}
          </div>
        )}

        {/* Product checkboxes grouped by category */}
        <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
          {[{ label: 'Bond', items: bondProducts }, { label: 'Insurance', items: insProducts }, { label: 'Other', items: otherProducts }]
            .filter(g => g.items.length > 0)
            .map(({ label, items }) => (
              <div key={label} className="p-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{label}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {items.map(p => {
                    const checked = (form.selectedProducts ?? []).some(sp => sp.productId === p.id)
                    return (
                      <label key={p.id} className="flex items-center gap-2 py-0.5 cursor-pointer hover:text-gray-900">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProduct(p)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                        />
                        <span className={`text-xs ${checked ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{p.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* ── Optional fields ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Person in Charge <span className="text-gray-400 font-normal">(optional)</span></label>
          <select className="input" value={form.personInCharge} onChange={set('personInCharge')}>
            <option value="">— Select —</option>
            {pics.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Target Insurer <span className="text-gray-400 font-normal">(optional)</span></label>
          <select className="input" value={form.finalInsurer ?? ''} onChange={e => setForm(prev => ({ ...prev, finalInsurer: e.target.value || undefined }))}>
            <option value="">— None —</option>
            {settingsData.insurers.filter(i => i.isActive).map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Waiting For <span className="text-gray-400 font-normal">(optional)</span></label>
          <select className="input" value={form.waitingFor || ''} onChange={set('waitingFor')}>
            <option value="">— Not waiting —</option>
            {WAITING_FOR_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
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

const WAITING_COLOR: Record<string, string> = {
  Customer: 'bg-purple-50 text-purple-700',
  Insurer: 'bg-blue-50 text-blue-700',
  Internal: 'bg-amber-50 text-amber-700',
}

export default function CasesPage() {
  const { cases, customers, pics, caseFiles, followUps, workflowTemplates, addCase, updateCase, deleteCase, archiveCase, restoreCase } = useStore()
  const searchParams = useSearchParams()
  const [view, setView] = useState<'list' | 'board'>('list')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [principalFilter, setPrincipalFilter] = useState<string>(() => searchParams.get('principal') ?? 'All')
  const [now] = useState(Date.now)
  const [showArchived, setShowArchived] = useState(false)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [selected, setSelected] = useState<Case | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Case | null>(null)

  const filtered = cases.filter(c => {
    if (showArchived ? !c.archivedAt : c.archivedAt) return false
    const matchStatus = statusFilter === 'All' || c.currentStatus === statusFilter
    const matchPrincipal = principalFilter === 'All' || c.bondPrincipal === principalFilter
    const matchSearch = search === '' || [c.caseTitle, c.customerName, c.bondPrincipal, c.caseType, c.personInCharge].some(f =>
      f?.toLowerCase().includes(search.toLowerCase())
    )
    return matchStatus && matchPrincipal && matchSearch
  })
  const archivedCount = cases.filter(c => !!c.archivedAt).length

  const closeModal = () => { setModal(null); setSelected(null) }

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader
        title="Cases"
        subtitle={principalFilter !== 'All' ? `Showing cases for contractor: ${principalFilter}` : `${cases.length} total cases`}
        action={<button className="btn-primary" onClick={() => setModal('add')}>+ New Case</button>}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cases…" className="input w-64" />
        <select className="input w-52" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="All">All Statuses</option>
          {CASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {principalFilter !== 'All' && (
          <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-medium rounded-xl px-3 py-2">
            <span className="text-xs text-indigo-400 font-normal">Contractor:</span>
            {principalFilter}
            <button
              onClick={() => setPrincipalFilter('All')}
              className="ml-1 text-indigo-400 hover:text-indigo-700 leading-none"
              aria-label="Clear principal filter"
            >
              ✕
            </button>
          </div>
        )}
        <button
          onClick={() => setShowArchived(p => !p)}
          className={`text-sm px-3 py-2 rounded-xl border transition-colors ${showArchived ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
        >
          {showArchived ? '← Active Cases' : `Archived${archivedCount > 0 ? ` (${archivedCount})` : ''}`}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setView('list')} className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${view === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100 border border-gray-200 bg-white'}`}>
            List View
          </button>
          <button onClick={() => setView('board')} className={`px-3 py-2 text-xs font-medium rounded-xl transition-colors ${view === 'board' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-50 border border-gray-200 bg-white'}`}>
            Board
          </button>
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
                <th className="table-th">Waiting For</th>
                <th className="table-th">Documents</th>
                <th className="table-th">Bond Expiry</th>
                <th className="table-th">Last Updated</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={11} className="px-5 py-12 text-center text-gray-400">No cases found.</td></tr>
              ) : filtered.map(c => {
                const cust = customers.find(cu => cu.id === c.customerId)
                const template = getWorkflowTemplate(c.caseType, workflowTemplates, cust?.businessType)
                const required = getRequiredDocs(template)
                const missing = getMissingRequiredDocs(c.id, template, caseFiles)
                const uploaded = required.length - missing.length
                const expiryDays = c.bondExpiryDate ? Math.ceil((new Date(c.bondExpiryDate).getTime() - now) / 86400000) : null
                const expiryUrgent = expiryDays !== null && expiryDays <= 30 && c.currentStatus !== 'Done'
                return (
                  <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                    <td className="table-td">
                      <Link href={`/cases/${c.id}`} className="font-semibold text-gray-900 hover:text-blue-600 line-clamp-1 max-w-[220px] block">
                        {c.caseTitle}
                      </Link>
                    </td>
                    <td className="table-td">
                      <span className="text-gray-500 whitespace-nowrap">{c.customerName}</span>
                      {c.bondPrincipal && c.bondPrincipal !== c.customerName && (
                        <p className="text-xs text-indigo-600 whitespace-nowrap mt-0.5">Contractor: {c.bondPrincipal}</p>
                      )}
                    </td>
                    <td className="table-td text-gray-500 whitespace-nowrap">{c.caseType || '—'}</td>
                    <td className="table-td font-semibold text-gray-800 whitespace-nowrap">{formatCurrency(c.amount)}</td>
                    <td className="table-td text-gray-500 whitespace-nowrap">{c.personInCharge || '—'}</td>
                    <td className="table-td"><StatusBadge status={c.currentStatus} /></td>
                    <td className="table-td whitespace-nowrap">
                      {c.waitingFor ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${WAITING_COLOR[c.waitingFor] ?? 'bg-gray-100 text-gray-600'}`}>
                          {c.waitingFor}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="table-td whitespace-nowrap">
                      {template ? (
                        <span className={`text-xs font-semibold ${missing.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {uploaded}/{required.length} docs
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="table-td whitespace-nowrap">
                      {c.bondExpiryDate ? (
                        <span className={`text-xs font-medium ${expiryUrgent ? 'text-red-600' : 'text-gray-600'}`}>
                          {expiryUrgent && '⚠ '}{formatDate(c.bondExpiryDate)}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="table-td text-gray-400 whitespace-nowrap text-xs">
                      {c.updatedAt ? timeAgo(c.updatedAt) : timeAgo(c.createdAt)}
                    </td>
                    <td className="table-td whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Link href={`/cases/${c.id}`} className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700">View</Link>
                        <button onClick={() => { setSelected(c); setModal('edit') }} className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700">Edit</button>
                        {c.archivedAt
                          ? <button onClick={() => restoreCase(c.id)} className="btn-xs bg-green-50 text-green-700 hover:bg-green-100">Restore</button>
                          : <button onClick={() => setDeleteTarget(c)} className="btn-xs bg-amber-50 text-amber-700 hover:bg-amber-100">Archive</button>
                        }
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

      {/* Add / Edit modals */}
      <Modal isOpen={modal === 'add'} onClose={closeModal} title="New Case" maxWidth="lg">
        <CaseForm initial={emptyCase(customers)} customers={customers} pics={pics} onSave={d => { addCase(d); closeModal() }} onCancel={closeModal} />
      </Modal>

      <Modal isOpen={modal === 'edit'} onClose={closeModal} title="Edit Case" maxWidth="lg">
        {selected && (
          <CaseForm
            initial={{ caseTitle: selected.caseTitle, customerId: selected.customerId, customerName: selected.customerName, bondPrincipal: selected.bondPrincipal ?? '', caseType: selected.caseType, amount: selected.amount, personInCharge: selected.personInCharge, currentStatus: selected.currentStatus, currentWorkflowStepId: selected.currentWorkflowStepId ?? '', result: selected.result, closingRemarks: selected.closingRemarks, bondExpiryDate: selected.bondExpiryDate ?? '', waitingFor: selected.waitingFor ?? null }}
            customers={customers}
            pics={pics}
            onSave={d => { updateCase(selected.id, d); closeModal() }}
            onCancel={closeModal}
          />
        )}
      </Modal>

      {/* Archive confirmation modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Archive Case" maxWidth="sm">
        {deleteTarget && (
          <div className="px-6 py-5">
            <div className="bg-amber-50 rounded-xl p-4 mb-5">
              <p className="text-sm font-semibold text-amber-800 mb-1">Archive this case?</p>
              <p className="text-sm text-amber-700">
                <span className="font-bold">{deleteTarget.caseTitle}</span> will be hidden from active views. You can restore it any time from the Archived filter.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => { archiveCase(deleteTarget.id); setDeleteTarget(null) }}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors"
              >
                Archive Case
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => { deleteCase(deleteTarget.id); setDeleteTarget(null) }}
                className="w-full text-xs text-red-500 hover:text-red-700 transition-colors py-1"
              >
                Delete permanently instead
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
