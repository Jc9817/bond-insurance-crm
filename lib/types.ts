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
  workflowType?: string   // the workflow whose steps this product follows
}

export const COMPANY_TYPES = ['Sdn. Bhd.', 'Sole Proprietor', 'Partnership'] as const
export type CompanyType = (typeof COMPANY_TYPES)[number]

/** One document a product needs, for one company type (see lib/product-documents.ts). */
export type ProductDocument = {
  productId: string
  documentId: string      // a required_documents row in the master list
  companyType: CompanyType
  required: boolean       // false = optional
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
  caseNumber?: string     // readable "2026-005", given by the database when the case is created
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
  usesProductDocuments?: boolean  // checklist comes from selectedProducts, not the workflow's own list
  requestType?: string         // New Business | Renewal | Endorsement | Cancellation | Claim | Servicing
  selectedProducts?: CaseProduct[]  // products selected for this case (from Product Master)
  loaAiStatus?: LoaAiStatus     // defaults to 'Pending' when unset
}

// ─── Policies (fix list 5.1) ─────────────────────────────────────────────────
// One row per policy or bond; a case (one contract) can have several. A
// yearly renewal is a new row whose renewedFrom points at the old one, which
// becomes 'Renewed'.

export const POLICY_STATUSES = ['Pending', 'Active', 'Renewed', 'Expired', 'Cancelled'] as const
export type PolicyStatus = (typeof POLICY_STATUSES)[number]

export type Policy = {
  id: string
  caseId: string
  policyType: string          // e.g. Performance Bond, CAR, TPL
  policyNumber: string
  insurer: string
  sumInsured?: number
  premium?: number
  startDate?: string          // YYYY-MM-DD
  expiryDate?: string         // YYYY-MM-DD
  status: PolicyStatus
  caseFileId?: string         // the policy / bond document on the case
  renewedFrom?: string
  notes: string
  createdAt: string
  updatedAt?: string
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

// 'received': an email from the shared mailbox filed to this case (Emails screen)
export const CASE_EMAIL_STATUSES = ['sent', 'failed', 'received'] as const
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
  sharepointItemId?: string    // its copy in the SharePoint Customers library (fix list 4.4)
  sharepointUrl?: string       // link to open that copy
}


// ─── Emails screen (mail_messages) ───────────────────────────────────────────
// One row per email in the shared mailbox. Attachments stay in the mailbox
// until someone files them to a case.

export const MAIL_STATUSES = ['new', 'analysing', 'ready', 'filed', 'not_case'] as const
export type MailStatus = (typeof MAIL_STATUSES)[number]

export type MailAttachment = {
  id: string              // Microsoft's attachment id
  name: string
  size: number
  contentType: string
  filedTo?: { caseId: string; caseFileId: string; documentType: string }
  alsoFiledTo?: { caseId: string; caseFileId: string; documentType: string }[]   // later filings to other cases
}

/** Every case an attachment has been filed to, first one first. */
export const filedCases = (a: MailAttachment) => [...(a.filedTo ? [a.filedTo] : []), ...(a.alsoFiledTo ?? [])]

export const MAIL_ACTIONS = ['create_case', 'existing_case', 'split', 'not_case'] as const
export type MailAction = (typeof MAIL_ACTIONS)[number]

export type MailPolicySuggestion = {
  policyType: string
  policyNumber: string
  insurer: string
  sumInsured?: number
  startDate?: string      // YYYY-MM-DD
  expiryDate?: string
}

// Reference numbers kept against a case (case_references) so later emails
// carrying the same number find the case — see lib/mail-links.ts
export const REFERENCE_KINDS = ['quote', 'cover_note', 'policy', 'rfq', 'po', 'tender', 'loa', 'other'] as const
export type ReferenceKind = (typeof REFERENCE_KINDS)[number]
export type MailReference = { kind: ReferenceKind; value: string }

/** What the AI suggests for one email. Nothing is created until a person decides. */
export type MailSuggestion = {
  action: MailAction
  summary: string                        // one line, plain words
  confidence: number                     // 0–1
  customer?: { id?: string; name: string; ssm?: string; isNew: boolean }
  caseId?: string                        // the existing case, for existing_case
  caseTitle?: string                     // proposed title, for create_case
  caseType?: string                      // workflow, from CASE_TYPES
  requestType?: string                   // from REQUEST_TYPES
  principal?: string                     // employer / project owner
  amount?: number                        // contract value
  coverTypes?: string                    // e.g. "CAR + WC"
  references?: string                    // RFQ, PO, tender numbers, for display
  referenceNumbers?: MailReference[]     // the same, by kind; saved to the case when filed
  matchReason?: string                   // set when DocFlow chose the case: same thread, or a known reference
  policies: MailPolicySuggestion[]
  attachments: Record<string, { documentType: string; caseId?: string }>   // by attachment id
}

export type MailMessage = {
  id: string
  graphId: string
  conversationId?: string  // Outlook's thread id; replies and the original share it
  subject: string
  fromName: string
  fromAddress: string
  toRecipients: string
  ccRecipients: string
  receivedAt: string
  bodyText: string
  attachments: MailAttachment[]
  status: MailStatus
  aiSuggestion?: MailSuggestion | null
  aiError?: string
  caseIds: string[]
  decidedBy?: string
  decidedAt?: string
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

