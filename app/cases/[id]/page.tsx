'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import type { CaseFile, WorkflowStep } from '@/lib/types'
import { WAITING_FOR_OPTIONS } from '@/lib/types'
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
import QuotationEmailPanel from '@/components/ui/QuotationEmailPanel'
import QuotationDocumentPanel from '@/components/ui/QuotationDocumentPanel'

type StageState = 'done' | 'current' | 'future'

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const {
    cases, customers, contacts, caseNotes, followUps, pics, workflowTemplates,
    activityLogs, updateCase, addCase, addCaseNote, addFollowUp, toggleFollowUp, deleteFollowUp,
    addActivityLog, caseFiles, settingsData,
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
  const [editInfoForm, setEditInfoForm] = useState({ caseTitle: '', caseType: '', amount: 0, personInCharge: '', bondPrincipal: '', bondExpiryDate: '', waitingFor: '', targetInsurer: '', customerId: '' })
  const [closingModal, setClosingModal] = useState(false)
  const [closingForm, setClosingForm] = useState({
    result: '', closingRemarks: '', lossReason: '', finalAmount: 0, finalInsurer: '', acceptanceDate: '', acceptedBy: '',
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

  // SLA: days since current step started
  const currentStepEnteredAt = currentStep
    ? stepTimestamps[currentStep.name]
      ? new Date(stepTimestamps[currentStep.name]).getTime()
      : new Date(caseItem.createdAt).getTime()
    : null
  const daysAtCurrentStep = currentStepEnteredAt
    ? Math.floor((Date.now() - currentStepEnteredAt) / 86400000)
    : null
  const slaBreached = currentStep?.slaDays != null && daysAtCurrentStep != null && daysAtCurrentStep > currentStep.slaDays && caseItem.currentStatus !== 'Closed'

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
      finalInsurer: closingForm.finalInsurer === '__other__' ? '' : closingForm.finalInsurer,
      acceptanceDate: closingForm.acceptanceDate || undefined,
      acceptedBy: closingForm.acceptedBy || undefined,
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
    { key: 'checklist' as const, label: `Workflow${missingDocs.length > 0 ? ` (${missingDocs.length} missing)` : ''}` },
    { key: 'followups' as const, label: `Follow-Ups${openFollowUps.length > 0 ? ` (${openFollowUps.length})` : ''}` },
    { key: 'info' as const, label: 'Case Info' },
    { key: 'notes' as const, label: `Notes${notes.length > 0 ? ` (${notes.length})` : ''}` },
    { key: 'activity' as const, label: `Activity${caseLogs.length > 0 ? ` (${caseLogs.length})` : ''}` },
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
              {caseItem.bondPrincipal && caseItem.bondPrincipal !== caseItem.customerName && (
                <><span className="text-gray-300">→</span><span className="font-medium text-indigo-700">Contractor: {caseItem.bondPrincipal}</span></>
              )}
              {caseItem.caseType && <><span>·</span><span>{caseItem.caseType}</span></>}
              {caseItem.personInCharge && <><span>·</span><span>{caseItem.personInCharge}</span></>}
              {caseItem.amount > 0 && <><span>·</span><span className="font-semibold text-gray-700">{formatCurrency(caseItem.amount)}</span></>}
              {caseItem.result && <><span>·</span><StatusBadge status={caseItem.result} size="sm" /></>}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {(caseItem.result === 'Won' || caseItem.currentStatus === 'Closed') && (
              <button
                onClick={() => {
                  const newId = addCase({
                    caseTitle: `${caseItem.caseTitle} — Renewal`,
                    customerId: caseItem.customerId,
                    customerName: caseItem.customerName,
                    bondPrincipal: caseItem.bondPrincipal,
                    caseType: caseItem.caseType,
                    amount: caseItem.finalAmount ?? caseItem.amount,
                    personInCharge: caseItem.personInCharge,
                    currentStatus: 'New',
                    currentWorkflowStepId: '',
                    result: '',
                    closingRemarks: '',
                    bondExpiryDate: undefined,
                    waitingFor: null,
                  })
                  router.push(`/cases/${newId}`)
                }}
                className="btn-secondary text-sm text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              >
                ↻ Renew
              </button>
            )}
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
                setEditInfoForm({ caseTitle: caseItem.caseTitle, caseType: caseItem.caseType, amount: caseItem.amount, personInCharge: caseItem.personInCharge, bondPrincipal: caseItem.bondPrincipal ?? '', bondExpiryDate: caseItem.bondExpiryDate ?? '', waitingFor: caseItem.waitingFor ?? '', targetInsurer: caseItem.finalInsurer ?? '', customerId: caseItem.customerId })
                setEditInfoModal(true)
              }}
              className="btn-secondary text-sm"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* ── Priority alert (max 1 shown, highest priority wins) ─────────────── */}
      {(() => {
        const expiryDays = caseItem.bondExpiryDate
          ? Math.ceil((new Date(caseItem.bondExpiryDate).getTime() - Date.now()) / 86400000)
          : null
        const warn = (color: string, msg: string, action?: React.ReactNode) => (
          <div className={`px-8 py-3 flex items-center justify-between gap-4 ${color}`}>
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-white shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-sm font-semibold text-white">{msg}</p>
            </div>
            {action}
          </div>
        )
        if (expiryDays !== null && expiryDays < 0 && caseItem.currentStatus !== 'Closed')
          return warn('bg-red-600', `Bond expired ${Math.abs(expiryDays)} day${Math.abs(expiryDays) !== 1 ? 's' : ''} ago — expired ${formatDate(caseItem.bondExpiryDate!)}`)
        if (slaBreached && currentStep)
          return warn('bg-orange-500', `SLA exceeded — ${daysAtCurrentStep} days at "${currentStep.name}" (limit: ${currentStep.slaDays} days)`)
        if (expiryDays !== null && expiryDays >= 0 && expiryDays <= 30 && caseItem.currentStatus !== 'Closed')
          return warn('bg-amber-500', `Bond expiring in ${expiryDays} day${expiryDays !== 1 ? 's' : ''} — expires ${formatDate(caseItem.bondExpiryDate!)}`)
        if (expiryDays !== null && expiryDays <= 90 && (caseItem.result === 'Won' || caseItem.currentStatus === 'Closed') && !caseFollowUps.some(f => f.title.toLowerCase().includes('renew') && f.status === 'Open'))
          return warn('bg-indigo-600', expiryDays < 0 ? 'Bond has expired — time to renew.' : `Bond expires in ${expiryDays} days — schedule renewal now.`,
            <button onClick={() => { setFuForm({ title: `Renew bond — ${caseItem.caseTitle}`, personInCharge: caseItem.personInCharge || (pics[0]?.name ?? ''), dueDate: caseItem.bondExpiryDate ? new Date(new Date(caseItem.bondExpiryDate).getTime() - 30 * 86400000).toISOString().split('T')[0] : '' }); setFollowUpModal(true) }} className="text-xs font-semibold bg-white text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 shrink-0">+ Schedule Renewal</button>
          )
        return null
      })()}

      {/* ── Stage Pipeline ───────────────────────────────────────────────────── */}
      <div className="bg-stone-50 border-b border-gray-200 px-8 py-4">
        {steps.length === 0 ? (
          <div className="text-sm text-gray-400 py-2">No workflow template for this case type. <Link href="/settings" className="text-blue-600 hover:underline">Configure in Settings →</Link></div>
        ) : (
          <>
            <StagePipeline
              steps={steps}
              currentStepId={caseItem.currentWorkflowStepId ?? ''}
              stepTimestamps={stepTimestamps}
              result={caseItem.result}
              selectedStepId={effectiveViewingStepId ?? undefined}
              onStepSelect={(stepId) => { setViewingStepId(stepId); setActiveTab('checklist') }}
              onStageClick={handleStageClick}
              onResultClick={() => {
                setClosingForm({ result: caseItem.result, closingRemarks: caseItem.closingRemarks, lossReason: caseItem.lossReason ?? '', finalAmount: caseItem.finalAmount ?? caseItem.amount, finalInsurer: caseItem.finalInsurer ?? '', acceptanceDate: caseItem.acceptanceDate ?? '', acceptedBy: caseItem.acceptedBy ?? '' })
                setClosingModal(true)
              }}
            />
          </>
        )}
      </div>

      {/* ── Step context bar ─────────────────────────────────────────────────── */}
      {steps.length > 0 && (
        <div className="px-8 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                viewingIdx < currentIdx ? 'bg-green-500 text-white' :
                viewingIdx === currentIdx ? 'bg-blue-600 text-white' :
                'bg-gray-200 text-gray-500'
              }`}>
                {viewingIdx < currentIdx ? '✓' : viewingIdx >= 0 ? viewingIdx + 1 : '?'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold ${
                    viewingIdx < currentIdx ? 'text-green-800' :
                    viewingIdx === currentIdx ? 'text-gray-900' : 'text-gray-400'
                  }`}>
                    {viewingStep?.name ?? 'No step selected'}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {viewingIdx >= 0 ? `Step ${viewingIdx + 1} of ${steps.length}` : ''}
                  </span>
                  {viewingIdx === currentIdx && <span className="shrink-0 text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">Active</span>}
                  {viewingIdx < currentIdx && <span className="shrink-0 text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">Done</span>}
                  {viewingIdx > currentIdx && <span className="shrink-0 text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-medium">Upcoming</span>}
                  {viewingStep && stepTimestamps[viewingStep.name] && (
                    <button
                      onClick={() => {
                        const ts = stepTimestamps[viewingStep.name]
                        setStepDate(ts ? new Date(ts).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16))
                        setStepModal({ step: viewingStep, state: viewingIdx < currentIdx ? 'done' : viewingIdx === currentIdx ? 'current' : 'future', dateEditOnly: true })
                      }}
                      className="shrink-0 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      {formatDate(stepTimestamps[viewingStep.name].split('T')[0])}
                    </button>
                  )}
                </div>
                {viewingStep?.description && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate max-w-md">{viewingStep.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                disabled={currentIdx <= 0}
                onClick={() => {
                  const prevStep = steps[currentIdx - 1]
                  if (!prevStep) return
                  setStepDate(new Date().toISOString().slice(0, 16))
                  setStepModal({ step: prevStep, state: 'done' })
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Back
              </button>
              <button
                disabled={currentIdx >= steps.length - 1}
                onClick={() => {
                  const nextStepNav = steps[currentIdx + 1]
                  if (!nextStepNav) return
                  setStepDate(new Date().toISOString().slice(0, 16))
                  setStepModal({ step: nextStepNav, state: 'future' })
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Advance →
              </button>
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
          setClosingForm({ result: caseItem.result, closingRemarks: caseItem.closingRemarks, lossReason: caseItem.lossReason ?? '', finalAmount: caseItem.finalAmount ?? caseItem.amount, finalInsurer: caseItem.finalInsurer ?? '', acceptanceDate: caseItem.acceptanceDate ?? '', acceptedBy: caseItem.acceptedBy ?? '' })
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

            {viewingStep?.aiEmailEnabled ? (
              /* ── Quotation step: documents + AI first, email second ── */
              <div className="space-y-5">
                <div className="card-section">
                  <QuotationDocumentPanel
                    caseId={id}
                    caseTitle={caseItem.caseTitle}
                    caseFiles={caseDocs}
                  />
                </div>
                <QuotationEmailPanel
                  caseItem={caseItem}
                  step={viewingStep}
                  customerName={customer?.customerName ?? caseItem.customerName}
                />
              </div>
            ) : (
              /* ── Regular step: required docs checklist ── */
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
                  readOnly={viewingIdx !== currentIdx}
                  onScanReady={file => setScanFile(file)}
                />
              </div>
            )}
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
                  setEditInfoForm({ caseTitle: caseItem.caseTitle, caseType: caseItem.caseType, amount: caseItem.amount, personInCharge: caseItem.personInCharge, bondPrincipal: caseItem.bondPrincipal ?? '', bondExpiryDate: caseItem.bondExpiryDate ?? '', waitingFor: caseItem.waitingFor ?? '', targetInsurer: caseItem.finalInsurer ?? '', customerId: caseItem.customerId })
                  setEditInfoModal(true)
                }}
                className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Edit
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              <DetailRow label="Main Contractor *">
                {customer
                  ? <Link href={`/customers/${customer.id}`} className="text-sm font-semibold text-blue-600 hover:underline">{customer.customerName}</Link>
                  : <span className="text-sm font-semibold text-gray-800">{caseItem.customerName}</span>}
              </DetailRow>
              <DetailRow label="Contractor">
                {caseItem.bondPrincipal
                  ? <span className="text-sm font-semibold text-indigo-700">{caseItem.bondPrincipal}</span>
                  : <span className="text-sm text-gray-400 italic">Same as Main Contractor</span>}
              </DetailRow>
              <DetailRow label="Case Type"><span className="text-sm font-semibold text-gray-800">{caseItem.caseType || '—'}</span></DetailRow>
              <DetailRow label="Amount"><span className="text-lg font-bold text-gray-900">{formatCurrency(caseItem.amount)}</span></DetailRow>
              <DetailRow label="Person in Charge"><span className="text-sm font-semibold text-gray-800">{caseItem.personInCharge || '—'}</span></DetailRow>
              <DetailRow label="Created"><span className="text-sm text-gray-700">{formatDate(caseItem.createdAt.split('T')[0])}</span></DetailRow>
              <DetailRow label="Last Updated"><span className="text-sm text-gray-700">{caseItem.updatedAt ? timeAgo(caseItem.updatedAt) : '—'}</span></DetailRow>
              <DetailRow label="Bond Expiry Date">
                {caseItem.bondExpiryDate ? (() => {
                  const days = Math.ceil((new Date(caseItem.bondExpiryDate).getTime() - Date.now()) / 86400000)
                  const urgent = days <= 30 && caseItem.currentStatus !== 'Closed'
                  return <span className={`text-sm font-semibold ${urgent ? 'text-red-600' : 'text-gray-800'}`}>{urgent && '⚠ '}{formatDate(caseItem.bondExpiryDate)}{days >= 0 ? ` (${days}d)` : ' (expired)'}</span>
                })() : <span className="text-sm text-gray-400">—</span>}
              </DetailRow>
              <DetailRow label="Waiting For">
                {caseItem.waitingFor ? (
                  <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${caseItem.waitingFor === 'Customer' ? 'bg-purple-100 text-purple-700' : caseItem.waitingFor === 'Insurer' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {caseItem.waitingFor}
                  </span>
                ) : <span className="text-sm text-gray-400">—</span>}
              </DetailRow>
              <DetailRow label="Target Insurer">
                {caseItem.finalInsurer
                  ? <span className="text-sm font-semibold text-blue-700">{caseItem.finalInsurer}</span>
                  : <span className="text-sm text-gray-400">— not set</span>}
              </DetailRow>
              {caseItem.result && <DetailRow label="Result"><StatusBadge status={caseItem.result} size="md" /></DetailRow>}
              {caseItem.acceptanceDate && <DetailRow label="Acceptance Date"><span className="text-sm font-semibold text-gray-800">{formatDate(caseItem.acceptanceDate)}</span></DetailRow>}
              {caseItem.acceptedBy && <DetailRow label="Accepted By"><span className="text-sm font-semibold text-gray-800">{caseItem.acceptedBy}</span></DetailRow>}
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
            <select className="input" value={closingForm.finalInsurer} onChange={e => setClosingForm(p => ({ ...p, finalInsurer: e.target.value }))}>
              <option value="">— Select insurer —</option>
              {settingsData.insurers.filter(i => i.isActive).map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
              <option value="__other__">Other (type below)</option>
            </select>
            {closingForm.finalInsurer === '__other__' && (
              <input className="input mt-2" placeholder="Enter insurer name…" onChange={e => setClosingForm(p => ({ ...p, finalInsurer: e.target.value }))} />
            )}
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
          {(closingForm.result === 'Won' || closingForm.result === 'Confirmed') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Acceptance Date</label>
                <input className="input" type="date" value={closingForm.acceptanceDate} onChange={e => setClosingForm(p => ({ ...p, acceptanceDate: e.target.value }))} />
              </div>
              <div>
                <label className="label">Accepted By (contact name)</label>
                <input className="input" value={closingForm.acceptedBy} onChange={e => setClosingForm(p => ({ ...p, acceptedBy: e.target.value }))} placeholder="e.g. Ahmad Razif" />
              </div>
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
            const newCustomer = customers.find(c => c.id === editInfoForm.customerId)
            if (editInfoForm.customerId !== caseItem.customerId) changes.push(`Main Contractor: ${caseItem.customerName} → ${newCustomer?.customerName ?? '—'}`)
            if (editInfoForm.caseTitle !== caseItem.caseTitle) changes.push(`Title: "${caseItem.caseTitle}" → "${editInfoForm.caseTitle}"`)
            if (editInfoForm.caseType !== caseItem.caseType) changes.push(`Type: ${caseItem.caseType || '—'} → ${editInfoForm.caseType || '—'}`)
            if (editInfoForm.amount !== caseItem.amount) changes.push(`Amount: RM ${caseItem.amount.toLocaleString()} → RM ${editInfoForm.amount.toLocaleString()}`)
            if (editInfoForm.personInCharge !== caseItem.personInCharge) changes.push(`Person in Charge: ${caseItem.personInCharge || '—'} → ${editInfoForm.personInCharge || '—'}`)
            if (editInfoForm.bondPrincipal !== (caseItem.bondPrincipal ?? '')) changes.push(`Contractor: ${caseItem.bondPrincipal || '—'} → ${editInfoForm.bondPrincipal || '—'}`)
            if (editInfoForm.bondExpiryDate !== (caseItem.bondExpiryDate ?? '')) changes.push(`Bond Expiry: ${caseItem.bondExpiryDate || '—'} → ${editInfoForm.bondExpiryDate || '—'}`)
            if (editInfoForm.waitingFor !== (caseItem.waitingFor ?? '')) changes.push(`Waiting For: ${caseItem.waitingFor || '—'} → ${editInfoForm.waitingFor || '—'}`)
            if (editInfoForm.targetInsurer !== (caseItem.finalInsurer ?? '')) changes.push(`Target Insurer: ${caseItem.finalInsurer || '—'} → ${editInfoForm.targetInsurer || '—'}`)
            updateCase(id, { customerId: editInfoForm.customerId, customerName: newCustomer?.customerName ?? caseItem.customerName, caseTitle: editInfoForm.caseTitle, caseType: editInfoForm.caseType, amount: editInfoForm.amount, personInCharge: editInfoForm.personInCharge, bondPrincipal: editInfoForm.bondPrincipal || undefined, bondExpiryDate: editInfoForm.bondExpiryDate || undefined, waitingFor: (editInfoForm.waitingFor as typeof WAITING_FOR_OPTIONS[number]) || null, finalInsurer: editInfoForm.targetInsurer || undefined })
            if (changes.length > 0) {
              addActivityLog({ caseId: id, caseTitle: editInfoForm.caseTitle, actionType: 'CASE_UPDATED', title: 'Case info updated', description: changes.join('; '), changedBy: currentUser?.fullName ?? 'Unknown' })
            }
            setEditInfoModal(false)
          }}
          className="px-6 py-5 space-y-4"
        >
          <div>
            <label className="label">Main Contractor *</label>
            <select className="input" value={editInfoForm.customerId} onChange={e => setEditInfoForm(p => ({ ...p, customerId: e.target.value }))} required>
              <option value="">— Select Main Contractor —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.customerName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Case Title *</label>
            <input className="input" value={editInfoForm.caseTitle} onChange={e => setEditInfoForm(p => ({ ...p, caseTitle: e.target.value }))} required />
          </div>
          <div>
            <label className="label">
              Contractor <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              className="input"
              value={editInfoForm.bondPrincipal}
              onChange={e => setEditInfoForm(p => ({ ...p, bondPrincipal: e.target.value }))}
              placeholder="Leave blank if Main Contractor is doing the work directly"
            />
            <p className="text-xs text-gray-400 mt-1">
              Fill in only if a <strong>sub-contractor</strong> is executing the works under the Main Contractor's name or licence. If left blank, the Main Contractor is assumed to be the Contractor.
            </p>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Bond Expiry Date</label>
              <input className="input" type="date" value={editInfoForm.bondExpiryDate} onChange={e => setEditInfoForm(p => ({ ...p, bondExpiryDate: e.target.value }))} />
            </div>
            <div>
              <label className="label">Waiting For</label>
              <select className="input" value={editInfoForm.waitingFor} onChange={e => setEditInfoForm(p => ({ ...p, waitingFor: e.target.value }))}>
                <option value="">— Not waiting —</option>
                {WAITING_FOR_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Target Insurer <span className="text-gray-400 font-normal">(insurer this case is submitted to)</span></label>
            <select className="input" value={editInfoForm.targetInsurer} onChange={e => setEditInfoForm(p => ({ ...p, targetInsurer: e.target.value }))}>
              <option value="">— None —</option>
              {settingsData.insurers.filter(i => i.isActive).map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
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

// ─── What To Do Now Card ──────────────────────────────────────────────────────

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

  type Primary = { urgency: 'urgent' | 'warning' | 'ready' | 'normal'; badge: string; headline: string; detail: string; cta: string; onClick: () => void }

  let primary: Primary | null = null

  if (overdueFollowUps.length > 0) {
    const f = overdueFollowUps[0]
    const d = daysUntil(f.dueDate)
    primary = { urgency: 'urgent', badge: 'Overdue', headline: f.title, detail: `${Math.abs(d!)} day${Math.abs(d!) !== 1 ? 's' : ''} past due — action needed immediately`, cta: 'View Follow-Ups', onClick: onGoToFollowUps }
  } else if (missingDocs.length > 0) {
    const names = missingDocs.slice(0, 2).map(d => d.name).join(', ') + (missingDocs.length > 2 ? ` + ${missingDocs.length - 2} more` : '')
    primary = { urgency: 'urgent', badge: 'Documents Required', headline: missingDocs.length === 1 ? `Upload: ${missingDocs[0].name}` : `${missingDocs.length} required documents missing`, detail: names, cta: 'Go to Document Checklist', onClick: onGoToDocs }
  } else if (currentStep?.aiEmailEnabled) {
    primary = { urgency: 'normal', badge: 'Ready to Send', headline: 'Send quotation email to insurers', detail: 'All documents are uploaded. Compose and send the quotation request to receive quotes.', cta: 'Open Email Panel', onClick: onGoToDocs }
  } else if (dueSoonFollowUps.length > 0) {
    const f = dueSoonFollowUps[0]
    const d = daysUntil(f.dueDate)
    primary = { urgency: 'warning', badge: d === 0 ? 'Due Today' : 'Due Soon', headline: f.title, detail: d === 0 ? 'This follow-up is due today' : `Due in ${d} day${d !== 1 ? 's' : ''}`, cta: 'View Follow-Ups', onClick: onGoToFollowUps }
  } else if (nextStep) {
    primary = { urgency: 'ready', badge: 'Step Complete', headline: `Advance to: ${nextStep.name}`, detail: nextStep.description || 'All tasks for this step are complete. You can now move to the next stage.', cta: `Advance to ${nextStep.name}`, onClick: onAdvance }
  } else if (allDone) {
    primary = { urgency: 'ready', badge: 'All Done', headline: 'Record the final case result', detail: 'All workflow steps are complete. Close this case by recording the outcome.', cta: 'Record Case Result', onClick: onSetResult }
  } else if (openFollowUps.length > 0) {
    primary = { urgency: 'normal', badge: 'Follow-Up', headline: `${openFollowUps.length} open follow-up${openFollowUps.length !== 1 ? 's' : ''} pending`, detail: 'Review and action your outstanding follow-ups for this case.', cta: 'View Follow-Ups', onClick: onGoToFollowUps }
  }

  if (!primary) return null

  const styles = {
    urgent: { card: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', btn: 'bg-red-600 hover:bg-red-700 text-white' },
    warning: { card: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', btn: 'bg-amber-600 hover:bg-amber-700 text-white' },
    ready: { card: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700', btn: 'bg-green-600 hover:bg-green-700 text-white' },
    normal: { card: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700', btn: 'bg-blue-600 hover:bg-blue-700 text-white' },
  }[primary.urgency]

  return (
    <div className="px-8 py-4">
      <div className={`rounded-2xl border-2 ${styles.card} p-5`}>
        <span className={`inline-block text-xs font-bold rounded-full px-2.5 py-0.5 mb-3 uppercase tracking-wide ${styles.badge}`}>
          {primary.badge}
        </span>
        <h3 className="text-lg font-bold text-gray-900 leading-snug mb-1.5">{primary.headline}</h3>
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">{primary.detail}</p>
        <button
          onClick={primary.onClick}
          className={`inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors ${styles.btn}`}
        >
          {primary.cta}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
