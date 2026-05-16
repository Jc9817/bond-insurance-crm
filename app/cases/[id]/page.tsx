'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { CASE_STATUSES } from '@/lib/types'
import type { CaseStatus } from '@/lib/types'
import { formatDate, formatCurrency, timeAgo, getDaysUntil } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { cases, customers, contacts, caseNotes, followUps, pics, updateCase, addCaseNote, addFollowUp, toggleFollowUp, deleteFollowUp } = useStore()

  const caseItem = cases.find(c => c.id === id)
  const [noteText, setNoteText] = useState('')
  const [notePic, setNotePic] = useState(pics[0]?.name ?? '')
  const [statusModal, setStatusModal] = useState(false)
  const [newStatus, setNewStatus] = useState<CaseStatus>(caseItem?.currentStatus ?? 'New')
  const [followUpModal, setFollowUpModal] = useState(false)
  const [fuForm, setFuForm] = useState({ title: '', personInCharge: pics[0]?.name ?? '', dueDate: '' })

  if (!caseItem) {
    return (
      <div className="p-8">
        <p className="text-gray-500 text-lg">Case not found.</p>
        <Link href="/cases" className="text-blue-600 hover:underline text-sm mt-3 inline-block">← Back to Cases</Link>
      </div>
    )
  }

  const customer = customers.find(c => c.id === caseItem.customerId)
  const custContacts = contacts.filter(c => c.customerId === caseItem.customerId)
  const notes = caseNotes
    .filter(n => n.caseId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const caseFollowUps = followUps.filter(f => f.caseId === id)
  const openCount = caseFollowUps.filter(f => f.status === 'Open').length
  const currentIdx = CASE_STATUSES.indexOf(caseItem.currentStatus)

  const submitNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteText.trim()) return
    addCaseNote({ caseId: id, content: noteText.trim(), createdBy: notePic })
    setNoteText('')
  }

  const submitFollowUp = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fuForm.title.trim()) return
    addFollowUp({
      title: fuForm.title,
      customerId: caseItem.customerId,
      customerName: caseItem.customerName,
      caseId: id,
      caseTitle: caseItem.caseTitle,
      personInCharge: fuForm.personInCharge,
      dueDate: fuForm.dueDate,
      status: 'Open',
    })
    setFuForm({ title: '', personInCharge: pics[0]?.name ?? '', dueDate: '' })
    setFollowUpModal(false)
  }

  return (
    <div className="p-8 max-w-screen-lg mx-auto">
      {/* Breadcrumb */}
      <div className="mb-5">
        <Link href="/cases" className="text-sm text-gray-400 hover:text-gray-600">← Cases</Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">{caseItem.caseTitle}</h1>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={caseItem.currentStatus} size="md" />
            {caseItem.result && <StatusBadge status={caseItem.result} size="md" />}
            <span className="text-sm text-gray-400">{caseItem.caseType}</span>
          </div>
        </div>
        <button onClick={() => { setNewStatus(caseItem.currentStatus); setStatusModal(true) }} className="btn-primary shrink-0">
          Update Status
        </button>
      </div>

      {/* Progress stepper */}
      <div className="card-section mb-6 overflow-x-auto">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Progress</h2>
        <p className="text-xs text-gray-400 mb-5">Click a step to jump to that status.</p>
        <div className="flex items-start gap-0 min-w-max">
          {CASE_STATUSES.map((status, idx) => {
            const done = idx < currentIdx
            const active = idx === currentIdx
            return (
              <div key={status} className="flex items-center">
                <button
                  type="button"
                  onClick={() => updateCase(id, { currentStatus: status })}
                  className="flex flex-col items-center group focus:outline-none"
                  title={`Set to ${status}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    active ? 'bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-1'
                    : done ? 'bg-green-500 text-white group-hover:bg-green-600'
                    : 'bg-gray-100 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600'
                  }`}>
                    {done ? '✓' : idx + 1}
                  </div>
                  <span className={`text-xs mt-1.5 text-center max-w-[80px] leading-tight transition-colors ${
                    active ? 'text-blue-600 font-semibold'
                    : done ? 'text-green-600 group-hover:text-green-700'
                    : 'text-gray-400 group-hover:text-blue-600'
                  }`}>
                    {status}
                  </span>
                </button>
                {idx < CASE_STATUSES.length - 1 && (
                  <div className={`h-0.5 w-10 mb-6 mx-1.5 ${done ? 'bg-green-300' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Case details */}
        <div className="lg:col-span-2 card-section">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Case Information</h2>
          <div className="grid grid-cols-2 gap-5">
            <DetailRow label="Customer">
              {customer
                ? <Link href={`/customers/${customer.id}`} className="text-sm font-semibold text-blue-600 hover:underline">{customer.customerName}</Link>
                : <span className="text-sm font-semibold text-gray-800">{caseItem.customerName}</span>}
            </DetailRow>
            <DetailRow label="Case Type">
              <span className="text-sm font-semibold text-gray-800">{caseItem.caseType || '—'}</span>
            </DetailRow>
            <DetailRow label="Amount">
              <span className="text-lg font-bold text-gray-900">{formatCurrency(caseItem.amount)}</span>
            </DetailRow>
            <DetailRow label="Person in Charge">
              <span className="text-sm font-semibold text-gray-800">{caseItem.personInCharge || '—'}</span>
            </DetailRow>
            {caseItem.result && (
              <DetailRow label="Result">
                <StatusBadge status={caseItem.result} size="md" />
              </DetailRow>
            )}
            {caseItem.closingRemarks && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400 mb-1">Closing Remarks</p>
                <p className="text-sm text-gray-700">{caseItem.closingRemarks}</p>
              </div>
            )}
          </div>

          {/* Related contacts */}
          {custContacts.length > 0 && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Customer Contacts</p>
              <div className="flex flex-wrap gap-2">
                {custContacts.map(c => (
                  <div key={c.id} className="bg-gray-50 rounded-xl px-3 py-2">
                    <p className="text-sm font-medium text-gray-800">{c.contactName}</p>
                    <p className="text-xs text-gray-400">{c.contactType} · {c.phone || c.email}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Follow-ups sidebar */}
        <div className="card-section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Follow-Ups <span className="text-gray-300">({openCount} open)</span>
            </h2>
            <button onClick={() => setFollowUpModal(true)} className="text-xs text-blue-600 hover:underline font-medium">+ Add</button>
          </div>
          {caseFollowUps.length === 0 ? (
            <p className="text-xs text-gray-400">No follow-ups yet.</p>
          ) : (
            <div className="space-y-3">
              {caseFollowUps.map(f => {
                const d = getDaysUntil(f.dueDate)
                const isOD = d !== null && d < 0 && f.status === 'Open'
                return (
                  <div key={f.id} className="flex items-start gap-2.5">
                    <button
                      onClick={() => toggleFollowUp(f.id)}
                      className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                        f.status === 'Done' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {f.status === 'Done' && <span className="text-xs leading-none">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium leading-snug ${f.status === 'Done' ? 'line-through text-gray-400' : isOD ? 'text-red-700' : 'text-gray-800'}`}>
                        {f.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {f.personInCharge} · {f.dueDate ? formatDate(f.dueDate) : '—'}
                        {isOD && <span className="ml-1 text-red-500 font-medium">overdue</span>}
                      </p>
                    </div>
                    <button onClick={() => deleteFollowUp(f.id)} className="text-gray-200 hover:text-red-400 text-base shrink-0 transition-colors">✕</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Files placeholder */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Files</p>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400">File upload coming soon.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="card-section">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Notes</h2>
        <form onSubmit={submitNote} className="mb-6 space-y-3">
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Write a note…"
            rows={3}
            className="input text-gray-900"
          />
          <div className="flex gap-3 items-center">
            <select
              value={notePic}
              onChange={e => setNotePic(e.target.value)}
              className="input w-44 shrink-0"
            >
              {pics.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            <button type="submit" className="btn-primary">Add Note</button>
          </div>
        </form>

        {notes.length === 0 ? (
          <p className="text-sm text-gray-400">No notes yet. Add the first note above.</p>
        ) : (
          <div className="space-y-3">
            {notes.map(n => (
              <div key={n.id} className="bg-stone-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">{n.createdBy}</span>
                  <span className="text-xs text-gray-400">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{n.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Update status modal */}
      <Modal isOpen={statusModal} onClose={() => setStatusModal(false)} title="Update Status" maxWidth="sm">
        <div className="px-6 py-5 space-y-2.5">
          {CASE_STATUSES.map(s => (
            <label
              key={s}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${
                newStatus === s ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'
              }`}
            >
              <input type="radio" name="status" value={s} checked={newStatus === s} onChange={() => setNewStatus(s)} className="accent-blue-600" />
              <span className="text-sm font-medium text-gray-700">{s}</span>
            </label>
          ))}
          <div className="flex gap-3 pt-3">
            <button onClick={() => setStatusModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => { updateCase(id, { currentStatus: newStatus }); setStatusModal(false) }}
              className="btn-primary flex-1"
            >
              Update
            </button>
          </div>
        </div>
      </Modal>

      {/* Add follow-up modal */}
      <Modal isOpen={followUpModal} onClose={() => setFollowUpModal(false)} title="Add Follow-Up" maxWidth="sm">
        <form onSubmit={submitFollowUp} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">What needs to be done? *</label>
            <input className="input" value={fuForm.title} onChange={e => setFuForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Call client to confirm decision" />
          </div>
          <div>
            <label className="label">Person in Charge</label>
            <select className="input" value={fuForm.personInCharge} onChange={e => setFuForm(p => ({ ...p, personInCharge: e.target.value }))}>
              {pics.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Due Date</label>
            <input type="date" className="input" value={fuForm.dueDate} onChange={e => setFuForm(p => ({ ...p, dueDate: e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setFollowUpModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Add Follow-Up</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      {children}
    </div>
  )
}
