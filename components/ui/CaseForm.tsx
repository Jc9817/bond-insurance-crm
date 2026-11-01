'use client'

import { useState, type ReactNode } from 'react'
import { useStore } from '@/lib/store'
import type { Case, CaseProduct } from '@/lib/types'
import { CASE_TYPES, WAITING_FOR_OPTIONS, REQUEST_TYPES } from '@/lib/types'
import { getWorkflowTemplate } from '@/lib/workflow'
import Modal from '@/components/ui/Modal'
import SearchableSelect from '@/components/ui/SearchableSelect'
import CustomerForm, { emptyCustomerForm, type CustomerFormData } from '@/components/ui/CustomerForm'

// The new / edit case form, used on the Cases page and the Emails screen.

type FormData = Omit<Case, 'id' | 'createdAt'>
export const emptyCase = (customers: { id: string; customerName: string }[]): FormData => ({
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

export default function CaseForm({ initial, customers, pics, onSave, onCancel, newCustomerDraft, saveLabel = 'Save Case', saving = false, children }: {
  initial: FormData
  customers: { id: string; customerName: string; businessType?: string }[]
  pics: { name: string }[]
  onSave: (d: FormData) => void
  onCancel: () => void
  newCustomerDraft?: CustomerFormData   // pre-fills "+ New Contractor" (e.g. a contractor the AI found)
  saveLabel?: string
  saving?: boolean
  children?: ReactNode                  // extra content shown above the buttons
}) {
  const { workflowTemplates, settingsData, products, productPackages, addCustomer } = useStore()
  const [form, setForm] = useState<FormData>(initial)
  const [error, setError] = useState('')
  const [selectedPkgId, setSelectedPkgId] = useState('')
  const [addingCustomer, setAddingCustomer] = useState(false)

  const saveNewCustomer = (d: Parameters<typeof addCustomer>[0]) => {
    const newId = addCustomer(d)
    setForm(prev => ({ ...prev, customerId: newId, customerName: d.customerName }))
    setAddingCustomer(false)
  }

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
    <>
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
        <div className="flex items-center justify-between">
          <label className="label">Main Contractor *</label>
          <button type="button" onClick={() => setAddingCustomer(true)} className="text-xs font-semibold text-blue-600 hover:underline mb-1.5">
            + New Contractor
          </button>
        </div>
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
      {children}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">{saving ? 'Saving…' : saveLabel}</button>
      </div>
    </form>

    <Modal isOpen={addingCustomer} onClose={() => setAddingCustomer(false)} title="New Contractor">
      <CustomerForm initial={newCustomerDraft ?? emptyCustomerForm} onSave={saveNewCustomer} onCancel={() => setAddingCustomer(false)} />
    </Modal>
    </>
  )
}
