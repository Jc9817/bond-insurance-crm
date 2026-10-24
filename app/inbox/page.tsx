'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import type { IntakeItem, IntakeSource } from '@/lib/types'
import { formatFileSize, timeAgo } from '@/lib/utils'
import { getActiveDocs, resolveTemplate } from '@/lib/workflow'
import PageHeader from '@/components/ui/PageHeader'
import SearchableSelect from '@/components/ui/SearchableSelect'
import FileViewerModal from '@/components/ui/FileViewerModal'

// The Unassigned Inbox: documents from every intake channel (intake_items)
// waiting for a person to file them to a case or discard them. Every
// decision is recorded on the item and in the activity log.

type ActionMode = 'assign' | 'discard'

const SOURCE_LABELS: Record<IntakeSource, string> = {
  telegram: 'Telegram',
  email: 'Email',
  sharepoint: 'SharePoint',
  upload: 'Upload',
}

function UploadCard({ upload }: { upload: IntakeItem }) {
  const { cases, workflowTemplates, fileIntakeItem, discardIntakeItem, addActivityLog } = useStore()
  const { currentUser } = useAuth()
  const decidedBy = currentUser?.fullName ?? 'Unknown'
  const [action, setAction] = useState<ActionMode | null>(null)
  const [viewing, setViewing] = useState(false)
  const [error, setError] = useState('')

  // Assign form state
  const [assignCaseId, setAssignCaseId] = useState('')

  const toggle = (mode: ActionMode) => {
    setError('')
    setAction(prev => prev === mode ? null : mode)
  }

  // New-case creation happens directly in the Telegram bot — this Inbox
  // files a document onto an existing case. The bot's documents are usually
  // the Letter of Award, so the tag defaults to that; staff can retag it from
  // the case checklist. (AI-suggested tags arrive with fix list 3.3.)
  const submitAssign = () => {
    if (!assignCaseId) { setError('Select a case to assign this file to.'); return }
    if (!upload.fileRef) { setError('The file is still loading — please try again in a moment.'); return }
    const targetCase = cases.find(c => c.id === assignCaseId)
    const template = targetCase ? resolveTemplate(targetCase, workflowTemplates) : null
    const loaDoc = template ? getActiveDocs(template).find(d => d.name.toLowerCase().includes('letter of award')) ?? null : null
    const documentType = loaDoc?.name ?? 'Letter of Award (LOA)'
    if (!fileIntakeItem(upload.id, { caseId: assignCaseId, documentType, requiredDocumentId: loaDoc?.id, decidedBy })) return
    addActivityLog({
      caseId: assignCaseId,
      caseTitle: targetCase?.caseTitle,
      actionType: 'DOCUMENT_UPLOADED',
      title: 'Filed from Inbox',
      description: `${upload.fileName} (from ${SOURCE_LABELS[upload.source]}, ${upload.sender}) filed as "${documentType}"`,
      changedBy: decidedBy,
    })
  }

  const submitDiscard = () => {
    discardIntakeItem(upload.id, decidedBy)
    addActivityLog({
      actionType: 'DOCUMENT_DELETED',
      title: 'Discarded from Inbox',
      description: `${upload.fileName} (from ${SOURCE_LABELS[upload.source]}, ${upload.sender}) discarded`,
      changedBy: decidedBy,
    })
  }

  const openCases = cases.filter(c => !c.archivedAt && c.currentStatus !== 'Done')

  return (
    <div className="rounded-2xl border border-gray-150 bg-white">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800 truncate">{upload.fileName}</p>
          <p className="text-xs text-gray-400">
            <span className="font-medium text-gray-500">{SOURCE_LABELS[upload.source]}</span>
            {' · '}{upload.sender} · {formatFileSize(upload.fileSize)} · {timeAgo(upload.receivedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {upload.fileRef && (
            <button
              onClick={() => setViewing(true)}
              className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              View
            </button>
          )}
          <button onClick={() => toggle('assign')} className={`btn-xs ${action === 'assign' ? 'bg-violet-700' : 'bg-violet-600 hover:bg-violet-700'} text-white`}>
            Assign to Case
          </button>
          <button onClick={() => toggle('discard')} className="btn-xs bg-red-50 text-red-500 hover:bg-red-100">
            Discard
          </button>
        </div>
      </div>

      {action === 'assign' && (
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl space-y-3">
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

type SortOrder = 'newest' | 'oldest'

export default function InboxPage() {
  const { intakeItems, loadInbox } = useStore()

  // File links for View / Assign are loaded here, not at startup
  useEffect(() => { loadInbox() }, [loadInbox])
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')

  const sortedUploads = [...intakeItems].sort((a, b) => {
    const diff = new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()
    return sortOrder === 'newest' ? -diff : diff
  })

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

      {intakeItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
          <p className="text-sm text-gray-400">No unassigned uploads right now.</p>
          <p className="text-xs text-gray-300 mt-1">Documents sent to the Telegram bot will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedUploads.map(u => <UploadCard key={u.id} upload={u} />)}
        </div>
      )}

      <p className="text-xs text-gray-300 mt-6">
        Looking for cases already created? <Link href="/cases" className="text-blue-500 hover:underline">Go to Cases</Link>
      </p>
    </div>
  )
}
