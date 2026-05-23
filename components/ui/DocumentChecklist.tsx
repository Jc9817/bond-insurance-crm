'use client'

import { useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import type { WorkflowTemplate, CaseFile } from '@/lib/types'
import { getActiveDocs, getUploadedFileForDoc, getUnassignedFiles } from '@/lib/workflow'
import { formatFileSize } from '@/lib/utils'

type Props = {
  caseId: string
  caseTitle?: string
  template: WorkflowTemplate | null
  caseFiles: CaseFile[]
  onScanReady: (file: CaseFile) => void
}

export default function DocumentChecklist({ caseId, caseTitle, template, caseFiles, onScanReady }: Props) {
  const { addCaseFile, deleteCaseFile, updateCaseFile, startAiScan, addActivityLog } = useStore()
  const { currentUser } = useAuth()
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [dragOverDocId, setDragOverDocId] = useState<string | null>(null)
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const docs = getActiveDocs(template)
  const requiredDocs = docs.filter(d => d.required)
  const optionalDocs = docs.filter(d => !d.required)
  const unassignedFiles = getUnassignedFiles(caseId, template, caseFiles)

  const readAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handleAssignFile = (fileId: string, docId: string | null, docName: string) => {
    const file = caseFiles.find(f => f.id === fileId)
    if (!file) return
    const oldDoc = file.requiredDocumentId ? docs.find(d => d.id === file.requiredDocumentId) : null
    updateCaseFile(fileId, {
      requiredDocumentId: docId ?? undefined,
      documentType: docId ? docName : 'Supporting Document',
    })
    addActivityLog({
      caseId,
      caseTitle,
      actionType: 'DOCUMENT_ASSIGNED',
      title: docId ? 'Document assigned' : 'Document unassigned',
      oldValue: oldDoc?.name,
      newValue: docId ? docName : undefined,
      description: docId
        ? `${file.fileName} assigned to "${docName}"`
        : `${file.fileName} unassigned from "${oldDoc?.name ?? 'slot'}"`,
      changedBy: currentUser?.fullName ?? 'Unknown',
    })
  }

  const handleFileSelect = async (docId: string, file: File, docName: string, aiPrompt?: string) => {
    setUploadingDocId(docId)
    const fileDataUrl = await readAsDataUrl(file)
    addCaseFile({
      caseId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.name.split('.').pop()?.toUpperCase() ?? 'FILE',
      documentType: docName,
      requiredDocumentId: docId,
      uploadedBy: currentUser?.fullName ?? 'Unknown',
      aiScanned: false,
      aiStatus: 'Not Scanned',
      aiExtractedData: null,
      fileDataUrl,
      aiPrompt,
    })
    addActivityLog({
      caseId,
      caseTitle,
      actionType: 'DOCUMENT_UPLOADED',
      title: 'Document uploaded',
      newValue: docName,
      description: `${file.name} uploaded`,
      changedBy: currentUser?.fullName ?? 'Unknown',
    })
    setUploadingDocId(null)
  }

  const handleGeneralFileSelect = async (file: File) => {
    setUploadingDocId('general')
    const fileDataUrl = await readAsDataUrl(file)
    addCaseFile({
      caseId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.name.split('.').pop()?.toUpperCase() ?? 'FILE',
      documentType: 'Supporting Document',
      uploadedBy: currentUser?.fullName ?? 'Unknown',
      aiScanned: false,
      aiStatus: 'Not Scanned',
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
    setUploadingDocId(null)
  }

  const handleDocDrop = (docId: string, docName: string, e: React.DragEvent) => {
    e.preventDefault()
    setDragOverDocId(null)
    const fileId = e.dataTransfer.getData('fileId')
    if (!fileId) return
    const existing = getUploadedFileForDoc(docId, caseId, caseFiles)
    if (existing) return // slot occupied — do nothing
    handleAssignFile(fileId, docId, docName)
    setDraggedFileId(null)
  }

  if (!template) {
    return (
      <div className="text-center py-10">
        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-600">No workflow template</p>
        <p className="text-xs text-gray-400 mt-1">Set a case type to see required documents</p>
        {unassignedFiles.length > 0 && (
          <div className="mt-4 text-left">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Uploaded Files</p>
            <div className="space-y-1.5">
              {unassignedFiles.map(f => (
                <UnassignedFileCard
                  key={f.id}
                  file={f}
                  docs={[]}
                  deleteConfirmId={deleteConfirmId}
                  setDeleteConfirmId={setDeleteConfirmId}
                  onAssign={() => {}}
                  onDragStart={() => setDraggedFileId(f.id)}
                  onDelete={() => { deleteCaseFile(f.id); setDeleteConfirmId(null) }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Required documents */}
      {requiredDocs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Required Documents</p>
          <div className="space-y-2">
            {requiredDocs.map(doc => {
              const uploaded = getUploadedFileForDoc(doc.id, caseId, caseFiles)
              const isUploading = uploadingDocId === doc.id
              const isDropTarget = dragOverDocId === doc.id && !uploaded
              return (
                <DocRow
                  key={doc.id}
                  docId={doc.id}
                  docName={doc.name}
                  description={doc.description}
                  required={doc.required}
                  uploaded={uploaded}
                  isUploading={isUploading}
                  isDropTarget={isDropTarget}
                  isDragging={!!draggedFileId}
                  deleteConfirmId={deleteConfirmId}
                  setDeleteConfirmId={setDeleteConfirmId}
                  fileInputRef={(el) => { fileInputRefs.current[doc.id] = el }}
                  onUploadClick={() => fileInputRefs.current[doc.id]?.click()}
                  onFileChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelect(doc.id, file, doc.name, doc.aiPrompt)
                  }}
                  onDelete={() => {
                    if (uploaded) {
                      deleteCaseFile(uploaded.id)
                      addActivityLog({ caseId, caseTitle, actionType: 'DOCUMENT_DELETED', title: 'Document deleted', description: `${uploaded.fileName} removed`, changedBy: currentUser?.fullName ?? 'Unknown' })
                      setDeleteConfirmId(null)
                    }
                  }}
                  onScan={() => {
                    if (uploaded) {
                      startAiScan(uploaded.id)
                      addActivityLog({ caseId, caseTitle, actionType: 'AI_SCAN_STARTED', title: 'AI scan started', description: `AI scanning ${uploaded.fileName}`, changedBy: currentUser?.fullName ?? 'Unknown' })
                    }
                  }}
                  onReview={() => { if (uploaded) onScanReady(uploaded) }}
                  onDragOver={(e) => { if (!uploaded) { e.preventDefault(); setDragOverDocId(doc.id) } }}
                  onDragLeave={() => setDragOverDocId(null)}
                  onDrop={(e) => handleDocDrop(doc.id, doc.name, e)}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Optional documents */}
      {optionalDocs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Optional Documents</p>
          <div className="space-y-2">
            {optionalDocs.map(doc => {
              const uploaded = getUploadedFileForDoc(doc.id, caseId, caseFiles)
              const isUploading = uploadingDocId === doc.id
              const isDropTarget = dragOverDocId === doc.id && !uploaded
              return (
                <DocRow
                  key={doc.id}
                  docId={doc.id}
                  docName={doc.name}
                  description={doc.description}
                  required={doc.required}
                  uploaded={uploaded}
                  isUploading={isUploading}
                  isDropTarget={isDropTarget}
                  isDragging={!!draggedFileId}
                  deleteConfirmId={deleteConfirmId}
                  setDeleteConfirmId={setDeleteConfirmId}
                  fileInputRef={(el) => { fileInputRefs.current[doc.id] = el }}
                  onUploadClick={() => fileInputRefs.current[doc.id]?.click()}
                  onFileChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelect(doc.id, file, doc.name, doc.aiPrompt)
                  }}
                  onDelete={() => {
                    if (uploaded) {
                      deleteCaseFile(uploaded.id)
                      addActivityLog({ caseId, caseTitle, actionType: 'DOCUMENT_DELETED', title: 'Document deleted', description: `${uploaded.fileName} removed`, changedBy: currentUser?.fullName ?? 'Unknown' })
                      setDeleteConfirmId(null)
                    }
                  }}
                  onScan={() => {
                    if (uploaded) {
                      startAiScan(uploaded.id)
                      addActivityLog({ caseId, caseTitle, actionType: 'AI_SCAN_STARTED', title: 'AI scan started', description: `AI scanning ${uploaded.fileName}`, changedBy: currentUser?.fullName ?? 'Unknown' })
                    }
                  }}
                  onReview={() => { if (uploaded) onScanReady(uploaded) }}
                  onDragOver={(e) => { if (!uploaded) { e.preventDefault(); setDragOverDocId(doc.id) } }}
                  onDragLeave={() => setDragOverDocId(null)}
                  onDrop={(e) => handleDocDrop(doc.id, doc.name, e)}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Unassigned / additional files */}
      <div className="pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Other Files</p>
            {unassignedFiles.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">
                {unassignedFiles.length} unassigned
              </span>
            )}
          </div>
          <label className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer">
            + Upload File
            <input
              type="file"
              className="sr-only"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleGeneralFileSelect(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        {uploadingDocId === 'general' && (
          <div className="flex items-center gap-2 py-2 px-3 bg-blue-50 rounded-xl mb-2">
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-xs text-blue-600">Uploading…</span>
          </div>
        )}
        {unassignedFiles.length === 0 && uploadingDocId !== 'general' ? (
          <p className="text-xs text-gray-400">No additional files uploaded.</p>
        ) : (
          <div className="space-y-1.5">
            {unassignedFiles.length > 0 && docs.length > 0 && (
              <p className="text-xs text-amber-600 mb-2">
                Drag a file onto a document slot above, or use "Assign to" to link it.
              </p>
            )}
            {unassignedFiles.map(f => (
              <UnassignedFileCard
                key={f.id}
                file={f}
                docs={docs}
                deleteConfirmId={deleteConfirmId}
                setDeleteConfirmId={setDeleteConfirmId}
                onAssign={(docId, docName) => handleAssignFile(f.id, docId, docName)}
                onDragStart={() => setDraggedFileId(f.id)}
                onDelete={() => {
                  deleteCaseFile(f.id)
                  addActivityLog({ caseId, caseTitle, actionType: 'DOCUMENT_DELETED', title: 'File deleted', description: `${f.fileName} removed`, changedBy: currentUser?.fullName ?? 'Unknown' })
                  setDeleteConfirmId(null)
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Individual document row (also a drop zone) ───────────────────────────────

type DocRowProps = {
  docId: string
  docName: string
  description: string
  required: boolean
  uploaded: CaseFile | undefined
  isUploading: boolean
  isDropTarget: boolean
  isDragging: boolean
  deleteConfirmId: string | null
  setDeleteConfirmId: (id: string | null) => void
  fileInputRef: (el: HTMLInputElement | null) => void
  onUploadClick: () => void
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDelete: () => void
  onScan: () => void
  onReview: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
}

function DocRow({
  docId, docName, description, required, uploaded, isUploading,
  isDropTarget, isDragging,
  deleteConfirmId, setDeleteConfirmId,
  fileInputRef, onUploadClick, onFileChange, onDelete, onScan, onReview,
  onDragOver, onDragLeave, onDrop,
}: DocRowProps) {
  const canDrop = !uploaded && isDragging

  return (
    <div
      className={`flex items-start gap-3 rounded-xl px-3.5 py-3 border transition-colors ${
        isDropTarget ? 'bg-blue-50 border-blue-300 border-dashed' :
        uploaded ? 'bg-green-50 border-green-100' :
        required ? 'bg-red-50 border-red-100' :
        canDrop ? 'border-dashed border-gray-300' :
        'bg-gray-50 border-gray-100'
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Status icon */}
      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        uploaded ? 'bg-green-500' : isDropTarget ? 'bg-blue-200' : required ? 'bg-red-200' : 'bg-gray-200'
      }`}>
        {uploaded ? (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : isDropTarget ? (
          <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <div className={`w-2 h-2 rounded-full ${required ? 'bg-red-500' : 'bg-gray-400'}`} />
        )}
      </div>

      {/* Document info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${
            isDropTarget ? 'text-blue-700' :
            uploaded ? 'text-green-800' :
            required ? 'text-red-900' : 'text-gray-700'
          }`}>
            {docName}
          </span>
          <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
            required ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
          }`}>
            {required ? 'Required' : 'Optional'}
          </span>
        </div>
        {!uploaded && !isDropTarget && (
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        )}
        {!uploaded && isDropTarget && (
          <p className="text-xs text-blue-500 mt-0.5">Drop file here to assign</p>
        )}
        {uploaded && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-green-700 font-medium truncate max-w-[200px]">{uploaded.fileName}</span>
            <span className="text-xs text-gray-400">{formatFileSize(uploaded.fileSize)}</span>
            {uploaded.aiStatus === 'Approved' && (
              <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">AI Verified</span>
            )}
          </div>
        )}
        {isUploading && (
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-2.5 h-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-blue-600">Uploading…</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {!uploaded && !isUploading && (
          <>
            <button
              onClick={onUploadClick}
              className="btn-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"
            >
              Upload
            </button>
            <input
              type="file"
              className="sr-only"
              ref={fileInputRef}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              onChange={(e) => { onFileChange(e); e.target.value = '' }}
            />
          </>
        )}
        {uploaded && (
          <>
            {uploaded.aiStatus === 'Not Scanned' && (
              <button onClick={onScan} className="btn-xs bg-white border border-gray-200 hover:bg-violet-50 text-violet-700">
                AI Scan
              </button>
            )}
            {uploaded.aiStatus === 'Processing' && (
              <span className="btn-xs text-amber-600">Scanning…</span>
            )}
            {uploaded.aiStatus === 'Ready for Review' && (
              <button onClick={onReview} className="btn-xs bg-blue-600 text-white hover:bg-blue-700">Review</button>
            )}
            {uploaded.aiStatus === 'Approved' && (
              <button onClick={onReview} className="btn-xs bg-green-50 text-green-700 hover:bg-green-100">View</button>
            )}
            {deleteConfirmId === uploaded.id ? (
              <>
                <button onClick={onDelete} className="btn-xs bg-red-600 text-white">Confirm</button>
                <button onClick={() => setDeleteConfirmId(null)} className="btn-xs bg-white border border-gray-200 text-gray-600">Cancel</button>
              </>
            ) : (
              <button onClick={() => setDeleteConfirmId(uploaded.id)} className="btn-xs text-gray-300 hover:text-red-400">✕</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Unassigned / other file card (draggable) ─────────────────────────────────

type UnassignedFileCardProps = {
  file: CaseFile
  docs: { id: string; name: string }[]
  deleteConfirmId: string | null
  setDeleteConfirmId: (id: string | null) => void
  onAssign: (docId: string | null, docName: string) => void
  onDragStart: () => void
  onDelete: () => void
}

function UnassignedFileCard({
  file, docs, deleteConfirmId, setDeleteConfirmId,
  onAssign, onDragStart, onDelete,
}: UnassignedFileCardProps) {
  const isOrphaned = !!file.requiredDocumentId

  return (
    <div
      draggable={docs.length > 0}
      onDragStart={(e) => {
        e.dataTransfer.setData('fileId', file.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 border transition-colors ${
        isOrphaned
          ? 'bg-amber-50 border-amber-100'
          : 'bg-gray-50 border-gray-100'
      } ${docs.length > 0 ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {docs.length > 0 && (
          <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
        <span className="text-xs font-medium text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5 shrink-0">{file.fileType}</span>
        <div className="min-w-0">
          <span className="text-sm text-gray-800 truncate block">{file.fileName}</span>
          {isOrphaned && (
            <span className="text-xs text-amber-600">Unassigned — template changed</span>
          )}
        </div>
        <span className="text-xs text-gray-400 shrink-0">{formatFileSize(file.fileSize)}</span>
      </div>
      <div className="flex gap-1.5 shrink-0 items-center">
        {/* Assign-to dropdown */}
        {docs.length > 0 && (
          <select
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white hover:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
            value=""
            onChange={(e) => {
              const val = e.target.value
              if (!val) return
              const doc = docs.find(d => d.id === val)
              if (doc) onAssign(doc.id, doc.name)
            }}
          >
            <option value="">Assign to…</option>
            {docs.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
        {deleteConfirmId === file.id ? (
          <>
            <button onClick={onDelete} className="btn-xs bg-red-600 text-white">Confirm</button>
            <button onClick={() => setDeleteConfirmId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
          </>
        ) : (
          <button onClick={() => setDeleteConfirmId(file.id)} className="btn-xs text-gray-400 hover:text-red-500">✕</button>
        )}
      </div>
    </div>
  )
}
