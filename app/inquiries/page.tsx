'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import type { Inquiry } from '@/lib/types'
import { INQUIRY_TYPES } from '@/lib/types'
import { formatCurrency, timeAgo, formatDate, getDaysUntil } from '@/lib/utils'
import PageHeader from '@/components/ui/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BOARD_COLUMNS = ['New', 'Gathering Info', 'Docs Requested', 'Quotation Requested', 'Quotation Received', 'Customer Reviewing', 'Qualified'] as const

function statusColor(s: string) {
  if (s === 'Qualified') return 'bg-emerald-50 border-emerald-200'
  if (s === 'Quotation Received' || s === 'Customer Reviewing') return 'bg-teal-50 border-teal-200'
  if (s === 'Quotation Requested' || s === 'Docs Requested') return 'bg-violet-50 border-violet-200'
  if (s === 'Gathering Info') return 'bg-sky-50 border-sky-200'
  if (s === 'Lost') return 'bg-red-50 border-red-200'
  if (s === 'Closed') return 'bg-slate-50 border-slate-200'
  return 'bg-gray-50 border-gray-200'
}

// ─── Inquiry Form ─────────────────────────────────────────────────────────────

type FormData = {
  inquiryTitle: string
  customerId: string
  customerName: string
  contactId: string
  contactName: string
  inquiryType: string
  roughAmount: number
  status: Inquiry['status']
  assignedPerson: string
  notes: string
}

function InquiryForm({ initial, customers, contacts, pics, statuses, onSave, onCancel }: {
  initial: FormData
  customers: { id: string; customerName: string }[]
  contacts: { id: string; customerId: string; contactName: string; role: string }[]
  pics: { name: string }[]
  statuses: string[]
  onSave: (d: FormData) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<FormData>(initial)
  const [error, setError] = useState('')

  const custContacts = contacts.filter(c => c.customerId === form.customerId)

  const set = (k: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      if (k === 'customerId') {
        const cust = customers.find(x => x.id === e.target.value)
        setForm(prev => ({ ...prev, customerId: e.target.value, customerName: cust?.customerName ?? '', contactId: '', contactName: '' }))
      } else if (k === 'contactId') {
        const con = contacts.find(x => x.id === e.target.value)
        setForm(prev => ({ ...prev, contactId: e.target.value, contactName: con?.contactName ?? '' }))
      } else if (k === 'roughAmount') {
        setForm(prev => ({ ...prev, roughAmount: Number(e.target.value) }))
      } else {
        setForm(prev => ({ ...prev, [k]: e.target.value }))
      }
    }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.inquiryTitle.trim()) { setError('Inquiry title is required.'); return }
    if (!form.customerId) { setError('Please select a customer.'); return }
    onSave(form)
  }

  return (
    <form onSubmit={submit} className="px-6 py-5 space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
      <div>
        <label className="label">Inquiry Title *</label>
        <input className="input" value={form.inquiryTitle} onChange={set('inquiryTitle')} placeholder="e.g. Performance Bond — Project ABC" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Customer *</label>
          <select className="input" value={form.customerId} onChange={set('customerId')}>
            <option value="">— Select Customer —</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.customerName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Contact Person</label>
          <select className="input" value={form.contactId} onChange={set('contactId')} disabled={!form.customerId}>
            <option value="">— Select Contact —</option>
            {custContacts.map(c => <option key={c.id} value={c.id}>{c.contactName} ({c.role})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Inquiry Type</label>
          <select className="input" value={form.inquiryType} onChange={set('inquiryType')}>
            <option value="">— Select Type —</option>
            {INQUIRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Est. Amount (RM)</label>
          <input className="input" type="number" min={0} value={form.roughAmount || ''} onChange={set('roughAmount')} placeholder="0" />
        </div>
        <div>
          <label className="label">Assigned To</label>
          <select className="input" value={form.assignedPerson} onChange={set('assignedPerson')}>
            <option value="">— Select —</option>
            {pics.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={set('status')}>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={3} value={form.notes} onChange={set('notes')} placeholder="Initial notes about this inquiry…" />
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" className="btn-primary flex-1">Save Inquiry</button>
      </div>
    </form>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InquiriesPage() {
  const { inquiries, inquiryQuotations, customers, contacts, pics, settingsData, addInquiry, updateInquiry, deleteInquiry } = useStore()
  const inquiryStatuses = settingsData.inquiryStatuses.filter(s => s.isActive).map(s => s.name)
  const activeStatuses = inquiryStatuses.filter(s => s !== 'Closed' && s !== 'Lost')

  const [view, setView] = useState<'list' | 'board'>('list')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('Active')
  const [typeFilter, setTypeFilter] = useState('')
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [selected, setSelected] = useState<Inquiry | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const emptyForm = (): FormData => ({
    inquiryTitle: '', customerId: '', customerName: '', contactId: '', contactName: '',
    inquiryType: '', roughAmount: 0, status: 'New', assignedPerson: pics[0]?.name ?? '', notes: '',
  })

  const filtered = inquiries.filter(i => {
    const matchStatus = statusFilter === 'Active'
      ? activeStatuses.includes(i.status)
      : statusFilter === 'All' || i.status === statusFilter
    const matchType = !typeFilter || i.inquiryType === typeFilter
    const matchSearch = !search || [i.inquiryTitle, i.customerName, i.assignedPerson, i.inquiryType].some(f =>
      f?.toLowerCase().includes(search.toLowerCase())
    )
    return matchStatus && matchType && matchSearch
  })

  const closeModal = () => { setModal(null); setSelected(null) }

  const getQuotations = (id: string) => inquiryQuotations.filter(q => q.inquiryId === id)
  const getQuotedCount = (id: string) => getQuotations(id).filter(q => q.status === 'Quoted').length
  const getPendingCount = (id: string) => getQuotations(id).filter(q => q.status === 'Pending').length

  // KPI metrics
  const active = inquiries.filter(i => activeStatuses.includes(i.status))
  const pendingQuotations = inquiries.filter(i => i.status === 'Quotation Requested')
  const quotationsReceived = inquiries.filter(i => i.status === 'Quotation Received' || i.status === 'Customer Reviewing')
  const readyToConvert = inquiries.filter(i => i.status === 'Qualified' && !i.convertedToCase)
  const converted = inquiries.filter(i => i.convertedToCase)

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader
        title="Inquiries"
        subtitle={`${active.length} active inquiries`}
        action={<button className="btn-primary" onClick={() => setModal('add')}>+ New Inquiry</button>}
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Active', value: active.length, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Awaiting Quote', value: pendingQuotations.length, color: 'text-violet-700', bg: 'bg-violet-50' },
          { label: 'Quotes Received', value: quotationsReceived.length, color: 'text-teal-700', bg: 'bg-teal-50' },
          { label: 'Ready to Convert', value: readyToConvert.length, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Converted', value: converted.length, color: 'text-gray-600', bg: 'bg-gray-100' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-2xl px-4 py-3`}>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search inquiries…" className="input w-64"
        />
        <select className="input w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="Active">Active</option>
          <option value="All">All Statuses</option>
          {inquiryStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input w-44" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {INQUIRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="ml-auto flex rounded-xl border border-gray-200 overflow-hidden bg-white">
          {(['list', 'board'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-4 py-2 text-sm font-medium transition-colors capitalize ${view === v ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {v === 'board' ? 'Board View' : 'List View'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Board View ── */}
      {view === 'board' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {BOARD_COLUMNS.map(col => {
              const cards = inquiries.filter(i => i.status === col && !i.convertedToCase)
              return (
                <div key={col} className="w-64 shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{col}</p>
                    <span className="text-xs font-bold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{cards.length}</span>
                  </div>
                  <div className="space-y-2.5 min-h-[120px]">
                    {cards.map(i => {
                      const qtns = getQuotations(i.id)
                      const quoted = qtns.filter(q => q.status === 'Quoted').length
                      return (
                        <Link
                          key={i.id}
                          href={`/inquiries/${i.id}`}
                          className={`block rounded-2xl border p-4 hover:shadow-sm transition-shadow cursor-pointer ${statusColor(i.status)}`}
                        >
                          <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">{i.inquiryTitle}</p>
                          <p className="text-xs text-gray-500 mt-1.5">{i.customerName}</p>
                          <p className="text-xs text-gray-400">{i.assignedPerson}</p>
                          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                            {i.roughAmount > 0 && (
                              <span className="text-xs font-semibold text-gray-700">{formatCurrency(i.roughAmount)}</span>
                            )}
                            {qtns.length > 0 && (
                              <span className="text-xs bg-white bg-opacity-70 text-gray-600 rounded-full px-2 py-0.5">
                                {quoted}/{qtns.length} quoted
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-2">{timeAgo(i.updatedAt ?? i.createdAt)}</p>
                        </Link>
                      )
                    })}
                    {cards.length === 0 && (
                      <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center">
                        <p className="text-xs text-gray-300">No inquiries</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── List View ── */}
      {view === 'list' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-stone-50">
                <th className="table-th">Inquiry</th>
                <th className="table-th">Customer</th>
                <th className="table-th">Type</th>
                <th className="table-th">Est. Amount</th>
                <th className="table-th">Status</th>
                <th className="table-th">Quotations</th>
                <th className="table-th">Assigned</th>
                <th className="table-th">Updated</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-gray-400">
                    {search || statusFilter !== 'All' ? 'No inquiries match your filters.' : 'No inquiries yet. Add your first inquiry to get started.'}
                  </td>
                </tr>
              ) : filtered.map(i => {
                const qtns = getQuotations(i.id)
                const quoted = getQuotedCount(i.id)
                const pending = getPendingCount(i.id)
                return (
                  <tr key={i.id} className="hover:bg-stone-50 transition-colors">
                    <td className="table-td max-w-[260px]">
                      <Link href={`/inquiries/${i.id}`} className="font-semibold text-gray-900 hover:text-blue-600 line-clamp-1 block">
                        {i.inquiryTitle}
                      </Link>
                      {i.convertedToCase && (
                        <span className="text-xs text-emerald-600 font-medium">Converted to case</span>
                      )}
                    </td>
                    <td className="table-td">
                      <p className="text-sm text-gray-700 whitespace-nowrap">{i.customerName}</p>
                      {i.contactName && <p className="text-xs text-gray-400">{i.contactName}</p>}
                    </td>
                    <td className="table-td text-gray-500 whitespace-nowrap text-sm">{i.inquiryType || '—'}</td>
                    <td className="table-td font-semibold text-gray-800 whitespace-nowrap">
                      {i.roughAmount > 0 ? formatCurrency(i.roughAmount) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="table-td"><StatusBadge status={i.status} /></td>
                    <td className="table-td whitespace-nowrap">
                      {qtns.length === 0 ? (
                        <span className="text-xs text-gray-300">—</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {quoted > 0 && <span className="text-xs bg-teal-50 text-teal-700 rounded-full px-2 py-0.5 font-medium">{quoted} quoted</span>}
                          {pending > 0 && <span className="text-xs bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">{pending} pending</span>}
                        </div>
                      )}
                    </td>
                    <td className="table-td text-gray-500 whitespace-nowrap text-sm">{i.assignedPerson || '—'}</td>
                    <td className="table-td text-gray-400 whitespace-nowrap text-xs">{timeAgo(i.updatedAt ?? i.createdAt)}</td>
                    <td className="table-td whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Link href={`/inquiries/${i.id}`} className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700">View</Link>
                        <button onClick={() => { setSelected(i); setModal('edit') }} className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700">Edit</button>
                        {deleteId === i.id ? (
                          <>
                            <button onClick={() => { deleteInquiry(i.id); setDeleteId(null) }} className="btn-xs bg-red-600 text-white hover:bg-red-700">Confirm</button>
                            <button onClick={() => setDeleteId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
                          </>
                        ) : (
                          <button onClick={() => setDeleteId(i.id)} className="btn-xs bg-red-50 text-red-600 hover:bg-red-100">Delete</button>
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

      {/* Add Modal */}
      <Modal isOpen={modal === 'add'} onClose={closeModal} title="New Inquiry" maxWidth="lg">
        <InquiryForm
          initial={emptyForm()}
          customers={customers}
          contacts={contacts}
          pics={pics}
          statuses={inquiryStatuses}
          onSave={d => { addInquiry(d); closeModal() }}
          onCancel={closeModal}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={modal === 'edit'} onClose={closeModal} title="Edit Inquiry" maxWidth="lg">
        {selected && (
          <InquiryForm
            initial={{
              inquiryTitle: selected.inquiryTitle,
              customerId: selected.customerId,
              customerName: selected.customerName,
              contactId: selected.contactId ?? '',
              contactName: selected.contactName ?? '',
              inquiryType: selected.inquiryType,
              roughAmount: selected.roughAmount,
              status: selected.status,
              assignedPerson: selected.assignedPerson,
              notes: selected.notes,
            }}
            customers={customers}
            contacts={contacts}
            pics={pics}
            statuses={inquiryStatuses}
            onSave={d => { updateInquiry(selected.id, d); closeModal() }}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </div>
  )
}
