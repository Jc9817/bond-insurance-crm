import type { Case, CaseFile, FollowUp, WorkflowTemplate, RequiredDocument, WorkflowStep } from './types'
import { getDaysUntil } from './utils'

export function getWorkflowTemplate(
  caseType: string,
  templates: WorkflowTemplate[]
): WorkflowTemplate | null {
  return templates.find(t => t.isActive && t.caseType === caseType) ?? null
}

export function getActiveSteps(template: WorkflowTemplate | null): WorkflowStep[] {
  if (!template) return []
  return [...template.workflowSteps.filter(s => s.isActive)].sort((a, b) => a.order - b.order)
}

export function getActiveDocs(template: WorkflowTemplate | null): RequiredDocument[] {
  if (!template) return []
  return template.requiredDocuments.filter(d => d.isActive)
}

export function getRequiredDocs(template: WorkflowTemplate | null): RequiredDocument[] {
  return getActiveDocs(template).filter(d => d.required)
}

export function getUploadedFileForDoc(
  docId: string,
  caseId: string,
  caseFiles: CaseFile[]
): CaseFile | undefined {
  return caseFiles.find(f => f.caseId === caseId && f.requiredDocumentId === docId)
}

export function getDocumentCompleteness(
  caseId: string,
  template: WorkflowTemplate | null,
  caseFiles: CaseFile[]
): number {
  if (!template) return 0
  const required = getRequiredDocs(template)
  if (required.length === 0) return 100
  const uploaded = required.filter(doc =>
    caseFiles.some(f => f.caseId === caseId && f.requiredDocumentId === doc.id)
  ).length
  return Math.round((uploaded / required.length) * 100)
}

export function getWorkflowProgress(
  currentWorkflowStepId: string | undefined,
  template: WorkflowTemplate | null
): number {
  if (!template || !currentWorkflowStepId) return 0
  const steps = getActiveSteps(template)
  if (steps.length === 0) return 0
  const currentIdx = steps.findIndex(s => s.id === currentWorkflowStepId)
  if (currentIdx < 0) return 0
  return Math.round((currentIdx / steps.length) * 100)
}

export function getFollowUpCompletion(caseId: string, followUps: FollowUp[]): number {
  const caseFus = followUps.filter(f => f.caseId === caseId)
  if (caseFus.length === 0) return 100
  const done = caseFus.filter(f => f.status === 'Done').length
  return Math.round((done / caseFus.length) * 100)
}

export function getCaseReadiness(
  caseItem: Case,
  template: WorkflowTemplate | null,
  caseFiles: CaseFile[],
  followUps: FollowUp[]
): number {
  const docScore = getDocumentCompleteness(caseItem.id, template, caseFiles) * 0.6
  const workflowScore = getWorkflowProgress(caseItem.currentWorkflowStepId, template) * 0.3
  const fuScore = getFollowUpCompletion(caseItem.id, followUps) * 0.1
  return Math.round(docScore + workflowScore + fuScore)
}

export function getMissingRequiredDocs(
  caseId: string,
  template: WorkflowTemplate | null,
  caseFiles: CaseFile[]
): RequiredDocument[] {
  if (!template) return []
  return getRequiredDocs(template).filter(
    doc => !caseFiles.some(f => f.caseId === caseId && f.requiredDocumentId === doc.id)
  )
}

export function getCurrentStep(
  currentWorkflowStepId: string | undefined,
  template: WorkflowTemplate | null
): WorkflowStep | null {
  if (!template || !currentWorkflowStepId) return null
  return template.workflowSteps.find(s => s.id === currentWorkflowStepId) ?? null
}

export function getNextStep(
  currentWorkflowStepId: string | undefined,
  template: WorkflowTemplate | null
): WorkflowStep | null {
  if (!template || !currentWorkflowStepId) return null
  const steps = getActiveSteps(template)
  const idx = steps.findIndex(s => s.id === currentWorkflowStepId)
  if (idx < 0 || idx >= steps.length - 1) return null
  return steps[idx + 1]
}

export function getNextRecommendedAction(
  caseItem: Case,
  template: WorkflowTemplate | null,
  caseFiles: CaseFile[],
  followUps: FollowUp[]
): string {
  if (!template) return 'Set a case type to see workflow guidance'

  // 1. Missing required documents
  const missing = getMissingRequiredDocs(caseItem.id, template, caseFiles)
  if (missing.length > 0) {
    return `Upload missing document: ${missing[0].name}`
  }

  // 2. Overdue follow-ups
  const overdueFollowUps = followUps.filter(f =>
    f.caseId === caseItem.id &&
    f.status === 'Open' &&
    getDaysUntil(f.dueDate) !== null &&
    (getDaysUntil(f.dueDate) as number) < 0
  )
  if (overdueFollowUps.length > 0) {
    return `Action overdue follow-up: ${overdueFollowUps[0].title}`
  }

  // 3. Move to next step
  const nextStep = getNextStep(caseItem.currentWorkflowStepId, template)
  if (nextStep) {
    return `Move to next step: ${nextStep.name}`
  }

  return 'All steps complete — close the case when ready'
}

export function isDocumentCheckComplete(
  caseId: string,
  template: WorkflowTemplate | null,
  caseFiles: CaseFile[]
): boolean {
  return getMissingRequiredDocs(caseId, template, caseFiles).length === 0
}

export function getStuckDays(caseItem: Case): number {
  const ref = caseItem.updatedAt ?? caseItem.createdAt
  const diff = new Date().getTime() - new Date(ref).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}
