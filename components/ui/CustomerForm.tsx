'use client'

import { useState } from 'react'
import type { Customer } from '@/lib/types'
import { INDUSTRIES, BUSINESS_TYPES } from '@/lib/types'

export type CustomerFormData = Omit<Customer, 'id' | 'createdAt'>

export const emptyCustomerForm: CustomerFormData = {
  customerName: '', companyRegistrationNo: '', businessType: '', industry: '',
  mainPhone: '', mainEmail: '', notes: '',
}

export default function CustomerForm({ initial, onSave, onCancel }: {
  initial: CustomerFormData; onSave: (d: CustomerFormData) => void; onCancel: () => void
}) {
  const [form, setForm] = useState<CustomerFormData>(initial)
  const [error, setError] = useState('')

  const set = (k: keyof CustomerFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customerName.trim()) { setError('Customer name is required.'); return }
    onSave(form)
  }

  return (
    <form onSubmit={submit} className="px-6 py-5 space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
      <div>
        <label className="label">Company / Customer Name *</label>
        <input className="input" value={form.customerName} onChange={set('customerName')} placeholder="e.g. Bina Perkasa Sdn Bhd" />
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
        <div>
          <label className="label">Company Reg. No.</label>
          <input className="input" value={form.companyRegistrationNo} onChange={set('companyRegistrationNo')} placeholder="e.g. 199801012345" />
        </div>
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
