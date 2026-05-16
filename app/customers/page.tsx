'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import type { Customer } from '@/lib/types'
import { INDUSTRIES } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'

type FormData = Omit<Customer, 'id' | 'createdAt'>
const empty: FormData = {
  customerName: '', companyRegistrationNo: '', industry: '',
  mainPhone: '', mainEmail: '', notes: '',
}

function CustomerForm({ initial, onSave, onCancel }: {
  initial: FormData; onSave: (d: FormData) => void; onCancel: () => void
}) {
  const [form, setForm] = useState<FormData>(initial)
  const [error, setError] = useState('')

  const set = (k: keyof FormData) =>
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
          <label className="label">Company Reg. No.</label>
          <input className="input" value={form.companyRegistrationNo} onChange={set('companyRegistrationNo')} placeholder="e.g. 199801012345" />
        </div>
        <div>
          <label className="label">Industry</label>
          <select className="input" value={form.industry} onChange={set('industry')}>
            <option value="">— Select —</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
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

export default function CustomersPage() {
  const { customers, contacts, cases, addCustomer, updateCustomer, deleteCustomer } = useStore()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [selected, setSelected] = useState<Customer | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const filtered = customers.filter(c =>
    [c.customerName, c.companyRegistrationNo, c.industry, c.mainPhone, c.mainEmail].some(f =>
      f?.toLowerCase().includes(search.toLowerCase())
    )
  )

  const getPrimary = (customerId: string) =>
    contacts.find(c => c.customerId === customerId && c.isPrimary) ??
    contacts.find(c => c.customerId === customerId)

  const getCaseCount = (customerId: string) => cases.filter(c => c.customerId === customerId).length

  const closeModal = () => { setModal(null); setSelected(null) }

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} companies on record`}
        action={
          <button className="btn-primary" onClick={() => setModal('add')}>+ Add Customer</button>
        }
      />

      <div className="mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, registration number, industry…"
          className="input max-w-md"
        />
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-stone-50">
              <th className="table-th">Customer Name</th>
              <th className="table-th">Reg. No.</th>
              <th className="table-th">Industry</th>
              <th className="table-th">Primary Contact</th>
              <th className="table-th">Phone</th>
              <th className="table-th">Cases</th>
              <th className="table-th">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                  {search ? 'No customers match your search.' : 'No customers yet. Add your first customer to get started.'}
                </td>
              </tr>
            ) : filtered.map(c => {
              const primary = getPrimary(c.id)
              const caseCount = getCaseCount(c.id)
              return (
                <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                  <td className="table-td">
                    <Link href={`/customers/${c.id}`} className="font-semibold text-gray-900 hover:text-blue-600 whitespace-nowrap">
                      {c.customerName}
                    </Link>
                  </td>
                  <td className="table-td text-gray-500 whitespace-nowrap">{c.companyRegistrationNo || '—'}</td>
                  <td className="table-td">
                    {c.industry
                      ? <span className="bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 text-xs font-medium">{c.industry}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="table-td">
                    {primary ? (
                      <div>
                        <p className="text-sm font-medium text-gray-800">{primary.contactName}</p>
                        <p className="text-xs text-gray-400">{primary.contactType}</p>
                      </div>
                    ) : <span className="text-gray-400 text-sm">—</span>}
                  </td>
                  <td className="table-td text-gray-500 whitespace-nowrap">{c.mainPhone || '—'}</td>
                  <td className="table-td">
                    <span className="text-sm font-semibold text-gray-700">{caseCount}</span>
                    <span className="text-xs text-gray-400 ml-1">case{caseCount !== 1 ? 's' : ''}</span>
                  </td>
                  <td className="table-td whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Link href={`/customers/${c.id}`} className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700">View</Link>
                      <button
                        onClick={() => { setSelected(c); setModal('edit') }}
                        className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
                      >
                        Edit
                      </button>
                      {deleteId === c.id ? (
                        <>
                          <button onClick={() => { deleteCustomer(c.id); setDeleteId(null) }} className="btn-xs bg-red-600 text-white hover:bg-red-700">Confirm</button>
                          <button onClick={() => setDeleteId(null)} className="btn-xs bg-gray-100 text-gray-600 hover:bg-gray-200">Cancel</button>
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

      <Modal isOpen={modal === 'add'} onClose={closeModal} title="Add Customer">
        <CustomerForm initial={empty} onSave={d => { addCustomer(d); closeModal() }} onCancel={closeModal} />
      </Modal>

      <Modal isOpen={modal === 'edit'} onClose={closeModal} title="Edit Customer">
        {selected && (
          <CustomerForm
            initial={{ customerName: selected.customerName, companyRegistrationNo: selected.companyRegistrationNo, industry: selected.industry, mainPhone: selected.mainPhone, mainEmail: selected.mainEmail, notes: selected.notes }}
            onSave={d => { updateCustomer(selected.id, d); closeModal() }}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </div>
  )
}
