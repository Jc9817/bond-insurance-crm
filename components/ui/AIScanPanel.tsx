'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import type { CaseFile } from '@/lib/types'
import Modal from './Modal'

type Props = {
  file: CaseFile
  onClose: () => void
}

export default function AIScanPanel({ file, onClose }: Props) {
  const { updateCaseFile, addActivityLog } = useStore()
  const { currentUser } = useAuth()
  const data = file.aiExtractedData
  const [done, setDone] = useState(false)
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null)

  const approve = () => {
    updateCaseFile(file.id, { aiStatus: 'Approved' })
    addActivityLog({
      caseId: file.caseId,
      actionType: 'AI_EXTRACTION_APPROVED',
      title: 'AI extraction approved',
      description: `Extracted data from ${file.fileName} approved`,
      changedBy: currentUser?.fullName ?? 'Unknown',
    })
    setDecision('approved')
    setDone(true)
  }

  const reject = () => {
    updateCaseFile(file.id, { aiStatus: 'Rejected' })
    addActivityLog({
      caseId: file.caseId,
      actionType: 'AI_EXTRACTION_REJECTED',
      title: 'AI extraction rejected',
      description: `Extracted data from ${file.fileName} rejected`,
      changedBy: currentUser?.fullName ?? 'Unknown',
    })
    setDecision('rejected')
    setDone(true)
  }

  return (
    <Modal isOpen onClose={onClose} title="AI Scan — Extracted Information" maxWidth="md">
      <div className="px-6 py-5">
        {/* File info */}
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
          <span className="text-lg">📄</span>
          <div>
            <p className="text-sm font-semibold text-gray-800">{file.fileName}</p>
            <p className="text-xs text-gray-400">{file.documentType}</p>
          </div>
        </div>

        {!done && data ? (
          <>
            <p className="text-xs text-gray-400 mb-4">
              The following information was extracted from this document. Please review carefully before approving.
            </p>

            <div className="space-y-2 mb-6">
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-0.5">Contractor / Client</p>
                <p className="text-sm font-medium text-gray-800">{data.customerName || '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-0.5">Project Title / Description of Works</p>
                <p className="text-sm font-medium text-gray-800 leading-snug">{data.projectName || '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-0.5">Bond / Insurance Type</p>
                <p className="text-sm font-medium text-gray-800">{data.caseType || '—'}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-blue-400 mb-0.5">Contract Value</p>
                  <p className="text-sm font-bold text-blue-800">{data.amount || '—'}</p>
                </div>
                <div className="bg-violet-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-violet-400 mb-0.5">Bond Value</p>
                  <p className="text-sm font-bold text-violet-800">{data.bondValue || '—'}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-0.5">Bond / Policy Expiry</p>
                <p className="text-sm font-medium text-gray-800">{data.expiryDate || '—'}</p>
              </div>
              {data.notes && (
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-400 mb-0.5">Reference / Notes</p>
                  <p className="text-sm font-medium text-gray-800">{data.notes}</p>
                </div>
              )}
            </div>

            {/* Extended fields from custom prompts */}
            {data.raw && <ExtendedFields raw={data.raw} />}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
              <p className="text-xs text-amber-700">
                <strong>Important:</strong> AI extraction may contain errors. Always verify extracted data against the original document before approving.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={reject} className="btn-secondary flex-1">
                Reject
              </button>
              <button onClick={approve} className="btn-primary flex-1">
                Approve & Save
              </button>
            </div>
          </>
        ) : done ? (
          <div className="text-center py-6">
            {decision === 'approved' ? (
              <>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-gray-800">Approved</p>
                <p className="text-sm text-gray-400 mt-1">Extracted data has been saved to this file record.</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-gray-800">Rejected</p>
                <p className="text-sm text-gray-400 mt-1">Extraction was rejected. You may re-scan this file later.</p>
              </>
            )}
            <button onClick={onClose} className="btn-primary mt-5 px-8">Close</button>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">No extracted data available.</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Extended fields renderer for custom-prompt responses ────────────────────

const STANDARD_KEYS = new Set(['customerName', 'projectName', 'caseType', 'amount', 'bondValue', 'expiryDate', 'notes'])

function formatRMDisplay(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  const num = Number(value)
  if (isNaN(num)) return String(value)
  return `RM ${num.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function isMoneyKey(key: string): boolean {
  return /value|compensation|liability|amount|sum|price|cost/i.test(key)
}

function ExtendedFields({ raw }: { raw: Record<string, unknown> }) {
  const extras = Object.entries(raw).filter(([k]) => !STANDARD_KEYS.has(k))
  if (extras.length === 0) return null

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Additional Extracted Fields</p>
      <div className="space-y-2">
        {extras.map(([key, value]) => {
          if (value === null || value === undefined) return null

          // Nested object (e.g. cover_duration)
          if (typeof value === 'object' && !Array.isArray(value)) {
            const nested = value as Record<string, unknown>
            return (
              <div key={key} className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1.5">{formatLabel(key)}</p>
                <div className="space-y-1">
                  {Object.entries(nested).map(([nk, nv]) => (
                    <div key={nk} className="flex items-start gap-2">
                      <span className="text-xs text-gray-400 shrink-0 w-40">{formatLabel(nk)}</span>
                      <span className="text-xs font-medium text-gray-700">{nv !== null && nv !== undefined && nv !== '' ? String(nv) : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          }

          // Note/explanation string paired with a numeric field (e.g. workmen_compensation_note)
          if (key.endsWith('_note') || key.endsWith('_reason')) {
            return (
              <div key={key} className="bg-blue-50 rounded-xl px-4 py-2.5">
                <p className="text-xs text-blue-400 mb-0.5">{formatLabel(key)}</p>
                <p className="text-xs text-blue-700">{String(value)}</p>
              </div>
            )
          }

          // Numeric monetary value
          if (typeof value === 'number' && isMoneyKey(key)) {
            return (
              <div key={key} className="bg-violet-50 rounded-xl px-4 py-3">
                <p className="text-xs text-violet-400 mb-0.5">{formatLabel(key)}</p>
                <p className="text-sm font-bold text-violet-800">{formatRMDisplay(value)}</p>
              </div>
            )
          }

          // Plain value
          return (
            <div key={key} className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">{formatLabel(key)}</p>
              <p className="text-sm font-medium text-gray-800">{String(value) || '—'}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
