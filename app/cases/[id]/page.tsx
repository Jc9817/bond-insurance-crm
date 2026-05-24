'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import type { CaseFile, WorkflowStep } from '@/lib/types'
import {
  getWorkflowTemplate, getActiveSteps, getCaseReadiness, getDocumentCompleteness,
  getMissingRequiredDocs, getCurrentStep, getNextStep, getUnassignedFiles,
  getDocsForStep, getStepDocumentCompleteness, getNextRecommendedAction,
} from '@/lib/workflow'
import { formatDate, formatCurrency, timeAgo, getDaysUntil } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import DocumentChecklist from '@/components/ui/DocumentChecklist'
import AIScanPanel from '@/components/ui/AIScanPanel'
import StagePipeline from '@/components/ui/StagePipeline'

type StageState = 'done' | 'current' | 'future'

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const {
    cases, customers, contacts, caseNotes, followUps, pics, workflowTemplates,
    activityLogs, updateCase, addCaseNote, addFollowUp, toggleFollowUp, deleteFollowUp,
    addActivityLog, caseFiles,
  } = useStore()
  const { currentUser } = useAuth()

  const caseItem = cases.find(c => c.id === id)

  // ── state ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'checklist' | 'info' | 'notes' | 'followups' | 'activity'>('checklist')
  const [noteText, setNoteText] = useState('')
  const [notePic, setNotePic] = useState(pics[0]?.name ?? '')
  const [followUpModal, setFollowUpModal] = useState(false)
  const [fuForm, setFuForm] = useState({ title: '', personInCharge: pics[0]?.name ?? '', dueDate: '' })
  const [scanFile, setScanFile] = useState<CaseFile | null>(null)
  const [editInfoModal, setEditInfoModal] = useState(false)
  const [editInfoForm, setEditInfoForm] = useState({ caseTitle: '', caseType: '', amount: 0, personInCharge: '' })
  const [closingModal, setClosingModal] = useState(false)
  const [closingForm, setClosingForm] = useState({
    result: '', closingRemarks: '', lossReason: '', finalAmount: 0, finalInsurer: '',
  })

  // Pipeline step modal
  const [stepModal, setStepModal] = useState<{
    step: WorkflowStep
    state: StageState
    dateEditOnly?: boolean
  } | null>(null)
  const [stepDate, setStepDate] = useState('')

  // Which step's checklist is currently shown (defaults to current step)
  const [viewingStepId, setViewingStepId] = useState<string | null>(null)

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
  const custContacts = contacts.filter(c => c.customerId === caseItem.customerId)

  // Active viewing step — default to current step
  const effectiveViewingStepId = viewingStepId ?? caseItem.currentWorkflowStepId ?? null
  const viewingStep = steps.find(s => s.id === effectiveViewingStepId) ?? null
  const currentStep = getCurrentStep(caseItem.currentWorkflowStepId, template)
  const nextStep = getNextStep(caseItem.currentWorkflowStepId, template)

  const stepCompleteness = getStepDocumentCompleteness(id, template, effectiveViewingStepId, caseDocs)
  const overallReadiness = getCaseReadiness(caseItem, template, caseFiles, followUps)
  const missingDocs = getMissingRequiredDocs(id, template, caseFiles)
  const caseFollowUps = followUps.filter(f => f.caseId === id)
  const openFollowUps = caseFollowUps.filter(f => f.status === 'Open')
  const notes = caseNotes
    .filter(n => n.caseId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const caseLogs = activityLogs
    .filter(l => l.caseId === id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // Most recent timestamp per step name
  const stepTimestamps = activityLogs
    .filter(log => log.caseId === id && log.actionType === 'WORKFLOW_STEP_CHANGED' && log.newValue)
    .reduce<Record<string, string>>((acc, log) => {
      if (!acc[log.newValue!]) acc[log.newValue!] = log.timestamp
      return acc
    }, {})

  // ── handlers ───────────────────────────────────────────────────────────────

  const handleStageClick = (step: WorkflowStep, state: StageState) => {
    const ts = stepTimestamps[step.name]
    setStepDate(ts ? new Date(ts).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16))
    setStepModal({ step, state, dateEditOnly: state === 'done' && step.id === caseItem.currentWorkflowStepId })
    setViewingStepId(step.id)
    setActiveTab('checklist')
  }

  const confirmStepChange = () => {
    if (!stepModal) return
    const ts = stepDate ? new Date(stepDate).toISOString() : new Date().toISOString()
    const prevStep = currentStep

    if (!stepModal.dateEditOnly) {
      updateCase(id, { currentWorkflowStepId: stepModal.step.id })
      setViewingStepId(stepModal.step.id)
    }
    addActivityLog({
      caseId: id,
      caseTitle: caseItem.caseTitle,
      actionType: 'WORKFLOW_STEP_CHANGED',
      title: stepModal.dateEditOnly ? 'Step date updated' : 'Workflow step changed',
      oldValue: prevStep?.name,
      newValue: stepModal.step.name,
      description: stepModal.dateEditOnly
        ? `Date updated for step: ${stepModal.step.name}`
        : `Moved to: ${stepModal.step.name}${prevStep ? ` from ${prevStep.name}` : ''}`,
      changedBy: currentUser?.fullName ?? 'Unknown',
      timestamp: ts,
    })
    setStepModal(null)
  }

  const submitNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteText.trim()) return
    addCaseNote({ caseId: id, content: noteText.trim(), createdBy: notePic })
    addActivityLog({
      caseId: id, caseTitle: caseItem.caseTitle, actionType: 'NOTE_ADDED',
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
      title: fuForm.title, customerId: caseItem.customerId, customerName: caseItem.customerName,
      caseId: id, caseTitle: caseItem.caseTitle, personInCharge: fuForm.personInCharge,
      dueDate: fuForm.dueDate, status: 'Open',
    })
    addActivityLog({
      caseId: id, caseTitle: caseItem.caseTitle, actionType: 'FOLLOW_UP_CREATED',
      title: 'Follow-up created', description: fuForm.title,
      changedBy: currentUser?.fullName ?? 'Unknown',
    })
    setFuForm({ title: '', personInCharge: pics[0]?.name ?? '', dueDate: '' })
    setFollowUpModal(false)
  }

  const submitClosing = (e: React.FormEvent) => {
    e.preventDefault()
    const isClosing = ['Won', 'Lost', 'Cancelled'].includes(closingForm.result)
    updateCase(id, {
      result: closingForm.result, closingRemarks: closingForm.closingRemarks,
      lossReason: closingForm.lossReason, finalAmount: closingForm.finalAmount,
      finalInsurer: closingForm.finalInsurer,
      ...(isClosing && !caseItem.closedAt ? { closedAt: new Date().toISOString() } : {}),
    })
    addActivityLog({
      caseId: id, caseTitle: caseItem.caseTitle,
      actionType: isClosing ? 'CASE_CLOSED' : 'RESULT_SET',
      title: closingForm.result ? `Case result: ${closingForm.result}` : 'Case result updated',
      oldValue: caseItem.result || undefined, newValue: closingForm.result || undefined,
      description: closingForm.closingRemarks || undefined,
      changedBy: currentUser?.fullName ?? 'Unknown',
    })
    setClosingModal(false)
  }

  const TABS = [
    { key: 'checklist' as const, label: `Documents${missingDocs.length > 0 ? ` (${missingDocs.length} missing)` : ''}` },
    { key: 'followups' as const, label: `Follow-Ups${openFollowUps.length > 0 ? ` (${openFollowUps.length})` : ''}` },
    { key: 'info' as const, label: 'Case Info' },
    { key: 'notes' as const, label: `Notes${notes.length > 0 ? ` (${notes.length})` : ''}` },
    { key: 'activity' as const, label: 'Activity' },
  ]

  const currentIdx = steps.findIndex(s => s.id === caseItem.currentWorkflowStepId)
  const viewingIdx = steps.findIndex(s => s.id === effectiveViewingStepId)

  return (
    <div className="max-w-screen-xl mx-auto">

      {/* ── Top header band ─────────────────────────────────────────────────── */}
      <div className="px-8 pt-6 pb-4 bg-white border-b border-gray-100">
        <div className="mb-3">
          <Link href="/cases" className="text-sm text-gray-400 hover:text-gray-600">← Cases</Link>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-tight">{caseItem.caseTitle}</h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-sm text-gray-500">
              {customer
                ? <Link href={`/customers/${customer.id}`} className="text-blue-600 hover:underline font-medium">{customer.customerName}</Link>
                : <span className="font-medium text-gray-700">{caseItem.customerName}</span>}
              {caseItem.caseType && <><span>·</span><span>{caseItem.caseType}</span></>}
              {caseItem.personInCharge && <><span>·</span><span>{caseItem.personInCharge}</span></>}
              {caseItem.amount > 0 && <><span>·</span><span className="font-semibold text-gray-700">{formatCurrency(caseItem.amount)}</span></>}
              {caseItem.result && <><span>·</span><StatusBadge status={caseItem.result} size="sm" /></>}
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
              Report
            </button>
            <button
              onClick={() => {
                setEditInfoForm({ caseTitle: caseItem.caseTitle, caseType: caseItem.caseType, amount: caseItem.amount, personInCharge: caseItem.personInCharge })
                setEditInfoModal(true)
              }}
              className="btn-secondary text-sm"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* ── Stage Pipeline ───────────────────────────────────────────────────── */}
      <div className="bg-stone-50 border-b border-gray-200 px-8 py-4">
        {steps.length === 0 ? (
          <div className="text-sm text-gray-400 py-2">No workflow template for this case type. <Link href="/settings" className="text-blue-600 hover:underline">Configure in Settings →</Link></div>
        ) : (
          <StagePipeline
            steps={steps}
            currentStepId={caseItem.currentWorkflowStepId ?? ''}
            stepTimestamps={stepTimestamps}
            result={caseItem.result}
            selectedStepId={effectiveViewingStepId ?? undefined}
            onStepSelect={(stepId) => { setViewingStepId(stepId); setActiveTab('checklist') }}
            onStageClick={handleStageClick}
            onResultClick={() => {
              setClosingForm({ result: caseItem.result, closingRemarks: caseItem.closingRemarks, lossReason: caseItem.lossReason ?? '', finalAmount: caseItem.finalAmount ?? caseItem.amount, finalInsurer: caseItem.finalInsurer ?? '' })
              setClosingModal(true)
            }}
          />
        )}
      </div>

      {/* ── Active step banner ───────────────────────────────────────────────── */}
      {steps.length > 0 && (
        <div className={`px-8 py-4 border-b ${
          viewingStep
            ? viewingIdx < currentIdx ? 'bg-green-50 border-green-100'
            : viewingIdx === currentIdx ? 'bg-blue-50 border-blue-100'
            : 'bg-gray-50 border-gray-100'
            : 'bg-gray-50 border-gray-100'
        }`}>
          <div className="flex items-start justify-between gap-6 flex-wrap">
            {/* Left: step identity + details */}
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 ${
                viewingIdx < currentIdx ? 'bg-green-500 text-white' :
                viewingIdx === currentIdx ? 'bg-blue-600 text-white' :
                'bg-gray-200 text-gray-500'
              }`}>
                {viewingIdx < currentIdx ? '✓' : (viewingIdx >= 0 ? viewingIdx + 1 : '?')}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className={`text-base font-bold ${
                    viewingIdx < currentIdx ? 'text-green-800' :
                    viewingIdx === currentIdx ? 'text-blue-800' :
                    'text-gray-600'
                  }`}>
                    {viewingStep?.name ?? 'No step selected'}
                  </p>
                  {viewingIdx === currentIdx && (
                    <span className="text-xs bg-blue-600 text-white rounded-full px-2 py-0.5 font-medium">Current</span>
                  )}
                  {viewingIdx < currentIdx && (
                    <span className="text-xs bg-green-500 text-white rounded-full px-2 py-0.5 font-medium">Completed</span>
                  )}
                  {viewingIdx > currentIdx && (
                    <span className="text-xs bg-gray-200 text-gray-500 rounded-full px-2 py-0.5 font-medium">Upcoming</span>
                  )}
                </div>
                {viewingStep?.description && (
                  <p className="text-xs text-gray-500 mb-2">{viewingStep.description}</p>
                )}
                {viewingStep?.defaultFollowUpSuggestion && (
                  <div className="inline-flex items-center gap-1.5 bg-blue-100/70 rounded-lg px-2.5 py-1 mb-2">
                    <svg className="w-3 h-3 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs text-blue-700">Suggested: {viewingStep.defaultFollowUpSuggestion}</span>
                  </div>
                )}
                {viewingStep?.requireDocumentsComplete && stepCompleteness < 100 && (
                  <div className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1 mb-2">
                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    Documents must be complete before advancing
                  </div>
                )}
                {viewingStep && (
                  <button
                    onClick={() => {
                      const ts = stepTimestamps[viewingStep.name]
                      setStepDate(ts ? new Date(ts).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16))
                      setStepModal({ step: viewingStep, state: viewingIdx < currentIdx ? 'done' : viewingIdx === currentIdx ? 'current' : 'future', dateEditOnly: true })
                    }}
                    className="flex items-center gap-1.5 group text-xs text-gray-500 hover:text-blue-600 transition-colors mt-1"
                  >
                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>
                      {stepTimestamps[viewingStep.name]
                        ? formatDate(stepTimestamps[viewingStep.name].split('T')[0])
                        : '— date not set'}
                    </span>
                    <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828A2 2 0 019 16.414V13z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Right: document readiness + advance */}
            <div className="flex flex-col items-end gap-3 shrink-0">
              <div className="bg-white/70 rounded-xl px-4 py-3 border border-gray-100 min-w-[180px]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-500 font-medium">Overall readiness</span>
                  <span className={`text-sm font-bold ${overallReadiness >= 70 ? 'text-green-600' : overallReadiness >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                    {overallReadiness}%
                  </span>
                </div>
                <div className="bg-gray-100 rounded-full h-1.5 mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${overallReadiness >= 70 ? 'bg-green-500' : overallReadiness >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${overallReadiness}%` }}
                  />
                </div>
                <p className={`text-xs font-medium ${missingDocs.length > 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {missingDocs.length > 0
                    ? `${missingDocs.length} required doc${missingDocs.length > 1 ? 's' : ''} missing`
                    : 'All required docs uploaded'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Next Best Action card ────────────────────────────────────────────── */}
      <NextBestAction
        missingDocs={missingDocs}
        followUps={caseFollowUps}
        nextStep={nextStep}
        currentStep={currentStep}
        onGoToDocs={() => { setActiveTab('checklist'); setViewingStepId(steps[0]?.id ?? null) }}
        onGoToFollowUps={() => setActiveTab('followups')}
        onAdvance={() => {
          if (!nextStep) return
          setStepDate(new Date().toISOString().slice(0, 16))
          setStepModal({ step: nextStep, state: 'future' })
        }}
        onSetResult={() => {
          setClosingForm({ result: caseItem.result, closingRemarks: caseItem.closingRemarks, lossReason: caseItem.lossReason ?? '', finalAmount: caseItem.finalAmount ?? caseItem.amount, finalInsurer: caseItem.finalInsurer ?? '' })
          setClosingModal(true)
        }}
        allDone={!nextStep && steps.length > 0 && missingDocs.length === 0}
      />

      {/* ── Tabs + content ────────────────────────────────────────────────────── */}
      <div className="px-8 py-5">
        <div className="flex gap-0 mb-5 border-b border-gray-200">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Documents / Checklist tab ─────────────────────────────────────── */}
        {activeTab === 'checklist' && (
          <div>
            {/* Step selector row */}
            {steps.length > 0 && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-xs text-gray-400 font-medium">Viewing checklist for:</span>
                {steps.map((step, idx) => {
                  const isViewing = effectiveViewingStepId === step.id
                  const sIdx = steps.findIndex(s => s.id === caseItem.currentWorkflowStepId)
                  const isDone = idx < sIdx
                  const isCurrent = idx === sIdx
                  return (
                    <button
                      key={step.id}
                      onClick={() => setViewingStepId(step.id)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors font-medium ${
                        isViewing ? 'bg-blue-600 text-white border-blue-600' :
                        isDone ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' :
                        isCurrent ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' :
                        'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {isDone ? '✓ ' : ''}{step.name}
                    </button>
                  )
                })}
                <button
                  onClick={() => setViewingStepId(null)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    effectiveViewingStepId === null ? 'bg-gray-700 text-white border-gray-700' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
              </div>
            )}

            <div className="card-section">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  {viewingStep ? `${viewingStep.name} — Checklist` : 'All Documents'}
                </h2>
                {unassignedDocs.length > 0 && (
                  <span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-amber-100 text-amber-700">
                    {unassignedDocs.length} unassigned file{unassignedDocs.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <DocumentChecklist
                caseId={id}
                caseTitle={caseItem.caseTitle}
                template={template}
                caseFiles={caseDocs}
                filterStepId={effectiveViewingStepId}
                readOnly={viewingIdx !== 0}
                onScanReady={file => setScanFile(file)}
              />
            </div>
          </div>
        )}

        {/* ── Follow-Ups tab ─────────────────────────────────────────────────── */}
        {activeTab === 'followups' && (
          <div className="card-section">
            <div className="flex items-center justify-between mb-5">
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
                className="btn-xs bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold"
              >
                + Add Follow-Up
              </button>
            </div>
            {currentStep?.defaultFollowUpSuggestion && openFollowUps.length === 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2">Suggested for current step:</p>
                <button
                  onClick={() => { setFuForm(prev => ({ ...prev, title: currentStep.defaultFollowUpSuggestion })); setFollowUpModal(true) }}
                  className="w-full text-left text-xs bg-blue-50 text-blue-700 rounded-xl px-3 py-2 hover:bg-blue-100 transition-colors"
                >
                  + {currentStep.defaultFollowUpSuggestion}
                </button>
              </div>
            )}
            {caseFollowUps.length === 0 ? (
              <p className="text-sm text-gray-400">No follow-ups yet.</p>
            ) : (
              <div className="space-y-3">
                {caseFollowUps.map(f => {
                  const d = getDaysUntil(f.dueDate)
                  const isOD = d !== null && d < 0 && f.status === 'Open'
                  return (
                    <div key={f.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                      <button
                        onClick={() => {
                          const wasOpen = f.status === 'Open'
                          toggleFollowUp(f.id)
                          if (wasOpen) {
                            addActivityLog({ caseId: id, caseTitle: caseItem.caseTitle, actionType: 'FOLLOW_UP_COMPLETED', title: 'Follow-up completed', description: f.title, changedBy: currentUser?.fullName ?? 'Unknown' })
                          }
                        }}
                        className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                          f.status === 'Done' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {f.status === 'Done' && <span className="text-xs leading-none">✓</span>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${f.status === 'Done' ? 'line-through text-gray-400' : isOD ? 'text-red-700' : 'text-gray-800'}`}>
                          {f.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {f.personInCharge} · {f.dueDate ? formatDate(f.dueDate) : '—'}
                          {isOD && <span className="ml-1 text-red-500 font-medium">overdue</span>}
                        </p>
                      </div>
                      <button onClick={() => deleteFollowUp(f.id)} className="text-gray-200 hover:text-red-400 transition-colors">✕</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Case Info tab ──────────────────────────────────────────────────── */}
        {activeTab === 'info' && (
          <div className="card-section">
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              <DetailRow label="Customer">
                {customer
                  ? <Link href={`/customers/${customer.id}`} className="text-sm font-semibold text-blue-600 hover:underline">{customer.customerName}</Link>
                  : <span className="text-sm font-semibold text-gray-800">{caseItem.customerName}</span>}
              </DetailRow>
              <DetailRow label="Case Type"><span className="text-sm font-semibold text-gray-800">{caseItem.caseType || '—'}</span></DetailRow>
              <DetailRow label="Amount"><span className="text-lg font-bold text-gray-900">{formatCurrency(caseItem.amount)}</span></DetailRow>
              <DetailRow label="Person in Charge"><span className="text-sm font-semibold text-gray-800">{caseItem.personInCharge || '—'}</span></DetailRow>
              <DetailRow label="Created"><span className="text-sm text-gray-700">{formatDate(caseItem.createdAt.split('T')[0])}</span></DetailRow>
              <DetailRow label="Last Updated"><span className="text-sm text-gray-700">{caseItem.updatedAt ? timeAgo(caseItem.updatedAt) : '—'}</span></DetailRow>
              {caseItem.result && <DetailRow label="Result"><StatusBadge status={caseItem.result} size="md" /></DetailRow>}
              {caseItem.finalInsurer && <DetailRow label="Insurer / Provider"><span className="text-sm font-semibold text-gray-800">{caseItem.finalInsurer}</span></DetailRow>}
              {caseItem.finalAmount && caseItem.finalAmount !== caseItem.amount && (
                <DetailRow label="Final Amount"><span className="text-sm font-semibold text-gray-800">{formatCurrency(caseItem.finalAmount)}</span></DetailRow>
              )}
              {caseItem.closingRemarks && (
                <div className="col-span-2 md:col-span-3">
                  <p className="text-xs text-gray-400 mb-0.5">Closing Remarks</p>
                  <p className="text-sm text-gray-700">{caseItem.closingRemarks}</p>
                </div>
              )}
              {caseItem.lossReason && (
                <div className="col-span-2 md:col-span-3">
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
        )}

        {/* ── Notes tab ─────────────────────────────────────────────────────── */}
        {activeTab === 'notes' && (
          <div className="card-section">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Notes</h2>
            <form onSubmit={submitNote} className="mb-6 space-y-3">
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Write a note…" rows={3} className="input text-gray-900" />
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
        )}

        {/* ── Activity tab ──────────────────────────────────────────────────── */}
        {activeTab === 'activity' && (
          <div className="card-section">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Activity Timeline</h2>
            {caseLogs.length === 0 ? (
              <p className="text-sm text-gray-400">No activity recorded yet.</p>
            ) : (
              <div className="space-y-0">
                {caseLogs.map((log, idx) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-blue-200 mt-1.5 shrink-0" />
                      {idx < caseLogs.length - 1 && <div className="w-px flex-1 bg-gray-100 my-1" />}
                    </div>
                    <div className="pb-4 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{log.title}</p>
                      {log.description && <p className="text-xs text-gray-500 mt-0.5">{log.description}</p>}
                      {log.oldValue && log.newValue && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          <span className="line-through">{log.oldValue}</span> → <span className="font-medium text-gray-600">{log.newValue}</span>
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-gray-400">{timeAgo(log.timestamp)}</p>
                        {log.changedBy && <p className="text-xs text-gray-400">· {log.changedBy}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Step Change Modal ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!stepModal}
        onClose={() => setStepModal(null)}
        title={stepModal?.dateEditOnly ? 'Edit Step Date' : stepModal?.state === 'done' ? 'Change Step' : 'Advance to Step'}
        maxWidth="sm"
      >
        {stepModal && (
          <div className="px-6 py-5 space-y-4">
            <div className={`rounded-xl px-4 py-3 ${
              stepModal.state === 'done' ? 'bg-green-50' :
              stepModal.state === 'current' ? 'bg-blue-50' :
              'bg-gray-50'
            }`}>
              <p className="text-xs text-gray-400 mb-0.5">
                {stepModal.dateEditOnly ? 'Editing date for:' : stepModal.state === 'future' ? 'Moving to:' : 'Changing to:'}
              </p>
              <p className="text-base font-bold text-gray-900">{stepModal.step.name}</p>
              {stepModal.step.description && (
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{stepModal.step.description}</p>
              )}
            </div>
            {stepModal.step.requireDocumentsComplete && stepCompleteness < 100 && !stepModal.dateEditOnly && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-xs text-amber-700">This step requires all documents to be complete before advancing. Some required documents are still missing.</p>
              </div>
            )}
            <div>
              <label className="label">When did this happen?</label>
              <input type="datetime-local" className="input" value={stepDate} onChange={e => setStepDate(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1.5">Defaults to now. Backdate if this step was completed earlier.</p>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setStepModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={confirmStepChange} className={`flex-1 text-sm py-2.5 px-4 rounded-xl font-semibold transition-colors ${
                stepModal.state === 'future' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-800 hover:bg-gray-900 text-white'
              }`}>
                {stepModal.dateEditOnly ? 'Update Date' : stepModal.state === 'future' ? 'Advance Stage →' : 'Set Stage'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Case Result Modal ─────────────────────────────────────────────────── */}
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

      {/* ── Edit Case Info Modal ──────────────────────────────────────────────── */}
      <Modal isOpen={editInfoModal} onClose={() => setEditInfoModal(false)} title="Edit Case Info" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const changes: string[] = []
            if (editInfoForm.caseTitle !== caseItem.caseTitle) changes.push(`Title: "${caseItem.caseTitle}" → "${editInfoForm.caseTitle}"`)
            if (editInfoForm.caseType !== caseItem.caseType) changes.push(`Type: ${caseItem.caseType || '—'} → ${editInfoForm.caseType || '—'}`)
            if (editInfoForm.amount !== caseItem.amount) changes.push(`Amount: RM ${caseItem.amount.toLocaleString()} → RM ${editInfoForm.amount.toLocaleString()}`)
            if (editInfoForm.personInCharge !== caseItem.personInCharge) changes.push(`PIC: ${caseItem.personInCharge || '—'} → ${editInfoForm.personInCharge || '—'}`)
            updateCase(id, { caseTitle: editInfoForm.caseTitle, caseType: editInfoForm.caseType, amount: editInfoForm.amount, personInCharge: editInfoForm.personInCharge })
            if (changes.length > 0) {
              addActivityLog({ caseId: id, caseTitle: editInfoForm.caseTitle, actionType: 'CASE_UPDATED', title: 'Case info updated', description: changes.join('; '), changedBy: currentUser?.fullName ?? 'Unknown' })
            }
            setEditInfoModal(false)
          }}
          className="px-6 py-5 space-y-4"
        >
          <div>
            <label className="label">Case Title *</label>
            <input className="input" value={editInfoForm.caseTitle} onChange={e => setEditInfoForm(p => ({ ...p, caseTitle: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Case Type</label>
            <select className="input" value={editInfoForm.caseType} onChange={e => setEditInfoForm(p => ({ ...p, caseType: e.target.value }))}>
              <option value="">— Select type —</option>
              {caseTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Estimated Amount (RM)</label>
            <input className="input" type="number" min={0} value={editInfoForm.amount || ''} onChange={e => setEditInfoForm(p => ({ ...p, amount: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Person in Charge</label>
            <select className="input" value={editInfoForm.personInCharge} onChange={e => setEditInfoForm(p => ({ ...p, personInCharge: e.target.value }))}>
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

      {/* ── Add Follow-Up Modal ───────────────────────────────────────────────── */}
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

// ─── Next Best Action Card ────────────────────────────────────────────────────

import type { RequiredDocument, FollowUp, WorkflowStep as WStep } from '@/lib/types'
import { getDaysUntil as daysUntil } from '@/lib/utils'

function NextBestAction({
  missingDocs, followUps, nextStep, currentStep, allDone,
  onGoToDocs, onGoToFollowUps, onAdvance, onSetResult,
}: {
  missingDocs: RequiredDocument[]
  followUps: FollowUp[]
  nextStep: WStep | null
  currentStep: WStep | null
  allDone: boolean
  onGoToDocs: () => void
  onGoToFollowUps: () => void
  onAdvance: () => void
  onSetResult: () => void
}) {
  const overdueFollowUps = followUps.filter(f => {
    const d = daysUntil(f.dueDate)
    return f.status === 'Open' && d !== null && d < 0
  })
  const dueSoonFollowUps = followUps.filter(f => {
    const d = daysUntil(f.dueDate)
    return f.status === 'Open' && d !== null && d >= 0 && d <= 3
  })
  const openFollowUps = followUps.filter(f => f.status === 'Open')

  type Action = { id: string; priority: 'high' | 'medium' | 'low'; label: string; sub?: string; onClick: () => void }
  const actions: Action[] = []

  missingDocs.forEach(doc => {
    actions.push({
      id: `doc-${doc.id}`,
      priority: 'high',
      label: `Upload ${doc.name}`,
      sub: doc.description || 'Required document missing',
      onClick: onGoToDocs,
    })
  })

  overdueFollowUps.forEach(f => {
    const d = daysUntil(f.dueDate)
    actions.push({
      id: `fu-od-${f.id}`,
      priority: 'high',
      label: f.title,
      sub: `Overdue by ${Math.abs(d!)} day${Math.abs(d!) !== 1 ? 's' : ''}`,
      onClick: onGoToFollowUps,
    })
  })

  dueSoonFollowUps.forEach(f => {
    const d = daysUntil(f.dueDate)
    actions.push({
      id: `fu-soon-${f.id}`,
      priority: 'medium',
      label: f.title,
      sub: d === 0 ? 'Due today' : `Due in ${d} day${d !== 1 ? 's' : ''}`,
      onClick: onGoToFollowUps,
    })
  })

  if (nextStep && missingDocs.length === 0) {
    actions.push({
      id: 'advance',
      priority: 'low',
      label: `Advance to: ${nextStep.name}`,
      sub: nextStep.description || undefined,
      onClick: onAdvance,
    })
  }

  if (allDone) {
    actions.push({
      id: 'close',
      priority: 'low',
      label: 'All steps complete — set final result',
      sub: 'Close or mark the case outcome',
      onClick: onSetResult,
    })
  }

  if (openFollowUps.length > 0 && overdueFollowUps.length === 0 && dueSoonFollowUps.length === 0) {
    actions.push({
      id: 'fu-open',
      priority: 'low',
      label: `${openFollowUps.length} open follow-up${openFollowUps.length > 1 ? 's' : ''} pending`,
      sub: 'Review and action outstanding follow-ups',
      onClick: onGoToFollowUps,
    })
  }

  if (actions.length === 0) return null

  const dotColor = (p: Action['priority']) =>
    p === 'high' ? 'bg-red-500' : p === 'medium' ? 'bg-amber-400' : 'bg-blue-500'
  const rowBg = (p: Action['priority']) =>
    p === 'high' ? 'hover:bg-red-50' : p === 'medium' ? 'hover:bg-amber-50' : 'hover:bg-blue-50'

  return (
    <div className="mx-8 mb-4 border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Next Actions</span>
        <span className="ml-auto text-xs text-gray-400">{actions.filter(a => a.priority === 'high').length > 0 ? `${actions.filter(a => a.priority === 'high').length} urgent` : `${actions.length} item${actions.length !== 1 ? 's' : ''}`}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {actions.map(action => (
          <button
            key={action.id}
            onClick={action.onClick}
            className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${rowBg(action.priority)}`}
          >
            <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor(action.priority)}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 leading-tight">{action.label}</p>
              {action.sub && <p className="text-xs text-gray-400 mt-0.5">{action.sub}</p>}
            </div>
            <svg className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}
