// ─── Customer ────────────────────────────────────────────────────────────────

export type Customer = {
  id: string
  customerName: string
  companyRegistrationNo: string
  industry: string
  mainPhone: string
  mainEmail: string
  notes: string
  createdAt: string
}

// ─── Contact ─────────────────────────────────────────────────────────────────

export const CONTACT_TYPES = [
  'Owner',
  'Director',
  'Manager',
  'Finance',
  'Operations',
  'Worker',
  'Referral',
  'Introducer',
  'Other',
] as const
export type ContactType = (typeof CONTACT_TYPES)[number]

export type Contact = {
  id: string
  customerId: string
  contactName: string
  role: string
  phone: string
  email: string
  contactType: ContactType
  isPrimary: boolean
}

// ─── Case ────────────────────────────────────────────────────────────────────

export const CASE_STATUSES = [
  'New',
  'Waiting Documents',
  'Submitted',
  'Quoted',
  'Sent to Customer',
  'Confirmed',
  'Closed',
] as const
export type CaseStatus = (typeof CASE_STATUSES)[number]

export const CASE_TYPES = [
  'Bond Request',
  'Insurance Request',
  'Policy Issuance',
  'Renewal',
  'Endorsement',
  'Claim',
  'Servicing Request',
  'Quotation Request',
  'Other',
]

export type Case = {
  id: string
  caseTitle: string
  customerId: string
  customerName: string
  caseType: string
  amount: number
  personInCharge: string
  createdAt: string
  updatedAt?: string
  currentStatus: CaseStatus
  currentWorkflowStepId?: string
  result: string        // '', 'Won', 'Lost', 'Cancelled', 'On Hold'
  closingRemarks: string
  lossReason?: string
  finalAmount?: number
  finalInsurer?: string
  closedAt?: string
}

export type CaseNote = {
  id: string
  caseId: string
  content: string
  createdAt: string
  createdBy: string
}

// ─── Follow-Up ───────────────────────────────────────────────────────────────

export const FOLLOW_UP_STATUSES = ['Open', 'Done'] as const
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number]

export type FollowUp = {
  id: string
  title: string
  customerId: string
  customerName: string
  caseId: string
  caseTitle: string
  personInCharge: string
  dueDate: string
  status: FollowUpStatus
  createdAt: string
}

// ─── Settings ────────────────────────────────────────────────────────────────

export type PicUser = {
  id: string
  name: string
  email: string
}

export const INDUSTRIES = [
  'Construction',
  'Manufacturing',
  'Trading',
  'Retail',
  'Services',
  'Technology',
  'Healthcare',
  'Education',
  'Transportation',
  'Other',
]

// ─── Users & Auth ─────────────────────────────────────────────────────────────

export const USER_ROLES = ['Admin', 'Manager', 'Staff', 'Viewer'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const USER_STATUSES = ['Active', 'Inactive'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export type User = {
  id: string
  fullName: string
  email: string
  password: string
  role: UserRole
  status: UserStatus
  createdAt: string
}

// ─── Case Files ───────────────────────────────────────────────────────────────

export const AI_STATUSES = [
  'Not Scanned',
  'Processing',
  'Ready for Review',
  'Approved',
  'Rejected',
] as const
export type AiStatus = (typeof AI_STATUSES)[number]

export type AiExtractedData = {
  customerName: string
  projectName: string
  caseType: string
  amount: string
  bondValue: string
  expiryDate: string
  notes: string
  raw?: Record<string, unknown>   // full parsed response when a custom prompt schema is used
}

export type CaseFile = {
  id: string
  caseId: string
  fileName: string
  fileSize: number
  fileType: string
  documentType: string
  requiredDocumentId?: string   // links to RequiredDocument.id when uploaded via checklist
  uploadedBy: string
  uploadedAt: string
  aiScanned: boolean
  aiStatus: AiStatus
  aiExtractedData: AiExtractedData | null
  fileDataUrl?: string
  aiPrompt?: string            // extraction instructions copied from RequiredDocument at upload time
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export const ACTIVITY_LOG_ACTION_TYPES = [
  'CASE_CREATED',
  'STATUS_CHANGED',
  'WORKFLOW_STEP_CHANGED',
  'DOCUMENT_UPLOADED',
  'DOCUMENT_DELETED',
  'AI_SCAN_STARTED',
  'AI_SCAN_COMPLETED',
  'AI_EXTRACTION_APPROVED',
  'AI_EXTRACTION_REJECTED',
  'FOLLOW_UP_CREATED',
  'FOLLOW_UP_COMPLETED',
  'CASE_CLOSED',
  'CASE_REOPENED',
  'RESULT_SET',
  'NOTE_ADDED',
] as const
export type ActivityLogActionType = (typeof ACTIVITY_LOG_ACTION_TYPES)[number]

export type ActivityLog = {
  id: string
  caseId?: string
  caseTitle?: string
  actionType?: ActivityLogActionType
  title: string
  description?: string
  oldValue?: string
  newValue?: string
  changedBy: string
  timestamp: string
}

// ─── Editable Settings Items ──────────────────────────────────────────────────

export type SettingsItem = {
  id: string
  name: string
  isActive: boolean
}

export type SettingsCategory =
  | 'caseTypes'
  | 'industries'
  | 'contactTypes'
  | 'followUpCategories'
  | 'documentTypes'

// ─── Workflow Templates ───────────────────────────────────────────────────────

export type RequiredDocument = {
  id: string
  caseTypeId: string
  name: string
  description: string
  required: boolean            // true = required, false = optional
  acceptedFileTypes: string[]
  isActive: boolean
  aiPrompt?: string            // custom extraction instructions sent to AI when scanning this document
}

export type WorkflowStep = {
  id: string
  caseTypeId: string
  name: string
  order: number
  description: string
  requireDocumentsComplete: boolean
  defaultFollowUpSuggestion: string
  isActive: boolean
}

export type WorkflowTemplate = {
  id: string
  caseType: string              // matches Case.caseType
  description: string
  requiredDocuments: RequiredDocument[]
  workflowSteps: WorkflowStep[]
  isActive: boolean
}
