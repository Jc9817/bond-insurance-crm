'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import type { SubmissionLetterDocItem } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type SubFieldValues = {
  directorName: string
  guarantorName: string
  bankName: string
  statementPeriod: string
  premiumAmount: string
}

type HeaderForm = {
  letterDate: string
  insurerName: string
  insurerBranch: string
  bondAmount: string
  contractSum: string
  projectName: string
  principal: string
  contractor: string
  agentName: string
  agentCode: string
}

// Resolved + user-editable letter content
type LetterContent = {
  subjectLine: string
  letterBody: string            // full body text with {{docList}} placeholder
  docItemTexts: Record<string, string>  // docItem.id → resolved line text
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayFormatted(): string {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function formatRM(raw: string | number): string {
  if (!raw && raw !== 0) return ''
  const num = Number(String(raw).replace(/[^0-9.]/g, ''))
  if (isNaN(num)) return String(raw)
  return `RM${num.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function resolveVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}

function buildVars(header: HeaderForm, sub: SubFieldValues): Record<string, string> {
  return {
    contractor: header.contractor,
    principal: header.principal,
    bondAmount: formatRM(header.bondAmount),
    contractSum: formatRM(header.contractSum),
    projectName: header.projectName,
    directorName: sub.directorName,
    guarantorName: sub.guarantorName,
    bankName: sub.bankName,
    statementPeriod: sub.statementPeriod,
    premiumAmount: formatRM(sub.premiumAmount),
  }
}

// Split the body at {{docList}} → [before, after]
function splitBody(body: string): [string, string] {
  const idx = body.indexOf('{{docList}}')
  if (idx === -1) return [body, '']
  return [body.slice(0, idx).trimEnd(), body.slice(idx + '{{docList}}'.length).trimStart()]
}

// ─── Editable body section (textarea when editing) ───────────────────────────

function BodySection({
  text, isEditing, onChange, className,
}: {
  text: string; isEditing: boolean; onChange: (v: string) => void; className?: string
}) {
  if (!text.trim() && !isEditing) return null
  if (isEditing) {
    return (
      <textarea
        className={`w-full bg-amber-50/50 border border-amber-200 rounded p-2 text-[13px] font-sans leading-relaxed resize-none focus:outline-none focus:border-amber-400 ${className ?? ''}`}
        rows={Math.max(3, text.split('\n').length + 1)}
        value={text}
        onChange={e => onChange(e.target.value)}
      />
    )
  }
  return (
    <div className={className}>
      {text.split(/\n\n+/).map((para, i) => (
        <p key={i} className="mb-4 last:mb-0 whitespace-pre-wrap">{para.trim()}</p>
      ))}
    </div>
  )
}

// Inline editable span for doc item lines
function EditableDocLine({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLSpanElement>(null)
  const last = useRef(value)

  useEffect(() => {
    if (ref.current && last.current !== value) {
      ref.current.textContent = value
      last.current = value
    }
  }, [value])

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={e => { const v = e.currentTarget.textContent ?? ''; last.current = v; onChange(v) }}
      className="outline outline-1 outline-amber-300 rounded px-0.5 -mx-0.5 focus:outline-2 focus:outline-amber-500 min-w-[4em] inline-block"
    >
      {value}
    </span>
  )
}

// ─── Letter Preview ───────────────────────────────────────────────────────────

function LetterPreview({
  header, content, checkedItemIds, docItems, isEditing, onContentChange,
}: {
  header: HeaderForm
  content: LetterContent
  checkedItemIds: string[]
  docItems: SubmissionLetterDocItem[]
  isEditing: boolean
  onContentChange: (patch: Partial<LetterContent>) => void
}) {
  const checkedDocs = docItems.filter(d => checkedItemIds.includes(d.id))
  const [bodyBefore, bodyAfter] = splitBody(content.letterBody)

  const updateBefore = (v: string) => {
    const after = splitBody(content.letterBody)[1]
    onContentChange({ letterBody: after ? `${v}\n\n{{docList}}\n\n${after}` : `${v}\n\n{{docList}}` })
  }
  const updateAfter = (v: string) => {
    const before = splitBody(content.letterBody)[0]
    onContentChange({ letterBody: `${before}\n\n{{docList}}\n\n${v}` })
  }

  return (
    <div id="letter-preview" className="bg-white p-12 text-[13px] font-sans leading-relaxed text-gray-900 min-h-[1056px] shadow-sm border border-gray-200">

      {/* Date */}
      <p className="mb-6">{header.letterDate}</p>

      {/* Insurer */}
      <p className="font-bold uppercase">{header.insurerName || 'INSURER NAME'}</p>
      {header.insurerBranch && <p className="font-bold uppercase">{header.insurerBranch}</p>}

      {/* Subject line + header table */}
      <div className="my-6">
        {isEditing ? (
          <input
            className="w-full bg-amber-50/50 border border-amber-200 rounded p-1.5 font-bold uppercase text-[13px] mb-3 focus:outline-none focus:border-amber-400"
            value={content.subjectLine}
            onChange={e => onContentChange({ subjectLine: e.target.value })}
          />
        ) : (
          <p className="font-bold uppercase mb-3">{content.subjectLine}</p>
        )}

        <table className="border-collapse">
          <tbody>
            <tr>
              <td className="font-bold pr-4 align-top whitespace-nowrap">CONTRACT SUM</td>
              <td className="font-bold pr-3 align-top">:</td>
              <td className="font-bold align-top">{formatRM(header.contractSum) || '__________'}</td>
            </tr>
            <tr>
              <td className="font-bold pr-4 align-top whitespace-nowrap pt-1">PROJECT</td>
              <td className="font-bold pr-3 align-top pt-1">:</td>
              <td className="font-bold align-top pt-1 uppercase">{header.projectName || '__________'}</td>
            </tr>
            <tr><td className="pt-3" colSpan={3}></td></tr>
            <tr>
              <td className="font-bold pr-4 align-top whitespace-nowrap">PRINCIPAL</td>
              <td className="font-bold pr-3 align-top">:</td>
              <td className="font-bold align-top uppercase">{header.principal || '__________'}</td>
            </tr>
            <tr>
              <td className="font-bold pr-4 align-top whitespace-nowrap pt-1 underline">CONTRACTOR</td>
              <td className="font-bold pr-3 align-top pt-1">:</td>
              <td className="font-bold align-top pt-1 underline uppercase">{header.contractor || '__________'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Body — before docList */}
      <BodySection text={bodyBefore} isEditing={isEditing} onChange={updateBefore} className="mb-4" />

      {/* Numbered doc list */}
      {checkedDocs.length > 0 ? (
        <ol className="list-decimal list-inside space-y-1.5 my-4 pl-2">
          {checkedDocs.map(item => (
            <li key={item.id} className="leading-snug">
              {isEditing ? (
                <EditableDocLine
                  value={content.docItemTexts[item.id] ?? ''}
                  onChange={v => onContentChange({ docItemTexts: { ...content.docItemTexts, [item.id]: v } })}
                />
              ) : (
                <span>{content.docItemTexts[item.id] ?? ''}</span>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="italic text-gray-400 my-4">(No documents selected)</p>
      )}

      {/* Body — after docList */}
      <BodySection text={bodyAfter} isEditing={isEditing} onChange={updateAfter} className="mt-4" />

      {/* Agent */}
      <div className="mt-8">
        <p className="font-semibold uppercase">{header.agentName || '__________'}</p>
        {header.agentCode && <p>{header.agentCode}</p>}
      </div>
    </div>
  )
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

function CheckRow({
  checked, onChange, label, children,
}: {
  checked: boolean; onChange: (v: boolean) => void; label: string; children?: React.ReactNode
}) {
  return (
    <div className={`rounded-xl border p-3 transition-colors ${checked ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-white'}`}>
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input type="checkbox" className="mt-0.5 shrink-0 accent-blue-600" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="text-sm text-gray-700 leading-snug">{label}</span>
      </label>
      {checked && children && <div className="mt-2 pl-5 space-y-2">{children}</div>}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SubmissionLetterPage() {
  const { id } = useParams<{ id: string }>()
  const { cases, settingsData, submissionLetterTemplates } = useStore()
  const { currentUser } = useAuth()
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const caseItem = cases.find(c => c.id === id)
  const insurerNames = settingsData.insurers.filter(i => i.isActive).map(i => i.name)
  const activeTemplates = submissionLetterTemplates.filter(t => t.isActive)

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => activeTemplates[0]?.id ?? '')
  const activeTemplate = submissionLetterTemplates.find(t => t.id === selectedTemplateId) ?? activeTemplates[0] ?? null

  const [header, setHeader] = useState<HeaderForm>(() => ({
    letterDate: todayFormatted(),
    insurerName: '',
    insurerBranch: '',
    bondAmount: '',
    contractSum: caseItem ? String(caseItem.amount || '') : '',
    projectName: caseItem?.caseTitle ?? '',
    principal: caseItem?.bondPrincipal ?? '',
    contractor: caseItem?.customerName ?? '',
    agentName: currentUser?.fullName ?? caseItem?.personInCharge ?? '',
    agentCode: '',
  }))

  const [subFields, setSubFields] = useState<SubFieldValues>({
    directorName: '',
    guarantorName: '',
    bankName: 'MAYBANK Islamic',
    statementPeriod: '',
    premiumAmount: '',
  })

  const [checkedItemIds, setCheckedItemIds] = useState<string[]>([])

  const [content, setContent] = useState<LetterContent>({
    subjectLine: '', letterBody: '', docItemTexts: {},
  })

  const vars = buildVars(header, subFields)
  useEffect(() => {
    if (!activeTemplate || isEditing) return
    const docItemTexts: Record<string, string> = {}
    activeTemplate.docItems.forEach(item => {
      docItemTexts[item.id] = resolveVars(item.textTemplate, vars)
    })
    setContent({
      subjectLine: resolveVars(activeTemplate.subjectLine, vars),
      letterBody: resolveVars(activeTemplate.letterBody, vars),
      docItemTexts,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId, header.contractor, header.principal, header.bondAmount, header.contractSum, header.projectName, subFields, isEditing])

  useEffect(() => {
    if (!activeTemplate) return
    setCheckedItemIds(activeTemplate.docItems.filter(d => d.defaultChecked).map(d => d.id))
    setIsEditing(false)
  }, [selectedTemplateId, activeTemplate])

  const setH = <K extends keyof HeaderForm>(k: K, v: HeaderForm[K]) => setHeader(p => ({ ...p, [k]: v }))
  const setSF = <K extends keyof SubFieldValues>(k: K, v: string) => setSubFields(p => ({ ...p, [k]: v }))
  const toggleItem = (itemId: string, on: boolean) =>
    setCheckedItemIds(prev => on ? [...prev, itemId] : prev.filter(x => x !== itemId))

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const docLines = (activeTemplate?.docItems ?? [])
        .filter(d => checkedItemIds.includes(d.id))
        .map(d => content.docItemTexts[d.id] ?? '')

      const res = await fetch('/api/generate-submission-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          header,
          content: { subjectLine: content.subjectLine, letterBody: content.letterBody, docLines },
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const contractor = header.contractor.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_')
      a.download = `Submission_Letter_${contractor || 'Bond'}.docx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to download. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  if (!caseItem) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Case not found.</p>
        <Link href="/cases" className="text-blue-600 hover:underline text-sm mt-3 inline-block">← Back to Cases</Link>
      </div>
    )
  }

  const docItems = activeTemplate?.docItems ?? []

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #letter-preview, #letter-preview * { visibility: visible !important; }
          #letter-preview { position: fixed; top: 0; left: 0; width: 100%; padding: 40px !important; box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <Link href={`/cases/${id}`} className="text-sm text-gray-400 hover:text-gray-600">← {caseItem.caseTitle}</Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-700">Submission Letter</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(p => !p)}
              className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border font-medium transition-colors ${
                isEditing
                  ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {isEditing ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                  Editing — click to Lock
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  Locked — click to Edit
                </>
              )}
            </button>
            <button onClick={() => window.print()} className="btn-secondary flex items-center gap-1.5 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / PDF
            </button>
            <button onClick={handleDownload} disabled={downloading} className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-60">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {downloading ? 'Generating…' : 'Download .docx'}
            </button>
          </div>
        </div>

        <div className="flex print:block">
          {/* ── Form panel ── */}
          <div className="w-[380px] shrink-0 border-r border-gray-200 bg-white overflow-y-auto h-[calc(100vh-61px)] print:hidden">
            <div className="p-6 space-y-6">

              <section>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Template</h3>
                {activeTemplates.length === 0 ? (
                  <p className="text-sm text-gray-400">No active templates. <Link href="/settings" className="text-blue-600 hover:underline">Configure in Settings →</Link></p>
                ) : (
                  <select className="input" value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
                    {activeTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
                {isEditing && (
                  <div className="mt-2 flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                    <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-xs text-amber-700">Letter is unlocked. Edit text directly in the preview on the right.</p>
                  </div>
                )}
              </section>

              <section>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Letter Details</h3>
                <div className="space-y-3">
                  <Field label="Date">
                    <input className="input" value={header.letterDate} onChange={e => setH('letterDate', e.target.value)} placeholder="DD/MM/YYYY" />
                  </Field>
                  <Field label="Insurer Name">
                    {insurerNames.length > 0 ? (
                      <select className="input" value={header.insurerName} onChange={e => setH('insurerName', e.target.value)}>
                        <option value="">— Select insurer —</option>
                        {insurerNames.map(n => <option key={n} value={n}>{n}</option>)}
                        <option value="__custom__">Other (type below)</option>
                      </select>
                    ) : (
                      <input className="input" value={header.insurerName} onChange={e => setH('insurerName', e.target.value)} placeholder="e.g. ALLIANZ GENERAL INSURANCE" />
                    )}
                    {header.insurerName === '__custom__' && (
                      <input className="input mt-2" placeholder="Enter insurer name…" onChange={e => setH('insurerName', e.target.value)} autoFocus />
                    )}
                  </Field>
                  <Field label="Insurer Branch">
                    <input className="input" value={header.insurerBranch} onChange={e => setH('insurerBranch', e.target.value)} placeholder="e.g. KUALA LUMPUR BRANCH" />
                  </Field>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Bond Details</h3>
                <div className="space-y-3">
                  <Field label="Bond Amount (RM)">
                    <input className="input" type="number" min={0} step="0.01" value={header.bondAmount} onChange={e => setH('bondAmount', e.target.value)} />
                  </Field>
                  <Field label="Contract Sum (RM)">
                    <input className="input" type="number" min={0} step="0.01" value={header.contractSum} onChange={e => setH('contractSum', e.target.value)} />
                  </Field>
                  <Field label="Project Name">
                    <textarea className="input" rows={3} value={header.projectName} onChange={e => setH('projectName', e.target.value)} />
                  </Field>
                  <Field label="Principal">
                    <input className="input" value={header.principal} onChange={e => setH('principal', e.target.value)} placeholder="e.g. DEWAN BANDARAYA KUALA LUMPUR" />
                  </Field>
                  <Field label="Contractor">
                    <input className="input" value={header.contractor} onChange={e => setH('contractor', e.target.value)} />
                  </Field>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Documents to Submit</h3>
                {docItems.length === 0 && <p className="text-sm text-gray-400 italic">No document items in this template.</p>}
                <div className="space-y-2">
                  {docItems.map(item => {
                    const checked = checkedItemIds.includes(item.id)
                    return (
                      <CheckRow key={item.id} checked={checked} onChange={v => toggleItem(item.id, v)} label={item.labelInForm}>
                        {item.subFieldType === 'director' && (
                          <Field label="Director / Signatory Name">
                            <input className="input text-sm" value={subFields.directorName} onChange={e => setSF('directorName', e.target.value)} placeholder="Full name as per NRIC" />
                          </Field>
                        )}
                        {item.subFieldType === 'guarantor' && (
                          <Field label="Guarantor Name">
                            <input className="input text-sm" value={subFields.guarantorName} onChange={e => setSF('guarantorName', e.target.value)} placeholder="Full name as per NRIC" />
                          </Field>
                        )}
                        {item.subFieldType === 'bank' && (
                          <div className="grid grid-cols-2 gap-2">
                            <Field label="Bank Name">
                              <input className="input text-sm" value={subFields.bankName} onChange={e => setSF('bankName', e.target.value)} />
                            </Field>
                            <Field label="Statement Period">
                              <input className="input text-sm" value={subFields.statementPeriod} onChange={e => setSF('statementPeriod', e.target.value)} placeholder="e.g. JAN – MAR 2026" />
                            </Field>
                          </div>
                        )}
                        {item.subFieldType === 'premium' && (
                          <Field label="Premium Amount (RM)">
                            <input className="input text-sm" type="number" min={0} step="0.01" value={subFields.premiumAmount} onChange={e => setSF('premiumAmount', e.target.value)} />
                          </Field>
                        )}
                      </CheckRow>
                    )
                  })}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Agent Info</h3>
                <div className="space-y-3">
                  <Field label="Agent Name">
                    <input className="input" value={header.agentName} onChange={e => setH('agentName', e.target.value)} />
                  </Field>
                  <Field label="Agent Code">
                    <input className="input" value={header.agentCode} onChange={e => setH('agentCode', e.target.value)} placeholder="e.g. KL 40465" />
                  </Field>
                </div>
              </section>

            </div>
          </div>

          {/* ── Preview panel ── */}
          <div className="flex-1 overflow-y-auto h-[calc(100vh-61px)] bg-gray-100 print:p-0 print:h-auto">
            {isEditing && (
              <div className="sticky top-0 z-10 bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2 text-xs text-amber-700 font-medium">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
                Edit mode — highlighted areas are editable. Lock to return to auto-sync with form values.
              </div>
            )}
            <div className="max-w-[794px] mx-auto p-8">
              <LetterPreview
                header={header}
                content={content}
                checkedItemIds={checkedItemIds}
                docItems={docItems}
                isEditing={isEditing}
                onContentChange={patch => setContent(prev => ({
                  ...prev, ...patch,
                  docItemTexts: patch.docItemTexts ? { ...prev.docItemTexts, ...patch.docItemTexts } : prev.docItemTexts,
                }))}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
