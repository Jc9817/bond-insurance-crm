'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { USER_ROLES, USER_STATUSES, BUSINESS_TYPES } from '@/lib/types'
import type { SettingsCategory, User, UserRole, UserStatus, WorkflowTemplate, WorkflowStep, RequiredDocument } from '@/lib/types'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'users' | 'caseTypes' | 'industries' | 'contactTypes' | 'followUpCategories' | 'documentTypes' | 'pic' | 'workflowTemplates' | 'quotationWorkflow'

const TABS: { key: Tab; label: string }[] = [
  { key: 'users', label: 'Users' },
  { key: 'workflowTemplates', label: 'Workflow Templates' },
  { key: 'quotationWorkflow', label: 'Quotation Workflow' },
  { key: 'caseTypes', label: 'Case Types' },
  { key: 'industries', label: 'Industries' },
  { key: 'contactTypes', label: 'Contact Types' },
  { key: 'followUpCategories', label: 'Follow-Up Categories' },
  { key: 'documentTypes', label: 'Document Types' },
  { key: 'pic', label: 'Person in Charge' },
]

// ─── User form modal ──────────────────────────────────────────────────────────

type UserFormData = { fullName: string; email: string; password: string; role: UserRole; status: UserStatus }
const emptyUserForm = (): UserFormData => ({ fullName: '', email: '', password: '', role: 'Staff', status: 'Active' })

function UserModal({ initial, onSave, onClose, title }: {
  initial: UserFormData; onSave: (d: UserFormData) => void; onClose: () => void; title: string
}) {
  const [form, setForm] = useState<UserFormData>(initial)
  const [error, setError] = useState('')

  const set = (k: keyof UserFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fullName.trim()) { setError('Full name is required.'); return }
    if (!form.email.trim()) { setError('Email is required.'); return }
    if (!form.password.trim()) { setError('Password is required.'); return }
    onSave(form)
  }

  return (
    <Modal isOpen onClose={onClose} title={title} maxWidth="sm">
      <form onSubmit={submit} className="px-6 py-5 space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
        <div>
          <label className="label">Full Name *</label>
          <input className="input" value={form.fullName} onChange={set('fullName')} placeholder="e.g. Ahmad Farid" />
        </div>
        <div>
          <label className="label">Email *</label>
          <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="ahmad@bondinsurance.com" />
        </div>
        <div>
          <label className="label">Password *</label>
          <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="Set a password" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={set('role')}>
              {USER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={set('status')}>
              {USER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" className="btn-primary flex-1">Save User</button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Editable list section ────────────────────────────────────────────────────

function ListSection({ category }: { category: SettingsCategory }) {
  const { settingsData, addSettingsItem, updateSettingsItem, toggleSettingsItem, deleteSettingsItem } = useStore()
  const items = settingsData[category]
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    addSettingsItem(category, newName.trim())
    setNewName('')
  }

  const startEdit = (id: string, name: string) => { setEditId(id); setEditName(name) }
  const saveEdit = (id: string) => {
    if (editName.trim()) updateSettingsItem(category, id, editName.trim())
    setEditId(null)
  }

  return (
    <div>
      <div className="overflow-x-auto mb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="pb-2 font-semibold">Name</th>
              <th className="pb-2 font-semibold w-24">Status</th>
              <th className="pb-2 font-semibold w-48 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map(item => (
              <tr key={item.id}>
                <td className="py-3">
                  {editId === item.id ? (
                    <input
                      className="input py-1.5 text-sm w-64"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(item.id); if (e.key === 'Escape') setEditId(null) }}
                      autoFocus
                    />
                  ) : (
                    <span className={`font-medium ${item.isActive ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                      {item.name}
                    </span>
                  )}
                </td>
                <td className="py-3">
                  <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <div className="flex items-center gap-2 justify-end">
                    {editId === item.id ? (
                      <>
                        <button onClick={() => saveEdit(item.id)} className="btn-xs bg-blue-600 text-white hover:bg-blue-700">Save</button>
                        <button onClick={() => setEditId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(item.id, item.name)} className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700">Edit</button>
                        <button onClick={() => toggleSettingsItem(category, item.id)} className={`btn-xs ${item.isActive ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                          {item.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        {deleteId === item.id ? (
                          <>
                            <button onClick={() => { deleteSettingsItem(category, item.id); setDeleteId(null) }} className="btn-xs bg-red-600 text-white hover:bg-red-700">Confirm</button>
                            <button onClick={() => setDeleteId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
                          </>
                        ) : (
                          <button onClick={() => setDeleteId(item.id)} className="btn-xs bg-red-50 text-red-500 hover:bg-red-100">Delete</button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={3} className="py-4 text-sm text-gray-400">No items yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <form onSubmit={handleAdd} className="flex gap-3">
        <input
          className="input flex-1 max-w-xs"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New item name…"
        />
        <button type="submit" className="btn-primary">+ Add</button>
      </form>
    </div>
  )
}

// ─── Workflow Templates tab ───────────────────────────────────────────────────

type StepFormData = Omit<WorkflowStep, 'id' | 'caseTypeId'>
type DocFormData = Omit<RequiredDocument, 'id' | 'caseTypeId'> & { aiPrompt: string }

const emptyStep = (): StepFormData => ({
  name: '',
  order: 1,
  description: '',
  requireDocumentsComplete: false,
  defaultFollowUpSuggestion: '',
  isActive: true,
  aiEmailEnabled: false,
  aiEmailPrompt: '',
})

const emptyDoc = (): DocFormData => ({
  name: '',
  description: '',
  required: true,
  acceptedFileTypes: ['pdf', 'doc', 'docx', 'jpg', 'png'],
  isActive: true,
  aiPrompt: '',
  workflowStepId: undefined,
})

function StepModal({ initial, onSave, onClose, title, maxOrder }: {
  initial: StepFormData; onSave: (d: StepFormData) => void; onClose: () => void; title: string; maxOrder: number
}) {
  const [form, setForm] = useState<StepFormData>(initial)
  const [error, setError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Step name is required.'); return }
    onSave(form)
  }

  return (
    <Modal isOpen onClose={onClose} title={title} maxWidth="sm">
      <form onSubmit={submit} className="px-6 py-5 space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
        <div>
          <label className="label">Step Name *</label>
          <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Submit to Insurer" />
        </div>
        <div>
          <label className="label">Order</label>
          <input className="input" type="number" min={1} max={maxOrder + 1} value={form.order}
            onChange={e => setForm(p => ({ ...p, order: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="label">Description</label>
          <input className="input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What happens in this step?" />
        </div>
        <div>
          <label className="label">Default Follow-Up Suggestion</label>
          <input className="input" value={form.defaultFollowUpSuggestion} onChange={e => setForm(p => ({ ...p, defaultFollowUpSuggestion: e.target.value }))} placeholder="e.g. Follow up with insurer for approval" />
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="reqDocs"
            checked={form.requireDocumentsComplete}
            onChange={e => setForm(p => ({ ...p, requireDocumentsComplete: e.target.checked }))}
            className="w-4 h-4 rounded border-gray-300 text-blue-600"
          />
          <label htmlFor="reqDocs" className="text-sm text-gray-700">Require all documents complete before this step</label>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="aiEmail"
            checked={form.aiEmailEnabled ?? false}
            onChange={e => setForm(p => ({ ...p, aiEmailEnabled: e.target.checked }))}
            className="w-4 h-4 rounded border-gray-300 text-blue-600"
          />
          <label htmlFor="aiEmail" className="text-sm text-gray-700">Enable AI quotation email panel for this step</label>
        </div>
        {form.aiEmailEnabled && (
          <div>
            <label className="label">AI Email Prompt (optional)</label>
            <textarea
              className="input min-h-[100px] text-xs font-mono resize-y"
              value={form.aiEmailPrompt ?? ''}
              onChange={e => setForm(p => ({ ...p, aiEmailPrompt: e.target.value }))}
              placeholder="Leave blank to use default quotation email template. Or write custom instructions for the AI to follow when composing the email."
            />
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" className="btn-primary flex-1">Save Step</button>
        </div>
      </form>
    </Modal>
  )
}

function DocModal({ initial, steps, onSave, onClose, title }: {
  initial: DocFormData
  steps: WorkflowStep[]
  onSave: (d: DocFormData) => void
  onClose: () => void
  title: string
}) {
  const [form, setForm] = useState<DocFormData>(initial)
  const [fileTypesStr, setFileTypesStr] = useState(initial.acceptedFileTypes.join(', '))
  const [error, setError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Document name is required.'); return }
    const types = fileTypesStr.split(',').map(s => s.trim()).filter(Boolean)
    onSave({ ...form, acceptedFileTypes: types })
  }

  return (
    <Modal isOpen onClose={onClose} title={title} maxWidth="sm">
      <form onSubmit={submit} className="px-6 py-5 space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
        <div>
          <label className="label">Document Name *</label>
          <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Company Profile" />
        </div>
        <div>
          <label className="label">Description</label>
          <input className="input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief note on what to upload" />
        </div>
        <div>
          <label className="label">Belongs to Step</label>
          <select
            className="input"
            value={form.workflowStepId ?? ''}
            onChange={e => setForm(p => ({ ...p, workflowStepId: e.target.value || undefined }))}
          >
            <option value="">— All steps (always shown) —</option>
            {steps.filter(s => s.isActive).sort((a, b) => a.order - b.order).map(s => (
              <option key={s.id} value={s.id}>{s.order}. {s.name}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">Assign to a step so this document only appears in that step's checklist.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="required"
            checked={form.required}
            onChange={e => setForm(p => ({ ...p, required: e.target.checked }))}
            className="w-4 h-4 rounded border-gray-300 text-blue-600"
          />
          <label htmlFor="required" className="text-sm text-gray-700">Required document (counts toward readiness)</label>
        </div>
        <div>
          <label className="label">Accepted File Types (comma-separated)</label>
          <input className="input" value={fileTypesStr} onChange={e => setFileTypesStr(e.target.value)} placeholder="pdf, doc, docx, jpg, png" />
        </div>
        <div>
          <label className="label">AI Extraction Prompt</label>
          <textarea
            className="input min-h-[220px] text-xs leading-relaxed font-mono resize-y"
            value={form.aiPrompt ?? ''}
            onChange={e => setForm(p => ({ ...p, aiPrompt: e.target.value }))}
            placeholder={`Write extraction instructions or paste a complete prompt with a custom JSON schema.\n\nSimple example:\n  This is a Surat Setuju Terima (SST).\n  - customerName: contractor company name\n  - amount: contract value (Harga Kontrak)\n\nCustom JSON schema example:\n  Extract ... Return this exact JSON:\n  {\n    "contract_value": number | null,\n    "bond_value": number | null\n  }`}
          />
          <p className="text-xs text-gray-400 mt-1">
            Leave blank to use automatic detection based on the document name. The AI will always return: customerName, projectName, caseType, amount, bondValue, expiryDate, notes.
          </p>
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" className="btn-primary flex-1">Save Document</button>
        </div>
      </form>
    </Modal>
  )
}

function WorkflowTemplateDetail({ template, onBack }: { template: WorkflowTemplate; onBack: () => void }) {
  const {
    updateWorkflowTemplate, deleteWorkflowTemplate,
    addWorkflowStep, updateWorkflowStep, deleteWorkflowStep,
    addRequiredDocument, updateRequiredDocument, deleteRequiredDocument,
  } = useStore()

  const [section, setSection] = useState<'steps' | 'docs'>('steps')

  // Step modal state
  const [stepModal, setStepModal] = useState<'add' | 'edit' | null>(null)
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null)
  const [deleteStepId, setDeleteStepId] = useState<string | null>(null)

  // Drag-to-reorder state
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // Doc modal state
  const [docModal, setDocModal] = useState<'add' | 'edit' | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<RequiredDocument | null>(null)
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null)

  // Template name edit
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(template.caseType)
  const [descVal, setDescVal] = useState(template.description)
  const [bizTypeVal, setBizTypeVal] = useState(template.businessType ?? '')

  const activeSteps = [...template.workflowSteps].filter(s => s.isActive).sort((a, b) => a.order - b.order)
  const allSteps = [...template.workflowSteps].sort((a, b) => a.order - b.order)
  const requiredDocs = template.requiredDocuments.filter(d => d.required)
  const optionalDocs = template.requiredDocuments.filter(d => !d.required)

  const saveTemplateName = () => {
    if (nameVal.trim()) {
      updateWorkflowTemplate(template.id, { caseType: nameVal.trim(), description: descVal.trim(), businessType: bizTypeVal || undefined })
    }
    setEditingName(false)
  }

  return (
    <div>
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1.5">
          ← Back
        </button>
        <span className="text-gray-300">/</span>
        <h2 className="text-base font-semibold text-gray-800">{template.caseType}</h2>
      </div>

      {/* Template name / description edit */}
      <div className="card-section mb-5">
        <div className="flex items-start justify-between gap-4">
          {editingName ? (
            <div className="flex-1 space-y-3">
              <div>
                <label className="label">Template Name</label>
                <input className="input" value={nameVal} onChange={e => setNameVal(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="label">Business Type</label>
                <select className="input" value={bizTypeVal} onChange={e => setBizTypeVal(e.target.value)}>
                  <option value="">— All (no restriction) —</option>
                  {BUSINESS_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" value={descVal} onChange={e => setDescVal(e.target.value)} placeholder="Brief description of this template" />
              </div>
              <div className="flex gap-2">
                <button onClick={saveTemplateName} className="btn-primary text-sm px-4 py-2">Save</button>
                <button onClick={() => setEditingName(false)} className="btn-secondary text-sm px-4 py-2">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-semibold text-gray-800">{template.caseType}</p>
                {template.businessType && (
                  <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${template.businessType === 'Sole Proprietor' ? 'bg-amber-100 text-amber-700' : template.businessType === 'Partnership' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {template.businessType}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{template.description || 'No description'}</p>
            </div>
          )}
          {!editingName && (
            <button onClick={() => setEditingName(true)} className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700 shrink-0">
              Edit
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
          <span>{activeSteps.length} workflow steps</span>
          <span>·</span>
          <span>{requiredDocs.length} required docs</span>
          <span>·</span>
          <span>{optionalDocs.length} optional docs</span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {(['steps', 'docs'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              section === s ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {s === 'steps' ? 'Workflow Steps' : 'Required Documents'}
          </button>
        ))}
      </div>

      {/* ── Workflow Steps ── */}
      {section === 'steps' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Drag the handle to reorder steps.</p>
            <button onClick={() => { setSelectedStep(null); setStepModal('add') }} className="btn-primary text-xs px-4 py-2">
              + Add Step
            </button>
          </div>
          <div className="space-y-2">
            {allSteps.map((step, idx) => (
              <div
                key={step.id}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={e => { e.preventDefault(); setDragOverIdx(idx) }}
                onDrop={() => {
                  if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return }
                  const reordered = [...allSteps]
                  const [moved] = reordered.splice(dragIdx, 1)
                  reordered.splice(idx, 0, moved)
                  reordered.forEach((s, i) => updateWorkflowStep(template.id, s.id, { order: i + 1 }))
                  setDragIdx(null)
                  setDragOverIdx(null)
                }}
                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                className={`bg-white rounded-xl border p-4 flex items-start gap-4 cursor-grab active:cursor-grabbing transition-all ${
                  dragOverIdx === idx && dragIdx !== idx ? 'border-blue-400 shadow-md scale-[1.01]' :
                  dragIdx === idx ? 'opacity-40' :
                  step.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'
                }`}
              >
                {/* Drag handle */}
                <div className="flex flex-col items-center gap-0.5 shrink-0 mt-1 text-gray-300 hover:text-gray-500 cursor-grab">
                  <span className="leading-none text-base select-none">⠿</span>
                </div>
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {step.order}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-800">{step.name}</p>
                    {!step.isActive && <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">Inactive</span>}
                    {step.requireDocumentsComplete && (
                      <span className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">Requires docs</span>
                    )}
                    {step.aiEmailEnabled && (
                      <span className="text-xs text-blue-700 bg-blue-50 rounded-full px-2 py-0.5 flex items-center gap-1">
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        AI Email
                      </span>
                    )}
                  </div>
                  {step.description && <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>}
                  {step.defaultFollowUpSuggestion && (
                    <p className="text-xs text-blue-600 mt-0.5">FU: {step.defaultFollowUpSuggestion}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => { setSelectedStep(step); setStepModal('edit') }}
                    className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => updateWorkflowStep(template.id, step.id, { isActive: !step.isActive })}
                    className={`btn-xs ${step.isActive ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                  >
                    {step.isActive ? 'Disable' : 'Enable'}
                  </button>
                  {deleteStepId === step.id ? (
                    <>
                      <button onClick={() => { deleteWorkflowStep(template.id, step.id); setDeleteStepId(null) }} className="btn-xs bg-red-600 text-white hover:bg-red-700">Confirm</button>
                      <button onClick={() => setDeleteStepId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteStepId(step.id)} className="btn-xs bg-red-50 text-red-500 hover:bg-red-100">Delete</button>
                  )}
                </div>
              </div>
            ))}
            {allSteps.length === 0 && (
              <p className="text-sm text-gray-400 py-4">No steps defined yet. Add the first step to get started.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Required Documents ── */}
      {section === 'docs' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Documents required or recommended for this case type.</p>
            <button onClick={() => { setSelectedDoc(null); setDocModal('add') }} className="btn-primary text-xs px-4 py-2">
              + Add Document
            </button>
          </div>

          {requiredDocs.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Required</p>
              <div className="space-y-2">
                {requiredDocs.map(doc => (
                  <DocRow
                    key={doc.id}
                    doc={doc}
                    templateId={template.id}
                    allSteps={allSteps}
                    onEdit={() => { setSelectedDoc(doc); setDocModal('edit') }}
                    deleteDocId={deleteDocId}
                    setDeleteDocId={setDeleteDocId}
                    updateRequiredDocument={updateRequiredDocument}
                    deleteRequiredDocument={deleteRequiredDocument}
                  />
                ))}
              </div>
            </div>
          )}

          {optionalDocs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Optional</p>
              <div className="space-y-2">
                {optionalDocs.map(doc => (
                  <DocRow
                    key={doc.id}
                    doc={doc}
                    templateId={template.id}
                    allSteps={allSteps}
                    onEdit={() => { setSelectedDoc(doc); setDocModal('edit') }}
                    deleteDocId={deleteDocId}
                    setDeleteDocId={setDeleteDocId}
                    updateRequiredDocument={updateRequiredDocument}
                    deleteRequiredDocument={deleteRequiredDocument}
                  />
                ))}
              </div>
            </div>
          )}

          {template.requiredDocuments.length === 0 && (
            <p className="text-sm text-gray-400 py-4">No documents configured yet.</p>
          )}
        </div>
      )}

      {/* Step modals */}
      {stepModal === 'add' && (
        <StepModal
          title="Add Workflow Step"
          initial={{ ...emptyStep(), order: allSteps.length + 1 }}
          maxOrder={allSteps.length}
          onSave={d => { addWorkflowStep(template.id, d); setStepModal(null) }}
          onClose={() => setStepModal(null)}
        />
      )}
      {stepModal === 'edit' && selectedStep && (
        <StepModal
          title="Edit Workflow Step"
          initial={{ name: selectedStep.name, order: selectedStep.order, description: selectedStep.description, requireDocumentsComplete: selectedStep.requireDocumentsComplete, defaultFollowUpSuggestion: selectedStep.defaultFollowUpSuggestion, isActive: selectedStep.isActive, aiEmailEnabled: selectedStep.aiEmailEnabled, aiEmailPrompt: selectedStep.aiEmailPrompt }}
          maxOrder={allSteps.length}
          onSave={d => { updateWorkflowStep(template.id, selectedStep.id, d); setStepModal(null) }}
          onClose={() => setStepModal(null)}
        />
      )}

      {/* Doc modals */}
      {docModal === 'add' && (
        <DocModal
          title="Add Required Document"
          initial={emptyDoc()}
          steps={allSteps}
          onSave={d => { addRequiredDocument(template.id, d); setDocModal(null) }}
          onClose={() => setDocModal(null)}
        />
      )}
      {docModal === 'edit' && selectedDoc && (
        <DocModal
          title="Edit Document"
          initial={{ name: selectedDoc.name, description: selectedDoc.description, required: selectedDoc.required, acceptedFileTypes: selectedDoc.acceptedFileTypes, isActive: selectedDoc.isActive, aiPrompt: selectedDoc.aiPrompt ?? '', workflowStepId: selectedDoc.workflowStepId }}
          steps={allSteps}
          onSave={d => { updateRequiredDocument(template.id, selectedDoc.id, d); setDocModal(null) }}
          onClose={() => setDocModal(null)}
        />
      )}
    </div>
  )
}

function DocRow({ doc, templateId, allSteps, onEdit, deleteDocId, setDeleteDocId, updateRequiredDocument, deleteRequiredDocument }: {
  doc: RequiredDocument
  templateId: string
  allSteps: WorkflowStep[]
  onEdit: () => void
  deleteDocId: string | null
  setDeleteDocId: (id: string | null) => void
  updateRequiredDocument: (templateId: string, docId: string, data: Partial<RequiredDocument>) => void
  deleteRequiredDocument: (templateId: string, docId: string) => void
}) {
  const assignedStep = doc.workflowStepId ? allSteps.find(s => s.id === doc.workflowStepId) : null
  return (
    <div className={`bg-white rounded-xl border p-4 flex items-start gap-4 ${doc.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 ${doc.required ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
        {doc.required ? '!' : '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-800">{doc.name}</p>
          <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${doc.required ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
            {doc.required ? 'Required' : 'Optional'}
          </span>
          {assignedStep && (
            <span className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 font-medium">
              Step: {assignedStep.name}
            </span>
          )}
          {!doc.isActive && <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">Inactive</span>}
        </div>
        {doc.description && <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>}
        {doc.acceptedFileTypes.length > 0 && (
          <p className="text-xs text-gray-400 mt-0.5">{doc.acceptedFileTypes.join(', ')}</p>
        )}
        {doc.aiPrompt ? (
          <span className="inline-block mt-1 text-xs text-violet-600 bg-violet-50 rounded-full px-2 py-0.5 font-medium">AI prompt configured</span>
        ) : (
          <span className="inline-block mt-1 text-xs text-gray-400 bg-gray-50 rounded-full px-2 py-0.5">No AI prompt</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onEdit} className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700">Edit</button>
        <button
          onClick={() => updateRequiredDocument(templateId, doc.id, { isActive: !doc.isActive })}
          className={`btn-xs ${doc.isActive ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
        >
          {doc.isActive ? 'Disable' : 'Enable'}
        </button>
        {deleteDocId === doc.id ? (
          <>
            <button onClick={() => { deleteRequiredDocument(templateId, doc.id); setDeleteDocId(null) }} className="btn-xs bg-red-600 text-white hover:bg-red-700">Confirm</button>
            <button onClick={() => setDeleteDocId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
          </>
        ) : (
          <button onClick={() => setDeleteDocId(doc.id)} className="btn-xs bg-red-50 text-red-500 hover:bg-red-100">Delete</button>
        )}
      </div>
    </div>
  )
}

function WorkflowTemplatesTab() {
  const { workflowTemplates, addWorkflowTemplate, deleteWorkflowTemplate } = useStore()
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [addModal, setAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newBizType, setNewBizType] = useState('')
  const [addError, setAddError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const selectedTemplate = workflowTemplates.find(t => t.id === selectedTemplateId) ?? null

  if (selectedTemplate) {
    return (
      <WorkflowTemplateDetail
        template={selectedTemplate}
        onBack={() => setSelectedTemplateId(null)}
      />
    )
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) { setAddError('Template name is required.'); return }
    addWorkflowTemplate({ caseType: newName.trim(), description: newDesc.trim(), businessType: newBizType || undefined, requiredDocuments: [], workflowSteps: [], isActive: true })
    setNewName('')
    setNewDesc('')
    setNewBizType('')
    setAddError('')
    setAddModal(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">Configure the steps and required documents for each case/policy type.</p>
        <button onClick={() => setAddModal(true)} className="btn-primary text-xs px-4 py-2">+ New Template</button>
      </div>

      <div className="space-y-3">
        {workflowTemplates.map(t => {
          const activeSteps = t.workflowSteps.filter(s => s.isActive).length
          const reqDocs = t.requiredDocuments.filter(d => d.required).length
          const optDocs = t.requiredDocuments.filter(d => !d.required).length
          return (
            <div key={t.id} className={`bg-white rounded-2xl border p-5 flex items-center gap-5 hover:border-blue-200 transition-colors ${t.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="text-base font-semibold text-gray-800">{t.caseType}</p>
                  {t.businessType && (
                    <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${t.businessType === 'Sole Proprietor' ? 'bg-amber-100 text-amber-700' : t.businessType === 'Partnership' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {t.businessType}
                    </span>
                  )}
                  {!t.isActive && <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">Inactive</span>}
                </div>
                <p className="text-sm text-gray-500">{t.description || 'No description'}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span>{activeSteps} steps</span>
                  <span>·</span>
                  <span>{reqDocs} required docs</span>
                  {optDocs > 0 && <><span>·</span><span>{optDocs} optional docs</span></>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setSelectedTemplateId(t.id)}
                  className="btn-xs bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                >
                  Configure
                </button>
                {deleteId === t.id ? (
                  <>
                    <button onClick={() => { deleteWorkflowTemplate(t.id); setDeleteId(null) }} className="btn-xs bg-red-600 text-white hover:bg-red-700">Confirm</button>
                    <button onClick={() => setDeleteId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setDeleteId(t.id)} className="btn-xs bg-red-50 text-red-500 hover:bg-red-100">Delete</button>
                )}
              </div>
            </div>
          )
        })}
        {workflowTemplates.length === 0 && (
          <p className="text-sm text-gray-400 py-4">No workflow templates yet.</p>
        )}
      </div>

      {addModal && (
        <Modal isOpen onClose={() => setAddModal(false)} title="New Workflow Template" maxWidth="sm">
          <form onSubmit={handleAdd} className="px-6 py-5 space-y-4">
            {addError && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{addError}</p>}
            <div>
              <label className="label">Template Name *</label>
              <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Bond Request" autoFocus />
              <p className="text-xs text-gray-400 mt-1">This should match the Case Type name exactly.</p>
            </div>
            <div>
              <label className="label">Business Type</label>
              <select className="input" value={newBizType} onChange={e => setNewBizType(e.target.value)}>
                <option value="">— All (no restriction) —</option>
                {BUSINESS_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Limit this template to a specific business type, or leave blank to apply to all.</p>
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Brief description of this workflow" />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setAddModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1">Create Template</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ─── Main settings page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const { users, addUser, updateUser, pics, addPic, deletePic } = useStore()
  const { currentUser } = useAuth()
  const [tab, setTab] = useState<Tab>('users')

  // User management
  const [userModal, setUserModal] = useState<'add' | 'edit' | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  // PIC management
  const [newPicName, setNewPicName] = useState('')
  const [newPicEmail, setNewPicEmail] = useState('')
  const [picError, setPicError] = useState('')
  const [deletePicId, setDeletePicId] = useState<string | null>(null)

  const isAdmin = currentUser?.role === 'Admin'

  const closeUserModal = () => { setUserModal(null); setSelectedUser(null) }

  const submitPic = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPicName.trim()) { setPicError('Name is required.'); return }
    addPic({ name: newPicName.trim(), email: newPicEmail.trim() })
    setNewPicName('')
    setNewPicEmail('')
    setPicError('')
  }

  return (
    <div className="p-8 max-w-screen-lg mx-auto">
      <PageHeader title="Settings" subtitle="Manage users, configuration, and master data" />

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Users tab ─────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="card-section">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Users</h2>
            {isAdmin && (
              <button onClick={() => setUserModal('add')} className="btn-primary text-xs px-4 py-2">
                + Add User
              </button>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-5">
            <p className="text-xs text-blue-700">
              <strong>Roles:</strong> Admin — full access · Manager — cases & reports · Staff — customers, cases & follow-ups · Viewer — read only
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="pb-3 font-semibold">Name</th>
                  <th className="pb-3 font-semibold">Email</th>
                  <th className="pb-3 font-semibold">Role</th>
                  <th className="pb-3 font-semibold">Status</th>
                  {isAdmin && <th className="pb-3 font-semibold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="py-3 font-semibold text-gray-800">{u.fullName}</td>
                    <td className="py-3 text-gray-500">{u.email}</td>
                    <td className="py-3">
                      <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${
                        u.role === 'Admin' ? 'bg-blue-100 text-blue-700' :
                        u.role === 'Manager' ? 'bg-violet-100 text-violet-700' :
                        u.role === 'Staff' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${u.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => { setSelectedUser(u); setUserModal('edit') }} className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700">Edit</button>
                          <button
                            onClick={() => updateUser(u.id, { status: u.status === 'Active' ? 'Inactive' : 'Active' })}
                            className={`btn-xs ${u.status === 'Active' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                          >
                            {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Workflow Templates tab ─────────────────────────────────────────── */}
      {tab === 'workflowTemplates' && (
        <div className="card-section">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Workflow Templates</h2>
          <WorkflowTemplatesTab />
        </div>
      )}

      {/* ── Quotation Workflow tab ─────────────────────────────────────────── */}
      {tab === 'quotationWorkflow' && (
        <div className="card-section space-y-8">
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Inquiry Statuses</h2>
            <p className="text-sm text-gray-500 mb-5">Stages an inquiry moves through from first contact to close.</p>
            <ListSection category="inquiryStatuses" />
          </div>
          <div className="border-t border-gray-100 pt-8">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Quotation Statuses</h2>
            <p className="text-sm text-gray-500 mb-5">Statuses for individual insurer quotations within an inquiry.</p>
            <ListSection category="quotationStatuses" />
          </div>
        </div>
      )}

      {/* ── Case Types tab ─────────────────────────────────────────────────── */}
      {tab === 'caseTypes' && (
        <div className="card-section">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Case Types</h2>
          <p className="text-sm text-gray-500 mb-5">These are the types available when creating a new case.</p>
          <ListSection category="caseTypes" />
        </div>
      )}

      {/* ── Industries tab ─────────────────────────────────────────────────── */}
      {tab === 'industries' && (
        <div className="card-section">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Industries</h2>
          <p className="text-sm text-gray-500 mb-5">Industry options shown in customer profiles.</p>
          <ListSection category="industries" />
        </div>
      )}

      {/* ── Contact Types tab ──────────────────────────────────────────────── */}
      {tab === 'contactTypes' && (
        <div className="card-section">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Contact Types</h2>
          <p className="text-sm text-gray-500 mb-5">Types used when adding contacts under a customer.</p>
          <ListSection category="contactTypes" />
        </div>
      )}

      {/* ── Follow-Up Categories tab ───────────────────────────────────────── */}
      {tab === 'followUpCategories' && (
        <div className="card-section">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Follow-Up Categories</h2>
          <p className="text-sm text-gray-500 mb-5">Categories used to classify follow-up tasks.</p>
          <ListSection category="followUpCategories" />
        </div>
      )}

      {/* ── Document Types tab ─────────────────────────────────────────────── */}
      {tab === 'documentTypes' && (
        <div className="card-section">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Document Types</h2>
          <p className="text-sm text-gray-500 mb-5">Document categories used when uploading files to a case.</p>
          <ListSection category="documentTypes" />
        </div>
      )}

      {/* ── Person in Charge tab ───────────────────────────────────────────── */}
      {tab === 'pic' && (
        <div className="card-section">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Person in Charge</h2>
          <p className="text-sm text-gray-500 mb-5">Staff members who can be assigned to cases and follow-ups.</p>
          <div className="overflow-x-auto mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-semibold">Name</th>
                  <th className="pb-2 font-semibold">Email</th>
                  <th className="pb-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pics.map(p => (
                  <tr key={p.id}>
                    <td className="py-3 font-semibold text-gray-800">{p.name}</td>
                    <td className="py-3 text-gray-500">{p.email || '—'}</td>
                    <td className="py-3">
                      {deletePicId === p.id ? (
                        <span className="flex gap-2">
                          <button onClick={() => { deletePic(p.id); setDeletePicId(null) }} className="btn-xs bg-red-600 text-white hover:bg-red-700">Confirm</button>
                          <button onClick={() => setDeletePicId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
                        </span>
                      ) : (
                        <button onClick={() => setDeletePicId(p.id)} className="btn-xs text-red-600 bg-red-50 hover:bg-red-100">Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
                {pics.length === 0 && (
                  <tr><td colSpan={3} className="py-4 text-sm text-gray-400">No staff added yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <form onSubmit={submitPic} className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="label">Name *</label>
              <input className="input w-44" value={newPicName} onChange={e => setNewPicName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input w-52" type="email" value={newPicEmail} onChange={e => setNewPicEmail(e.target.value)} placeholder="email@company.com" />
            </div>
            <button type="submit" className="btn-primary">Add Person</button>
          </form>
          {picError && <p className="text-sm text-red-600 mt-2">{picError}</p>}
        </div>
      )}

      {/* User modals */}
      {userModal === 'add' && (
        <UserModal
          title="Add User"
          initial={emptyUserForm()}
          onSave={d => { addUser(d); closeUserModal() }}
          onClose={closeUserModal}
        />
      )}
      {userModal === 'edit' && selectedUser && (
        <UserModal
          title="Edit User"
          initial={{ fullName: selectedUser.fullName, email: selectedUser.email, password: selectedUser.password, role: selectedUser.role, status: selectedUser.status }}
          onSave={d => { updateUser(selectedUser.id, d); closeUserModal() }}
          onClose={closeUserModal}
        />
      )}
    </div>
  )
}
