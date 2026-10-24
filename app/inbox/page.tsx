'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import type { IntakeItem, IntakeSource, IntakeStatus } from '@/lib/types'
import { formatFileSize, timeAgo } from '@/lib/utils'
import { getActiveDocs, getWorkflowTemplate, resolveTemplate } from '@/lib/workflow'
import { matchCustomer } from '@/lib/ssm'
import PageHeader from '@/components/ui/PageHeader'
import SearchableSelect from '@/components/ui/SearchableSelect'
import FileViewerModal from '@/components/ui/FileViewerModal'
import { INBOX_FOLDER, INBOX_UPLOAD_TYPES, isZipFile } from '@/lib/storage'
import { fileSha256, uploadFile } from '@/lib/upload'

// The Unassigned Inbox: documents from every intake channel (intake_items)
// waiting for a person to file them. The AI suggests a customer, case and
// document type for each (fix list 3.3); a person approves — one at a time
// or several together — changes the suggestion, or discards (3.5). A new
// customer or case is only created on approval, and every decision is
// recorded on the item and in the activity log.

type ActionMode = 'assign' | 'discard'

// New cases created from the Inbox start on the same workflow as the
// Telegram bot's "New case" (every intake case starts from a Letter of Award).
const NEW_CASE_TYPE = 'Bond Workflow'

const SOURCE_LABELS: Record<IntakeSource, string> = {
  telegram: 'Telegram',
  email: 'Email',
  sharepoint: 'SharePoint',
  upload: 'Upload',
}

const STATUS_BADGES: Partial<Record<IntakeStatus, { label: string; className: string }>> = {
  received: { label: 'New', className: 'bg-gray-100 text-gray-600' },
  processing: { label: 'AI reading…', className: 'bg-blue-100 text-blue-700' },
  suggested: { label: 'Suggested', className: 'bg-green-100 text-green-700' },
  needs_review: { label: 'Needs review', className: 'bg-amber-100 text-amber-700' },
}

/** True when an item's suggestion names everything needed to file it in one click. */
const canApprove = (item: IntakeItem) => {
  const s = item.aiSuggestion
  return !!item.fileRef && !!s?.customer && !!s.case && (!!s.case.id || s.case.isNew) && !!s.documentType
}

// ─── Approving suggestions ───────────────────────────────────────────────────

function useApprove() {
  const { customers, cases, workflowTemplates, addCustomer, addCase, fileIntakeItem, addActivityLog } = useStore()
  const { currentUser } = useAuth()
  const decidedBy = currentUser?.fullName ?? 'Unknown'

  // Files the given items as the AI suggested. New customers and cases are
  // created once per batch, even when several items point at the same one.
  return (items: IntakeItem[]): number => {
    const newCustomerIds = new Map<string, string>()   // suggested name|ssm -> created id
    const newCaseIds = new Map<string, { id: string; title: string }>()
    let filed = 0

    for (const item of items) {
      const s = item.aiSuggestion
      if (!canApprove(item) || !s?.customer || !s.case) continue

      // Customer: the suggested one, or one that now matches, or a new one
      let customerId = s.customer.id
      let customerName = s.customer.name
      if (!customerId) {
        const key = `${s.customer.ssm ?? ''}|${s.customer.name.toLowerCase()}`
        const existing = matchCustomer(customers, { ssm: s.customer.ssm, name: s.customer.name })
        customerId = existing?.id ?? newCustomerIds.get(key)
        if (existing) customerName = existing.customerName
        if (!customerId) {
          customerId = addCustomer({
            customerName: s.customer.name, companyRegistrationNo: s.customer.ssm ?? '',
            businessType: '', industry: '', mainPhone: '', mainEmail: '',
            notes: `Created from the Inbox (${item.fileName}).`,
          })
          newCustomerIds.set(key, customerId)
          addActivityLog({ title: 'Customer created from Inbox', description: `${s.customer.name} created when filing ${item.fileName}`, changedBy: decidedBy })
        }
      }

      // Case: the suggested one, or a new one for this customer
      let caseId = s.case.id
      let caseTitle = s.case.title
      if (!caseId) {
        const key = `${customerId}|${s.case.title}`
        const made = newCaseIds.get(key)
        if (made) {
          caseId = made.id
        } else {
          caseId = addCase({
            caseTitle: s.case.title, customerId, customerName, caseType: NEW_CASE_TYPE, amount: 0,
            personInCharge: '', currentStatus: 'Created', result: '', closingRemarks: '',
          })
          newCaseIds.set(key, { id: caseId, title: s.case.title })
          addActivityLog({ caseId, caseTitle, actionType: 'CASE_CREATED', title: 'Case created from Inbox', description: `Created when filing ${item.fileName}`, changedBy: decidedBy })
        }
      } else {
        caseTitle = cases.find(c => c.id === caseId)?.caseTitle ?? caseTitle
      }

      // Checklist slot: from the suggestion, or by name in the new case's workflow
      const documentType = s.documentType!
      const requiredDocumentId = s.requiredDocumentId ?? getActiveDocs(getWorkflowTemplate(NEW_CASE_TYPE, workflowTemplates))
        .find(d => d.name.toLowerCase() === documentType.toLowerCase())?.id

      if (!fileIntakeItem(item.id, { caseId, documentType, requiredDocumentId, decidedBy })) continue
      addActivityLog({
        caseId, caseTitle,
        actionType: 'DOCUMENT_ASSIGNED',
        title: 'Filed from Inbox',
        description: `${item.fileName} (from ${SOURCE_LABELS[item.source]}, ${item.sender}) filed as "${documentType}"`
          + (item.confidence != null ? ` — AI suggestion, ${Math.round(item.confidence * 100)}% sure` : ''),
        changedBy: decidedBy,
      })
      filed++
    }
    return filed
  }
}

// ─── One Inbox item ──────────────────────────────────────────────────────────

function UploadCard({ upload, selected, onToggleSelect, onApprove, onAskAi }: {
  upload: IntakeItem
  selected: boolean
  onToggleSelect: () => void
  onApprove: () => void
  onAskAi: () => void
}) {
  const { cases, workflowTemplates, fileIntakeItem, discardIntakeItem, addActivityLog } = useStore()
  const { currentUser } = useAuth()
  const decidedBy = currentUser?.fullName ?? 'Unknown'
  const s = upload.aiSuggestion
  const [action, setAction] = useState<ActionMode | null>(null)
  const [viewing, setViewing] = useState(false)
  const [error, setError] = useState('')

  // "Change" form, started from the AI's suggestion when there is one
  const [assignCaseId, setAssignCaseId] = useState(s?.case?.id ?? '')
  const targetCase = cases.find(c => c.id === assignCaseId)
  const caseDocs = targetCase ? getActiveDocs(resolveTemplate(targetCase, workflowTemplates)) : []
  const defaultDocId = (name?: string) => (name
    ? caseDocs.find(d => d.name.toLowerCase() === name.toLowerCase())?.id
    : undefined) ?? caseDocs.find(d => d.name.toLowerCase().includes('letter of award'))?.id ?? ''
  const [assignDocId, setAssignDocId] = useState<string | null>(null)   // null = use the default
  const chosenDocId = assignDocId ?? defaultDocId(s?.documentType)

  const toggle = (mode: ActionMode) => {
    setError('')
    // A suggestion may have arrived after this card first showed
    if (mode === 'assign' && !assignCaseId && s?.case?.id) setAssignCaseId(s.case.id)
    setAction(prev => prev === mode ? null : mode)
  }

  const submitAssign = () => {
    if (!assignCaseId) { setError('Select a case to assign this file to.'); return }
    if (!upload.fileRef) { setError('The file is still loading — please try again in a moment.'); return }
    const doc = caseDocs.find(d => d.id === chosenDocId)
    const documentType = doc?.name ?? s?.documentType ?? 'Supporting Document'
    if (!fileIntakeItem(upload.id, { caseId: assignCaseId, documentType, requiredDocumentId: doc?.id, decidedBy })) return
    addActivityLog({
      caseId: assignCaseId,
      caseTitle: targetCase?.caseTitle,
      actionType: 'DOCUMENT_ASSIGNED',
      title: 'Filed from Inbox',
      description: `${upload.fileName} (from ${SOURCE_LABELS[upload.source]}, ${upload.sender}) filed as "${documentType}"`
        + (s ? ' — AI suggestion changed by hand' : ''),
      changedBy: decidedBy,
    })
  }

  const submitDiscard = () => {
    discardIntakeItem(upload.id, decidedBy)
    addActivityLog({
      title: 'Discarded from Inbox',
      description: `${upload.fileName} (from ${SOURCE_LABELS[upload.source]}, ${upload.sender}) discarded`,
      changedBy: decidedBy,
    })
  }

  const openCases = cases.filter(c => !c.archivedAt && c.currentStatus !== 'Done')
  const badge = STATUS_BADGES[upload.status]
  const approvable = canApprove(upload)

  return (
    <div className={`rounded-2xl border bg-white ${selected ? 'border-violet-300 ring-1 ring-violet-200' : 'border-gray-150'}`}>
      <div className="flex items-center gap-3 px-5 py-4">
        <input
          type="checkbox"
          className="w-4 h-4 accent-violet-600 shrink-0 disabled:opacity-30"
          checked={selected}
          disabled={!approvable}
          onChange={onToggleSelect}
          title={approvable ? 'Select for "Approve selected"' : 'Nothing to approve yet — use Assign to Case'}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{upload.fileName}</p>
            {badge && (
              <span className={`text-xs font-medium rounded-full px-2 py-0.5 shrink-0 ${badge.className}`}>
                {badge.label}{upload.confidence != null && upload.status !== 'processing' ? ` · ${Math.round(upload.confidence * 100)}%` : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            <span className="font-medium text-gray-500">{SOURCE_LABELS[upload.source]}</span>
            {' · '}{upload.sender} · {formatFileSize(upload.fileSize)} · {timeAgo(upload.receivedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {upload.fileRef && (
            <button onClick={() => setViewing(true)} className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700">View</button>
          )}
          {approvable && (
            <button onClick={onApprove} className="btn-xs bg-green-600 hover:bg-green-700 text-white">Approve</button>
          )}
          <button onClick={() => toggle('assign')} className={`btn-xs ${action === 'assign' ? 'bg-violet-700' : 'bg-violet-600 hover:bg-violet-700'} text-white`}>
            {s ? 'Change…' : 'Assign to Case'}
          </button>
          <button onClick={() => toggle('discard')} className="btn-xs bg-red-50 text-red-500 hover:bg-red-100">Discard</button>
        </div>
      </div>

      {/* What the AI suggests */}
      {s && (s.customer || s.case || s.documentType || s.note) && (
        <div className="mx-5 mb-4 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-xs space-y-1">
          {s.documentType && <p><span className="text-gray-400 w-20 inline-block">Document</span> <strong className="text-gray-700">{s.documentType}</strong></p>}
          {s.customer && (
            <p><span className="text-gray-400 w-20 inline-block">Customer</span> <strong className="text-gray-700">{s.customer.name}</strong>
              {s.customer.isNew && <span className="ml-1.5 text-amber-700">(new — will be created)</span>}
              {s.customer.ssm && <span className="ml-1.5 text-gray-400">SSM {s.customer.ssm}</span>}</p>
          )}
          {s.case && (
            <p><span className="text-gray-400 w-20 inline-block">Case</span> <strong className="text-gray-700">{s.case.title}</strong>
              {s.case.isNew && <span className="ml-1.5 text-amber-700">(new — will be created)</span>}</p>
          )}
          {s.note && <p className="text-amber-700 pt-1">{s.note}</p>}
        </div>
      )}
      {(upload.status === 'received' || upload.status === 'needs_review') && (
        <div className="mx-5 mb-3 -mt-1">
          <button onClick={onAskAi} className="text-xs text-violet-600 hover:underline">
            {s ? 'Ask the AI to read it again' : 'Ask the AI to suggest where it goes'}
          </button>
        </div>
      )}

      {action === 'assign' && (
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl space-y-3">
          <div>
            <label className="label">Case *</label>
            <SearchableSelect
              value={assignCaseId}
              onChange={v => { setAssignCaseId(v); setAssignDocId(null) }}
              options={openCases.map(c => ({ value: c.id, label: `${c.caseTitle} — ${c.customerName}` }))}
              placeholder="— Select a case —"
            />
          </div>
          {caseDocs.length > 0 && (
            <div>
              <label className="label">Document type</label>
              <select className="input" value={chosenDocId} onChange={e => setAssignDocId(e.target.value)}>
                <option value="">Supporting Document (no checklist slot)</option>
                {caseDocs.map(d => <option key={d.id} value={d.id}>{d.name}{d.required ? ' *' : ''}</option>)}
              </select>
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button onClick={submitAssign} className="btn-primary text-sm">Attach File to Case</button>
            <button onClick={() => setAction(null)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {action === 'discard' && (
        <div className="px-5 py-4 border-t border-gray-100 bg-red-50 rounded-b-2xl space-y-3">
          <p className="text-sm text-red-700">Discard this upload? The file will be permanently removed from the inbox.</p>
          <div className="flex gap-2">
            <button onClick={submitDiscard} className="btn-xs bg-red-600 hover:bg-red-700 text-white">Confirm Discard</button>
            <button onClick={() => setAction(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {viewing && (
        <FileViewerModal
          file={{ fileName: upload.fileName, fileSize: upload.fileSize, fileType: upload.fileType, fileRef: upload.fileRef }}
          onClose={() => setViewing(false)}
        />
      )}
    </div>
  )
}

// ─── Bulk upload (fix list 4.3) ─────────────────────────────────────────────
// Drop or pick any number of files and zips; each file (and each document
// inside a zip) becomes its own Inbox item. Files already received before are
// not added again.

function BulkUpload({ onDone }: { onDone: () => void }) {
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [result, setResult] = useState<{ added: string[]; duplicates: string[]; skipped: string[] } | null>(null)
  const [error, setError] = useState('')

  const handleFiles = async (picked: File[]) => {
    if (picked.length === 0 || progress) return
    setResult(null)
    setError('')
    try {
      const uploaded = []
      for (const [i, file] of picked.entries()) {
        setProgress(`Uploading ${i + 1} of ${picked.length}…`)
        uploaded.push({
          ref: await uploadFile(file, INBOX_FOLDER),
          fileName: file.name,
          fileSize: file.size,
          fileHash: isZipFile(file.name) ? undefined : await fileSha256(file),
        })
      }
      setProgress('Adding to the Inbox…')
      const res = await fetch('/api/intake/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: uploaded }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `Upload failed (${res.status})`)
      setResult(data)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed — please try again.')
    }
    setProgress(null)
  }

  return (
    <div className="mb-5">
      <label
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)) }}
        className={`block border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        } ${progress ? 'pointer-events-none opacity-70' : ''}`}
      >
        <input
          type="file"
          multiple
          className="sr-only"
          accept={[...Object.keys(INBOX_UPLOAD_TYPES), 'zip'].map(e => `.${e}`).join(',')}
          onChange={e => { handleFiles(Array.from(e.target.files ?? [])); e.target.value = '' }}
        />
        {progress ? (
          <span className="inline-flex items-center gap-2 text-sm text-blue-700">
            <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            {progress}
          </span>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-600">Drop files or zips here, or click to choose</p>
            <p className="text-xs text-gray-400 mt-1">PDF, images, Word, Excel — a zip is unpacked into separate documents</p>
          </>
        )}
      </label>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3 mt-3">{error}</p>}
      {result && (
        <div className="text-sm bg-gray-50 rounded-xl p-3 mt-3 space-y-1">
          <p className="text-gray-700">
            <strong>{result.added.length}</strong> document{result.added.length === 1 ? '' : 's'} added to the Inbox.
          </p>
          {result.duplicates.length > 0 && (
            <p className="text-amber-700">
              Already received before, not added again: {result.duplicates.join(', ')}
            </p>
          )}
          {result.skipped.length > 0 && (
            <p className="text-gray-500">
              Skipped (file type not supported, or could not be read): {result.skipped.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

type SortOrder = 'newest' | 'oldest'

export default function InboxPage() {
  const { intakeItems, loadInbox } = useStore()
  const approve = useApprove()
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState('')

  // File links and suggestions are loaded here, not at startup
  useEffect(() => { loadInbox() }, [loadInbox])

  // While the AI is reading something, check every few seconds for its suggestion
  const aiReading = intakeItems.some(i => i.status === 'processing')
  useEffect(() => {
    if (!aiReading) return
    const timer = setInterval(() => loadInbox(), 5000)
    return () => clearInterval(timer)
  }, [aiReading, loadInbox])

  const sortedUploads = [...intakeItems].sort((a, b) => {
    const diff = new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()
    return sortOrder === 'newest' ? -diff : diff
  })
  const approvable = sortedUploads.filter(canApprove)
  const selected = approvable.filter(i => selectedIds.has(i.id))

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const approveItems = (items: IntakeItem[]) => {
    const filed = approve(items)
    setSelectedIds(new Set())
    setNotice(`${filed} document${filed === 1 ? '' : 's'} filed.`)
  }

  const askAi = async (id: string) => {
    setNotice('')
    const res = await fetch('/api/intake/classify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) setNotice(data.error ?? 'The AI could not be asked — please try again.')
    loadInbox()
  }

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader
        title="Unassigned Inbox"
        subtitle={`${intakeItems.length} document${intakeItems.length === 1 ? '' : 's'} awaiting review`}
        action={intakeItems.length > 1 ? (
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setSortOrder('newest')}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${sortOrder === 'newest' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Newest first
            </button>
            <button
              onClick={() => setSortOrder('oldest')}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${sortOrder === 'oldest' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Oldest first
            </button>
          </div>
        ) : undefined}
      />

      <BulkUpload onDone={loadInbox} />

      {approvable.length > 0 && (
        <div className="flex items-center gap-3 mb-3 text-sm">
          <button
            onClick={() => setSelectedIds(selected.length === approvable.length ? new Set() : new Set(approvable.map(i => i.id)))}
            className="text-violet-600 hover:underline"
          >
            {selected.length === approvable.length ? 'Clear selection' : `Select all ${approvable.length} with a suggestion`}
          </button>
          {selected.length > 0 && (
            <button onClick={() => approveItems(selected)} className="btn-xs bg-green-600 hover:bg-green-700 text-white">
              Approve selected ({selected.length})
            </button>
          )}
        </div>
      )}
      {notice && <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 mb-3">{notice}</p>}

      {intakeItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
          <p className="text-sm text-gray-400">No unassigned uploads right now.</p>
          <p className="text-xs text-gray-300 mt-1">Documents sent to the Telegram bot or uploaded above will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedUploads.map(u => (
            <UploadCard
              key={u.id}
              upload={u}
              selected={selectedIds.has(u.id)}
              onToggleSelect={() => toggleSelect(u.id)}
              onApprove={() => approveItems([u])}
              onAskAi={() => askAi(u.id)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-gray-300 mt-6">
        Looking for cases already created? <Link href="/cases" className="text-blue-500 hover:underline">Go to Cases</Link>
      </p>
    </div>
  )
}
