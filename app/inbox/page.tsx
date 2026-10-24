'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import type { TelegramUpload } from '@/lib/types'
import { formatFileSize, timeAgo } from '@/lib/utils'
import { getActiveDocs, resolveTemplate } from '@/lib/workflow'
import PageHeader from '@/components/ui/PageHeader'
import SearchableSelect from '@/components/ui/SearchableSelect'
import FileViewerModal from '@/components/ui/FileViewerModal'

type ActionMode = 'assign' | 'discard'

function UploadCard({ upload }: { upload: TelegramUpload }) {
  const { cases, workflowTemplates, addCaseFile, deleteTelegramUpload } = useStore()
  const [action, setAction] = useState<ActionMode | null>(null)
  const [viewing, setViewing] = useState(false)
  const [error, setError] = useState('')

  // Assign form state
  const [assignCaseId, setAssignCaseId] = useState('')

  const toggle = (mode: ActionMode) => {
    setError('')
    setAction(prev => prev === mode ? null : mode)
  }

  // New-case creation now happens directly in the upload bot (Bot 1) — this
  // inbox exists purely to park a document onto an already-existing case.
  // Bot 1 only ever sends the Letter of Award, so default the tag to that
  // instead of a generic placeholder; staff can still retag it from the
  // checklist if it's ever something else.
  const attachFile = (caseId: string, loaDoc: { id: string; name: string } | null) => addCaseFile({
    caseId,
    fileName: upload.fileName,
    fileSize: upload.fileSize,
    fileType: upload.fileType,
    documentType: loaDoc?.name ?? 'Letter of Award (LOA)',
    requiredDocumentId: loaDoc?.id,
    uploadedBy: upload.uploadedBy,
    fileDataUrl: upload.fileDataUrl,
    aiScanned: false,
    aiStatus: 'Pending',
    aiExtractedData: null,
  })

  const submitAssign = () => {
    if (!assignCaseId) { setError('Select a case to assign this file to.'); return }
    const targetCase = cases.find(c => c.id === assignCaseId)
    const template = targetCase ? resolveTemplate(targetCase, workflowTemplates) : null
    const loaDoc = template ? getActiveDocs(template).find(d => d.name.toLowerCase().includes('letter of award')) ?? null : null
    attachFile(assignCaseId, loaDoc)
    // The case file now points at the same stored file — keep it
    deleteTelegramUpload(upload.id, { keepFile: true })
  }

  const submitDiscard = () => deleteTelegramUpload(upload.id)

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
            {upload.uploadedBy} · {formatFileSize(upload.fileSize)} · {timeAgo(upload.uploadedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {upload.fileDataUrl && (
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
          file={{ fileName: upload.fileName, fileSize: upload.fileSize, fileType: upload.fileType, fileRef: upload.fileDataUrl }}
          onClose={() => setViewing(false)}
        />
      )}
    </div>
  )
}

type SortOrder = 'newest' | 'oldest'

export default function InboxPage() {
  const { telegramUploads } = useStore()
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')

  const sortedUploads = [...telegramUploads].sort((a, b) => {
    const diff = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
    return sortOrder === 'newest' ? -diff : diff
  })

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader
        title="Unassigned Inbox"
        subtitle={`${telegramUploads.length} document${telegramUploads.length === 1 ? '' : 's'} uploaded via Telegram, awaiting review`}
        action={telegramUploads.length > 1 ? (
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

      {telegramUploads.length === 0 ? (
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
