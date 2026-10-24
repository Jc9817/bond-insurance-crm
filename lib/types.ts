// ─── Customer ────────────────────────────────────────────────────────────────

export const BUSINESS_TYPES = [
  'Sole Proprietor',
  'Partnership',
  'Sdn. Bhd.',
  'Bhd.',
  'PLT (LLP)',
  'Other',
] as const
export type BusinessType = (typeof BUSINESS_TYPES)[number]

export type Customer = {
  id: string
  customerName: string
  companyRegistrationNo: string
  businessType: string          // Sole Proprietor | Sdn. Bhd. | etc.
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
  notes: string
}

// ─── Request Types ────────────────────────────────────────────────────────────

export const REQUEST_TYPES = [
  'New Business',
  'Renewal',
  'Endorsement',
  'Cancellation',
  'Claim',
  'Servicing',
] as const
export type RequestType = (typeof REQUEST_TYPES)[number]

// ─── Product Master ───────────────────────────────────────────────────────────

export const PRODUCT_CATEGORIES = ['Bond', 'Insurance', 'Other'] as const
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export type Product = {
  id: string
  name: string
  category: ProductCategory
  description: string
  isActive: boolean
}

export type ProductPackage = {
  id: string
  name: string
  description: string
  productIds: string[]
  isActive: boolean
}

export type CaseProduct = {
  productId: string
  productName: string
  category: string
}

// ─── Case ────────────────────────────────────────────────────────────────────

export const CASE_STATUSES = [
  'Created',
  'In Progress',
  'Done',
] as const
export type CaseStatus = (typeof CASE_STATUSES)[number]

export const CASE_TYPES = [
  'Bond Workflow',
  'Simple Policy Workflow',
  'Project Insurance Workflow',
  'Claim Workflow',
  'Renewal Workflow',
  'Endorsement Workflow',
  'Servicing Workflow',
]

export const WAITING_FOR_OPTIONS = ['Customer', 'Insurer', 'Internal'] as const
export type WaitingFor = (typeof WAITING_FOR_OPTIONS)[number]

// Tracks whether the case's Letter of Award has had its AI extraction run —
// 'Manual' covers staff doing the extraction by hand instead of via AI.
// Display-only in the CRM UI — set by the upload/review bots, not editable there.
export const LOA_AI_STATUSES = ['Pending', 'Extracted', 'Manual'] as const
export type LoaAiStatus = (typeof LOA_AI_STATUSES)[number]

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
  bondPrincipal?: string     // entity named on the bond (if different from customer)
  bondExpiryDate?: string   // ISO date — when the bond expires
  waitingFor?: WaitingFor | null  // who is currently blocking progress
  archivedAt?: string       // set when case is archived (soft delete)
  acceptanceDate?: string   // date customer confirmed / accepted the quotation
  acceptedBy?: string       // name of contact who confirmed acceptance
  workflowTemplateId?: string  // snapshot of template ID at case creation — insulates from future template edits
  requestType?: string         // New Business | Renewal | Endorsement | Cancellation | Claim | Servicing
  selectedProducts?: CaseProduct[]  // products selected for this case (from Product Master)
  loaAiStatus?: LoaAiStatus     // defaults to 'Pending' when unset
}

export type CaseNote = {
  id: string
  caseId: string
  content: string
  createdAt: string
  createdBy: string
}

// ─── Email Templates ─────────────────────────────────────────────────────────
// Reusable customer-facing email templates, picked manually from a case's Emails tab.
// Supports {{customerName}}, {{caseTitle}}, {{amount}}, {{personInCharge}}.

export type EmailTemplate = {
  id: string
  name: string
  isActive: boolean
  subject: string
  body: string
}

export const CASE_EMAIL_STATUSES = ['sent', 'failed'] as const
export type CaseEmailStatus = (typeof CASE_EMAIL_STATUSES)[number]

export type CaseEmailLog = {
  id: string
  caseId: string
  templateName?: string
  toEmail: string
  subject: string
  body: string
  status: CaseEmailStatus
  errorMessage?: string
  sentAt: string
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

// Must match the check constraint on user_roles.role
export const USER_ROLES = ['Admin', 'Staff'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const USER_STATUSES = ['Active', 'Inactive'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

// A row of user_roles; id is the Supabase Auth user id. Passwords live only
// in Supabase Auth and are set through /api/admin/users.
export type User = {
  id: string
  fullName: string
  email: string
  role: UserRole
  status: UserStatus
  createdAt: string
}

// ─── Case Files ───────────────────────────────────────────────────────────────

// Driven by an n8n workflow: Pending (not scanned yet) -> Processing (n8n
// triggered, awaiting result) -> Extracted (n8n reported success, data
// filled in) or Failed (n8n reported an extraction error).
export const AI_STATUSES = [
  'Pending',
  'Processing',
  'Extracted',
  'Failed',
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
  // n8n-driven pipeline's shape — one flat bucket of whatever fields matter
  // for this document type (e.g. an LOA sends award_date/award_amount/
  // awarding_body; a Bank Statement sends different keys entirely).
  // Rendered generically — no per-field whitelist to maintain per doc type.
  fields?: Record<string, string | null>
  reasoning?: string
  confidence?: string
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
  fileDataUrl?: string    // storage reference "storage:<path>" (lib/storage.ts), not file contents
  aiPrompt?: string            // extraction instructions copied from RequiredDocument at upload time
  supersededBy?: string        // id of the newer file that replaced this one
  fileHash?: string            // SHA-256 of the file — spots the same file arriving again
}


// ─── Unassigned Inbox (intake_items) ──────────────────────────────────────────
// One row per document that arrived from any channel, waiting to be filed.

export const INTAKE_SOURCES = ['telegram', 'email', 'sharepoint', 'upload'] as const
export type IntakeSource = (typeof INTAKE_SOURCES)[number]

export const INTAKE_STATUSES = [
  'received', 'processing', 'suggested', 'needs_review', 'approved', 'discarded', 'duplicate',
] as const
export type IntakeStatus = (typeof INTAKE_STATUSES)[number]

/** Statuses still waiting for a person — what the Inbox shows and counts. */
export const OPEN_INTAKE_STATUSES: readonly IntakeStatus[] = ['received', 'processing', 'suggested', 'needs_review']

export type IntakeItem = {
  id: string
  source: IntakeSource
  sender: string
  receivedAt: string
  fileName: string
  fileSize: number
  fileType: string
  fileRef?: string        // storage reference "storage:<path>"; loaded with the Inbox page
  fileHash?: string       // SHA-256 of the file
  status: IntakeStatus
  aiSuggestion?: Record<string, unknown> | null
  confidence?: number | null
  duplicateOf?: string
  caseId?: string
  caseFileId?: string
  decidedBy?: string
  decidedAt?: string
  sourceMeta: Record<string, unknown>
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
  'DOCUMENT_ASSIGNED',
  'CASE_UPDATED',
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
  | 'insurers'

// ─── Workflow Templates ───────────────────────────────────────────────────────

export type RequiredDocument = {
  id: string
  caseTypeId: string
  workflowStepId?: string      // if set, this document only appears on that specific step's checklist
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
  aiEmailEnabled?: boolean   // shows AI quotation email panel when this step is active
  aiEmailPrompt?: string     // custom AI prompt for composing the quotation email
  slaDays?: number           // max days allowed at this step before an SLA warning is shown
}

export type WorkflowTemplate = {
  id: string
  caseType: string              // matches Case.caseType
  businessType?: string         // if set, template only applies to customers of this business type
  description: string
  requiredDocuments: RequiredDocument[]
  workflowSteps: WorkflowStep[]
  isActive: boolean
}

// ─── Submission Letter Templates ─────────────────────────────────────────────

export type SubmissionLetterDocItem = {
  id: string
  labelInForm: string       // shown in form checkbox
  textTemplate: string      // letter line, supports {{contractor}} {{principal}} etc.
  defaultChecked: boolean
  subFieldType?: 'director' | 'guarantor' | 'bank' | 'premium'
}

export type SubmissionLetterTemplate = {
  id: string
  name: string
  isActive: boolean
  subjectLine: string       // supports {{bondAmount}}; rendered bold above the header table
  letterBody: string        // full letter text; use {{docList}} where the numbered list goes; supports all {{variables}}
  docItems: SubmissionLetterDocItem[]
}

