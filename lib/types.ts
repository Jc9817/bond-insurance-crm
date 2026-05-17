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
  currentStatus: CaseStatus
  result: string        // '', 'Won', 'Lost'
  closingRemarks: string
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
  expiryDate: string
  notes: string
}

export type CaseFile = {
  id: string
  caseId: string
  fileName: string
  fileSize: number
  fileType: string
  documentType: string
  uploadedBy: string
  uploadedAt: string
  aiScanned: boolean
  aiStatus: AiStatus
  aiExtractedData: AiExtractedData | null
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export type ActivityLog = {
  id: string
  action: string
  user: string
  target: string
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
