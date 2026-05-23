'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import type { InquiryQuotation, InquiryDocument } from '@/lib/types'
import { INQUIRY_STATUSES, INQUIRY_TYPES, QUOTATION_STATUSES } from '@/lib/types'
import { formatCurrency, formatDate, timeAgo } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">{children}</h2>
}

function QuotationStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Pending: 'bg-amber-400',
    Quoted: 'bg-teal-400',
    'Under Review': 'bg-blue-400',
    Rejected: 'bg-red-400',
    'No Response': 'bg-gray-300',
  }
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] ?? 'bg-gray-300'} shrink-0 mt-1.5`} />
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Quotation Form ───────────────────────────────────────────────────────────

type QuotationFormData = {
  providerName: string
  quotationAmount: number
  requestedDate: string
  receivedDate: string
  status: InquiryQuotation['status']
  notes: string
}

function emptyQuotationForm(): QuotationFormData {
  return {
    providerName: '', quotationAmount: 0,
    requestedDate: new Date().toISOString().split('T')[0],
    receivedDate: '', status: 'Pending', notes: '',
  }
}

function QuotationForm({ initial, onSave, onCancel }: {
  initial: QuotationFormData
  onSave: (d: QuotationFormData) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<QuotationFormData>(initial)
  const [error, setError] = useState('')

  const set = (k: keyof QuotationFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      if (k === 'quotationAmount') setForm(p => ({ ...p, quotationAmount: Number(e.target.value) }))
      else setForm(p => ({ ...p, [k]: e.target.value }))
    }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.providerName.trim()) { setError('Provider name is required.'); return }
    onSave(form)
  }

  return (
    <form onSubmit={submit} className="px-6 py-5 space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
      <div>
        <label className="label">Insurer / Provider *</label>
        <input className="input" value={form.providerName} onChange={set('providerName')} placeholder="e.g. Allianz Malaysia" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Requested Date</label>
          <input className="input" type="date" value={form.requestedDate} onChange={set('requestedDate')} />
        </div>
        <div>
          <label className="label">Received Date</label>
          <input className="input" type="date" value={form.receivedDate} onChange={set('receivedDate')} />
        </div>
        <div>
          <label className="label">Quotation Amount (RM)</label>
          <input className="input" type="number" min={0} step="0.01" value={form.quotationAmount || ''} onChange={set('quotationAmount')} placeholder="0.00" />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={set('status')}>
            {QUOTATION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={form.notes} onChange={set('notes')} placeholder="Rate, conditions, or any remarks…" />
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" className="btn-primary flex-1">Save Quotation</button>
      </div>
    </form>
  )
}

// ─── Convert to Case Modal ────────────────────────────────────────────────────

function ConvertModal({ inquiry, pics, onConvert, onCancel }: {
  inquiry: { id: string; inquiryTitle: string; customerId: string; customerName: string; assignedPerson: string; roughAmount: number; inquiryType: string }
  pics: { name: string }[]
  onConvert: (title: string, personInCharge: string, amount: number, caseType: string) => void
  onCancel: () => void
}) {
  const [caseTitle, setCaseTitle] = useState(inquiry.inquiryTitle)
  const [caseType, setCaseType] = useState(inquiry.inquiryType)
  const [personInCharge, setPersonInCharge] = useState(inquiry.assignedPerson)
  const [amount, setAmount] = useState(inquiry.roughAmount)

  return (
    <div className="px-6 py-5 space-y-4">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
        <p className="text-xs text-blue-700">
          Converting this inquiry will create a new Case for operational execution. The inquiry will remain as a historical record.
        </p>
      </div>
      <div>
        <label className="label">Case Title</label>
        <input className="input" value={caseTitle} onChange={e => setCaseTitle(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Case Type</label>
          <select className="input" value={caseType} onChange={e => setCaseType(e.target.value)}>
            <option value="">— Select —</option>
            {INQUIRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Amount (RM)</label>
          <input className="input" type="number" min={0} value={amount || ''} onChange={e => setAmount(Number(e.target.value))} />
        </div>
        <div className="col-span-2">
          <label className="label">Person in Charge</label>
          <select className="input" value={personInCharge} onChange={e => setPersonInCharge(e.target.value)}>
            <option value="">— Select —</option>
            {pics.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button
          onClick={() => onConvert(caseTitle, personInCharge, amount, caseType)}
          disabled={!caseTitle.trim()}
          className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Convert to Case →
        </button>
      </div>
    </div>
  )
}

// ─── Main Detail Page ─────────────────────────────────────────────────────────

export default function InquiryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { currentUser } = useAuth()
  const {
    inquiries, inquiryQuotations, inquiryNotes, inquiryDocuments, activityLogs,
    customers, contacts, pics,
    updateInquiry, deleteInquiry,
    addInquiryQuotation, updateInquiryQuotation, deleteInquiryQuotation,
    addInquiryNote, addInquiryDocument, deleteInquiryDocument,
    convertInquiryToCase, cases,
  } = useStore()

  const [activeTab, setActiveTab] = useState<'quotations' | 'documents' | 'activity' | 'notes'>('quotations')
  const [quotationModal, setQuotationModal] = useState<'add' | 'edit' | null>(null)
  const [selectedQuotation, setSelectedQuotation] = useState<InquiryQuotation | null>(null)
  const [deleteQuotationId, setDeleteQuotationId] = useState<string | null>(null)
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null)
  const [convertModal, setConvertModal] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [editingStatus, setEditingStatus] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const inquiry = inquiries.find(i => i.id === id)

  if (!inquiry) {
    return (
      <div className="p-8">
        <p className="text-gray-500 text-lg">Inquiry not found.</p>
        <Link href="/inquiries" className="text-blue-600 hover:underline text-sm mt-3 inline-block">← Back to Inquiries</Link>
      </div>
    )
  }

  const quotations = inquiryQuotations.filter(q => q.inquiryId === id)
  const notes = inquiryNotes.filter(n => n.inquiryId === id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const documents = inquiryDocuments.filter(d => d.inquiryId === id)
  const inqLogs = activityLogs.filter(l => l.inquiryId === id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const convertedCase = inquiry.convertedCaseId ? cases.find(c => c.id === inquiry.convertedCaseId) : null

  const quotedCount = quotations.filter(q => q.status === 'Quoted').length
  const pendingCount = quotations.filter(q => q.status === 'Pending').length

  const handleStatusChange = (newStatus: string) => {
    const prev = inquiry.status
    updateInquiry(id, { status: newStatus as typeof inquiry.status })
    setEditingStatus(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        addInquiryDocument({
          inquiryId: id,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          documentType: 'Supporting Document',
          uploadedBy: currentUser?.fullName ?? 'User',
          fileDataUrl: reader.result as string,
        })
      }
      reader.readAsDataURL(file)
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleConvert = (title: string, personInCharge: string, amount: number, caseType: string) => {
    const caseId = convertInquiryToCase(id, {
      caseTitle: title,
      customerId: inquiry.customerId,
      customerName: inquiry.customerName,
      caseType,
      amount,
      personInCharge,
      currentStatus: 'New',
      currentWorkflowStepId: '',
      result: '',
      closingRemarks: '',
    })
    setConvertModal(false)
    router.push(`/cases/${caseId}`)
  }

  const submitNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteText.trim()) return
    addInquiryNote({
      inquiryId: id,
      content: noteText.trim(),
      createdBy: currentUser?.fullName ?? 'User',
    })
    setNoteText('')
  }

  const TABS = [
    { key: 'quotations' as const, label: `Quotations${quotations.length > 0 ? ` (${quotations.length})` : ''}` },
    { key: 'documents' as const, label: `Documents${documents.length > 0 ? ` (${documents.length})` : ''}` },
    { key: 'notes' as const, label: `Notes${notes.length > 0 ? ` (${notes.length})` : ''}` },
    { key: 'activity' as const, label: 'Activity' },
  ]

  return (
    <div className="p-8 max-w-screen-lg mx-auto">
      {/* Breadcrumb */}
      <div className="mb-5">
        <Link href="/inquiries" className="text-sm text-gray-400 hover:text-gray-600">← Inquiries</Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-snug">{inquiry.inquiryTitle}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* Status — clickable to change */}
              <div className="relative">
                {editingStatus ? (
                  <select
                    className="input py-1 text-xs font-medium"
                    value={inquiry.status}
                    onChange={e => handleStatusChange(e.target.value)}
                    onBlur={() => setEditingStatus(false)}
                    autoFocus
                  >
                    {INQUIRY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <button onClick={() => setEditingStatus(true)} className="group flex items-center gap-1">
                    <StatusBadge status={inquiry.status} />
                    <svg className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>
              <span className="text-sm text-gray-500">{inquiry.customerName}</span>
              {inquiry.contactName && <span className="text-sm text-gray-400">· {inquiry.contactName}</span>}
              {inquiry.inquiryType && <span className="text-sm text-gray-400">· {inquiry.inquiryType}</span>}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {!inquiry.convertedToCase ? (
              <button
                onClick={() => setConvertModal(true)}
                className="btn-primary flex items-center gap-1.5 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                Convert to Case
              </button>
            ) : (
              convertedCase && (
                <Link href={`/cases/${convertedCase.id}`} className="btn-primary text-sm flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  View Case →
                </Link>
              )
            )}
          </div>
        </div>

        {/* Converted notice */}
        {inquiry.convertedToCase && (
          <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5">
            <p className="text-sm text-emerald-700 font-medium">
              This inquiry has been converted to a case.
              {convertedCase && <> Case: <Link href={`/cases/${convertedCase.id}`} className="underline">{convertedCase.caseTitle}</Link></>}
            </p>
          </div>
        )}
      </div>

      {/* Info strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Est. Amount', value: inquiry.roughAmount > 0 ? formatCurrency(inquiry.roughAmount) : '—' },
          { label: 'Assigned To', value: inquiry.assignedPerson || '—' },
          { label: 'Created', value: formatDate(inquiry.createdAt.split('T')[0]) },
          { label: 'Last Updated', value: timeAgo(inquiry.updatedAt ?? inquiry.createdAt) },
        ].map(item => (
          <div key={item.label} className="bg-stone-50 rounded-2xl px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
            <p className="text-sm font-semibold text-gray-800">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Quotation summary bar (when there are quotations) */}
      {quotations.length > 0 && (
        <div className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl px-5 py-3 mb-5 flex-wrap">
          <span className="text-sm font-semibold text-gray-700">{quotations.length} insurer{quotations.length !== 1 ? 's' : ''} approached</span>
          {quotedCount > 0 && <span className="text-sm text-teal-700 font-medium">{quotedCount} quoted</span>}
          {pendingCount > 0 && <span className="text-sm text-amber-600">{pendingCount} pending</span>}
          {quotedCount > 0 && (
            <span className="text-sm font-medium text-gray-700 ml-auto">
              Best: {formatCurrency(Math.min(...quotations.filter(q => q.status === 'Quoted' && q.quotationAmount > 0).map(q => q.quotationAmount)))}
            </span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Quotations Tab ── */}
      {activeTab === 'quotations' && (
        <div className="card-section">
          <div className="flex items-center justify-between mb-5">
            <SectionTitle>Quotation Coordination</SectionTitle>
            <button
              onClick={() => { setSelectedQuotation(null); setQuotationModal('add') }}
              className="btn-xs bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold"
            >
              + Add Quotation
            </button>
          </div>

          {quotations.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">No quotations yet.</p>
              <p className="text-xs text-gray-300 mt-0.5">Add an insurer to start tracking quotations.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {quotations.map(q => (
                <div key={q.id} className={`bg-white rounded-2xl border p-4 flex items-start gap-4 ${
                  q.status === 'Quoted' ? 'border-teal-100' :
                  q.status === 'Rejected' ? 'border-red-100 opacity-60' :
                  q.status === 'No Response' ? 'border-gray-100 opacity-70' :
                  'border-gray-200'
                }`}>
                  <QuotationStatusDot status={q.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{q.providerName}</p>
                      <StatusBadge status={q.status} />
                      {q.quotationAmount > 0 && (
                        <span className="text-sm font-bold text-teal-700">{formatCurrency(q.quotationAmount)}</span>
                      )}
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-gray-400 flex-wrap">
                      <span>Requested: {formatDate(q.requestedDate)}</span>
                      {q.receivedDate && <span>Received: {formatDate(q.receivedDate)}</span>}
                    </div>
                    {q.notes && <p className="text-xs text-gray-500 mt-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">{q.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => { setSelectedQuotation(q); setQuotationModal('edit') }}
                      className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
                    >
                      Edit
                    </button>
                    {deleteQuotationId === q.id ? (
                      <>
                        <button onClick={() => { deleteInquiryQuotation(q.id); setDeleteQuotationId(null) }} className="btn-xs bg-red-600 text-white hover:bg-red-700">Confirm</button>
                        <button onClick={() => setDeleteQuotationId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => setDeleteQuotationId(q.id)} className="btn-xs bg-red-50 text-red-500 hover:bg-red-100">Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Future email integration placeholder */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest">Email Integration</p>
              <span className="text-xs bg-gray-100 text-gray-400 rounded-full px-2 py-0.5">Coming soon</span>
            </div>
            <p className="text-xs text-gray-400">
              Future: Send quotation requests to insurers, track email replies, and auto-update quotation status from inbox.
            </p>
          </div>
        </div>
      )}

      {/* ── Documents Tab ── */}
      {activeTab === 'documents' && (
        <div className="card-section">
          <div className="flex items-center justify-between mb-5">
            <SectionTitle>Documents</SectionTitle>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-xs bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold"
            >
              + Upload
            </button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
          </div>

          {documents.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="text-sm text-gray-400">Click to upload documents</p>
              <p className="text-xs text-gray-300 mt-0.5">Contracts, financials, supporting files</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between gap-4 bg-white border border-gray-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{doc.fileName}</p>
                      <p className="text-xs text-gray-400">{doc.documentType} · {formatFileSize(doc.fileSize)} · {doc.uploadedBy}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {deleteDocId === doc.id ? (
                      <>
                        <button onClick={() => { deleteInquiryDocument(doc.id); setDeleteDocId(null) }} className="btn-xs bg-red-600 text-white hover:bg-red-700">Confirm</button>
                        <button onClick={() => setDeleteDocId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => setDeleteDocId(doc.id)} className="btn-xs bg-red-50 text-red-500 hover:bg-red-100">Remove</button>
                    )}
                  </div>
                </div>
              ))}

              {/* Upload more */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border border-dashed border-gray-200 rounded-xl p-3 text-xs text-gray-400 hover:border-blue-300 hover:text-blue-600 transition-colors text-center"
              >
                + Upload more documents
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Notes Tab ── */}
      {activeTab === 'notes' && (
        <div className="card-section">
          <SectionTitle>Notes</SectionTitle>

          <form onSubmit={submitNote} className="mb-5">
            <textarea
              className="input w-full"
              rows={3}
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Add a note…"
            />
            <div className="flex justify-end mt-2">
              <button type="submit" disabled={!noteText.trim()} className="btn-primary text-sm px-4 py-2 disabled:opacity-50">
                Add Note
              </button>
            </div>
          </form>

          {notes.length === 0 ? (
            <p className="text-sm text-gray-400">No notes yet.</p>
          ) : (
            <div className="space-y-3">
              {notes.map(n => (
                <div key={n.id} className="bg-stone-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold text-gray-600">{n.createdBy}</p>
                    <p className="text-xs text-gray-400">{timeAgo(n.createdAt)}</p>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{n.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Activity Tab ── */}
      {activeTab === 'activity' && (
        <div className="card-section">
          <SectionTitle>Activity Timeline</SectionTitle>

          {inqLogs.length === 0 ? (
            <p className="text-sm text-gray-400">No activity recorded yet.</p>
          ) : (
            <div className="space-y-0">
              {inqLogs.map((log, idx) => (
                <div key={log.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-200 mt-1.5 shrink-0" />
                    {idx < inqLogs.length - 1 && <div className="w-px flex-1 bg-gray-100 my-1" />}
                  </div>
                  <div className="pb-4 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{log.title}</p>
                    {log.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{log.description}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-400">{timeAgo(log.timestamp)}</p>
                      {log.changedBy && <p className="text-xs text-gray-400">· {log.changedBy}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      <Modal isOpen={quotationModal === 'add'} onClose={() => setQuotationModal(null)} title="Add Quotation" maxWidth="sm">
        <QuotationForm
          initial={emptyQuotationForm()}
          onSave={d => {
            addInquiryQuotation({
              inquiryId: id,
              providerName: d.providerName,
              quotationAmount: d.quotationAmount,
              requestedDate: d.requestedDate,
              receivedDate: d.receivedDate || undefined,
              status: d.status,
              notes: d.notes,
            })
            setQuotationModal(null)
          }}
          onCancel={() => setQuotationModal(null)}
        />
      </Modal>

      <Modal isOpen={quotationModal === 'edit'} onClose={() => setQuotationModal(null)} title="Edit Quotation" maxWidth="sm">
        {selectedQuotation && (
          <QuotationForm
            initial={{
              providerName: selectedQuotation.providerName,
              quotationAmount: selectedQuotation.quotationAmount,
              requestedDate: selectedQuotation.requestedDate,
              receivedDate: selectedQuotation.receivedDate ?? '',
              status: selectedQuotation.status,
              notes: selectedQuotation.notes,
            }}
            onSave={d => {
              updateInquiryQuotation(selectedQuotation.id, {
                providerName: d.providerName,
                quotationAmount: d.quotationAmount,
                requestedDate: d.requestedDate,
                receivedDate: d.receivedDate || undefined,
                status: d.status,
                notes: d.notes,
              })
              setQuotationModal(null)
              setSelectedQuotation(null)
            }}
            onCancel={() => { setQuotationModal(null); setSelectedQuotation(null) }}
          />
        )}
      </Modal>

      <Modal isOpen={convertModal} onClose={() => setConvertModal(false)} title="Convert to Case" maxWidth="sm">
        <ConvertModal
          inquiry={inquiry}
          pics={pics}
          onConvert={handleConvert}
          onCancel={() => setConvertModal(false)}
        />
      </Modal>
    </div>
  )
}
