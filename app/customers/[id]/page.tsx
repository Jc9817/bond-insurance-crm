'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import type { Contact } from '@/lib/types'
import { CONTACT_TYPES, INDUSTRIES } from '@/lib/types'
import { formatDate, formatCurrency, getDaysUntil } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'

type ContactFormData = Omit<Contact, 'id' | 'customerId'>
const emptyContact = (): ContactFormData => ({
  contactName: '', role: '', phone: '', email: '', contactType: 'Owner', isPrimary: false,
})

function ContactForm({ initial, onSave, onCancel }: {
  initial: ContactFormData; onSave: (d: ContactFormData) => void; onCancel: () => void
}) {
  const [form, setForm] = useState<ContactFormData>(initial)
  const [error, setError] = useState('')

  const set = (k: keyof ContactFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const v = k === 'isPrimary' ? (e.target as HTMLInputElement).checked : e.target.value
      setForm(prev => ({ ...prev, [k]: v }))
    }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.contactName.trim()) { setError('Contact name is required.'); return }
    onSave(form)
  }

  return (
    <form onSubmit={submit} className="px-6 py-5 space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
      <div>
        <label className="label">Full Name *</label>
        <input className="input" value={form.contactName} onChange={set('contactName')} placeholder="e.g. Razif Harun" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Job Title / Role</label>
          <input className="input" value={form.role} onChange={set('role')} placeholder="e.g. Managing Director" />
        </div>
        <div>
          <label className="label">Contact Type</label>
          <select className="input" value={form.contactType} onChange={set('contactType')}>
            {CONTACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" type="tel" value={form.phone} onChange={set('phone')} placeholder="012-XXXXXXX" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="name@company.com" />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.isPrimary} onChange={set('isPrimary')} className="w-4 h-4 rounded accent-blue-600" />
        <span className="text-sm text-gray-700">Set as primary contact</span>
      </label>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" className="btn-primary flex-1">Save Contact</button>
      </div>
    </form>
  )
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { customers, contacts, cases, followUps, updateCustomer, addContact, updateContact, deleteContact, setPrimaryContact } = useStore()

  const customer = customers.find(c => c.id === id)
  const [contactModal, setContactModal] = useState<'add' | 'edit' | null>(null)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null)

  if (!customer) {
    return (
      <div className="p-8">
        <p className="text-gray-500 text-lg">Customer not found.</p>
        <Link href="/customers" className="text-blue-600 hover:underline text-sm mt-3 inline-block">← Back to Customers</Link>
      </div>
    )
  }

  const custContacts = contacts.filter(c => c.customerId === id)
  const relatedCases = cases.filter(c => c.customerId === id)
  const relatedFollowUps = followUps.filter(f => f.customerId === id && f.status === 'Open')

  const closeModal = () => { setContactModal(null); setSelectedContact(null) }

  return (
    <div className="p-8 max-w-screen-lg mx-auto">
      {/* Breadcrumb */}
      <div className="mb-5">
        <Link href="/customers" className="text-sm text-gray-400 hover:text-gray-600">← Customers</Link>
      </div>

      {/* Header */}
      <div className="mb-7">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{customer.customerName}</h1>
        <div className="flex items-center gap-3 mt-2">
          {customer.industry && (
            <span className="bg-gray-100 text-gray-600 rounded-full px-3 py-0.5 text-sm font-medium">{customer.industry}</span>
          )}
          {customer.companyRegistrationNo && (
            <span className="text-sm text-gray-400">Reg: {customer.companyRegistrationNo}</span>
          )}
        </div>
      </div>

      {/* Customer info + contacts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Company info */}
        <div className="card-section">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Company Information</h2>
          <div className="space-y-3">
            <InfoRow label="Main Phone" value={customer.mainPhone} />
            <InfoRow label="Main Email" value={customer.mainEmail} isEmail />
            <InfoRow label="Industry" value={customer.industry} />
            <InfoRow label="Registration No." value={customer.companyRegistrationNo} />
            <InfoRow label="Added On" value={formatDate(customer.createdAt.split('T')[0])} />
            {customer.notes && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Notes</p>
                <p className="text-sm text-gray-700">{customer.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Open follow-ups summary */}
        <div className="card-section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Open Follow-Ups</h2>
            <Link href="/followups" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          {relatedFollowUps.length === 0 ? (
            <p className="text-sm text-gray-400">No open follow-ups.</p>
          ) : (
            <div className="space-y-2.5">
              {relatedFollowUps.map(f => {
                const d = getDaysUntil(f.dueDate)
                return (
                  <div key={f.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 line-clamp-1">{f.title}</p>
                      <p className="text-xs text-gray-400">{f.personInCharge}</p>
                    </div>
                    {d !== null && d < 0
                      ? <span className="text-xs text-red-500 font-medium shrink-0">{Math.abs(d)}d overdue</span>
                      : d === 0
                      ? <span className="text-xs text-amber-600 font-medium shrink-0">Today</span>
                      : <span className="text-xs text-gray-400 shrink-0">{formatDate(f.dueDate)}</span>
                    }
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Contacts */}
      <div className="card-section mb-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Contacts <span className="text-gray-300 font-normal">({custContacts.length})</span>
          </h2>
          <button onClick={() => { setSelectedContact(null); setContactModal('add') }} className="btn-xs bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold">
            + Add Contact
          </button>
        </div>

        {custContacts.length === 0 ? (
          <p className="text-sm text-gray-400">No contacts yet. Add someone to get started.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {custContacts.map(c => (
              <div key={c.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-semibold text-sm shrink-0">
                    {c.contactName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{c.contactName}</p>
                      {c.isPrimary && (
                        <span className="text-xs bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 font-medium">Primary</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{c.role} · {c.contactType}</p>
                    <div className="flex gap-3 mt-1">
                      {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                      {c.email && <a href={`mailto:${c.email}`} className="text-xs text-blue-600 hover:underline">{c.email}</a>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!c.isPrimary && (
                    <button onClick={() => setPrimaryContact(id, c.id)} className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-600 hidden sm:inline-flex">
                      Set Primary
                    </button>
                  )}
                  <button onClick={() => { setSelectedContact(c); setContactModal('edit') }} className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700">Edit</button>
                  {deleteContactId === c.id ? (
                    <>
                      <button onClick={() => { deleteContact(c.id); setDeleteContactId(null) }} className="btn-xs bg-red-600 text-white hover:bg-red-700">Confirm</button>
                      <button onClick={() => setDeleteContactId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteContactId(c.id)} className="btn-xs bg-red-50 text-red-500 hover:bg-red-100">Remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Related cases */}
      <div className="card-section">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Cases <span className="text-gray-300 font-normal">({relatedCases.length})</span>
          </h2>
          <Link href="/cases" className="text-xs text-blue-600 hover:underline">View in Cases →</Link>
        </div>
        {relatedCases.length === 0 ? (
          <p className="text-sm text-gray-400">No cases yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {relatedCases.map(c => (
              <div key={c.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link href={`/cases/${c.id}`} className="text-sm font-semibold text-gray-900 hover:text-blue-600 line-clamp-1">
                    {c.caseTitle}
                  </Link>
                  <p className="text-xs text-gray-400 mt-0.5">{c.caseType} · {c.personInCharge}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-sm font-medium text-gray-700">{formatCurrency(c.amount)}</span>
                  <StatusBadge status={c.currentStatus} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal isOpen={contactModal === 'add'} onClose={closeModal} title="Add Contact">
        <ContactForm
          initial={emptyContact()}
          onSave={d => { addContact({ ...d, customerId: id }); closeModal() }}
          onCancel={closeModal}
        />
      </Modal>

      <Modal isOpen={contactModal === 'edit'} onClose={closeModal} title="Edit Contact">
        {selectedContact && (
          <ContactForm
            initial={{ contactName: selectedContact.contactName, role: selectedContact.role, phone: selectedContact.phone, email: selectedContact.email, contactType: selectedContact.contactType, isPrimary: selectedContact.isPrimary }}
            onSave={d => { updateContact(selectedContact.id, d); closeModal() }}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </div>
  )
}

function InfoRow({ label, value, isEmail }: { label: string; value: string; isEmail?: boolean }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      {isEmail
        ? <a href={`mailto:${value}`} className="text-sm text-blue-600 hover:underline">{value}</a>
        : <p className="text-sm font-medium text-gray-800">{value}</p>}
    </div>
  )
}
