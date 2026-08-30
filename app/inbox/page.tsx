'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import type { TelegramUpload } from '@/lib/types'
import { formatFileSize, timeAgo } from '@/lib/utils'
import { getActiveDocs, resolveTemplate } from '@/lib/workflow'
import PageHeader from '@/components/ui/PageHeader'
import SearchableSelect from '@/components/ui/SearchableSelect'

type ActionMode = 'assign' | 'discard'

// Browsers won't render/navigate large base64 data: URIs reliably (some treat
// them as a download instead of a view). Converting to a blob: URL first is
// the same fix already used for case-file PDFs elsewhere in this app.
function UploadViewerModal({ upload, onClose }: { upload: TelegramUpload; onClose: () => void }) {
  const isPdf = upload.fileType === 'application/pdf'
  const isImage = upload.fileType.startsWith('image/')
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!upload.fileDataUrl) return
    const [header, b64] = upload.fileDataUrl.split(',')
    const mimeType = header.match(/:(.*?);/)?.[1] ?? upload.fileType
    const bytes = atob(b64)
    const arr = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    const blob = new Blob([arr], { type: mimeType })
    const url = URL.createObjectURL(blob)
    setBlobUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [upload.fileDataUrl, upload.fileType])

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 shrink-0">{upload.fileType}</span>
            <p className="text-sm font-semibold text-gray-800 truncate">{upload.fileName}</p>
            <span className="text-xs text-gray-400 shrink-0">{formatFileSize(upload.fileSize)}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {blobUrl && (
              <a
                href={blobUrl}
                download={upload.fileName}
                className="flex items-center gap-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </a>
            )}
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors text-base leading-none">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto min-h-0">
          {!upload.fileDataUrl ? (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">File data not available</div>
          ) : isImage && blobUrl ? (
            <div className="flex items-center justify-center p-6 bg-gray-50 min-h-[300px]">
              <img src={blobUrl} alt={upload.fileName} className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-sm" />
            </div>
          ) : isPdf ? (
            blobUrl ? (
              <iframe src={blobUrl} className="w-full h-[75vh] border-0" title={upload.fileName} />
            ) : (
              <div className="flex items-center justify-center h-48 gap-2 text-gray-400">
                <span className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading PDF…</span>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <p className="text-sm">Preview not available for this file type.</p>
              {blobUrl && <a href={blobUrl} download={upload.fileName} className="text-sm text-blue-600 hover:underline">Download to view</a>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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
    deleteTelegramUpload(upload.id)
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

      {viewing && <UploadViewerModal upload={upload} onClose={() => setViewing(false)} />}
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
