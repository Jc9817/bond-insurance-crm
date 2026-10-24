'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import type { CaseFile } from '@/lib/types'
import { formatFileSize, timeAgo } from '@/lib/utils'
import { caseFolder } from '@/lib/storage'
import { fileSha256, uploadFile } from '@/lib/upload'
import FileViewerModal, { downloadFile as downloadViewable } from './FileViewerModal'

const viewable = (file: CaseFile) => ({
  fileName: file.fileName, fileSize: file.fileSize, fileType: file.fileType, fileRef: file.fileDataUrl,
})
const downloadFile = (file: CaseFile) => downloadViewable(viewable(file))

const QUOTATION_AI_PROMPT =
  'Extract from this insurance quotation document: project name or site name, bond type, sum insured or bond amount, bond period or duration, premium rate (%), premium amount, insurer name, effective date, expiry date, and any key terms or conditions.'

function ExtractedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-xs text-violet-500 font-semibold shrink-0 w-32">{label}</span>
      <span className="text-xs text-violet-900 font-medium">{value}</span>
    </div>
  )
}

type Props = {
  caseId: string
  caseTitle?: string
  caseFiles: CaseFile[]
}

export default function QuotationDocumentPanel({ caseId, caseTitle, caseFiles }: Props) {
  const { addCaseFile, deleteCaseFile, startAiScan, addActivityLog } = useStore()
  const { currentUser } = useAuth()
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [viewingFile, setViewingFile] = useState<CaseFile | null>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    try {
      const fileHash = await fileSha256(file)
      const same = caseFiles.find(f => f.fileHash === fileHash)
      if (same && !confirm(`This exact file is already here as "${same.fileName}". Upload it again anyway?`)) {
        setUploading(false)
        return
      }
      const fileDataUrl = await uploadFile(file, caseFolder(caseId))
      addCaseFile({
        caseId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.name.split('.').pop()?.toUpperCase() ?? 'FILE',
        documentType: 'Quotation Document',
        uploadedBy: currentUser?.fullName ?? 'Unknown',
        aiScanned: false,
        aiStatus: 'Pending',
        aiExtractedData: null,
        fileDataUrl,
        fileHash,
        aiPrompt: QUOTATION_AI_PROMPT,
      })
      addActivityLog({
        caseId, caseTitle,
        actionType: 'DOCUMENT_UPLOADED',
        title: 'Quotation document uploaded',
        description: `${file.name} uploaded`,
        changedBy: currentUser?.fullName ?? 'Unknown',
      })
    } catch (err) {
      console.error('[Storage] Upload failed:', err)
      alert(`File upload failed: ${err instanceof Error ? err.message : 'please try again.'}`)
    }
    setUploading(false)
  }

  const handleScan = (file: CaseFile) => {
    startAiScan(file.id)
    addActivityLog({
      caseId, caseTitle,
      actionType: 'AI_SCAN_STARTED',
      title: 'AI scan started',
      description: `Scanning ${file.fileName} for project details`,
      changedBy: currentUser?.fullName ?? 'Unknown',
    })
  }

  const handleDelete = (file: CaseFile) => {
    deleteCaseFile(file.id)
    addActivityLog({
      caseId, caseTitle,
      actionType: 'DOCUMENT_DELETED',
      title: 'Document deleted',
      description: file.fileName,
      changedBy: currentUser?.fullName ?? 'Unknown',
    })
    setDeleteConfirmId(null)
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Quotation Documents</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Upload quotation letters received from insurers — AI will scan and extract project details.
          </p>
        </div>
        <label className={`btn-primary text-sm cursor-pointer flex items-center gap-2 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
          {uploading ? (
            <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Uploading…</>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload Document
            </>
          )}
          <input type="file" className="sr-only" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleUpload} />
        </label>
      </div>

      {/* Empty state */}
      {caseFiles.length === 0 && (
        <div className="text-center py-14 border-2 border-dashed border-gray-200 rounded-2xl">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-sm font-medium text-gray-500 mb-1">No documents yet</p>
          <p className="text-xs text-gray-400">Upload the quotation letters you receive from insurers</p>
        </div>
      )}

      {/* Document list */}
      <div className="space-y-3">
        {caseFiles.map(file => {
          const data = file.aiExtractedData
          const hasData = data && (data.projectName || data.amount || data.bondValue || data.expiryDate)

          return (
            <div
              key={file.id}
              className={`rounded-2xl border bg-white overflow-hidden transition-colors ${
                file.aiStatus === 'Extracted' ? 'border-green-200' :
                file.aiStatus === 'Failed' ? 'border-red-200' :
                'border-gray-200'
              }`}
            >
              {/* File row */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                  file.fileType === 'PDF' ? 'bg-red-100 text-red-600' :
                  ['JPG', 'JPEG', 'PNG'].includes(file.fileType) ? 'bg-green-100 text-green-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {file.fileType}
                </div>

                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => setViewingFile(file)}
                    className="text-sm font-semibold text-gray-800 hover:text-blue-600 hover:underline text-left truncate block max-w-xs"
                  >
                    {file.fileName}
                  </button>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-400">{formatFileSize(file.fileSize)}</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{timeAgo(file.uploadedAt)}</span>
                    {file.uploadedBy && <><span className="text-gray-300">·</span><span className="text-xs text-gray-400">{file.uploadedBy}</span></>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {file.fileDataUrl && (
                    <>
                      <button onClick={() => setViewingFile(file)} className="btn-xs bg-white border border-gray-200 hover:bg-blue-50 text-gray-600 hover:text-blue-700 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </button>
                      <button onClick={() => downloadFile(file)} className="btn-xs bg-white border border-gray-200 hover:bg-green-50 text-gray-600 hover:text-green-700 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </button>
                    </>
                  )}

                  {file.aiStatus === 'Pending' && (
                    <button
                      onClick={() => handleScan(file)}
                      className="btn-xs bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1.5 font-semibold"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.75 3.75 0 01-5.303 0l-.347-.347z" />
                      </svg>
                      Scan with AI
                    </button>
                  )}
                  {file.aiStatus === 'Processing' && (
                    <span className="flex items-center gap-1.5 text-xs text-violet-600 font-medium">
                      <span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                      Scanning…
                    </span>
                  )}
                  {file.aiStatus === 'Extracted' && (
                    <span className="text-xs font-semibold bg-green-100 text-green-700 rounded-full px-2.5 py-0.5">
                      ✓ Extracted
                    </span>
                  )}
                  {file.aiStatus === 'Failed' && (
                    <button onClick={() => handleScan(file)} className="btn-xs bg-red-50 text-red-700 hover:bg-red-100 font-semibold">
                      Failed — Retry
                    </button>
                  )}

                  {deleteConfirmId === file.id ? (
                    <>
                      <button onClick={() => handleDelete(file)} className="btn-xs bg-red-600 text-white">Confirm</button>
                      <button onClick={() => setDeleteConfirmId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteConfirmId(file.id)} className="btn-xs text-gray-300 hover:text-red-400 transition-colors">✕</button>
                  )}
                </div>
              </div>

              {/* AI extracted data */}
              {hasData && (
                <div className="mx-4 mb-4 rounded-xl bg-violet-50 border border-violet-100 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-3.5 h-3.5 text-violet-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.75 3.75 0 01-5.303 0l-.347-.347z" />
                    </svg>
                    <p className="text-xs font-bold text-violet-700 uppercase tracking-wide">AI Extracted Details</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-8">
                    {data!.projectName && <ExtractedField label="Project Name" value={data!.projectName} />}
                    {data!.amount && <ExtractedField label="Amount" value={data!.amount} />}
                    {data!.bondValue && data!.bondValue !== data!.amount && <ExtractedField label="Bond Value" value={data!.bondValue} />}
                    {data!.expiryDate && <ExtractedField label="Duration / Expiry" value={data!.expiryDate} />}
                    {data!.caseType && <ExtractedField label="Bond Type" value={data!.caseType} />}
                    {data!.customerName && <ExtractedField label="Customer" value={data!.customerName} />}
                    {data!.notes && (
                      <div className="sm:col-span-2 mt-1 pt-1.5 border-t border-violet-100">
                        <span className="text-xs text-violet-500 font-semibold">Notes: </span>
                        <span className="text-xs text-violet-800">{data!.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {viewingFile && <FileViewerModal file={viewable(viewingFile)} onClose={() => setViewingFile(null)} />}
    </div>
  )
}
