'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import type { CaseFile } from '@/lib/types'
import {
  getWorkflowTemplate, getActiveSteps, getCaseReadiness, getDocumentCompleteness,
  getMissingRequiredDocs, getCurrentStep, getNextStep, getUnassignedFiles,
} from '@/lib/workflow'
import { formatDate, formatCurrency, timeAgo, getDaysUntil } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import DocumentChecklist from '@/components/ui/DocumentChecklist'
import AIScanPanel from '@/components/ui/AIScanPanel'

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const {
    cases, customers, contacts, caseNotes, followUps, pics, workflowTemplates,
    activityLogs, updateCase, addCaseNote, addFollowUp, toggleFollowUp, deleteFollowUp,
    addActivityLog, caseFiles,
  } = useStore()

  const [editInfoModal, setEditInfoModal] = useState(false)
  const [editInfoForm, setEditInfoForm] = useState({ caseTitle: '', caseType: '', amount: 0, personInCharge: '' })
  const { currentUser } = useAuth()

  const caseItem = cases.find(c => c.id === id)
  const [noteText, setNoteText] = useState('')
  const [notePic, setNotePic] = useState(pics[0]?.name ?? '')
  const [followUpModal, setFollowUpModal] = useState(false)
  const [stepModal, setStepModal] = useState<{ stepId: string; stepName: string; prevStepName?: string; isAdvance?: boolean; dateEditOnly?: boolean } | null>(null)
  const [stepDate, setStepDate] = useState('')
  const [fuForm, setFuForm] = useState({ title: '', personInCharge: pics[0]?.name ?? '', dueDate: '' })
  const [closingModal, setClosingModal] = useState(false)
  const [scanFile, setScanFile] = useState<CaseFile | null>(null)
  const [closingForm, setClosingForm] = useState({
    result: caseItem?.result ?? '',
    closingRemarks: caseItem?.closingRemarks ?? '',
    lossReason: caseItem?.lossReason ?? '',
    finalAmount: caseItem?.finalAmount ?? caseItem?.amount ?? 0,
    finalInsurer: caseItem?.finalInsurer ?? '',
  })

  if (!caseItem) {
    return (
      <div className="p-8">
        <p className="text-gray-500 text-lg">Case not found.</p>
        <Link href="/cases" className="text-blue-600 hover:underline text-sm mt-3 inline-block">← Back to Cases</Link>
      </div>
    )
  }

  const customer = customers.find(c => c.id === caseItem.customerId)
  const template = getWorkflowTemplate(caseItem.caseType, workflowTemplates, customer?.businessType)
  const steps = getActiveSteps(template)
  const caseDocs = caseFiles.filter(f => f.caseId === id)
  const unassignedDocs = getUnassignedFiles(id, template, caseDocs)
  const caseTypeOptions = [...new Set(workflowTemplates.filter(t => t.isActive).map(t => t.caseType))]
  const readiness = getCaseReadiness(caseItem, template, caseFiles, followUps)
  const docCompleteness = getDocumentCompleteness(id, template, caseFiles)
  const missingDocs = getMissingRequiredDocs(id, template, caseFiles)
  const currentStep = getCurrentStep(caseItem.currentWorkflowStepId, template)
  const nextStep = getNextStep(caseItem.currentWorkflowStepId, template)

  // Most recent recorded timestamp per step name (array is newest-first so first match wins)
  const stepTimestamps = activityLogs
    .filter(log => log.caseId === id && log.actionType === 'WORKFLOW_STEP_CHANGED' && log.newValue)
    .reduce<Record<string, string>>((acc, log) => {
      if (!acc[log.newValue!]) acc[log.newValue!] = log.timestamp
      return acc
    }, {})
  const custContacts = contacts.filter(c => c.customerId === caseItem.customerId)
  const notes = caseNotes
    .filter(n => n.caseId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const caseFollowUps = followUps.filter(f => f.caseId === id)
  const openFollowUps = caseFollowUps.filter(f => f.status === 'Open')

  const submitNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteText.trim()) return
    addCaseNote({ caseId: id, content: noteText.trim(), createdBy: notePic })
    addActivityLog({
      caseId: id,
      caseTitle: caseItem.caseTitle,
      actionType: 'NOTE_ADDED',
      title: 'Note added',
      description: noteText.trim().length > 80 ? noteText.trim().slice(0, 80) + '…' : noteText.trim(),
      changedBy: currentUser?.fullName ?? notePic,
    })
    setNoteText('')
  }

  const submitFollowUp = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fuForm.title.trim()) return
    addFollowUp({
      title: fuForm.title,
      customerId: caseItem.customerId,
      customerName: caseItem.customerName,
      caseId: id,
      caseTitle: caseItem.caseTitle,
      personInCharge: fuForm.personInCharge,
      dueDate: fuForm.dueDate,
      status: 'Open',
    })
    addActivityLog({
      caseId: id,
      caseTitle: caseItem.caseTitle,
      actionType: 'FOLLOW_UP_CREATED',
      title: 'Follow-up created',
      description: fuForm.title,
      changedBy: currentUser?.fullName ?? 'Unknown',
    })
    setFuForm({ title: '', personInCharge: pics[0]?.name ?? '', dueDate: '' })
    setFollowUpModal(false)
  }

  const submitClosing = (e: React.FormEvent) => {
    e.preventDefault()
    const isClosing = (closingForm.result === 'Won' || closingForm.result === 'Lost' || closingForm.result === 'Cancelled')
    updateCase(id, {
      result: closingForm.result,
      closingRemarks: closingForm.closingRemarks,
      lossReason: closingForm.lossReason,
      finalAmount: closingForm.finalAmount,
      finalInsurer: closingForm.finalInsurer,
      ...(isClosing && !caseItem.closedAt ? { closedAt: new Date().toISOString() } : {}),
    })
    addActivityLog({
      caseId: id,
      caseTitle: caseItem.caseTitle,
      actionType: isClosing ? 'CASE_CLOSED' : 'RESULT_SET',
      title: closingForm.result ? `Case result: ${closingForm.result}` : 'Case result updated',
      oldValue: caseItem.result || undefined,
      newValue: closingForm.result || undefined,
      description: closingForm.closingRemarks || undefined,
      changedBy: currentUser?.fullName ?? 'Unknown',
    })
    setClosingModal(false)
  }

  return (
    <div className="p-8 max-w-screen-lg mx-auto">
      {/* Breadcrumb */}
      <div className="mb-5">
        <Link href="/cases" className="text-sm text-gray-400 hover:text-gray-600">← Cases</Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">{caseItem.caseTitle}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <StatusBadge status={caseItem.currentStatus} size="md" />
            {caseItem.result && <StatusBadge status={caseItem.result} size="md" />}
            <span className="text-sm text-gray-400">{caseItem.caseType || 'No type set'}</span>
            <span className="text-sm text-gray-400">· {caseItem.personInCharge || '—'}</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => router.push(`/cases/${id}/report`)}
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View Report
          </button>
          <button onClick={() => {
            setClosingForm({ result: caseItem.result, closingRemarks: caseItem.closingRemarks, lossReason: caseItem.lossReason ?? '', finalAmount: caseItem.finalAmount ?? caseItem.amount, finalInsurer: caseItem.finalInsurer ?? '' })
            setClosingModal(true)
          }} className="btn-primary text-sm">
            Set Result
          </button>
        </div>
      </div>

      {/* ─── Document Checklist + Workflow Steps ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="lg:col-span-2 card-section">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Document Checklist</h2>
            <div className="flex items-center gap-2">
              {unassignedDocs.length > 0 && (
                <span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-amber-100 text-amber-700">
                  {unassignedDocs.length} unassigned
                </span>
              )}
              <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                docCompleteness >= 100 ? 'bg-green-100 text-green-700' :
                missingDocs.length > 0 ? 'bg-red-100 text-red-600' :
                'bg-gray-100 text-gray-500'
              }`}>
                {missingDocs.length > 0 ? `${missingDocs.length} missing` : 'Complete'}
              </span>
            </div>
          </div>
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">Documents ready</span>
              <span className={`text-xs font-semibold ${docCompleteness >= 100 ? 'text-green-600' : docCompleteness >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{docCompleteness}%</span>
            </div>
            <div className="bg-gray-100 rounded-full h-1.5">
              <div
                className={`h-full rounded-full transition-all ${docCompleteness >= 100 ? 'bg-green-500' : docCompleteness >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${docCompleteness}%` }}
              />
            </div>
          </div>
          <DocumentChecklist
            caseId={id}
            caseTitle={caseItem.caseTitle}
            template={template}
            caseFiles={caseDocs}
            onScanReady={file => setScanFile(file)}
          />
        </div>

        {/* Workflow Steps */}
        <div className="card-section">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Workflow Steps</h2>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">Overall readiness</span>
              <span className={`text-xs font-semibold ${readiness >= 70 ? 'text-green-600' : readiness >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{readiness}%</span>
            </div>
            <div className="bg-gray-100 rounded-full h-1.5">
              <div
                className={`h-full rounded-full transition-all ${readiness >= 70 ? 'bg-green-500' : readiness >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${readiness}%` }}
              />
            </div>
          </div>
          {steps.length === 0 ? (
            <p className="text-xs text-gray-400">No workflow defined for this case type.</p>
          ) : (
            <div className="space-y-1">
              {steps.map((step, idx) => {
                const isCurrent = step.id === caseItem.currentWorkflowStepId
                const currentIdx = steps.findIndex(s => s.id === caseItem.currentWorkflowStepId)
                const isDone = currentIdx > idx
                const stepTs = stepTimestamps[step.name]
                const hasDate = isDone || isCurrent
                return (
                  <div key={step.id} className="flex items-start gap-2.5">
                    <div className="flex flex-col items-center shrink-0">
                      <button
                        onClick={() => {
                          const prevStep = getCurrentStep(caseItem.currentWorkflowStepId, template)
                          setStepDate(stepTs ? new Date(stepTs).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16))
                          setStepModal({ stepId: step.id, stepName: step.name, prevStepName: prevStep?.name })
                        }}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all focus:outline-none ${
                          isCurrent ? 'bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-1' :
                          isDone ? 'bg-green-500 text-white hover:bg-green-600' :
                          'bg-gray-100 text-gray-400 hover:bg-blue-100 hover:text-blue-600'
                        }`}
                        title={`Set to: ${step.name}`}
                      >
                        {isDone ? '✓' : idx + 1}
                      </button>
                      {idx < steps.length - 1 && (
                        <div className={`w-0.5 h-4 mt-0.5 ${isDone ? 'bg-green-300' : 'bg-gray-200'}`} />
                      )}
                    </div>
                    <div className="pb-3 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-semibold leading-tight ${
                          isCurrent ? 'text-blue-700' :
                          isDone ? 'text-green-700' :
                          'text-gray-500'
                        }`}>
                          {step.name}
                        </p>
                        {hasDate && (
                          <button
                            onClick={() => {
                              setStepDate(stepTs ? new Date(stepTs).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16))
                              setStepModal({ stepId: step.id, stepName: step.name, dateEditOnly: true })
                            }}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 shrink-0 transition-colors group"
                            title="Edit date"
                          >
                            <span>{stepTs ? formatDate(stepTs.split('T')[0]) : '—'}</span>
                            <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828A2 2 0 019 16.414V13z" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {isCurrent && (
                        <p className="text-xs text-gray-400 mt-0.5 leading-snug">{step.description}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {nextStep && (
            <button
              onClick={() => {
                setStepDate(new Date().toISOString().slice(0, 16))
                setStepModal({ stepId: nextStep.id, stepName: nextStep.name, prevStepName: currentStep?.name, isAdvance: true })
              }}
              className="w-full mt-4 btn-primary text-xs py-2"
            >
              Move to: {nextStep.name} →
            </button>
          )}
          {!nextStep && steps.length > 0 && (
            <div className="mt-4 text-center py-2 bg-green-50 rounded-xl">
              <p className="text-xs font-semibold text-green-700">All steps completed</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Case Info + Follow-Ups ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="lg:col-span-2 card-section">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Case Information</h2>
            <button
              onClick={() => {
                setEditInfoForm({ caseTitle: caseItem.caseTitle, caseType: caseItem.caseType, amount: caseItem.amount, personInCharge: caseItem.personInCharge })
                setEditInfoModal(true)
              }}
              className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              Edit
            </button>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <DetailRow label="Customer">
              {customer
                ? <Link href={`/customers/${customer.id}`} className="text-sm font-semibold text-blue-600 hover:underline">{customer.customerName}</Link>
                : <span className="text-sm font-semibold text-gray-800">{caseItem.customerName}</span>}
            </DetailRow>
            <DetailRow label="Case Type">
              <span className="text-sm font-semibold text-gray-800">{caseItem.caseType || '—'}</span>
            </DetailRow>
            <DetailRow label="Amount">
              <span className="text-lg font-bold text-gray-900">{formatCurrency(caseItem.amount)}</span>
            </DetailRow>
            <DetailRow label="Person in Charge">
              <span className="text-sm font-semibold text-gray-800">{caseItem.personInCharge || '—'}</span>
            </DetailRow>
            <DetailRow label="Created">
              <span className="text-sm text-gray-700">{formatDate(caseItem.createdAt.split('T')[0])}</span>
            </DetailRow>
            <DetailRow label="Last Updated">
              <span className="text-sm text-gray-700">{caseItem.updatedAt ? timeAgo(caseItem.updatedAt) : '—'}</span>
            </DetailRow>
            {caseItem.result && (
              <DetailRow label="Result">
                <StatusBadge status={caseItem.result} size="md" />
              </DetailRow>
            )}
            {caseItem.finalInsurer && (
              <DetailRow label="Insurer / Provider">
                <span className="text-sm font-semibold text-gray-800">{caseItem.finalInsurer}</span>
              </DetailRow>
            )}
            {caseItem.finalAmount && caseItem.finalAmount !== caseItem.amount && (
              <DetailRow label="Final Amount">
                <span className="text-sm font-semibold text-gray-800">{formatCurrency(caseItem.finalAmount)}</span>
              </DetailRow>
            )}
            {caseItem.closingRemarks && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400 mb-0.5">Closing Remarks</p>
                <p className="text-sm text-gray-700">{caseItem.closingRemarks}</p>
              </div>
            )}
            {caseItem.lossReason && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400 mb-0.5">Loss Reason</p>
                <p className="text-sm text-red-700">{caseItem.lossReason}</p>
              </div>
            )}
          </div>
          {custContacts.length > 0 && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Customer Contacts</p>
              <div className="flex flex-wrap gap-2">
                {custContacts.map(c => (
                  <div key={c.id} className="bg-gray-50 rounded-xl px-3 py-2">
                    <p className="text-sm font-medium text-gray-800">{c.contactName}</p>
                    <p className="text-xs text-gray-400">{c.contactType} · {c.phone || c.email}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Follow-Ups */}
        <div className="card-section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Follow-Ups <span className="text-gray-300">({openFollowUps.length} open)</span>
            </h2>
            <button
              onClick={() => {
                if (currentStep?.defaultFollowUpSuggestion) {
                  setFuForm(prev => ({ ...prev, title: currentStep.defaultFollowUpSuggestion }))
                }
                setFollowUpModal(true)
              }}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              + Add
            </button>
          </div>
          {caseFollowUps.length === 0 ? (
            <p className="text-xs text-gray-400">No follow-ups yet.</p>
          ) : (
            <div className="space-y-3">
              {caseFollowUps.map(f => {
                const d = getDaysUntil(f.dueDate)
                const isOD = d !== null && d < 0 && f.status === 'Open'
                return (
                  <div key={f.id} className="flex items-start gap-2.5">
                    <button
                      onClick={() => {
                        const wasOpen = f.status === 'Open'
                        toggleFollowUp(f.id)
                        if (wasOpen) {
                          addActivityLog({
                            caseId: id,
                            caseTitle: caseItem.caseTitle,
                            actionType: 'FOLLOW_UP_COMPLETED',
                            title: 'Follow-up completed',
                            description: f.title,
                            changedBy: currentUser?.fullName ?? 'Unknown',
                          })
                        }
                      }}
                      className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                        f.status === 'Done' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {f.status === 'Done' && <span className="text-xs leading-none">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium leading-snug ${f.status === 'Done' ? 'line-through text-gray-400' : isOD ? 'text-red-700' : 'text-gray-800'}`}>
                        {f.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {f.personInCharge} · {f.dueDate ? formatDate(f.dueDate) : '—'}
                        {isOD && <span className="ml-1 text-red-500 font-medium">overdue</span>}
                      </p>
                    </div>
                    <button onClick={() => deleteFollowUp(f.id)} className="text-gray-200 hover:text-red-400 text-base shrink-0 transition-colors">✕</button>
                  </div>
                )
              })}
            </div>
          )}
          {currentStep?.defaultFollowUpSuggestion && openFollowUps.length === 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2">Suggested for current step:</p>
              <button
                onClick={() => { setFuForm(prev => ({ ...prev, title: currentStep.defaultFollowUpSuggestion })); setFollowUpModal(true) }}
                className="w-full text-left text-xs bg-blue-50 text-blue-700 rounded-xl px-3 py-2 hover:bg-blue-100 transition-colors"
              >
                + {currentStep.defaultFollowUpSuggestion}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Notes ───────────────────────────────────────────────────────────── */}
      <div className="card-section mb-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Notes</h2>
        <form onSubmit={submitNote} className="mb-6 space-y-3">
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Write a note…"
            rows={3}
            className="input text-gray-900"
          />
          <div className="flex gap-3 items-center">
            <select value={notePic} onChange={e => setNotePic(e.target.value)} className="input w-44 shrink-0">
              {pics.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            <button type="submit" className="btn-primary">Add Note</button>
          </div>
        </form>
        {notes.length === 0 ? (
          <p className="text-sm text-gray-400">No notes yet.</p>
        ) : (
          <div className="space-y-3">
            {notes.map(n => (
              <div key={n.id} className="bg-stone-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">{n.createdBy}</span>
                  <span className="text-xs text-gray-400">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{n.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step Date Modal */}
      <Modal isOpen={!!stepModal} onClose={() => setStepModal(null)} title={stepModal?.dateEditOnly ? 'Edit Step Date' : 'Record Step Change'} maxWidth="sm">
        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-sm text-gray-500">{stepModal?.dateEditOnly ? 'Step:' : 'Moving to step:'}</p>
            <p className="text-base font-semibold text-gray-900 mt-0.5">{stepModal?.stepName}</p>
            {!stepModal?.dateEditOnly && stepModal?.prevStepName && (
              <p className="text-xs text-gray-400 mt-0.5">from: {stepModal.prevStepName}</p>
            )}
          </div>
          <div>
            <label className="label">When did this happen?</label>
            <input
              type="datetime-local"
              className="input"
              value={stepDate}
              onChange={e => setStepDate(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1.5">Backdate if this step was completed on a different day.</p>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setStepModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => {
                if (!stepModal) return
                const ts = stepDate ? new Date(stepDate).toISOString() : new Date().toISOString()
                addActivityLog({
                  caseId: id,
                  caseTitle: caseItem.caseTitle,
                  actionType: 'WORKFLOW_STEP_CHANGED',
                  title: stepModal.isAdvance ? 'Workflow step advanced' : 'Workflow step changed',
                  oldValue: stepModal.prevStepName,
                  newValue: stepModal.stepName,
                  description: stepModal.isAdvance
                    ? `Moved from ${stepModal.prevStepName ?? '—'} to ${stepModal.stepName}`
                    : `Set to step: ${stepModal.stepName}`,
                  changedBy: currentUser?.fullName ?? 'Unknown',
                  timestamp: ts,
                })
                if (!stepModal.dateEditOnly) {
                  updateCase(id, { currentWorkflowStepId: stepModal.stepId })
                }
                setStepModal(null)
              }}
              className="btn-primary flex-1"
            >
              Confirm
            </button>
          </div>
        </div>
      </Modal>

      {/* Case Result Modal */}
      <Modal isOpen={closingModal} onClose={() => setClosingModal(false)} title="Case Result" maxWidth="sm">
        <form onSubmit={submitClosing} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Result</label>
            <select className="input" value={closingForm.result} onChange={e => setClosingForm(p => ({ ...p, result: e.target.value }))}>
              <option value="">Pending — not decided yet</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
              <option value="Cancelled">Cancelled</option>
              <option value="On Hold">On Hold</option>
            </select>
          </div>
          <div>
            <label className="label">Insurer / Provider</label>
            <input className="input" value={closingForm.finalInsurer} onChange={e => setClosingForm(p => ({ ...p, finalInsurer: e.target.value }))} placeholder="e.g. Allianz, Etiqa, RHB Insurance" />
          </div>
          <div>
            <label className="label">Final Amount (RM)</label>
            <input className="input" type="number" min={0} value={closingForm.finalAmount || ''} onChange={e => setClosingForm(p => ({ ...p, finalAmount: Number(e.target.value) }))} />
          </div>
          {closingForm.result === 'Lost' && (
            <div>
              <label className="label">Loss Reason</label>
              <input className="input" value={closingForm.lossReason} onChange={e => setClosingForm(p => ({ ...p, lossReason: e.target.value }))} placeholder="e.g. Price — competitor offered lower premium" />
            </div>
          )}
          <div>
            <label className="label">Closing Remarks</label>
            <textarea className="input" rows={3} value={closingForm.closingRemarks} onChange={e => setClosingForm(p => ({ ...p, closingRemarks: e.target.value }))} placeholder="Optional notes on the outcome…" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setClosingModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Save Result</button>
          </div>
        </form>
      </Modal>

      {/* Add Follow-Up Modal */}
      <Modal isOpen={followUpModal} onClose={() => setFollowUpModal(false)} title="Add Follow-Up" maxWidth="sm">
        <form onSubmit={submitFollowUp} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">What needs to be done? *</label>
            <input className="input" value={fuForm.title} onChange={e => setFuForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Call client to confirm decision" />
          </div>
          <div>
            <label className="label">Person in Charge</label>
            <select className="input" value={fuForm.personInCharge} onChange={e => setFuForm(p => ({ ...p, personInCharge: e.target.value }))}>
              {pics.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Due Date</label>
            <input type="date" className="input" value={fuForm.dueDate} onChange={e => setFuForm(p => ({ ...p, dueDate: e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setFollowUpModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Add Follow-Up</button>
          </div>
        </form>
      </Modal>

      {/* Edit Case Info Modal */}
      <Modal isOpen={editInfoModal} onClose={() => setEditInfoModal(false)} title="Edit Case Info" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const changes: string[] = []
            if (editInfoForm.caseTitle !== caseItem.caseTitle) changes.push(`Title: "${caseItem.caseTitle}" → "${editInfoForm.caseTitle}"`)
            if (editInfoForm.caseType !== caseItem.caseType) changes.push(`Type: ${caseItem.caseType || '—'} → ${editInfoForm.caseType || '—'}`)
            if (editInfoForm.amount !== caseItem.amount) changes.push(`Amount: RM ${caseItem.amount.toLocaleString()} → RM ${editInfoForm.amount.toLocaleString()}`)
            if (editInfoForm.personInCharge !== caseItem.personInCharge) changes.push(`PIC: ${caseItem.personInCharge || '—'} → ${editInfoForm.personInCharge || '—'}`)
            updateCase(id, {
              caseTitle: editInfoForm.caseTitle,
              caseType: editInfoForm.caseType,
              amount: editInfoForm.amount,
              personInCharge: editInfoForm.personInCharge,
            })
            if (changes.length > 0) {
              addActivityLog({
                caseId: id,
                caseTitle: editInfoForm.caseTitle,
                actionType: 'CASE_UPDATED',
                title: 'Case info updated',
                description: changes.join('; '),
                changedBy: currentUser?.fullName ?? 'Unknown',
              })
            }
            setEditInfoModal(false)
          }}
          className="px-6 py-5 space-y-4"
        >
          <div>
            <label className="label">Case Title *</label>
            <input
              className="input"
              value={editInfoForm.caseTitle}
              onChange={e => setEditInfoForm(p => ({ ...p, caseTitle: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Case Type</label>
            <select
              className="input"
              value={editInfoForm.caseType}
              onChange={e => setEditInfoForm(p => ({ ...p, caseType: e.target.value }))}
            >
              <option value="">— Select type —</option>
              {caseTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Estimated Amount (RM)</label>
            <input
              className="input"
              type="number"
              min={0}
              value={editInfoForm.amount || ''}
              onChange={e => setEditInfoForm(p => ({ ...p, amount: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="label">Person in Charge</label>
            <select
              className="input"
              value={editInfoForm.personInCharge}
              onChange={e => setEditInfoForm(p => ({ ...p, personInCharge: e.target.value }))}
            >
              <option value="">— Select —</option>
              {pics.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setEditInfoModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Save Changes</button>
          </div>
        </form>
      </Modal>

      {scanFile && <AIScanPanel file={scanFile} onClose={() => setScanFile(null)} />}
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      {children}
    </div>
  )
}
