'use client'

import { useState } from 'react'
import type { Case, WorkflowStep } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

type EmailEntry = {
  id: string
  insurerName: string
  emailTo: string
  subject: string
  body: string
  status: 'draft' | 'sending' | 'sent' | 'error'
  sentAt?: string
  errorMsg?: string
}

type Props = {
  caseItem: Case
  step: WorkflowStep
  customerName: string
}

export default function QuotationEmailPanel({ caseItem, step, customerName }: Props) {
  const [entries, setEntries] = useState<EmailEntry[]>([
    {
      id: '1',
      insurerName: '',
      emailTo: '',
      subject: '',
      body: '',
      status: 'draft',
    },
  ])
  const [generating, setGenerating] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string>('1')

  const updateEntry = (id: string, patch: Partial<EmailEntry>) =>
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))

  const addInsurer = () => {
    const newId = String(Date.now())
    setEntries(prev => [...prev, { id: newId, insurerName: '', emailTo: '', subject: '', body: '', status: 'draft' }])
    setExpandedId(newId)
  }

  const removeEntry = (id: string) =>
    setEntries(prev => prev.filter(e => e.id !== id))

  const generateEmail = async (entry: EmailEntry) => {
    setGenerating(entry.id)
    try {
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseTitle: caseItem.caseTitle,
          caseType: caseItem.caseType,
          customerName,
          amount: formatCurrency(caseItem.amount),
          personInCharge: caseItem.personInCharge,
          insurerName: entry.insurerName,
          notes: '',
          aiEmailPrompt: step.aiEmailPrompt,
        }),
      })
      if (res.ok) {
        const { subject, body } = await res.json()
        updateEntry(entry.id, { subject, body })
      }
    } finally {
      setGenerating(null)
    }
  }

  const sendEmail = async (entry: EmailEntry) => {
    if (!entry.emailTo || !entry.subject || !entry.body) return
    updateEntry(entry.id, { status: 'sending' })
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailTo: entry.emailTo,
          emailSubject: entry.subject,
          emailBody: entry.body,
        }),
      })
      if (res.ok) {
        updateEntry(entry.id, { status: 'sent', sentAt: new Date().toISOString() })
      } else {
        const { error } = await res.json()
        updateEntry(entry.id, { status: 'error', errorMsg: error ?? 'Send failed' })
      }
    } catch (err) {
      updateEntry(entry.id, { status: 'error', errorMsg: 'Network error' })
    }
  }

  const sentCount = entries.filter(e => e.status === 'sent').length

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-blue-600 text-white">
        <div className="flex items-center gap-2.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-semibold">AI Quotation Email</span>
        </div>
        <div className="flex items-center gap-3">
          {sentCount > 0 && (
            <span className="text-xs bg-white/20 rounded-full px-2.5 py-0.5 font-medium">
              {sentCount} sent
            </span>
          )}
          <button
            onClick={addInsurer}
            className="text-xs bg-white/20 hover:bg-white/30 transition-colors rounded-lg px-3 py-1.5 font-medium flex items-center gap-1"
          >
            + Add Insurer
          </button>
        </div>
      </div>

      {/* Case context strip */}
      <div className="px-5 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center gap-4 text-xs text-blue-700 flex-wrap">
        <span className="font-medium">{caseItem.caseTitle}</span>
        <span>·</span>
        <span>{customerName}</span>
        {caseItem.caseType && <><span>·</span><span>{caseItem.caseType}</span></>}
        {caseItem.amount > 0 && <><span>·</span><span className="font-semibold">{formatCurrency(caseItem.amount)}</span></>}
      </div>

      {/* Insurer entries */}
      <div className="divide-y divide-blue-100">
        {entries.map((entry, idx) => {
          const isExpanded = expandedId === entry.id
          const isGen = generating === entry.id
          const isSent = entry.status === 'sent'
          const isSending = entry.status === 'sending'

          return (
            <div key={entry.id} className="bg-white">
              {/* Entry header row */}
              <button
                onClick={() => setExpandedId(isExpanded ? '' : entry.id)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                  isSent ? 'bg-green-500 text-white' : 'bg-blue-100 text-blue-700'
                }`}>
                  {isSent ? '✓' : idx + 1}
                </span>
                <span className="text-sm font-medium text-gray-800 flex-1 truncate">
                  {entry.insurerName || `Insurer ${idx + 1}`}
                </span>
                {entry.emailTo && <span className="text-xs text-gray-400 truncate hidden sm:block">{entry.emailTo}</span>}
                {isSent && <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium shrink-0">Sent</span>}
                {entry.status === 'error' && <span className="text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5 font-medium shrink-0">Error</span>}
                <svg className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded form */}
              {isExpanded && (
                <div className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Insurer / Company Name</label>
                      <input
                        className="input"
                        value={entry.insurerName}
                        onChange={e => updateEntry(entry.id, { insurerName: e.target.value })}
                        placeholder="e.g. Allianz, Etiqa, RHB Insurance"
                        disabled={isSent}
                      />
                    </div>
                    <div>
                      <label className="label">Recipient Email *</label>
                      <input
                        className="input"
                        type="email"
                        value={entry.emailTo}
                        onChange={e => updateEntry(entry.id, { emailTo: e.target.value })}
                        placeholder="underwriter@insurer.com"
                        disabled={isSent}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="label mb-0">Subject</label>
                      <button
                        onClick={() => generateEmail(entry)}
                        disabled={isGen || isSent}
                        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                      >
                        {isGen ? (
                          <>
                            <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                            Generating…
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.75 3.75 0 01-5.303 0l-.347-.347z" />
                            </svg>
                            Generate with AI
                          </>
                        )}
                      </button>
                    </div>
                    <input
                      className="input"
                      value={entry.subject}
                      onChange={e => updateEntry(entry.id, { subject: e.target.value })}
                      placeholder="Quotation Request — Customer Name | Bond Type"
                      disabled={isSent}
                    />
                  </div>

                  <div>
                    <label className="label">Email Body</label>
                    <textarea
                      className="input min-h-[160px] text-sm leading-relaxed resize-y"
                      value={entry.body}
                      onChange={e => updateEntry(entry.id, { body: e.target.value })}
                      placeholder="Click 'Generate with AI' to auto-compose, or type your message here…"
                      disabled={isSent}
                    />
                  </div>

                  {entry.status === 'error' && entry.errorMsg && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{entry.errorMsg}</p>
                  )}

                  {isSent && entry.sentAt && (
                    <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Email sent at {new Date(entry.sentAt).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    {!isSent && (
                      <button
                        onClick={() => sendEmail(entry)}
                        disabled={isSending || !entry.emailTo || !entry.subject || !entry.body}
                        className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSending ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Sending…
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                            Send Email
                          </>
                        )}
                      </button>
                    )}
                    {entries.length > 1 && !isSent && (
                      <button
                        onClick={() => removeEntry(entry.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
