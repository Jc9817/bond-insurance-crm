'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
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

type BondDetails = {
  principalName: string
  bondAmount: number
  bondType: string
}

type Props = {
  caseItem: Case
  step: WorkflowStep
  customerName: string
}

export default function QuotationEmailPanel({ caseItem, step, customerName }: Props) {
  const { settingsData } = useStore()
  const insurerOptions = settingsData.insurers.filter(i => i.isActive).map(i => i.name)

  const [bondDetails, setBondDetails] = useState<BondDetails>({
    principalName: caseItem.bondPrincipal ?? customerName,
    bondAmount: caseItem.amount,
    bondType: caseItem.caseType,
  })
  const [entries, setEntries] = useState<EmailEntry[]>([])
  const [generating, setGenerating] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(entries.length === 0)
  const [addSelect, setAddSelect] = useState('')
  const [addCustomName, setAddCustomName] = useState('')
  const [addEmail, setAddEmail] = useState('')

  const resolvedInsurerName = addSelect === '__other__' ? addCustomName : addSelect

  const updateEntry = (id: string, patch: Partial<EmailEntry>) =>
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))

  const buildTemplate = (insurerName: string): { subject: string; body: string } => ({
    subject: `Quotation Request — ${bondDetails.bondType || caseItem.caseType} | ${bondDetails.principalName}`,
    body: `Dear ${insurerName} Team,

We are pleased to request a quotation on behalf of our client for the following:

Principal Name   : ${bondDetails.principalName}
Bond / Policy    : ${bondDetails.bondType || caseItem.caseType}
Sum Insured      : ${formatCurrency(bondDetails.bondAmount)}
Applicant        : ${customerName}
Person in Charge : ${caseItem.personInCharge}

Kindly provide us with your best premium offer at your earliest convenience. Please also include any applicable terms and conditions.

Should you require any further information or supporting documents, please do not hesitate to contact us.

Thank you.

Best regards,
${caseItem.personInCharge}
Bond Insurance CRM`,
  })

  const addInsurer = () => {
    const name = resolvedInsurerName.trim()
    const email = addEmail.trim()
    if (!name || !email) return
    const newId = String(Date.now())
    const template = buildTemplate(name)
    setEntries(prev => [...prev, { id: newId, insurerName: name, emailTo: email, ...template, status: 'draft' }])
    setExpandedId(newId)
    setAddSelect('')
    setAddCustomName('')
    setAddEmail('')
    setShowAddForm(false)
  }

  const generateEmail = async (entry: EmailEntry) => {
    setGenerating(entry.id)
    try {
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseTitle: caseItem.caseTitle,
          caseType: bondDetails.bondType || caseItem.caseType,
          customerName,
          principalName: bondDetails.principalName,
          bondAmount: formatCurrency(bondDetails.bondAmount),
          amount: formatCurrency(bondDetails.bondAmount),
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
        body: JSON.stringify({ emailTo: entry.emailTo, emailSubject: entry.subject, emailBody: entry.body }),
      })
      if (res.ok) {
        updateEntry(entry.id, { status: 'sent', sentAt: new Date().toISOString() })
      } else {
        const { error } = await res.json()
        updateEntry(entry.id, { status: 'error', errorMsg: error ?? 'Send failed' })
      }
    } catch {
      updateEntry(entry.id, { status: 'error', errorMsg: 'Network error' })
    }
  }

  const sentCount = entries.filter(e => e.status === 'sent').length
  const draftEntries = entries.filter(e => e.status === 'draft')

  return (
    <div className="rounded-2xl border border-blue-100 overflow-hidden bg-white">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-blue-600 text-white">
        <div className="flex items-center gap-2.5">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-semibold">Send Quotation Request to Insurers</span>
        </div>
        {sentCount > 0 && (
          <span className="text-xs bg-white/20 rounded-full px-2.5 py-0.5 font-medium">
            {sentCount} of {entries.length} sent
          </span>
        )}
      </div>

      {/* ── Bond Details — shared across all emails ── */}
      <div className="px-5 py-4 bg-blue-50 border-b border-blue-100">
        <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-0.5">Step 1 — Bond Details</p>
        <p className="text-xs text-blue-500 mb-3">These values will be inserted into every email automatically.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label text-blue-800">Principal Name *</label>
            <input
              className="input text-sm"
              value={bondDetails.principalName}
              onChange={e => setBondDetails(p => ({ ...p, principalName: e.target.value }))}
              placeholder="e.g. JUTA-KASEH JV Sdn Bhd"
            />
            <p className="text-xs text-blue-400 mt-1">Entity named on the bond document</p>
          </div>
          <div>
            <label className="label text-blue-800">Sum Insured (RM) *</label>
            <input
              className="input text-sm"
              type="number"
              min={0}
              value={bondDetails.bondAmount || ''}
              onChange={e => setBondDetails(p => ({ ...p, bondAmount: Number(e.target.value) }))}
              placeholder="0"
            />
            <p className="text-xs text-blue-400 mt-1">Bond amount to be covered</p>
          </div>
          <div>
            <label className="label text-blue-800">Bond / Policy Type</label>
            <input
              className="input text-sm"
              value={bondDetails.bondType}
              onChange={e => setBondDetails(p => ({ ...p, bondType: e.target.value }))}
              placeholder="e.g. Performance Bond"
            />
          </div>
        </div>
      </div>

      {/* ── Insurer entries ── */}
      {entries.length > 0 && (
        <div>
          <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Step 2 — Send to Insurers</p>
          </div>
          <div className="divide-y divide-gray-100">
            {entries.map((entry, idx) => {
              const isExpanded = expandedId === entry.id
              const isGen = generating === entry.id
              const isSent = entry.status === 'sent'
              const isSending = entry.status === 'sending'

              return (
                <div key={entry.id} className={`bg-white ${isSent ? 'opacity-80' : ''}`}>
                  {/* Row */}
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                      isSent ? 'bg-green-500 text-white' :
                      entry.status === 'error' ? 'bg-red-100 text-red-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {isSent ? '✓' : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{entry.insurerName}</p>
                      <p className="text-xs text-gray-400">{entry.emailTo}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isSent && (
                        <span className="text-xs bg-green-100 text-green-700 font-semibold rounded-full px-2.5 py-0.5">
                          Sent ✓
                        </span>
                      )}
                      {entry.status === 'error' && (
                        <span className="text-xs bg-red-100 text-red-600 rounded-full px-2.5 py-0.5">Failed</span>
                      )}
                      {!isSent && (
                        <button
                          onClick={() => sendEmail(entry)}
                          disabled={isSending || !entry.emailTo || !entry.subject || !entry.body}
                          className="flex items-center gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSending ? (
                            <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending…</>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                              Send
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        {isExpanded ? 'Hide' : isSent ? 'View' : 'Edit'}
                      </button>
                      {!isSent && (
                        <button
                          onClick={() => setEntries(prev => prev.filter(e => e.id !== entry.id))}
                          className="text-gray-300 hover:text-red-400 transition-colors text-sm leading-none"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded email editor */}
                  {isExpanded && (
                    <div className="mx-5 mb-4 rounded-xl border border-gray-200 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <p className="text-xs font-semibold text-gray-500">Email preview</p>
                        {!isSent && (
                          <button
                            onClick={() => generateEmail(entry)}
                            disabled={isGen}
                            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 font-medium transition-colors"
                          >
                            {isGen ? (
                              <><span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />Generating…</>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.75 3.75 0 01-5.303 0l-.347-.347z" />
                                </svg>
                                Customise with AI
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <div className="p-4 space-y-3 bg-white">
                        <div>
                          <label className="label">Subject</label>
                          <input
                            className="input text-sm"
                            value={entry.subject}
                            onChange={e => updateEntry(entry.id, { subject: e.target.value })}
                            disabled={isSent}
                          />
                        </div>
                        <div>
                          <label className="label">Email Body</label>
                          <textarea
                            className="input text-sm min-h-[220px] resize-y leading-relaxed font-mono"
                            value={entry.body}
                            onChange={e => updateEntry(entry.id, { body: e.target.value })}
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
                            Sent at {new Date(entry.sentAt).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                        {!isSent && (
                          <button
                            onClick={() => sendEmail(entry)}
                            disabled={isSending || !entry.emailTo || !entry.subject || !entry.body}
                            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                            {isSending ? 'Sending…' : 'Send Email'}
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
      )}

      {/* ── Add insurer form ── */}
      {showAddForm ? (
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-700 mb-3">
            {entries.length === 0 ? 'Step 2 — Add the insurers you want to contact' : 'Add another insurer'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">Insurer *</label>
              <select className="input text-sm" value={addSelect} onChange={e => { setAddSelect(e.target.value); setAddCustomName('') }}>
                <option value="">— Select insurer —</option>
                {insurerOptions.map(i => <option key={i} value={i}>{i}</option>)}
                <option value="__other__">Other (type below)</option>
              </select>
              {addSelect === '__other__' && (
                <input
                  className="input text-sm mt-2"
                  value={addCustomName}
                  onChange={e => setAddCustomName(e.target.value)}
                  placeholder="Enter insurer name…"
                  autoFocus
                />
              )}
            </div>
            <div>
              <label className="label">Recipient Email *</label>
              <input
                className="input text-sm"
                type="email"
                value={addEmail}
                onChange={e => setAddEmail(e.target.value)}
                placeholder="underwriter@insurer.com"
                onKeyDown={e => { if (e.key === 'Enter') addInsurer() }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={addInsurer}
              disabled={!resolvedInsurerName.trim() || !addEmail.trim()}
              className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add &amp; Generate Email
            </button>
            {entries.length > 0 && (
              <button
                onClick={() => { setShowAddForm(false); setAddSelect(''); setAddCustomName(''); setAddEmail('') }}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            A standard quotation email will be generated automatically using the bond details above.
          </p>
        </div>
      ) : (
        <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Insurer
          </button>
          {draftEntries.length > 1 && (
            <button
              onClick={() => draftEntries.forEach(e => sendEmail(e))}
              className="flex items-center gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send All ({draftEntries.length})
            </button>
          )}
        </div>
      )}
    </div>
  )
}
