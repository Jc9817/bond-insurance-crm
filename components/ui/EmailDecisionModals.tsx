'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { filedCases, type Case, type MailAttachment, type MailMessage, type MailPolicySuggestion } from '@/lib/types'
import { getWorkflowTemplate } from '@/lib/workflow'
import { formatDate, formatFileSize, todayDate } from '@/lib/utils'
import { attachmentForPolicy } from '@/lib/mail-links'
import Modal from '@/components/ui/Modal'
import SearchableSelect from '@/components/ui/SearchableSelect'
import CaseForm, { emptyCase } from '@/components/ui/CaseForm'
import { emptyCustomerForm } from '@/components/ui/CustomerForm'

// The decisions on the Emails screen that file something:
//   CreateCaseFromEmail  new case, pre-filled by the AI, checked by a person;
//                        then the chosen attachments are filed into it
//   FileEmailModal       'existing': everything to one existing case
//                        'split':    each attachment to its own case
// Filing itself happens on the server (/api/mail/file), which copies each
// attachment from the mailbox into the case. All of them can also add the
// policies and cover notes the AI found, linked to their files.

type Pick = { include: boolean; documentType: string; caseId: string }
type Picks = Record<string, Pick>

type FiledFile = { name: string; caseId: string; caseFileId: string }
export type FileResult = { filed: string[]; duplicates: string[]; failed: string[]; files: FiledFile[] }

/** Sends a filing decision to the server. */
async function fileEmail(mailId: string, picks: Picks, caseIds: string[]): Promise<FileResult> {
  const assignments = Object.entries(picks)
    .filter(([, p]) => p.include && p.caseId)
    .map(([attachmentId, p]) => ({ attachmentId, caseId: p.caseId, documentType: p.documentType }))
  const res = await fetch('/api/mail/file', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: mailId, assignments, caseIds }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Filing failed — please try again.')
  return data
}

export function describeResult(r: FileResult): string {
  const parts = [`${r.filed.length} document${r.filed.length === 1 ? '' : 's'} filed`]
  if (r.duplicates.length) parts.push(`${r.duplicates.length} already in the case`)
  if (r.failed.length) parts.push(`could not file: ${r.failed.join(', ')}`)
  return parts.join(' · ') + '.'
}

/** Names of the checklist documents across all active workflows, plus "Other". */
function useDocumentTypes(): string[] {
  const { workflowTemplates } = useStore()
  const names = workflowTemplates.filter(t => t.isActive)
    .flatMap(t => t.requiredDocuments.filter(d => d.isActive).map(d => d.name))
  return [...new Set(names)].sort().concat('Other')
}

function openCaseOptions(cases: Case[]) {
  return cases
    .filter(c => !c.archivedAt && c.currentStatus !== 'Done')
    .map(c => ({ value: c.id, label: `${c.caseNumber ? `${c.caseNumber} · ` : ''}${c.caseTitle} — ${c.customerName}` }))
}

/**
 * Starting choices for every attachment, with the AI's (or the earlier
 * filing's) document type and case. Ticked unless already filed — an
 * attachment can also go to more cases.
 */
function initialPicks(mail: MailMessage, defaultCaseId = ''): Picks {
  const s = mail.aiSuggestion
  return Object.fromEntries(mail.attachments.map(a => {
    const ai = s?.attachments[a.id]
    return [a.id, {
      include: !a.filedTo,
      documentType: a.filedTo?.documentType ?? ai?.documentType ?? 'Other',
      caseId: a.filedTo ? defaultCaseId : ai?.caseId ?? defaultCaseId,
    }]
  }))
}

function AttachmentPicks({ attachments, picks, setPicks, withCase }: {
  attachments: MailAttachment[]
  picks: Picks
  setPicks: (p: Picks) => void
  withCase: boolean
}) {
  const { cases } = useStore()
  const documentTypes = useDocumentTypes()
  const caseOptions = openCaseOptions(cases)
  const pending = attachments.filter(a => picks[a.id])
  if (pending.length === 0) return <p className="text-sm text-gray-400">This email has no attachments.</p>
  const caseNumber = (id: string) => {
    const c = cases.find(x => x.id === id)
    return c?.caseNumber ?? c?.caseTitle ?? 'a case'
  }

  const set = (id: string, p: Partial<Pick>) => setPicks({ ...picks, [id]: { ...picks[id], ...p } })
  return (
    <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
      {pending.map(a => {
        const p = picks[a.id]
        const types = documentTypes.includes(p.documentType) ? documentTypes : [p.documentType, ...documentTypes]
        return (
          <div key={a.id} className="p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={p.include} onChange={e => set(a.id, { include: e.target.checked })}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600" />
              <span className="text-sm font-medium text-gray-800 truncate">{a.name}</span>
              <span className="text-xs text-gray-400 shrink-0">{formatFileSize(a.size)}</span>
            </label>
            {a.filedTo && (
              <p className="text-xs text-green-700 pl-5">
                Already in {filedCases(a).map(f => caseNumber(f.caseId)).join(', ')} — tick to file it to this case too
              </p>
            )}
            {p.include && (
              <div className={`grid gap-2 ${withCase ? 'sm:grid-cols-2' : ''}`}>
                {withCase && (
                  <SearchableSelect value={p.caseId} options={caseOptions} onChange={v => set(a.id, { caseId: v })} placeholder="— Choose case —" />
                )}
                <select className="input text-sm" value={p.documentType} onChange={e => set(a.id, { documentType: e.target.value })}>
                  {types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Policies the AI found ───────────────────────────────────────────────────

const samePolicyNumber = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase()

/** Adds the chosen policies to their cases, each once. Returns how many were added. */
function useAddEmailPolicies(mail: MailMessage) {
  const { policies, addPolicy } = useStore()
  const isOnCase = (p: MailPolicySuggestion, caseId: string) =>
    !!p.policyNumber.trim() && policies.some(x => x.caseId === caseId && samePolicyNumber(x.policyNumber, p.policyNumber))

  const addPolicies = (wanted: { policy: MailPolicySuggestion; caseId: string }[], files: FiledFile[]) => {
    const toAdd = wanted.filter(w => !isOnCase(w.policy, w.caseId))
    for (const { policy: p, caseId } of toAdd) {
      addPolicy({
        caseId, policyType: p.policyType, policyNumber: p.policyNumber, insurer: p.insurer,
        sumInsured: p.sumInsured, startDate: p.startDate, expiryDate: p.expiryDate,
        status: p.expiryDate && p.expiryDate < todayDate() ? 'Expired' : 'Active',
        caseFileId: attachmentForPolicy(p.policyNumber, files.filter(f => f.caseId === caseId))?.caseFileId,
        notes: `From email "${mail.subject}"`,
      })
    }
    return toAdd.length
  }
  return { isOnCase, addPolicies }
}

const describePolicies = (added: number) => added ? ` ${added} polic${added === 1 ? 'y' : 'ies'} added.` : ''

function PolicyPicks({ policies, isOn, setOn, alreadyOnCase, caseChoice }: {
  policies: MailPolicySuggestion[]
  isOn: (i: number) => boolean
  setOn: (i: number, on: boolean) => void
  alreadyOnCase?: (i: number) => boolean
  caseChoice?: { value: (i: number) => string; set: (i: number, caseId: string) => void; options: { value: string; label: string }[] }
}) {
  if (policies.length === 0) return null
  return (
    <div>
      <label className="label">Policies to add</label>
      <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
        {policies.map((p, i) => (
          <div key={i} className="p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={isOn(i)} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                onChange={e => setOn(i, e.target.checked)} />
              <span className="font-medium text-gray-800">{p.policyType || 'Policy'} {p.policyNumber}</span>
              <span className="text-gray-500">
                {p.insurer}{p.startDate || p.expiryDate ? ` · ${p.startDate ? formatDate(p.startDate) : '?'} → ${p.expiryDate ? formatDate(p.expiryDate) : '?'}` : ''}
              </span>
            </label>
            {alreadyOnCase?.(i) && <p className="text-xs text-green-700 pl-5">Already on this case — it won&apos;t be added twice</p>}
            {caseChoice && isOn(i) && (
              <SearchableSelect value={caseChoice.value(i)} options={caseChoice.options} onChange={v => caseChoice.set(i, v)} placeholder="— Choose case —" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── New case ────────────────────────────────────────────────────────────────

export function CreateCaseFromEmail({ mail, onClose, onDone }: {
  mail: MailMessage
  onClose: () => void
  onDone: (message: string) => void
}) {
  const { customers, pics, workflowTemplates, addCaseAndWait, addCaseNote, addActivityLog, loadCase } = useStore()
  const { addPolicies } = useAddEmailPolicies(mail)
  const { currentUser } = useAuth()
  const decidedBy = currentUser?.fullName ?? 'Unknown'
  const s = mail.aiSuggestion
  const [picks, setPicks] = useState<Picks>(() => initialPicks(mail))
  const [policyPicks, setPolicyPicks] = useState<boolean[]>(() => (s?.policies ?? []).map(() => true))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Pre-fill from the AI; the person checks and saves
  const [initial] = useState(() => {
    const base = emptyCase(customers)
    const customer = s?.customer?.id ? customers.find(c => c.id === s.customer!.id) : undefined
    const caseType = s?.caseType ?? ''
    const template = caseType ? getWorkflowTemplate(caseType, workflowTemplates, customer?.businessType) : null
    const firstStep = template?.workflowSteps.filter(st => st.isActive).sort((a, b) => a.order - b.order)[0]
    return {
      ...base,
      caseTitle: s?.caseTitle ?? mail.subject,
      customerId: customer?.id ?? '',
      customerName: customer?.customerName ?? '',
      caseType,
      currentWorkflowStepId: firstStep?.id ?? '',
      requestType: s?.requestType ?? '',
      amount: s?.amount ?? 0,
    }
  })
  const newCustomer = s?.customer?.isNew ? s.customer : undefined

  const save = async (form: Omit<Case, 'id' | 'createdAt'>) => {
    setSaving(true)
    setError('')
    try {
      const caseId = await addCaseAndWait(form)
      addActivityLog({
        caseId, caseTitle: form.caseTitle, actionType: 'CASE_CREATED',
        title: 'Case created from email', description: `From "${mail.subject}" (${mail.fromName || mail.fromAddress})`,
        changedBy: decidedBy,
      })

      // What the AI read that has no field on the case, kept as a note
      const facts = [
        s?.principal && `Principal: ${s.principal}`,
        s?.coverTypes && `Covers: ${s.coverTypes}`,
        s?.references && `References: ${s.references}`,
      ].filter(Boolean)
      if (facts.length) {
        addCaseNote({ caseId, content: `From email "${mail.subject}":\n${facts.join('\n')}`, createdBy: decidedBy })
      }

      const forCase = Object.fromEntries(Object.entries(picks).map(([id, p]) => [id, { ...p, caseId }]))
      const result = await fileEmail(mail.id, forCase, [caseId])
      const wanted = (s?.policies ?? []).filter((_, i) => policyPicks[i]).map(policy => ({ policy, caseId }))
      const added = addPolicies(wanted, result.files)
      await loadCase(caseId)
      onDone(`Case created. ${describeResult(result)}${describePolicies(added)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again.')
      setSaving(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Create case from email" maxWidth="lg">
      {newCustomer && (
        <p className="mx-6 mt-5 text-sm bg-amber-50 text-amber-800 rounded-xl p-3">
          The AI found a contractor that isn&apos;t in DocFlow yet: <b>{newCustomer.name}</b>
          {newCustomer.ssm && <> ({newCustomer.ssm})</>}. Click <b>+ New Contractor</b> to add it — the form is pre-filled.
        </p>
      )}
      <CaseForm
        initial={initial}
        customers={customers}
        pics={pics}
        onSave={save}
        onCancel={onClose}
        newCustomerDraft={newCustomer ? { ...emptyCustomerForm, customerName: newCustomer.name, companyRegistrationNo: newCustomer.ssm ?? '' } : undefined}
        saveLabel="Create case and file"
        saving={saving}
      >
        <div>
          <label className="label">Attachments to file into the new case</label>
          <AttachmentPicks attachments={mail.attachments} picks={picks} setPicks={setPicks} withCase={false} />
        </div>
        <PolicyPicks
          policies={s?.policies ?? []}
          isOn={i => policyPicks[i]}
          setOn={(i, on) => setPolicyPicks(prev => prev.map((v, j) => j === i ? on : v))}
        />
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
      </CaseForm>
    </Modal>
  )
}

// ─── Existing case / split ───────────────────────────────────────────────────

export function FileEmailModal({ mail, mode, onClose, onDone }: {
  mail: MailMessage
  mode: 'existing' | 'split'
  onClose: () => void
  onDone: (message: string) => void
}) {
  const { cases, loadCase } = useStore()
  const { isOnCase, addPolicies } = useAddEmailPolicies(mail)
  const s = mail.aiSuggestion
  const found = s?.policies ?? []
  const [caseId, setCaseId] = useState(s?.caseId ?? '')
  const [picks, setPicks] = useState<Picks>(() => initialPicks(mail, mode === 'split' ? '' : s?.caseId ?? ''))
  // Ticked unless the email was already filed, like its attachments
  const [policyPicks, setPolicyPicks] = useState(() => found.map(() => ({ include: mail.status !== 'filed', caseId: '' })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // A policy goes where it was sent; in a split, by default with its own attachment
  const policyCase = (i: number) => {
    if (mode === 'existing') return caseId
    const attachment = attachmentForPolicy(found[i].policyNumber, mail.attachments)
    return policyPicks[i].caseId || (attachment ? picks[attachment.id]?.caseId : '') || ''
  }

  const submit = async () => {
    setError('')
    const wanted = found.map((policy, i) => ({ policy, caseId: policyCase(i), include: policyPicks[i].include })).filter(w => w.include)
    const chosen = mode === 'existing'
      ? Object.fromEntries(Object.entries(picks).map(([id, p]) => [id, { ...p, caseId }]))
      : picks
    const caseIds = mode === 'existing' ? [caseId].filter(Boolean)
      : [...new Set([...Object.values(chosen).filter(p => p.include && p.caseId).map(p => p.caseId), ...wanted.map(w => w.caseId).filter(Boolean)])]
    if (mode === 'existing' && !caseId) { setError('Choose the case.'); return }
    if (mode === 'split') {
      if (Object.values(chosen).some(p => p.include && !p.caseId)) { setError('Choose a case for each ticked attachment.'); return }
      if (wanted.some(w => !w.caseId)) { setError('Choose a case for each ticked policy.'); return }
      if (caseIds.length === 0) { setError('Tick at least one attachment and choose its case.'); return }
    }
    setSaving(true)
    try {
      const result = await fileEmail(mail.id, chosen, caseIds)
      const added = addPolicies(wanted, result.files)
      await Promise.all(caseIds.map(id => loadCase(id)))
      onDone(describeResult(result) + describePolicies(added))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Filing failed — please try again.')
      setSaving(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={mode === 'existing' ? 'Add to existing case' : 'Split across cases'} maxWidth="lg">
      <div className="px-6 py-5 space-y-4">
        {mode === 'existing' && (
          <div>
            <label className="label">Case *</label>
            <SearchableSelect value={caseId} options={openCaseOptions(cases)} onChange={setCaseId} placeholder="— Search case —" />
          </div>
        )}
        <div>
          <label className="label">{mode === 'existing' ? 'Attachments to file' : 'Choose a case for each attachment'}</label>
          <AttachmentPicks attachments={mail.attachments} picks={picks} setPicks={setPicks} withCase={mode === 'split'} />
          <p className="text-xs text-gray-400 mt-1.5">The email is also added to each case&apos;s email history.</p>
        </div>
        <PolicyPicks
          policies={found}
          isOn={i => policyPicks[i].include}
          setOn={(i, include) => setPolicyPicks(prev => prev.map((v, j) => j === i ? { ...v, include } : v))}
          alreadyOnCase={i => !!policyCase(i) && isOnCase(found[i], policyCase(i))}
          caseChoice={mode === 'split' ? {
            value: policyCase,
            set: (i, value) => setPolicyPicks(prev => prev.map((v, j) => j === i ? { ...v, caseId: value } : v)),
            options: openCaseOptions(cases),
          } : undefined}
        />
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="button" onClick={submit} disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Filing…' : 'File'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
