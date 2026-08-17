'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import type { Case } from '@/lib/types'

type Props = {
  caseItem: Case
}

export default function OpsNotifyPanel({ caseItem }: Props) {
  const { caseEmails, notifyOpsTeam } = useStore()
  const history = caseEmails.filter(e => e.caseId === caseItem.id && e.templateName === 'Ops Notification (test)')

  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sentOk, setSentOk] = useState(false)

  const handleSend = async () => {
    setSending(true)
    setError('')
    setSentOk(false)
    try {
      await notifyOpsTeam(caseItem)
      setSentOk(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send notification')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-2xl border border-amber-100 overflow-hidden bg-white">
      <div className="flex items-center gap-2.5 px-5 py-3.5 bg-amber-500 text-white">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <span className="text-sm font-semibold">Notify Operations Team (test)</span>
      </div>

      <div className="px-5 py-4 space-y-3">
        <p className="text-xs text-gray-500">
          Sends a fixed internal notification about this case to the ops distribution address. Manual trigger for now — not yet wired to case creation.
        </p>

        {error && <p className="text-xs text-red-500">{error}</p>}
        {sentOk && <p className="text-xs text-emerald-600">Notification sent.</p>}

        <button
          onClick={handleSend}
          disabled={sending}
          className="btn-xs bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send Test Notification'}
        </button>
      </div>

      {history.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5">Sent History</p>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <p className="text-gray-700 font-medium truncate">{h.subject}</p>
                  <p className="text-xs text-gray-400">To {h.toEmail} · {new Date(h.sentAt).toLocaleString()}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                  h.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                }`}>
                  {h.status === 'sent' ? 'Sent' : 'Failed'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
