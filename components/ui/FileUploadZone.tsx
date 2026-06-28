'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { formatFileSize } from '@/lib/utils'
import type { CaseFile } from '@/lib/types'

const ACCEPTED_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOCX',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLSX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
}

const FILE_ICONS: Record<string, string> = {
  PDF: '📄',
  DOCX: '📝',
  XLSX: '📊',
  JPG: '🖼️',
  PNG: '🖼️',
}

const AI_STATUS_COLORS: Record<string, string> = {
  'Not Scanned': 'bg-gray-100 text-gray-500',
  'Processing': 'bg-blue-100 text-blue-600',
  'Ready for Review': 'bg-amber-100 text-amber-700',
  'Approved': 'bg-green-100 text-green-700',
  'Rejected': 'bg-red-100 text-red-600',
}

type Props = {
  caseId: string
  documentTypes: string[]
  onScanReady?: (file: CaseFile) => void
}

export default function FileUploadZone({ caseId, documentTypes, onScanReady }: Props) {
  const { caseFiles, addCaseFile, deleteCaseFile, startAiScan, addActivityLog } = useStore()
  const { currentUser } = useAuth()
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const files = caseFiles.filter(f => f.caseId === caseId)

  const processFile = (rawFile: File, documentType: string) => {
    const fileType = ACCEPTED_TYPES[rawFile.type]
    if (!fileType) return

    setUploading(rawFile.name)
    setUploadProgress(0)

    const interval = setInterval(() => {
      setUploadProgress(p => {
        if (p >= 90) { clearInterval(interval); return 90 }
        return p + 20
      })
    }, 200)

    const reader = new FileReader()
    reader.onload = () => {
      const fileDataUrl = reader.result as string
      clearInterval(interval)
      setUploadProgress(100)
      setTimeout(() => {
        addCaseFile({
          caseId,
          fileName: rawFile.name,
          fileSize: rawFile.size,
          fileType,
          documentType,
          uploadedBy: currentUser?.fullName ?? 'Unknown',
          aiScanned: false,
          aiStatus: 'Not Scanned',
          aiExtractedData: null,
          fileDataUrl,
        })
        addActivityLog({
          actionType: 'DOCUMENT_UPLOADED',
          title: 'File uploaded',
          description: `${rawFile.name} uploaded`,
          changedBy: currentUser?.fullName ?? 'Unknown',
        })
        setUploading(null)
        setUploadProgress(0)
      }, 300)
    }
    reader.readAsDataURL(rawFile)
  }

  const handleView = (file: CaseFile) => {
    const url = file.fileDataUrl
    if (!url) return
    if (url.startsWith('http')) {
      window.open(url, '_blank')
    } else {
      try {
        const [header, data] = url.split(',')
        const mime = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'
        const bytes = atob(data)
        const arr = new Uint8Array(bytes.length)
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
        const blobUrl = URL.createObjectURL(new Blob([arr], { type: mime }))
        window.open(blobUrl, '_blank')
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000)
      } catch {
        window.open(url, '_blank')
      }
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file, documentTypes[0] ?? 'Other')
  }

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file, documentTypes[0] ?? 'Other')
    e.target.value = ''
  }

  const handleScan = (file: CaseFile) => {
    startAiScan(file.id)
    addActivityLog({
      actionType: 'AI_SCAN_STARTED',
      title: 'AI scan started',
      description: `AI scanning ${file.fileName}`,
      changedBy: currentUser?.fullName ?? 'Unknown',
    })
    // Notify parent when ready (poll for status change)
    const check = setInterval(() => {
      // parent handles via onScanReady after status update
    }, 100)
    setTimeout(() => {
      clearInterval(check)
      onScanReady?.(file)
    }, 2200)
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleFileInput}
        />
        <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm font-medium text-gray-600">Drop a file here or click to browse</p>
        <p className="text-xs text-gray-400 mt-1">PDF, DOCX, XLSX, JPG, PNG</p>
      </div>

      {/* Upload progress */}
      {uploading && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-medium text-blue-700 truncate max-w-[200px]">{uploading}</p>
            <span className="text-xs text-blue-500">{uploadProgress}%</span>
          </div>
          <div className="bg-blue-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(file => (
            <div key={file.id} className="bg-gray-50 rounded-xl p-3.5 flex items-start gap-3">
              <span className="text-xl shrink-0">{FILE_ICONS[file.fileType] ?? '📎'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{file.fileName}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-gray-400">{file.fileType}</span>
                  <span className="text-gray-200">·</span>
                  <span className="text-xs text-gray-400">{formatFileSize(file.fileSize)}</span>
                  <span className="text-gray-200">·</span>
                  <span className="text-xs text-gray-400">{file.documentType}</span>
                  <span className="text-gray-200">·</span>
                  <span className="text-xs text-gray-400">{file.uploadedBy}</span>
                </div>
                <span className={`inline-block mt-1.5 text-xs font-medium rounded-full px-2 py-0.5 ${AI_STATUS_COLORS[file.aiStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                  {file.aiStatus === 'Processing' ? (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 border border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />
                      Processing…
                    </span>
                  ) : file.aiStatus}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {file.fileDataUrl && (
                  <button
                    onClick={() => handleView(file)}
                    className="btn-xs bg-blue-50 text-blue-600 hover:bg-blue-100"
                  >
                    View
                  </button>
                )}
                {(file.aiStatus === 'Not Scanned' || file.aiStatus === 'Rejected') && (
                  <button
                    onClick={() => handleScan(file)}
                    className="btn-xs bg-violet-50 text-violet-700 hover:bg-violet-100"
                  >
                    AI Scan
                  </button>
                )}
                {file.aiStatus === 'Ready for Review' && onScanReady && (
                  <button
                    onClick={() => onScanReady(file)}
                    className="btn-xs bg-amber-50 text-amber-700 hover:bg-amber-100"
                  >
                    Review
                  </button>
                )}
                {deleteId === file.id ? (
                  <>
                    <button onClick={() => { deleteCaseFile(file.id); setDeleteId(null) }} className="btn-xs bg-red-600 text-white hover:bg-red-700">Confirm</button>
                    <button onClick={() => setDeleteId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setDeleteId(file.id)} className="btn-xs bg-red-50 text-red-500 hover:bg-red-100">Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && !uploading && (
        <p className="text-xs text-gray-400 text-center">No files uploaded yet.</p>
      )}
    </div>
  )
}
