'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { formatFileSize } from '@/lib/utils'
import { isInlineFile, isStorageFile, resolveFileUrl } from '@/lib/storage'

// One viewer for every file in DocFlow (case checklist, quotation documents,
// Unassigned Inbox). Files live in the private bucket and open through a
// short-lived signed URL. Rows not yet moved out of the database (base64
// data: URLs, see scripts/move-base64-files.mjs) still open, via a blob URL.

export type ViewableFile = {
  fileName: string
  fileSize: number
  fileType: string        // label shown in the header: "PDF" or a MIME type
  fileRef?: string        // the row's file_data_url
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']

function kindOf(file: ViewableFile): 'pdf' | 'image' | 'other' {
  const ext = file.fileName.split('.').pop()?.toLowerCase() ?? ''
  const mime = isInlineFile(file.fileRef) ? file.fileRef!.slice(5, file.fileRef!.indexOf(';')) : file.fileType.toLowerCase()
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf'
  if (IMAGE_EXTS.includes(ext) || mime.startsWith('image/')) return 'image'
  return 'other'
}

function inlineToBlobUrl(dataUrl: string): string {
  const [header, b64] = dataUrl.split(',')
  const mimeType = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'
  const bytes = atob(b64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return URL.createObjectURL(new Blob([arr], { type: mimeType }))
}

function clickDownload(href: string, fileName: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/** Downloads a file to the user's computer. */
export async function downloadFile(file: ViewableFile) {
  if (!file.fileRef) return
  if (!isStorageFile(file.fileRef)) {
    clickDownload(file.fileRef, file.fileName)
    return
  }
  let signedUrl: string
  try {
    signedUrl = await resolveFileUrl(createClient(), file.fileRef)
  } catch (err) {
    console.error('[Storage] Signed URL failed:', err)
    alert('Could not open this file. Please try again.')
    return
  }
  // Fetch as a blob so the browser saves it under the original name
  try {
    const blobUrl = URL.createObjectURL(await (await fetch(signedUrl)).blob())
    clickDownload(blobUrl, file.fileName)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
  } catch {
    window.open(signedUrl, '_blank')
  }
}

const DownloadIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

const Spinner = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center h-48 gap-2 text-gray-400">
    <span className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
    <span className="text-sm">{label}</span>
  </div>
)

export default function FileViewerModal({ file, onClose }: { file: ViewableFile; onClose: () => void }) {
  const kind = kindOf(file)
  const inline = isInlineFile(file.fileRef)

  // Browsers block large data: URIs in iframes — show inline files as a blob URL
  const inlineUrl = useMemo(
    () => (inline && kind !== 'other' ? inlineToBlobUrl(file.fileRef!) : null),
    [inline, kind, file.fileRef],
  )
  useEffect(() => () => { if (inlineUrl) URL.revokeObjectURL(inlineUrl) }, [inlineUrl])

  // Stored files: the bucket is private, so preview through a short-lived signed URL
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!file.fileRef || inline || kind === 'other') return
    let cancelled = false
    resolveFileUrl(createClient(), file.fileRef)
      .then(url => { if (!cancelled) setSignedUrl(url) })
      .catch(err => { console.error('[Storage] Signed URL failed:', err); if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [file.fileRef, inline, kind])

  const src = inlineUrl ?? signedUrl

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 shrink-0">{file.fileType}</span>
            <p className="text-sm font-semibold text-gray-800 truncate">{file.fileName}</p>
            <span className="text-xs text-gray-400 shrink-0">{formatFileSize(file.fileSize)}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {file.fileRef && (
              <button
                onClick={() => downloadFile(file)}
                className="flex items-center gap-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                Download
              </button>
            )}
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors text-base leading-none">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          {!file.fileRef || failed ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <p className="text-sm">File not available</p>
            </div>
          ) : kind === 'other' ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700 mb-1">In-browser preview not available for {file.fileType} files</p>
                <p className="text-xs text-gray-400 mb-4">Download the file to open it in the appropriate application</p>
                <button
                  onClick={() => downloadFile(file)}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  <DownloadIcon className="w-4 h-4" />
                  Download {file.fileName}
                </button>
              </div>
            </div>
          ) : !src ? (
            <Spinner label="Loading file…" />
          ) : kind === 'image' ? (
            <div className="flex items-center justify-center p-6 bg-gray-50 min-h-[300px]">
              <img src={src} alt={file.fileName} className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-sm" />
            </div>
          ) : (
            <iframe src={src} className="w-full h-[75vh] border-0" title={file.fileName} />
          )}
        </div>
      </div>
    </div>
  )
}
