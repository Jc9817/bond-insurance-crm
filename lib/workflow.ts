import type { Case, CaseFile, FollowUp, WorkflowTemplate, RequiredDocument, WorkflowStep } from './types'
import { getDaysUntil } from './utils'

export function getWorkflowTemplate(
  caseType: string,
  templates: WorkflowTemplate[],
  businessType?: string
): WorkflowTemplate | null {
  const matching = templates.filter(t => t.isActive && t.caseType === caseType)
  if (matching.length === 0) return null

  // Prefer exact business-type match, fall back to generic (no businessType set)
  if (businessType) {
    const exact = matching.find(t => t.businessType === businessType)
    if (exact) return exact
  }
  return matching.find(t => !t.businessType) ?? matching[0]
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

/** Documents for a specific workflow step. Falls back to step-unassigned docs if stepId is null. */
export function getDocsForStep(
  template: WorkflowTemplate | null,
  stepId: string | null
): RequiredDocument[] {
  if (!template) return []
  const all = getActiveDocs(template)
  if (!stepId) return all.filter(d => !d.workflowStepId)
  return all.filter(d => d.workflowStepId === stepId || !d.workflowStepId)
}

/** Documents strictly assigned to this step only (not shared). */
export function getStepOwnedDocs(
  template: WorkflowTemplate | null,
  stepId: string
): RequiredDocument[] {
  if (!template) return []
  return getActiveDocs(template).filter(d => d.workflowStepId === stepId)
}

export function getStepDocumentCompleteness(
  caseId: string,
  template: WorkflowTemplate | null,
  stepId: string | null,
  caseFiles: CaseFile[]
): number {
  const docs = getDocsForStep(template, stepId)
  const required = docs.filter(d => d.required)
  if (required.length === 0) return 100
  const uploaded = required.filter(doc =>
    caseFiles.some(f => f.caseId === caseId && f.requiredDocumentId === doc.id)
  ).length
  return Math.round((uploaded / required.length) * 100)
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

export function getUnassignedFiles(
  caseId: string,
  template: WorkflowTemplate | null,
  caseFiles: CaseFile[]
): CaseFile[] {
  const docIds = template ? new Set(getActiveDocs(template).map(d => d.id)) : new Set<string>()
  return caseFiles.filter(
    f => f.caseId === caseId && (!f.requiredDocumentId || !docIds.has(f.requiredDocumentId))
  )
}

export function getStuckDays(caseItem: Case): number {
  const ref = caseItem.updatedAt ?? caseItem.createdAt
  const diff = new Date().getTime() - new Date(ref).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}
