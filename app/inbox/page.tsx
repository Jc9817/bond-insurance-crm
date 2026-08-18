'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import type { TelegramUpload } from '@/lib/types'
import { CASE_TYPES } from '@/lib/types'
import { formatFileSize, timeAgo } from '@/lib/utils'
import PageHeader from '@/components/ui/PageHeader'
import SearchableSelect from '@/components/ui/SearchableSelect'

type ActionMode = 'newCase' | 'assign' | 'discard'

function UploadCard({ upload }: { upload: TelegramUpload }) {
  const { customers, cases, pics, addCustomer, addCase, addCaseFile, deleteTelegramUpload } = useStore()
  const [action, setAction] = useState<ActionMode | null>(null)
  const [error, setError] = useState('')

  // New Case form state
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing')
  const [customerId, setCustomerId] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [caseTitle, setCaseTitle] = useState(() => upload.fileName.replace(/\.[^.]+$/, ''))
  const [caseType, setCaseType] = useState('')
  const [amount, setAmount] = useState('')
  const [personInCharge, setPersonInCharge] = useState('')

  // Assign form state
  const [assignCaseId, setAssignCaseId] = useState('')

  const toggle = (mode: ActionMode) => {
    setError('')
    setAction(prev => prev === mode ? null : mode)
  }

  const attachFile = (caseId: string) => addCaseFile({
    caseId,
    fileName: upload.fileName,
    fileSize: upload.fileSize,
    fileType: upload.fileType,
    documentType: 'Uploaded via Telegram',
    uploadedBy: upload.uploadedBy,
    fileDataUrl: upload.fileDataUrl,
    aiScanned: false,
    aiStatus: 'Not Scanned',
    aiExtractedData: null,
  })

  const submitNewCase = () => {
    if (!caseTitle.trim()) { setError('Case title is required.'); return }

    let resolvedCustomerId = customerId
    let resolvedCustomerName = customers.find(c => c.id === customerId)?.customerName ?? ''

    if (customerMode === 'new') {
      if (!newCustomerName.trim()) { setError('Customer name is required.'); return }
      resolvedCustomerName = newCustomerName.trim()
      resolvedCustomerId = addCustomer({
        customerName: resolvedCustomerName,
        companyRegistrationNo: '', businessType: '', industry: '',
        mainPhone: '', mainEmail: '', notes: 'Created from Telegram inbox',
      })
    } else if (!resolvedCustomerId) {
      setError('Select a customer, or switch to "New customer".')
      return
    }

    const newCaseId = addCase({
      caseTitle: caseTitle.trim(),
      customerId: resolvedCustomerId,
      customerName: resolvedCustomerName,
      caseType,
      amount: Number(amount) || 0,
      personInCharge,
      currentStatus: 'New',
      result: '',
      closingRemarks: '',
    })
    attachFile(newCaseId)
    deleteTelegramUpload(upload.id)
  }

  const submitAssign = () => {
    if (!assignCaseId) { setError('Select a case to assign this file to.'); return }
    attachFile(assignCaseId)
    deleteTelegramUpload(upload.id)
  }

  const submitDiscard = () => deleteTelegramUpload(upload.id)

  const openCases = cases.filter(c => !c.archivedAt && c.currentStatus !== 'Closed')

  return (
    <div className="rounded-2xl border border-gray-150 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800 truncate">{upload.fileName}</p>
          <p className="text-xs text-gray-400">
            {upload.uploadedBy} · {formatFileSize(upload.fileSize)} · {timeAgo(upload.uploadedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {upload.fileDataUrl && (
            <button
              onClick={() => window.open(upload.fileDataUrl, '_blank')}
              className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              View
            </button>
          )}
          <button onClick={() => toggle('newCase')} className={`btn-xs ${action === 'newCase' ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}>
            New Case
          </button>
          <button onClick={() => toggle('assign')} className={`btn-xs ${action === 'assign' ? 'bg-violet-700' : 'bg-violet-600 hover:bg-violet-700'} text-white`}>
            Assign to Case
          </button>
          <button onClick={() => toggle('discard')} className="btn-xs bg-red-50 text-red-500 hover:bg-red-100">
            Discard
          </button>
        </div>
      </div>

      {action === 'newCase' && (
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 space-y-3">
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="radio" checked={customerMode === 'existing'} onChange={() => setCustomerMode('existing')} />
              Existing customer
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="radio" checked={customerMode === 'new'} onChange={() => setCustomerMode('new')} />
              New customer
            </label>
          </div>

          {customerMode === 'existing' ? (
            <div>
              <label className="label">Customer *</label>
              <SearchableSelect
                value={customerId}
                onChange={setCustomerId}
                options={customers.map(c => ({ value: c.id, label: c.customerName }))}
                placeholder="— Select customer —"
              />
            </div>
          ) : (
            <div>
              <label className="label">Customer / Company Name *</label>
              <input className="input text-sm" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="e.g. Juta-Kaseh Sdn Bhd" />
            </div>
          )}

          <div>
            <label className="label">Case Title *</label>
            <input className="input text-sm" value={caseTitle} onChange={e => setCaseTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Case Type</label>
              <select className="input text-sm" value={caseType} onChange={e => setCaseType(e.target.value)}>
                <option value="">— Optional —</option>
                {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Amount (RM)</label>
              <input className="input text-sm" type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div>
            <label className="label">Person In Charge</label>
            <select className="input text-sm" value={personInCharge} onChange={e => setPersonInCharge(e.target.value)}>
              <option value="">— Unassigned —</option>
              {pics.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={submitNewCase} className="btn-primary text-sm">Create Case &amp; Attach File</button>
            <button onClick={() => setAction(null)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {action === 'assign' && (
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 space-y-3">
          <div>
            <label className="label">Case *</label>
            <SearchableSelect
              value={assignCaseId}
              onChange={setAssignCaseId}
              options={openCases.map(c => ({ value: c.id, label: `${c.caseTitle} — ${c.customerName}` }))}
              placeholder="— Select a case —"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button onClick={submitAssign} className="btn-primary text-sm">Attach File to Case</button>
            <button onClick={() => setAction(null)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {action === 'discard' && (
        <div className="px-5 py-4 border-t border-gray-100 bg-red-50 space-y-3">
          <p className="text-sm text-red-700">Discard this upload? The file will be permanently removed from the inbox.</p>
          <div className="flex gap-2">
            <button onClick={submitDiscard} className="btn-xs bg-red-600 hover:bg-red-700 text-white">Confirm Discard</button>
            <button onClick={() => setAction(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InboxPage() {
  const { telegramUploads } = useStore()

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader
        title="Unassigned Inbox"
        subtitle={`${telegramUploads.length} document${telegramUploads.length === 1 ? '' : 's'} uploaded via Telegram, awaiting review`}
      />

      {telegramUploads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
          <p className="text-sm text-gray-400">No unassigned uploads right now.</p>
          <p className="text-xs text-gray-300 mt-1">Documents sent to the Telegram bot will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {telegramUploads.map(u => <UploadCard key={u.id} upload={u} />)}
        </div>
      )}

      <p className="text-xs text-gray-300 mt-6">
        Looking for cases already created? <Link href="/cases" className="text-blue-500 hover:underline">Go to Cases</Link>
      </p>
    </div>
  )
}
