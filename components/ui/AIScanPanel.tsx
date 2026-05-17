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
      action: 'AI scan approved',
      user: currentUser?.fullName ?? 'Unknown',
      target: file.fileName,
    })
    setDecision('approved')
    setDone(true)
  }

  const reject = () => {
    updateCaseFile(file.id, { aiStatus: 'Rejected' })
    addActivityLog({
      action: 'AI scan rejected',
      user: currentUser?.fullName ?? 'Unknown',
      target: file.fileName,
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

            <div className="space-y-3 mb-6">
              {[
                { label: 'Customer Name', value: data.customerName },
                { label: 'Project / Bond Name', value: data.projectName },
                { label: 'Case Type', value: data.caseType },
                { label: 'Amount', value: data.amount },
                { label: 'Expiry Date', value: data.expiryDate },
                { label: 'Notes', value: data.notes },
              ].map(row => (
                <div key={row.label} className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-400 mb-0.5">{row.label}</p>
                  <p className="text-sm font-medium text-gray-800">{row.value || '—'}</p>
                </div>
              ))}
            </div>

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
