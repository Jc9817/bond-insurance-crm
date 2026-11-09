'use client'

import { useState } from 'react'
import type { Customer } from '@/lib/types'
import { INDUSTRIES, BUSINESS_TYPES, CONTACT_TYPES } from '@/lib/types'
import { useStore } from '@/lib/store'
import { findCustomerBySsm, nameKey } from '@/lib/ssm'

export type CustomerFormData = Omit<Customer, 'id' | 'createdAt'>

export const emptyCustomerForm: CustomerFormData = {
  customerName: '', companyRegistrationNo: '', businessType: '', industry: '',
  mainPhone: '', mainEmail: '', notes: '',
}

export const customerFormData = (c: Customer): CustomerFormData => ({
  customerName: c.customerName, companyRegistrationNo: c.companyRegistrationNo, businessType: c.businessType ?? '', industry: c.industry,
  mainPhone: c.mainPhone, mainEmail: c.mainEmail, notes: c.notes,
  isPerson: c.isPerson, companyName: c.companyName ?? '', contactType: c.contactType ?? '',
})

// editingId: the customer being edited, so it isn't flagged as its own duplicate.
// person: a Contractor / Customer, which has a company name and position instead of a registration number.
export default function CustomerForm({ initial, editingId, person = false, onSave, onCancel }: {
  initial: CustomerFormData; editingId?: string; person?: boolean; onSave: (d: CustomerFormData) => void; onCancel: () => void
}) {
  const { customers } = useStore()
  const [form, setForm] = useState<CustomerFormData>(initial)
  const [error, setError] = useState('')

  const set = (k: keyof CustomerFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customerName.trim()) { setError('Customer name is required.'); return }

    // One customer per SSM number (fix list 3.4)
    const sameSsm = findCustomerBySsm(customers, form.companyRegistrationNo, editingId)
    if (sameSsm) {
      setError(`"${sameSsm.customerName}" already has this registration number. Use that customer instead of creating a second one.`)
      return
    }
    // Same name but no shared SSM number — likely the same company; ask
    const key = nameKey(form.customerName)
    const sameName = key ? customers.find(c => c.id !== editingId && nameKey(c.customerName) === key) : undefined
    if (sameName && !confirm(`A customer named "${sameName.customerName}" already exists. Save this as a separate customer anyway?`)) {
      return
    }
    onSave({ ...form, isPerson: person })
  }

  return (
    <form onSubmit={submit} className="px-6 py-5 space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
      <div>
        <label className="label">{person ? 'Contractor / Customer Name *' : 'Company / Customer Name *'}</label>
        <input className="input" value={form.customerName} onChange={set('customerName')} placeholder={person ? 'e.g. Razif Harun' : 'e.g. Bina Perkasa Sdn Bhd'} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Business Type *</label>
          <select className="input" value={form.businessType} onChange={set('businessType')}>
            <option value="">— Select —</option>
            {BUSINESS_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Industry</label>
          <select className="input" value={form.industry} onChange={set('industry')}>
            <option value="">— Select —</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        {person ? (
          <>
            <div>
              <label className="label">Company Name</label>
              <input className="input" value={form.companyName ?? ''} onChange={set('companyName')} placeholder="e.g. Bina Perkasa Sdn Bhd" />
            </div>
            <div>
              <label className="label">Position</label>
              <select className="input" value={form.contactType ?? ''} onChange={set('contactType')}>
                <option value="">— Select —</option>
                {CONTACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </>
        ) : (
          <div>
            <label className="label">Company Reg. No.</label>
            <input className="input" value={form.companyRegistrationNo} onChange={set('companyRegistrationNo')} placeholder="e.g. 199801012345" />
          </div>
        )}
        <div>
          <label className="label">Main Phone</label>
          <input className="input" type="tel" value={form.mainPhone} onChange={set('mainPhone')} placeholder="03-XXXXXXXX" />
        </div>
        <div>
          <label className="label">Main Email</label>
          <input className="input" type="email" value={form.mainEmail} onChange={set('mainEmail')} placeholder="admin@company.com" />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={3} value={form.notes} onChange={set('notes')} placeholder="Any additional notes about this customer…" />
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" className="btn-primary flex-1">Save Customer</button>
      </div>
    </form>
  )
}
