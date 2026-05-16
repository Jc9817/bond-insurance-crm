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
