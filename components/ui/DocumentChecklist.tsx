'use client'

import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/utils/supabase/client'
import type { WorkflowTemplate, CaseFile } from '@/lib/types'
import { getActiveDocs } from '@/lib/workflow'
import { formatFileSize, timeAgo } from '@/lib/utils'

const STORAGE_BUCKET = 'case-files'

function isStorageUrl(url?: string) {
  return !!url && url.startsWith('http')
}

async function downloadFile(file: CaseFile) {
  if (!file.fileDataUrl) return
  if (isStorageUrl(file.fileDataUrl)) {
    // Fetch from storage and force-download via blob
    try {
      const res = await fetch(file.fileDataUrl)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = file.fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
    } catch {
      window.open(file.fileDataUrl, '_blank')
    }
  } else {
    const a = document.createElement('a')
    a.href = file.fileDataUrl
    a.download = file.fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
}

function FileViewerModal({ file, onClose }: { file: CaseFile; onClose: () => void }) {
  const ext = file.fileName.split('.').pop()?.toLowerCase() ?? ''
  const storageFile = isStorageUrl(file.fileDataUrl)

  // Type detection: check URL for storage files, check MIME for base64
  const isPdf = storageFile ? ext === 'pdf' : file.fileDataUrl?.split(';')[0].split(':')[1] === 'application/pdf'
  const isImage = storageFile ? ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext) : (file.fileDataUrl?.split(';')[0].split(':')[1]?.startsWith('image/') ?? false)

  // For base64 PDFs: browsers block data: URIs in iframes — convert to blob URL
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!isPdf || !file.fileDataUrl || storageFile) return
    const [header, b64] = file.fileDataUrl.split(',')
    const mimeType = header.match(/:(.*?);/)?.[1] ?? 'application/pdf'
    const bytes = atob(b64)
    const arr = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    const blob = new Blob([arr], { type: mimeType })
    const url = URL.createObjectURL(blob)
    setBlobUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [isPdf, file.fileDataUrl, storageFile])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 shrink-0">{file.fileType}</span>
            <p className="text-sm font-semibold text-gray-800 truncate">{file.fileName}</p>
            <span className="text-xs text-gray-400 shrink-0">{formatFileSize(file.fileSize)}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button
              onClick={() => downloadFile(file)}
              className="flex items-center gap-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors text-base leading-none">✕</button>
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-auto min-h-0">
          {!file.fileDataUrl ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <p className="text-sm">File data not available</p>
            </div>
          ) : isImage ? (
            <div className="flex items-center justify-center p-6 bg-gray-50 min-h-[300px]">
              <img src={file.fileDataUrl} alt={file.fileName} className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-sm" />
            </div>
          ) : isPdf ? (
            storageFile ? (
              <iframe src={file.fileDataUrl} className="w-full h-[75vh] border-0" title={file.fileName} />
            ) : blobUrl ? (
              <iframe src={blobUrl} className="w-full h-[75vh] border-0" title={file.fileName} />
            ) : (
              <div className="flex items-center justify-center h-48 gap-2 text-gray-400">
                <span className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading PDF…</span>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700 mb-1">In-browser preview not available for {file.fileType} files</p>
                <p className="text-xs text-gray-400 mb-4">Download the file to open it in the appropriate application</p>
                <button
                  onClick={() => downloadFile(file)}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download {file.fileName}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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

  const uploadedRequiredCount = requiredDocs.filter(doc => activeFiles.some(f => f.requiredDocumentId === doc.id)).length
  const overallCompleteness = requiredDocs.length > 0 ? Math.round((uploadedRequiredCount / requiredDocs.length) * 100) : 100

  const uploadToStorage = async (file: File, caseId: string): Promise<string> => {
    const sb = createClient()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `cases/${caseId}/${Date.now()}_${safeName}`
    const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false })
    if (error) throw error
    const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path)
    return data.publicUrl
  }

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
      const fileDataUrl = await uploadToStorage(file, caseId)
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
      alert('File upload failed. Please check your Supabase storage bucket is set up and try again.')
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
              onDownload={() => downloadFile(f)}
              onSendToInbox={() => sendCaseFileToInbox(f)}
            />
          ))}
        </div>
      )}

      {viewingFile && <FileViewerModal file={viewingFile} onClose={() => setViewingFile(null)} />}
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
  onDownload: () => void
  onSendToInbox: () => void
}

function FileRow({
  file, docs, deleteConfirmId, setDeleteConfirmId,
  onRetag, onDelete, onScan, onReview, onView, onDownload, onSendToInbox,
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
        <button
          onClick={file.fileDataUrl ? onView : undefined}
          disabled={!file.fileDataUrl}
          title={file.fileDataUrl ? 'View file' : 'File preview not available'}
          className={`btn-xs flex items-center gap-1 ${
            file.fileDataUrl
              ? 'bg-white border border-gray-200 hover:bg-blue-50 text-gray-600 hover:text-blue-700'
              : 'bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed'
          }`}
        >
          View
        </button>
        <button
          onClick={file.fileDataUrl ? onDownload : undefined}
          disabled={!file.fileDataUrl}
          title={file.fileDataUrl ? 'Download file' : 'File not available for download'}
          className={`btn-xs flex items-center gap-1 ${
            file.fileDataUrl
              ? 'bg-white border border-gray-200 hover:bg-green-50 text-gray-600 hover:text-green-700'
              : 'bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed'
          }`}
        >
          Download
        </button>
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
