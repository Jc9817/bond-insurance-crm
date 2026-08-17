'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import type { Case } from '@/lib/types'

type Props = {
  caseItem: Case
  customerName: string
  defaultToEmail: string
}

function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match)
}

export default function CustomerEmailPanel({ caseItem, customerName, defaultToEmail }: Props) {
  const { emailTemplates, caseEmails, sendCaseEmail } = useStore()
  const activeTemplates = emailTemplates.filter(t => t.isActive)
  const history = caseEmails.filter(e => e.caseId === caseItem.id)

  const [templateId, setTemplateId] = useState('')
  const [toEmail, setToEmail] = useState(defaultToEmail)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sentOk, setSentOk] = useState(false)

  const vars = {
    customerName,
    caseTitle: caseItem.caseTitle,
    amount: formatCurrency(caseItem.amount),
    personInCharge: caseItem.personInCharge,
  }

  const handleTemplateSelect = (id: string) => {
    setTemplateId(id)
    setSentOk(false)
    setError('')
    const t = activeTemplates.find(x => x.id === id)
    if (t) {
      setSubject(renderTemplate(t.subject, vars))
      setBody(renderTemplate(t.body, vars))
    } else {
      setSubject('')
      setBody('')
    }
  }

  const handleSend = async () => {
    if (!toEmail.trim() || !subject.trim() || !body.trim()) return
    setSending(true)
    setError('')
    setSentOk(false)
    try {
      const template = activeTemplates.find(x => x.id === templateId)
      await sendCaseEmail({ caseId: caseItem.id, templateName: template?.name, toEmail, subject, body })
      setSentOk(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-2xl border border-blue-100 overflow-hidden bg-white">
      <div className="flex items-center gap-2.5 px-5 py-3.5 bg-blue-600 text-white">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="text-sm font-semibold">Send Email to Customer</span>
      </div>

      <div className="px-5 py-4 space-y-3">
        <div>
          <label className="label">Template</label>
          <select className="input text-sm" value={templateId} onChange={e => handleTemplateSelect(e.target.value)}>
            <option value="">Choose a template…</option>
            {activeTemplates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {activeTemplates.length === 0 && (
            <p className="text-xs text-gray-400 mt-1">No active templates. Add one in Settings → Email Templates.</p>
          )}
        </div>

        {templateId && (
          <>
            <div>
              <label className="label">To</label>
              <input className="input text-sm" value={toEmail} onChange={e => setToEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Subject</label>
              <input className="input text-sm" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div>
              <label className="label">Body</label>
              <textarea className="input text-sm min-h-[140px]" value={body} onChange={e => setBody(e.target.value)} />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}
            {sentOk && <p className="text-xs text-emerald-600">Email sent.</p>}

            <button
              onClick={handleSend}
              disabled={sending}
              className="btn-xs bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </>
        )}
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
