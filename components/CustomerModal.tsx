'use client'

import { useState, useEffect } from 'react'
import { Customer } from '@/lib/supabase'

type FormData = Omit<Customer, 'id' | 'created_at'>

const emptyForm: FormData = {
  name: '',
  phone: '',
  email: '',
  policy_type: '',
  policy_start_date: '',
  policy_due_date: '',
  notes: '',
}

type Props = {
  customer: Customer | null
  onClose: () => void
  onSave: (data: FormData) => Promise<void>
}

export default function CustomerModal({ customer, onClose, onSave }: Props) {
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (customer) {
      const { id, created_at, ...rest } = customer
      setForm(rest)
    } else {
      setForm(emptyForm)
    }
  }, [customer])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(form)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            {customer ? 'Edit Customer' : 'Add Customer'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input name="name" value={form.name} onChange={handleChange} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} type="tel"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input name="email" value={form.email} onChange={handleChange} type="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Policy Type</label>
              <select name="policy_type" value={form.policy_type} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Select —</option>
                <option value="Life Insurance">Life Insurance</option>
                <option value="Medical Insurance">Medical Insurance</option>
                <option value="Motor Insurance">Motor Insurance</option>
                <option value="Fire Insurance">Fire Insurance</option>
                <option value="Travel Insurance">Travel Insurance</option>
                <option value="Personal Accident">Personal Accident</option>
                <option value="Bond Insurance">Bond Insurance</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Policy Start Date</label>
              <input name="policy_start_date" value={form.policy_start_date} onChange={handleChange} type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Policy Due Date</label>
              <input name="policy_due_date" value={form.policy_due_date} onChange={handleChange} type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
