'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import type { Case, MailPolicySuggestion } from '@/lib/types'
import type { WaBundle, WaFiling } from '@/lib/whatsapp-types'
import { getWorkflowTemplate } from '@/lib/workflow'
import { formatDate, formatFileSize, todayDate } from '@/lib/utils'
import { attachmentForPolicy } from '@/lib/mail-links'
import Modal from '@/components/ui/Modal'
import SearchableSelect from '@/components/ui/SearchableSelect'
import CaseForm, { emptyCase } from '@/components/ui/CaseForm'
import { emptyCustomerForm } from '@/components/ui/CustomerForm'

// The decisions on the WhatsApp screen that file something — the same three
// as on the Emails screen (components/ui/EmailDecisionModals.tsx, left as it
// is), sending to /api/whatsapp/file:
//   CreateCaseFromWhatsApp  new case, pre-filled by the AI, checked by a person
//   FileWhatsAppModal       'existing': everything to one case; 'split': each file its case
// plus LinkPhoneModal: "Link to customer / contact" for an unknown number.

export type WaFile = { key: string; name: string; size: number; mimeType: string; filedTo: WaFiling[] }

type Pick = { include: boolean; documentType: string; caseId: string }
type Picks = Record<string, Pick>
type FiledFile = { name: string; caseId: string; caseFileId: string }
type FileResult = { filed: string[]; duplicates: string[]; failed: string[]; files: FiledFile[] }

async function fileBundle(bundleId: string, picks: Picks, caseIds: string[]): Promise<FileResult> {
  const assignments = Object.entries(picks)
    .filter(([, p]) => p.include && p.caseId)
    .map(([fileKey, p]) => ({ fileKey, caseId: p.caseId, documentType: p.documentType }))
  const res = await fetch('/api/whatsapp/file', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: bundleId, assignments, caseIds }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Filing failed — please try again.')
  return data
}

function describeResult(r: FileResult): string {
  const parts = [`${r.filed.length} document${r.filed.length === 1 ? '' : 's'} filed`]
  if (r.duplicates.length) parts.push(`${r.duplicates.length} already in the case`)
  if (r.failed.length) parts.push(`could not file: ${r.failed.join(', ')}`)
  return parts.join(' · ') + '.'
}

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

function initialPicks(bundle: WaBundle, files: WaFile[], defaultCaseId = ''): Picks {
  const s = bundle.aiSuggestion
  return Object.fromEntries(files.map(f => {
    const ai = s?.attachments[f.key]
    const filed = f.filedTo[0]
    return [f.key, {
      include: !filed,
      documentType: filed?.documentType ?? ai?.documentType ?? 'Other',
      caseId: filed ? defaultCaseId : ai?.caseId ?? defaultCaseId,
    }]
  }))
}

function FilePicks({ files, picks, setPicks, withCase }: {
  files: WaFile[]; picks: Picks; setPicks: (p: Picks) => void; withCase: boolean
}) {
  const { cases } = useStore()
  const documentTypes = useDocumentTypes()
  const caseOptions = openCaseOptions(cases)
  if (files.length === 0) return <p className="text-sm text-gray-400">No stored files in these messages.</p>
  const caseNumber = (id: string) => {
    const c = cases.find(x => x.id === id)
    return c?.caseNumber ?? c?.caseTitle ?? 'a case'
  }
  const set = (key: string, p: Partial<Pick>) => setPicks({ ...picks, [key]: { ...picks[key], ...p } })
  return (
    <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
      {files.map(f => {
        const p = picks[f.key]
        if (!p) return null
        const types = documentTypes.includes(p.documentType) ? documentTypes : [p.documentType, ...documentTypes]
        return (
          <div key={f.key} className="p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={p.include} onChange={e => set(f.key, { include: e.target.checked })}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600" />
              <span className="text-sm font-medium text-gray-800 truncate">{f.name}</span>
              <span className="text-xs text-gray-400 shrink-0">{formatFileSize(f.size)}</span>
            </label>
            {f.filedTo.length > 0 && (
              <p className="text-xs text-green-700 pl-5">
                Already in {f.filedTo.map(x => caseNumber(x.caseId)).join(', ')} — tick to file it to this case too
              </p>
            )}
            {p.include && (
              <div className={`grid gap-2 ${withCase ? 'sm:grid-cols-2' : ''}`}>
                {withCase && (
                  <SearchableSelect value={p.caseId} options={caseOptions} onChange={v => set(f.key, { caseId: v })} placeholder="— Choose case —" />
                )}
                <select className="input text-sm" value={p.documentType} onChange={e => set(f.key, { documentType: e.target.value })}>
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

function useAddPolicies(from: string) {
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
        notes: `From WhatsApp (${from})`,
      })
    }
    return toAdd.length
  }
  return { isOnCase, addPolicies }
}

const describePolicies = (added: number) => added ? ` ${added} polic${added === 1 ? 'y' : 'ies'} added.` : ''

function PolicyPicks({ policies, isOn, setOn, alreadyOnCase }: {
  policies: MailPolicySuggestion[]
  isOn: (i: number) => boolean
  setOn: (i: number, on: boolean) => void
  alreadyOnCase?: (i: number) => boolean
}) {
  if (policies.length === 0) return null
  return (
    <div>
      <label className="label">Policies to add</label>
      <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
        {policies.map((p, i) => (
          <div key={i} className="p-3 space-y-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={isOn(i)} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                onChange={e => setOn(i, e.target.checked)} />
              <span className="font-medium text-gray-800">{p.policyType || 'Policy'} {p.policyNumber}</span>
              <span className="text-gray-500">
                {p.insurer}{p.startDate || p.expiryDate ? ` · ${p.startDate ? formatDate(p.startDate) : '?'} → ${p.expiryDate ? formatDate(p.expiryDate) : '?'}` : ''}
              </span>
            </label>
            {alreadyOnCase?.(i) && <p className="text-xs text-green-700 pl-5">Already on this case — it won&apos;t be added twice</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── New case ────────────────────────────────────────────────────────────────

export function CreateCaseFromWhatsApp({ bundle, files, from, onClose, onDone }: {
  bundle: WaBundle; files: WaFile[]; from: string
  onClose: () => void; onDone: (message: string) => void
}) {
  const { customers, pics, workflowTemplates, addCaseAndWait, addCaseNote, addActivityLog, loadCase } = useStore()
  const { addPolicies } = useAddPolicies(from)
  const { currentUser } = useAuth()
  const decidedBy = currentUser?.fullName ?? 'Unknown'
  const s = bundle.aiSuggestion
  const [picks, setPicks] = useState<Picks>(() => initialPicks(bundle, files))
  const [policyPicks, setPolicyPicks] = useState<boolean[]>(() => (s?.policies ?? []).map(() => true))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [initial] = useState(() => {
    const base = emptyCase(customers)
    const customerId = s?.customer?.id ?? bundle.customerId
    const customer = customerId ? customers.find(c => c.id === customerId) : undefined
    const caseType = s?.caseType ?? ''
    const template = caseType ? getWorkflowTemplate(caseType, workflowTemplates, customer?.businessType) : null
    const firstStep = template?.workflowSteps.filter(st => st.isActive).sort((a, b) => a.order - b.order)[0]
    return {
      ...base,
      caseTitle: s?.caseTitle ?? '',
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
        title: 'Case created from WhatsApp', description: `From WhatsApp messages (${from})`,
        changedBy: decidedBy,
      })
      const facts = [
        s?.principal && `Project Owner: ${s.principal}`,
        s?.coverTypes && `Covers: ${s.coverTypes}`,
        s?.references && `References: ${s.references}`,
      ].filter(Boolean)
      if (facts.length) addCaseNote({ caseId, content: `From WhatsApp (${from}):\n${facts.join('\n')}`, createdBy: decidedBy })

      const forCase = Object.fromEntries(Object.entries(picks).map(([k, p]) => [k, { ...p, caseId }]))
      const result = await fileBundle(bundle.id, forCase, [caseId])
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
    <Modal isOpen onClose={onClose} title="Create case from WhatsApp" maxWidth="lg">
      {newCustomer && (
        <p className="mx-6 mt-5 text-sm bg-amber-50 text-amber-800 rounded-xl p-3">
          The AI found a contractor that isn&apos;t in DocFlow yet: <b>{newCustomer.name}</b>
          {newCustomer.ssm && <> ({newCustomer.ssm})</>}. Click <b>+ New Principal</b> to add it — the form is pre-filled.
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
          <label className="label">Files to put in the new case</label>
          <FilePicks files={files} picks={picks} setPicks={setPicks} withCase={false} />
        </div>
        <PolicyPicks policies={s?.policies ?? []} isOn={i => policyPicks[i]}
          setOn={(i, on) => setPolicyPicks(prev => prev.map((v, j) => j === i ? on : v))} />
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
      </CaseForm>
    </Modal>
  )
}

// ─── Existing case / split ───────────────────────────────────────────────────

export function FileWhatsAppModal({ bundle, files, from, mode, onClose, onDone }: {
  bundle: WaBundle; files: WaFile[]; from: string; mode: 'existing' | 'split'
  onClose: () => void; onDone: (message: string) => void
}) {
  const { cases, loadCase } = useStore()
  const { isOnCase, addPolicies } = useAddPolicies(from)
  const s = bundle.aiSuggestion
  const found = s?.policies ?? []
  const [caseId, setCaseId] = useState(s?.caseId ?? '')
  const [picks, setPicks] = useState<Picks>(() => initialPicks(bundle, files, mode === 'split' ? '' : s?.caseId ?? ''))
  const [policyPicks, setPolicyPicks] = useState<boolean[]>(() => found.map(() => bundle.status !== 'filed'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // In a split, a policy goes with the file named after it
  const policyCase = (i: number) => {
    if (mode === 'existing') return caseId
    const file = attachmentForPolicy(found[i].policyNumber, files)
    return file ? picks[file.key]?.caseId ?? '' : ''
  }

  const submit = async () => {
    setError('')
    const chosen = mode === 'existing'
      ? Object.fromEntries(Object.entries(picks).map(([k, p]) => [k, { ...p, caseId }]))
      : picks
    const wanted = found.map((policy, i) => ({ policy, caseId: policyCase(i), include: policyPicks[i] })).filter(w => w.include && w.caseId)
    const caseIds = mode === 'existing' ? [caseId].filter(Boolean)
      : [...new Set(Object.values(chosen).filter(p => p.include && p.caseId).map(p => p.caseId))]
    if (mode === 'existing' && !caseId) { setError('Choose the case.'); return }
    if (mode === 'split') {
      if (Object.values(chosen).some(p => p.include && !p.caseId)) { setError('Choose a case for each ticked file.'); return }
      if (caseIds.length === 0) { setError('Tick at least one file and choose its case.'); return }
    }
    setSaving(true)
    try {
      const result = await fileBundle(bundle.id, chosen, caseIds)
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
          <label className="label">{mode === 'existing' ? 'Files to put in the case' : 'Choose a case for each file'}</label>
          <FilePicks files={files} picks={picks} setPicks={setPicks} withCase={mode === 'split'} />
          <p className="text-xs text-gray-400 mt-1.5">Each case&apos;s Activity tab shows &quot;Filed from WhatsApp&quot;.</p>
        </div>
        <PolicyPicks policies={found} isOn={i => policyPicks[i]}
          setOn={(i, on) => setPolicyPicks(prev => prev.map((v, j) => j === i ? on : v))}
          alreadyOnCase={i => !!policyCase(i) && isOnCase(found[i], policyCase(i))} />
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

// ─── Link an unknown number ──────────────────────────────────────────────────

export function LinkPhoneModal({ phone, onClose, onDone }: {
  phone: string; onClose: () => void; onDone: (message: string) => void
}) {
  const { customers, contacts } = useStore()
  const [customerId, setCustomerId] = useState('')
  const [contactId, setContactId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const theirContacts = contacts.filter(c => c.customerId === customerId)

  const submit = async () => {
    if (!customerId) { setError('Choose the customer.'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/whatsapp/link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, customerId, contactId: contactId || undefined }),
    }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    if (!res?.ok) {
      setError(data?.error ?? 'Could not link the number — please try again.')
      setSaving(false)
      return
    }
    const name = customers.find(c => c.id === customerId)?.customerName ?? 'the customer'
    onDone(`${phone} is now linked to ${name}. Its next messages will match.`)
  }

  return (
    <Modal isOpen onClose={onClose} title="Link to customer / contact" maxWidth="md">
      <div className="px-6 py-5 space-y-4">
        <p className="text-sm text-gray-600">
          DocFlow will remember that <b>{phone}</b> belongs to this customer. The customer&apos;s and
          contact&apos;s own details are not changed.
        </p>
        <div>
          <label className="label">Customer *</label>
          <SearchableSelect value={customerId} onChange={v => { setCustomerId(v); setContactId('') }}
            options={customers.map(c => ({ value: c.id, label: c.customerName }))} placeholder="— Search customer —" />
        </div>
        {theirContacts.length > 0 && (
          <div>
            <label className="label">Contact (optional)</label>
            <select className="input text-sm" value={contactId} onChange={e => setContactId(e.target.value)}>
              <option value="">— None —</option>
              {theirContacts.map(c => <option key={c.id} value={c.id}>{c.contactName}{c.role ? ` · ${c.role}` : ''}</option>)}
            </select>
          </div>
        )}
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="button" onClick={submit} disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Linking…' : 'Link'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
