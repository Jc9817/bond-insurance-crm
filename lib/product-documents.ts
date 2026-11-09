import type { CaseProduct, CompanyType, Product, ProductDocument, RequiredDocument, WorkflowStep, WorkflowTemplate } from './types'

// Documents follow the products. A workflow has two parts — the process steps
// and the required documents. For a new business case left on "Automatic":
//
// - Documents: every selected product's documents (product_documents, set in
//   Settings → Product Master), each counted once. The list differs for
//   Sdn. Bhd. and Sole Proprietor customers.
// - Steps: one workflow, the most complete among the selected products'.
//
// Renewal, Claim, Endorsement and Servicing keep their own workflow, steps
// and documents. A workflow picked by hand also keeps its own documents.
//
// The documents themselves are one master list, kept as a workflow template
// (PRODUCT_DOCS_TEMPLATE_ID) so Settings can edit them and a file on a case
// keeps its checklist slot when products change.
//
// No server code here, so it is tested on its own (product-documents.test.mjs).

export const PRODUCT_DOCS_TEMPLATE_ID = 'wt_product_docs'

// Most complete first: when products differ, the first one found decides the steps
export const PRODUCT_WORKFLOWS = ['Bond Workflow', 'Project Insurance Workflow', 'Simple Policy Workflow']

const REQUEST_WORKFLOWS: Record<string, string> = {
  Renewal: 'Renewal Workflow',
  Claim: 'Claim Workflow',
  Endorsement: 'Endorsement Workflow',
  Servicing: 'Servicing Workflow',
}

/** Customers with no company type, and every other type, use the Sdn. Bhd. list. */
export const companyTypeFor = (businessType?: string): CompanyType =>
  businessType === 'Sole Proprietor' ? 'Sole Proprietor' : 'Sdn. Bhd.'

type Form = { caseType: string; requestType?: string; selectedProducts?: CaseProduct[] }

/** The workflow a case gets on "Automatic". */
export function automaticWorkflow(
  requestType: string | undefined, selected: CaseProduct[], products: Pick<Product, 'id' | 'workflowType'>[],
): { caseType: string; usesProductDocuments: boolean } {
  if (requestType && requestType !== 'New Business') {
    return { caseType: REQUEST_WORKFLOWS[requestType] ?? '', usesProductDocuments: false }
  }
  const workflows = selected.map(s =>
    products.find(p => p.id === s.productId)?.workflowType
      || (s.category === 'Bond' ? 'Bond Workflow' : 'Simple Policy Workflow'))
  const caseType = PRODUCT_WORKFLOWS.find(w => workflows.includes(w)) ?? workflows[0] ?? ''
  return { caseType, usesProductDocuments: selected.length > 0 }
}

/** The checklist for these products: each document once, required if any product requires it. */
export function productChecklist(
  selected: Pick<CaseProduct, 'productId'>[], businessType: string | undefined,
  links: ProductDocument[], masterDocs: RequiredDocument[],
): RequiredDocument[] {
  const companyType = companyTypeFor(businessType)
  const ids = new Set(selected.map(p => p.productId))
  const needed = links.filter(l => ids.has(l.productId) && l.companyType === companyType)
  return masterDocs
    .filter(d => d.isActive && needed.some(l => l.documentId === d.id))
    .map(d => ({ ...d, required: needed.some(l => l.documentId === d.id && l.required) }))
}

const orderedSteps = (t: WorkflowTemplate | null): WorkflowStep[] =>
  [...(t?.workflowSteps ?? [])].filter(s => s.isActive).sort((a, b) => a.order - b.order)

type Existing = { caseType: string; currentWorkflowStepId?: string; workflowTemplateId?: string }

/**
 * What to save for a case form's workflow (form.caseType '' means Automatic).
 * A case already past its first step keeps its steps when products change;
 * its documents still follow the products.
 */
export function workflowForSave(
  form: Form, products: Pick<Product, 'id' | 'workflowType'>[],
  findTemplate: (caseType: string) => WorkflowTemplate | null, existing?: Existing,
): { caseType: string; usesProductDocuments: boolean; currentWorkflowStepId?: string; workflowTemplateId?: string } {
  const auto = !form.caseType
  const resolved = auto
    ? automaticWorkflow(form.requestType, form.selectedProducts ?? [], products)
    : { caseType: form.caseType, usesProductDocuments: false }
  const keep = existing && {
    caseType: existing.caseType, usesProductDocuments: resolved.usesProductDocuments,
    currentWorkflowStepId: existing.currentWorkflowStepId, workflowTemplateId: existing.workflowTemplateId,
  }

  if (keep && resolved.caseType === existing.caseType) return keep
  if (keep && auto && existing.caseType) {
    const first = orderedSteps(findTemplate(existing.caseType))[0]
    const underWay = !!first && !!existing.currentWorkflowStepId && existing.currentWorkflowStepId !== first.id
    if (underWay || !resolved.caseType) return keep
  }

  const template = findTemplate(resolved.caseType)
  return { ...resolved, currentWorkflowStepId: orderedSteps(template)[0]?.id ?? '', workflowTemplateId: template?.id }
}
