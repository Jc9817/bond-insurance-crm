'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { useStore } from '@/lib/store'
import type { Case } from '@/lib/types'

type Props = {
  caseItem: Pick<Case, 'id' | 'caseTitle' | 'caseNumber'>
  onClose: () => void
  onDeleted: () => void
}

// Permanent delete, confirmed twice. The final button sits on the opposite
// side from "Continue", so a double-click can't confirm both steps.
export default function DeleteCaseModal({ caseItem, onClose, onDeleted }: Props) {
  const { deleteCase } = useStore()
  const [step, setStep] = useState<1 | 2>(1)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const close = () => { if (!deleting) onClose() }
  const name = [caseItem.caseNumber, caseItem.caseTitle].filter(Boolean).join(' ')

  const confirm = async () => {
    setDeleting(true)
    setError('')
    try {
      await deleteCase(caseItem.id)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setDeleting(false)
    }
  }

  return (
    <Modal isOpen onClose={close} title={step === 1 ? 'Delete Case' : 'Are you sure?'} maxWidth="sm">
      {step === 1 ? (
        <div className="px-6 py-5">
          <div className="bg-red-50 rounded-xl p-4 mb-5">
            <p className="text-sm font-semibold text-red-800 mb-1">Delete this case?</p>
            <p className="text-sm text-red-700">
              <span className="font-bold">{name}</span> will be deleted with all its files, notes, follow-ups, emails, policies and history.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={close} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => setStep(2)}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      ) : (
        <div className="px-6 py-5">
          <div className="bg-red-50 rounded-xl p-4 mb-5">
            <p className="text-sm font-semibold text-red-800 mb-1">This cannot be undone.</p>
            <p className="text-sm text-red-700">
              <span className="font-bold">{name}</span> will be gone for good. To keep it but hide it, use Archive instead.
            </p>
          </div>
          {error && <p className="text-sm text-red-600 mb-3">Could not delete: {error}</p>}
          <div className="flex gap-3">
            <button
              onClick={confirm}
              disabled={deleting}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors"
            >
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button onClick={close} disabled={deleting} className="btn-secondary flex-1">No, keep it</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
