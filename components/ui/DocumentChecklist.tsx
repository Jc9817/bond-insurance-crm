'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import type { WorkflowTemplate, CaseFile } from '@/lib/types'
import { getActiveDocs } from '@/lib/workflow'
import { formatFileSize, timeAgo } from '@/lib/utils'
import { caseFolder } from '@/lib/storage'
import { fileSha256, uploadFile } from '@/lib/upload'
import FileViewerModal from './FileViewerModal'

type Props = {
  caseId: string
  caseTitle?: string
  template: WorkflowTemplate | null
  caseFiles: CaseFile[]
  onScanReady: (file: CaseFile) => void
}

export default function DocumentChecklist({ caseId, caseTitle, template, caseFiles, onScanReady }: Props) {
  const { addCaseFile, deleteCaseFile, updateCaseFile, startAiScan, addActivityLog, sendCaseFileToInbox } = useStore()
  const { currentUser } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [viewingFile, setViewingFile] = useState<CaseFile | null>(null)

  const docs = getActiveDocs(template)
  const requiredDocs = docs.filter(d => d.required)

  // Superseded files are legacy leftovers from the old per-slot upload model — hide them from the live list.
  const activeFiles = caseFiles.filter(f => f.caseId === caseId && !f.supersededBy)

  const uploadedRequiredCount = requiredDocs.filter(doc => activeFiles.some(f => f.requiredDocumentId === doc.id && f.aiStatus !== 'Failed')).length
  const overallCompleteness = requiredDocs.length > 0 ? Math.round((uploadedRequiredCount / requiredDocs.length) * 100) : 100

  const handleRetag = (file: CaseFile, docId: string | null, docName: string) => {
    const oldDoc = file.requiredDocumentId ? docs.find(d => d.id === file.requiredDocumentId) : null
    updateCaseFile(file.id, {
      requiredDocumentId: docId ?? undefined,
      documentType: docId ? docName : 'Supporting Document',
    })
    addActivityLog({
      caseId,
      caseTitle,
      actionType: 'DOCUMENT_ASSIGNED',
      title: docId ? 'Document tagged' : 'Document untagged',
      oldValue: oldDoc?.name,
      newValue: docId ? docName : undefined,
      description: docId
        ? `${file.fileName} tagged as "${docName}"`
        : `${file.fileName} untagged from "${oldDoc?.name ?? 'category'}"`,
      changedBy: currentUser?.fullName ?? 'Unknown',
    })
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const fileHash = await fileSha256(file)
      const same = activeFiles.find(f => f.fileHash === fileHash)
      if (same && !confirm(`This exact file is already on this case as "${same.fileName}". Upload it again anyway?`)) {
        setUploading(false)
        return
      }
      const fileDataUrl = await uploadFile(file, caseFolder(caseId))
      addCaseFile({
        caseId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.name.split('.').pop()?.toUpperCase() ?? 'FILE',
        documentType: 'Supporting Document',
        uploadedBy: currentUser?.fullName ?? 'Unknown',
        aiScanned: false,
        aiStatus: 'Pending',
        aiExtractedData: null,
        fileDataUrl,
        fileHash,
      })
      addActivityLog({
        caseId,
        caseTitle,
        actionType: 'DOCUMENT_UPLOADED',
        title: 'File uploaded',
        description: `${file.name} uploaded`,
        changedBy: currentUser?.fullName ?? 'Unknown',
      })
    } catch (err) {
      console.error('[Storage] Upload failed:', err)
      alert(`File upload failed: ${err instanceof Error ? err.message : 'please try again.'}`)
    }
    setUploading(false)
  }

  return (
    <div className="space-y-4">
      {docs.length === 0 ? (
        <p className="text-xs text-gray-400">No workflow template — set a case type to see document categories.</p>
      ) : requiredDocs.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Required Documents</p>
          <div className="flex items-center gap-2">
            <div className="w-24 bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${overallCompleteness >= 100 ? 'bg-green-500' : overallCompleteness >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${overallCompleteness}%` }}
              />
            </div>
            <span className={`text-xs font-bold ${overallCompleteness >= 100 ? 'text-green-600' : overallCompleteness >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
              {uploadedRequiredCount}/{requiredDocs.length}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          All Files <span className="normal-case font-normal text-gray-300">({activeFiles.length})</span>
        </p>
        <label className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer">
          + Upload Document
          <input
            type="file"
            className="sr-only"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUpload(file)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {uploading && (
        <div className="flex items-center gap-2 py-2 px-3 bg-blue-50 rounded-xl">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="text-xs text-blue-600">Uploading…</span>
        </div>
      )}

      {activeFiles.length === 0 ? (
        <p className="text-xs text-gray-400">No files uploaded yet.</p>
      ) : (
        <div className="space-y-1.5">
          {activeFiles.map(f => (
            <FileRow
              key={f.id}
              file={f}
              docs={docs}
              deleteConfirmId={deleteConfirmId}
              setDeleteConfirmId={setDeleteConfirmId}
              onRetag={(docId, docName) => handleRetag(f, docId, docName)}
              onDelete={() => {
                deleteCaseFile(f.id)
                addActivityLog({ caseId, caseTitle, actionType: 'DOCUMENT_DELETED', title: 'File deleted', description: `${f.fileName} removed`, changedBy: currentUser?.fullName ?? 'Unknown' })
                setDeleteConfirmId(null)
              }}
              onScan={() => {
                startAiScan(f.id)
                addActivityLog({ caseId, caseTitle, actionType: 'AI_SCAN_STARTED', title: 'AI scan started', description: `AI scanning ${f.fileName}`, changedBy: currentUser?.fullName ?? 'Unknown' })
              }}
              onReview={() => onScanReady(f)}
              onView={() => setViewingFile(f)}
              onSendToInbox={() => sendCaseFileToInbox(f)}
            />
          ))}
        </div>
      )}

      {viewingFile && (
        <FileViewerModal
          file={{ fileName: viewingFile.fileName, fileSize: viewingFile.fileSize, fileType: viewingFile.fileType, fileRef: viewingFile.fileDataUrl }}
          onClose={() => setViewingFile(null)}
        />
      )}
    </div>
  )
}

// ─── File row ───────────────────────────────────────────────────────────────

type FileRowProps = {
  file: CaseFile
  docs: { id: string; name: string; required: boolean }[]
  deleteConfirmId: string | null
  setDeleteConfirmId: (id: string | null) => void
  onRetag: (docId: string | null, docName: string) => void
  onDelete: () => void
  onScan: () => void
  onReview: () => void
  onView: () => void
  onSendToInbox: () => void
}

function FileRow({
  file, docs, deleteConfirmId, setDeleteConfirmId,
  onRetag, onDelete, onScan, onReview, onView, onSendToInbox,
}: FileRowProps) {
  // Telegram-sourced files now default to a "Letter of Award" tag rather than
  // a fixed placeholder, so origin has to be read off `uploadedBy` instead.
  const fromTelegram = file.uploadedBy.startsWith('Telegram:')
  const isTagged = !!file.requiredDocumentId && docs.some(d => d.id === file.requiredDocumentId)
  // Letter of Award is the one document the whole case revolves around —
  // call it out from ordinary supporting documents at a glance.
  const isLoa = file.documentType.toLowerCase().includes('letter of award')

  return (
    <div className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 border transition-colors ${isTagged ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
      <span className="text-xs font-medium text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5 shrink-0">{file.fileType}</span>
      {isLoa && (
        <span className="text-xs font-bold bg-purple-100 text-purple-700 rounded px-1.5 py-0.5 shrink-0" title="Letter of Award">
          LOA
        </span>
      )}

      <div className="min-w-0 flex-1">
        <button onClick={onView} className="text-sm font-medium text-gray-800 truncate block hover:text-blue-600 hover:underline text-left">
          {file.fileName}
        </button>
        <p className="text-xs text-gray-400 truncate">
          {formatFileSize(file.fileSize)} · {timeAgo(file.uploadedAt)} · {file.uploadedBy}
          {file.sharepointUrl && (
            <> · <a href={file.sharepointUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">SharePoint</a></>
          )}
        </p>
      </div>

      {file.aiStatus === 'Extracted' && (
        <button onClick={onReview} className="text-xs font-semibold text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5 shrink-0">
          Extracted →
        </button>
      )}
      {file.aiStatus === 'Failed' && (
        <button onClick={onScan} className="btn-xs bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 shrink-0">
          Failed — Retry
        </button>
      )}
      {file.aiStatus === 'Processing' && (
        <span className="text-xs text-amber-600 font-medium shrink-0">Scanning…</span>
      )}
      {file.aiStatus === 'Pending' && (
        <button onClick={onScan} className="btn-xs bg-white border border-gray-200 hover:bg-violet-50 text-violet-700 shrink-0">
          AI Scan
        </button>
      )}

      {/* Tag dropdown */}
      <select
        className={`text-xs border rounded-lg px-2 py-1.5 shrink-0 max-w-[160px] focus:outline-none focus:ring-1 focus:ring-blue-400 ${
          isTagged ? 'border-gray-200 text-gray-700 bg-white' : 'border-amber-300 text-amber-700 bg-amber-50 font-medium'
        }`}
        value={isTagged ? file.requiredDocumentId : ''}
        onChange={(e) => {
          const val = e.target.value
          const doc = docs.find(d => d.id === val)
          onRetag(val || null, doc?.name ?? '')
        }}
      >
        <option value="">— Untagged —</option>
        {docs.map(d => (
          <option key={d.id} value={d.id}>{d.name}{d.required ? ' *' : ''}</option>
        ))}
      </select>

      <div className="flex gap-1.5 shrink-0 items-center">
        {fromTelegram && (
          <button
            onClick={onSendToInbox}
            title="Move this file back to the Unassigned Inbox — use this if it was attached to the wrong case"
            className="btn-xs bg-white border border-gray-200 hover:bg-amber-50 text-gray-600 hover:text-amber-700"
          >
            Back to Inbox
          </button>
        )}
        {deleteConfirmId === file.id ? (
          <>
            <button onClick={onDelete} className="btn-xs bg-red-600 text-white">Confirm</button>
            <button onClick={() => setDeleteConfirmId(null)} className="btn-xs bg-white border border-gray-200 text-gray-600">Cancel</button>
          </>
        ) : (
          <button onClick={() => setDeleteConfirmId(file.id)} className="btn-xs text-gray-300 hover:text-red-400">✕</button>
        )}
      </div>
    </div>
  )
}
