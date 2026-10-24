'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { createClient } from '@/utils/supabase/client'
import type {
  Customer, Contact, Case, CaseNote, FollowUp, PicUser,
  User, CaseFile, ActivityLog, SettingsItem, SettingsCategory,
  WorkflowTemplate, RequiredDocument, WorkflowStep,
  Product, ProductPackage, SubmissionLetterTemplate, EmailTemplate, CaseEmailLog, TelegramUpload,
} from './types'
import { mockWorkflowTemplates } from './mock-data'
import { generateId, nowIso } from './utils'
import { getWorkflowTemplate } from './workflow'
import { STORAGE_BUCKET, storagePath } from './storage'

type SettingsData = Record<SettingsCategory, SettingsItem[]>

type StoreCtx = {
  customers: Customer[]
  contacts: Contact[]
  cases: Case[]
  caseNotes: CaseNote[]
  followUps: FollowUp[]
  pics: PicUser[]
  users: User[]
  caseFiles: CaseFile[]
  activityLogs: ActivityLog[]
  settingsData: SettingsData
  workflowTemplates: WorkflowTemplate[]
  products: Product[]
  productPackages: ProductPackage[]
  emailTemplates: EmailTemplate[]
  caseEmails: CaseEmailLog[]
  telegramUploads: TelegramUpload[]
  loading: boolean

  // Load what the startup load leaves out (see loadAll): call when a case or
  // the Inbox is opened.
  loadCase: (caseId: string) => Promise<void>
  loadInbox: () => Promise<void>

  addCustomer: (c: Omit<Customer, 'id' | 'createdAt'>) => string
  updateCustomer: (id: string, c: Partial<Customer>) => void
  deleteCustomer: (id: string) => void

  addContact: (c: Omit<Contact, 'id'>) => void
  updateContact: (id: string, c: Partial<Contact>) => void
  deleteContact: (id: string) => void
  setPrimaryContact: (customerId: string, contactId: string) => void

  addCase: (c: Omit<Case, 'id' | 'createdAt'>) => string
  updateCase: (id: string, c: Partial<Case>) => void
  deleteCase: (id: string) => void
  archiveCase: (id: string) => void
  restoreCase: (id: string) => void

  addCaseNote: (n: Omit<CaseNote, 'id' | 'createdAt'>) => void

  addFollowUp: (f: Omit<FollowUp, 'id' | 'createdAt'>) => void
  updateFollowUp: (id: string, f: Partial<FollowUp>) => void
  deleteFollowUp: (id: string) => void
  toggleFollowUp: (id: string) => void

  addPic: (p: Omit<PicUser, 'id'>) => void
  deletePic: (id: string) => void

  // Both go through /api/admin/users (Admins only) and throw on failure
  addUser: (u: Omit<User, 'id' | 'createdAt' | 'status'> & { password: string }) => Promise<void>
  updateUser: (id: string, u: Partial<Omit<User, 'id' | 'createdAt' | 'email'>> & { password?: string }) => Promise<void>

  addCaseFile: (f: Omit<CaseFile, 'id' | 'uploadedAt'>) => string
  deleteCaseFile: (id: string) => void
  updateCaseFile: (id: string, f: Partial<CaseFile>) => void
  startAiScan: (id: string) => void

  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'> & { timestamp?: string }) => void

  addSettingsItem: (category: SettingsCategory, name: string) => void
  updateSettingsItem: (category: SettingsCategory, id: string, name: string) => void
  toggleSettingsItem: (category: SettingsCategory, id: string) => void
  deleteSettingsItem: (category: SettingsCategory, id: string) => void

  addWorkflowTemplate: (t: Omit<WorkflowTemplate, 'id'>) => void
  updateWorkflowTemplate: (id: string, t: Partial<WorkflowTemplate>) => void
  deleteWorkflowTemplate: (id: string) => void
  addWorkflowStep: (templateId: string, step: Omit<WorkflowStep, 'id' | 'caseTypeId'>) => void
  updateWorkflowStep: (templateId: string, stepId: string, step: Partial<WorkflowStep>) => void
  deleteWorkflowStep: (templateId: string, stepId: string) => void
  addRequiredDocument: (templateId: string, doc: Omit<RequiredDocument, 'id' | 'caseTypeId'>) => void
  updateRequiredDocument: (templateId: string, docId: string, doc: Partial<RequiredDocument>) => void
  deleteRequiredDocument: (templateId: string, docId: string) => void

  addProduct: (p: Omit<Product, 'id'>) => void
  updateProduct: (id: string, p: Partial<Product>) => void
  deleteProduct: (id: string) => void

  addProductPackage: (p: Omit<ProductPackage, 'id'>) => void
  updateProductPackage: (id: string, p: Partial<ProductPackage>) => void
  deleteProductPackage: (id: string) => void

  submissionLetterTemplates: SubmissionLetterTemplate[]
  addSubmissionLetterTemplate: (t: Omit<SubmissionLetterTemplate, 'id'>) => void
  updateSubmissionLetterTemplate: (id: string, t: Partial<SubmissionLetterTemplate>) => void
  deleteSubmissionLetterTemplate: (id: string) => void

  addEmailTemplate: (t: Omit<EmailTemplate, 'id'>) => void
  updateEmailTemplate: (id: string, t: Partial<EmailTemplate>) => void
  deleteEmailTemplate: (id: string) => void
  sendCaseEmail: (data: { caseId: string; templateName?: string; toEmail: string; subject: string; body: string }) => Promise<void>
  notifyOpsTeam: (caseItem: Case) => Promise<void>

  // keepFile: the stored file now belongs to a case file (Inbox "Assign to Case")
  deleteTelegramUpload: (id: string, opts?: { keepFile?: boolean }) => void
  sendCaseFileToInbox: (file: CaseFile) => void
}

// ─── DB row → TypeScript mappers ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

const fromCustomer = (r: Row): Customer => ({
  id: r.id, customerName: r.customer_name, companyRegistrationNo: r.company_registration_no ?? '',
  businessType: r.business_type ?? '', industry: r.industry ?? '',
  mainPhone: r.main_phone ?? '', mainEmail: r.main_email ?? '',
  notes: r.notes ?? '', createdAt: r.created_at,
})
const toCustomer = (c: Customer) => ({
  id: c.id, customer_name: c.customerName, company_registration_no: c.companyRegistrationNo,
  business_type: c.businessType, industry: c.industry, main_phone: c.mainPhone,
  main_email: c.mainEmail, notes: c.notes, created_at: c.createdAt,
})

const fromContact = (r: Row): Contact => ({
  id: r.id, customerId: r.customer_id, contactName: r.contact_name, role: r.role ?? '',
  phone: r.phone ?? '', email: r.email ?? '', contactType: r.contact_type ?? 'Other',
  isPrimary: r.is_primary ?? false, notes: r.notes ?? '',
})
const toContact = (c: Contact) => ({
  id: c.id, customer_id: c.customerId, contact_name: c.contactName, role: c.role,
  phone: c.phone, email: c.email, contact_type: c.contactType, is_primary: c.isPrimary,
  notes: c.notes ?? '',
})

const fromCase = (r: Row): Case => ({
  id: r.id, caseTitle: r.case_title, customerId: r.customer_id ?? '',
  customerName: r.customer_name ?? '', caseType: r.case_type ?? '',
  amount: r.amount ?? 0, personInCharge: r.person_in_charge ?? '',
  currentStatus: r.current_status ?? 'Created', currentWorkflowStepId: r.current_workflow_step_id ?? undefined,
  result: r.result ?? '', closingRemarks: r.closing_remarks ?? '',
  lossReason: r.loss_reason ?? undefined, finalAmount: r.final_amount ?? undefined,
  finalInsurer: r.final_insurer ?? undefined, closedAt: r.closed_at ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at ?? undefined,
  bondPrincipal: r.bond_principal ?? undefined,
  bondExpiryDate: r.bond_expiry_date ?? undefined,
  waitingFor: r.waiting_for ?? undefined,
  archivedAt: r.archived_at ?? undefined,
  acceptanceDate: r.acceptance_date ?? undefined,
  acceptedBy: r.accepted_by ?? undefined,
  workflowTemplateId: r.workflow_template_id ?? undefined,
  requestType: r.request_type ?? undefined,
  selectedProducts: r.selected_products ?? undefined,
  loaAiStatus: r.loa_ai_status ?? 'Pending',
})
const toCase = (c: Case) => ({
  id: c.id, case_title: c.caseTitle, customer_id: c.customerId, customer_name: c.customerName,
  case_type: c.caseType, amount: c.amount, person_in_charge: c.personInCharge,
  current_status: c.currentStatus, current_workflow_step_id: c.currentWorkflowStepId ?? null,
  result: c.result, closing_remarks: c.closingRemarks, loss_reason: c.lossReason ?? null,
  final_amount: c.finalAmount ?? null, final_insurer: c.finalInsurer ?? null,
  closed_at: c.closedAt ?? null, created_at: c.createdAt, updated_at: c.updatedAt ?? null,
  bond_principal: c.bondPrincipal || null,
  bond_expiry_date: c.bondExpiryDate || null,
  waiting_for: c.waitingFor || null,
  archived_at: c.archivedAt || null,
  acceptance_date: c.acceptanceDate || null,
  accepted_by: c.acceptedBy || null,
  workflow_template_id: c.workflowTemplateId ?? null,
  request_type: c.requestType ?? null,
  selected_products: c.selectedProducts ?? null,
  // Conditionally included (not `?? null`) — updateCase() is often called with a
  // sparse partial (e.g. just { currentStatus }), and toCase() runs on that partial
  // object directly. A blanket `?? null` here would send loa_ai_status: null on
  // every such unrelated update and wipe it back to unset.
  ...(c.loaAiStatus !== undefined ? { loa_ai_status: c.loaAiStatus } : {}),
})

const fromEmailTemplate = (r: Row): EmailTemplate => ({
  id: r.id, name: r.name ?? '', isActive: r.is_active ?? true,
  subject: r.subject ?? '', body: r.body ?? '',
})
const toEmailTemplate = (t: EmailTemplate) => ({
  id: t.id, name: t.name, subject: t.subject, body: t.body, is_active: t.isActive,
})

const fromCaseEmailLog = (r: Row): CaseEmailLog => ({
  id: r.id, caseId: r.case_id ?? '', templateName: r.template_name ?? undefined,
  toEmail: r.to_email ?? '', subject: r.subject ?? '', body: r.body ?? '',
  status: r.status ?? 'sent', errorMessage: r.error_message ?? undefined, sentAt: r.sent_at,
})
const toCaseEmailLog = (l: CaseEmailLog) => ({
  id: l.id, case_id: l.caseId, template_name: l.templateName ?? null,
  to_email: l.toEmail, subject: l.subject, body: l.body,
  status: l.status, error_message: l.errorMessage ?? null, sent_at: l.sentAt,
})

const fromTelegramUpload = (r: Row): TelegramUpload => ({
  id: r.id, fileName: r.file_name ?? '', fileSize: r.file_size ?? 0, fileType: r.file_type ?? '',
  fileDataUrl: r.file_data_url ?? undefined, uploadedBy: r.uploaded_by ?? '', uploadedAt: r.uploaded_at,
  telegramChatId: r.telegram_chat_id ?? undefined, telegramMessageId: r.telegram_message_id ?? undefined,
  telegramFileId: r.telegram_file_id ?? undefined,
})
const toTelegramUpload = (u: TelegramUpload) => ({
  id: u.id, file_name: u.fileName, file_size: u.fileSize, file_type: u.fileType,
  file_data_url: u.fileDataUrl ?? null, uploaded_by: u.uploadedBy, uploaded_at: u.uploadedAt,
  telegram_chat_id: u.telegramChatId ?? null, telegram_message_id: u.telegramMessageId ?? null,
  telegram_file_id: u.telegramFileId ?? null,
})

const fromCaseNote = (r: Row): CaseNote => ({
  id: r.id, caseId: r.case_id, content: r.content ?? '', createdBy: r.created_by ?? '', createdAt: r.created_at,
})
const toCaseNote = (n: CaseNote) => ({
  id: n.id, case_id: n.caseId, content: n.content, created_by: n.createdBy, created_at: n.createdAt,
})

const fromFollowUp = (r: Row): FollowUp => ({
  id: r.id, title: r.title ?? '', customerId: r.customer_id ?? '', customerName: r.customer_name ?? '',
  caseId: r.case_id ?? '', caseTitle: r.case_title ?? '', personInCharge: r.person_in_charge ?? '',
  dueDate: r.due_date ?? '', status: r.status ?? 'Open', createdAt: r.created_at,
})
const toFollowUp = (f: FollowUp) => ({
  id: f.id, title: f.title, customer_id: f.customerId, customer_name: f.customerName,
  case_id: f.caseId, case_title: f.caseTitle, person_in_charge: f.personInCharge,
  due_date: f.dueDate, status: f.status, created_at: f.createdAt,
})

const fromCaseFile = (r: Row): CaseFile => ({
  id: r.id, caseId: r.case_id, fileName: r.file_name ?? '', fileSize: r.file_size ?? 0,
  fileType: r.file_type ?? '', documentType: r.document_type ?? '',
  requiredDocumentId: r.required_document_id ?? undefined,
  uploadedBy: r.uploaded_by ?? '', uploadedAt: r.uploaded_at,
  fileDataUrl: r.file_data_url ?? undefined,
  aiScanned: r.ai_scanned ?? false, aiStatus: r.ai_status ?? 'Pending',
  aiExtractedData: r.ai_extracted_data ?? null, aiPrompt: r.ai_prompt ?? undefined,
})
const toCaseFile = (f: CaseFile) => ({
  id: f.id, case_id: f.caseId, file_name: f.fileName, file_size: f.fileSize,
  file_type: f.fileType, document_type: f.documentType,
  required_document_id: f.requiredDocumentId ?? null, uploaded_by: f.uploadedBy,
  uploaded_at: f.uploadedAt, file_data_url: f.fileDataUrl ?? null,
  ai_scanned: f.aiScanned, ai_status: f.aiStatus,
  ai_extracted_data: f.aiExtractedData ?? null, ai_prompt: f.aiPrompt ?? null,
})

const fromActivityLog = (r: Row): ActivityLog => ({
  id: r.id, caseId: r.case_id ?? undefined, caseTitle: r.case_title ?? undefined,
  actionType: r.action_type ?? '', title: r.title ?? '', description: r.description ?? '',
  oldValue: r.old_value ?? undefined, newValue: r.new_value ?? undefined,
  changedBy: r.changed_by ?? '', timestamp: r.timestamp,
})
const toActivityLog = (l: ActivityLog) => ({
  id: l.id, case_id: l.caseId ?? null, case_title: l.caseTitle ?? null,
  action_type: l.actionType, title: l.title, description: l.description,
  old_value: l.oldValue ?? null, new_value: l.newValue ?? null,
  changed_by: l.changedBy, timestamp: l.timestamp,
})

const fromStep = (r: Row): WorkflowStep => ({
  id: r.id, caseTypeId: r.template_id ?? r.case_type_id ?? '',
  name: r.name ?? '', order: r.order ?? 0, description: r.description ?? '',
  requireDocumentsComplete: r.require_documents_complete ?? false,
  defaultFollowUpSuggestion: r.default_follow_up_suggestion ?? '',
  isActive: r.is_active ?? true,
  aiEmailEnabled: r.ai_email_enabled ?? false, aiEmailPrompt: r.ai_email_prompt ?? '',
})
const fromDoc = (r: Row): RequiredDocument => ({
  id: r.id, caseTypeId: r.template_id ?? r.case_type_id ?? '',
  workflowStepId: r.step_id ?? undefined, name: r.name ?? '',
  description: r.description ?? '', required: r.required ?? true,
  acceptedFileTypes: r.accepted_file_types ?? [], isActive: r.is_active ?? true,
  aiPrompt: r.ai_prompt ?? undefined,
})

const fromSettingsItem = (r: Row): SettingsItem => ({
  id: r.id, name: r.name ?? '', isActive: r.is_active ?? true,
})

const fromProduct = (r: Row): Product => ({
  id: r.id, name: r.name ?? '', category: r.category ?? 'Bond',
  description: r.description ?? '', isActive: r.is_active ?? true,
})
const toProduct = (p: Partial<Product>) => ({
  id: p.id, name: p.name, category: p.category, description: p.description, is_active: p.isActive,
})

const fromProductPackage = (r: Row): ProductPackage => ({
  id: r.id, name: r.name ?? '', description: r.description ?? '',
  productIds: r.product_ids ?? [], isActive: r.is_active ?? true,
})
const toProductPackage = (p: Partial<ProductPackage>) => ({
  id: p.id, name: p.name, description: p.description, product_ids: p.productIds, is_active: p.isActive,
})

const fromSubmissionLetterTemplate = (r: Row): SubmissionLetterTemplate => ({
  id: r.id, name: r.name ?? '', isActive: r.is_active ?? true,
  subjectLine: r.subject_line ?? '', letterBody: r.letter_body ?? '', docItems: r.doc_items ?? [],
})
const toSubmissionLetterTemplate = (t: Partial<SubmissionLetterTemplate>) => ({
  id: t.id, name: t.name, is_active: t.isActive,
  subject_line: t.subjectLine, letter_body: t.letterBody, doc_items: t.docItems,
})

const fromPic = (r: Row): PicUser => ({ id: r.id, name: r.name ?? '', email: r.email ?? '' })

const fromUser = (r: Row): User => ({
  id: r.user_id, fullName: r.full_name ?? '', email: r.email ?? '',
  role: r.role === 'Admin' ? 'Admin' : 'Staff', status: r.status === 'Inactive' ? 'Inactive' : 'Active',
  createdAt: r.created_at,
})

// ─── What the startup load fetches (see loadAll) ─────────────────────────────

// Enough for lists, the dashboard and reports ("missing documents"). The file
// link, AI-extracted data and AI prompt come with loadCase().
const CASE_FILE_LIST_COLUMNS =
  'id, case_id, file_name, file_size, file_type, document_type, required_document_id, uploaded_by, uploaded_at, ai_scanned, ai_status'
// Inbox list and the sidebar count; file links come with loadInbox().
const INBOX_LIST_COLUMNS =
  'id, file_name, file_size, file_type, uploaded_by, uploaded_at, telegram_chat_id, telegram_message_id, telegram_file_id'
// When each case entered a workflow step — the dashboard's SLA warnings.
const STEP_LOG_COLUMNS = 'id, case_id, action_type, new_value, timestamp'
const RECENT_ACTIVITY_LIMIT = 20

/** prev with rows added; a row with an id already in prev replaces it. */
function mergeById<T extends { id: string }>(prev: T[], rows: T[]): T[] {
  const map = new Map(prev.map(x => [x.id, x]))
  for (const r of rows) map.set(r.id, r)
  return [...map.values()]
}

/** prev with everything belonging to caseId replaced by rows. */
function replaceForCase<T extends { caseId?: string }>(prev: T[], caseId: string, rows: T[]): T[] {
  return [...rows, ...prev.filter(x => x.caseId !== caseId)]
}

const sortLogs = (logs: ActivityLog[]) =>
  [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

/** Drops undefined fields so a partial update only touches the columns it changes. */
const defined = (o: Row) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

const emptySettings = (): SettingsData => ({
  caseTypes: [], industries: [], contactTypes: [], followUpCategories: [], insurers: [],
})

// ─── Context ──────────────────────────────────────────────────────────────────

const StoreContext = createContext<StoreCtx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [cases, setCases] = useState<Case[]>([])
  const [caseNotes, setCaseNotes] = useState<CaseNote[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [pics, setPics] = useState<PicUser[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [caseFiles, setCaseFiles] = useState<CaseFile[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [productPackages, setProductPackages] = useState<ProductPackage[]>([])
  const [submissionLetterTemplates, setSubmissionLetterTemplates] = useState<SubmissionLetterTemplate[]>([])
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([])
  const [caseEmails, setCaseEmails] = useState<CaseEmailLog[]>([])
  const [telegramUploads, setTelegramUploads] = useState<TelegramUpload[]>([])
  const [settingsState, setSettingsState] = useState<SettingsData>(emptySettings)
  const [loading, setLoading] = useState(true)

  // ─── Loading ───────────────────────────────────────────────────────────────
  // On startup we load what the lists, dashboard and reports need: every
  // customer, contact, case and follow-up, the settings, and a slim version
  // of the case files and Inbox (name, tag and status only — no file link,
  // no AI-extracted data). Things only shown inside one case — its notes,
  // emails, full history and full file rows — are loaded by loadCase() when
  // that case is opened, and the Inbox's file links by loadInbox().

  // `loading` starts true and is cleared once this finishes
  async function loadAll() {
    const sb = createClient()

    const [
      { data: cust, error: custErr },
      { data: cont },
      { data: caseRows },
      { data: fuRows },
      { data: fileRows },
      { data: recentLogRows },
      { data: stepLogRows },
      { data: templates },
      { data: steps },
      { data: docs },
      { data: templateRows },
      { data: telegramUploadRows },
      { data: settingsRows },
      { data: productRows },
      { data: packageRows },
      { data: letterRows },
      { data: picRows },
      { data: userRows },
    ] = await Promise.all([
      sb.from('customers').select('*').order('created_at', { ascending: false }),
      sb.from('contacts').select('*'),
      sb.from('cases').select('*').order('created_at', { ascending: false }),
      sb.from('follow_ups').select('*').order('created_at', { ascending: false }),
      sb.from('case_files').select(CASE_FILE_LIST_COLUMNS).order('uploaded_at', { ascending: false }),
      // Dashboard: "Recent activity" ...
      sb.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(RECENT_ACTIVITY_LIMIT),
      // ... and when each case entered its current step (SLA warnings)
      sb.from('activity_logs').select(STEP_LOG_COLUMNS).eq('action_type', 'WORKFLOW_STEP_CHANGED'),
      sb.from('workflow_templates').select('*'),
      sb.from('workflow_steps').select('*').order('order'),
      sb.from('required_documents').select('*'),
      sb.from('email_templates').select('*').order('created_at'),
      sb.from('telegram_uploads').select(INBOX_LIST_COLUMNS).order('uploaded_at', { ascending: false }),
      sb.from('settings_items').select('*').order('sort_order').order('created_at'),
      sb.from('products').select('*').order('sort_order').order('created_at'),
      sb.from('product_packages').select('*').order('sort_order').order('created_at'),
      sb.from('submission_letter_templates').select('*').order('created_at'),
      sb.from('pics').select('*').order('created_at'),
      sb.from('user_roles').select('*').order('created_at'),
    ])

    if (custErr) console.error('[Supabase] customers load error:', custErr.message)
    if (cust) setCustomers(cust.map(fromCustomer))
    if (cont) setContacts(cont.map(fromContact))
    if (caseRows) setCases(caseRows.map(fromCase))
    if (fuRows) setFollowUps(fuRows.map(fromFollowUp))
    if (fileRows) setCaseFiles(fileRows.map(fromCaseFile))
    // Full recent rows listed last so they win over the slim step-change rows
    setActivityLogs(sortLogs(mergeById<ActivityLog>([], [...(stepLogRows ?? []), ...(recentLogRows ?? [])].map(fromActivityLog))))
    if (telegramUploadRows) setTelegramUploads(telegramUploadRows.map(fromTelegramUpload))
    if (settingsRows) {
      const grouped = emptySettings()
      for (const r of settingsRows) grouped[r.category as SettingsCategory]?.push(fromSettingsItem(r))
      setSettingsState(grouped)
    }
    if (productRows) setProducts(productRows.map(fromProduct))
    if (packageRows) setProductPackages(packageRows.map(fromProductPackage))
    if (letterRows) setSubmissionLetterTemplates(letterRows.map(fromSubmissionLetterTemplate))
    if (picRows) setPics(picRows.map(fromPic))
    if (userRows) setUsers(userRows.map(fromUser))
    if (templateRows) {
      setEmailTemplates(templateRows.map(fromEmailTemplate))
      if (templateRows.length === 0) seedEmailTemplates(sb)
    }

    // Build nested workflow templates
    if (templates) {
      const built = templates.map(t => ({
        id: t.id, caseType: t.case_type ?? '', businessType: t.business_type ?? undefined,
        description: t.description ?? '', isActive: t.is_active ?? true,
        workflowSteps: (steps ?? []).filter(s => s.template_id === t.id).map(fromStep),
        requiredDocuments: (docs ?? []).filter(d => d.template_id === t.id).map(fromDoc),
      }))
      setWorkflowTemplates(built)

      // Seed from mock data if DB is empty
      if (templates.length === 0) {
        seedWorkflowTemplates(sb)
      }
    }

    setLoading(false)
  }

  // Everything about one case that the startup load leaves out. Also picks up
  // changes made elsewhere since (e.g. an AI scan result from n8n).
  // Stable across renders so pages can call it from useEffect without looping.
  // (React Compiler is not enabled, so its memoization lint does not apply.)
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const loadCase = useCallback(async (caseId: string) => {
    const sb = createClient()
    const [
      { data: fileRows, error: fileErr },
      { data: noteRows },
      { data: logRows },
      { data: emailRows },
    ] = await Promise.all([
      sb.from('case_files').select('*').eq('case_id', caseId).order('uploaded_at', { ascending: false }),
      sb.from('case_notes').select('*').eq('case_id', caseId).order('created_at', { ascending: false }),
      sb.from('activity_logs').select('*').eq('case_id', caseId).order('timestamp', { ascending: false }),
      sb.from('case_emails').select('*').eq('case_id', caseId).order('sent_at', { ascending: false }),
    ])
    if (fileErr) console.error('[Supabase] loadCase failed:', fileErr.message)
    if (fileRows) setCaseFiles(prev => replaceForCase(prev, caseId, fileRows.map(fromCaseFile)))
    if (noteRows) setCaseNotes(prev => replaceForCase(prev, caseId, noteRows.map(fromCaseNote)))
    if (logRows) setActivityLogs(prev => sortLogs(replaceForCase(prev, caseId, logRows.map(fromActivityLog))))
    if (emailRows) setCaseEmails(prev => replaceForCase(prev, caseId, emailRows.map(fromCaseEmailLog)))
  }, [])

  // The Inbox page's file links (the startup load only has names and sizes).
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const loadInbox = useCallback(async () => {
    const { data, error } = await createClient()
      .from('telegram_uploads').select('*').order('uploaded_at', { ascending: false })
    if (error) console.error('[Supabase] loadInbox failed:', error.message)
    if (data) setTelegramUploads(data.map(fromTelegramUpload))
  }, [])

  async function seedEmailTemplates(sb: ReturnType<typeof createClient>) {
    const row: EmailTemplate = {
      id: generateId(),
      name: 'Quotation Sent to Customer',
      isActive: true,
      subject: 'Your Quotation – {{caseTitle}}',
      body: `dear testing, \n\n{{customerName}}, {{caseTitle}}\n\nregards \ntesting`,
    }
    const { error } = await sb.from('email_templates').insert(toEmailTemplate(row))
    if (!error) setEmailTemplates([row])
  }

  async function seedWorkflowTemplates(sb: ReturnType<typeof createClient>) {
    for (const t of mockWorkflowTemplates) {
      await sb.from('workflow_templates').upsert({
        id: t.id, name: t.caseType, case_type: t.caseType,
        business_type: t.businessType ?? null, description: t.description, is_active: t.isActive,
      })
      for (const s of t.workflowSteps) {
        await sb.from('workflow_steps').upsert({
          id: s.id, template_id: t.id, case_type_id: t.id,
          name: s.name, description: s.description, order: s.order,
          require_documents_complete: s.requireDocumentsComplete,
          default_follow_up_suggestion: s.defaultFollowUpSuggestion,
          is_active: s.isActive, ai_email_enabled: s.aiEmailEnabled ?? false,
          ai_email_prompt: s.aiEmailPrompt ?? null,
        })
      }
      for (const d of t.requiredDocuments) {
        await sb.from('required_documents').upsert({
          id: d.id, template_id: t.id, case_type_id: t.id,
          step_id: d.workflowStepId ?? null, name: d.name, description: d.description,
          required: d.required, accepted_file_types: d.acceptedFileTypes,
          is_active: d.isActive, ai_prompt: d.aiPrompt ?? null,
        })
      }
    }
    setWorkflowTemplates(mockWorkflowTemplates)
  }

  // Fetch on mount; loadAll only sets state after its queries come back
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Customers ────────────────────────────────────────────────────────────

  const addCustomer = (c: Omit<Customer, 'id' | 'createdAt'>): string => {
    const row: Customer = { ...c, id: generateId(), createdAt: nowIso() }
    setCustomers(prev => [row, ...prev])
    createClient().from('customers').insert(toCustomer(row))
      .then(({ error }) => {
        if (error) console.error('[Supabase] addCustomer failed:', error.message, error.code)
        else console.log('[Supabase] addCustomer saved:', row.customerName)
      })
    return row.id
  }
  const updateCustomer = (id: string, c: Partial<Customer>) => {
    setCustomers(prev => prev.map(x => x.id === id ? { ...x, ...c } : x))
    createClient().from('customers').update(
      Object.fromEntries(Object.entries(toCustomer({ ...c, id } as Customer)).filter(([, v]) => v !== undefined))
    ).eq('id', id).then()
  }
  const deleteCustomer = (id: string) => {
    setCustomers(prev => prev.filter(x => x.id !== id))
    createClient().from('customers').delete().eq('id', id).then()
  }

  // ─── Contacts ─────────────────────────────────────────────────────────────

  const addContact = (c: Omit<Contact, 'id'>) => {
    const row: Contact = { ...c, id: generateId() }
    setContacts(prev => [...prev, row])
    createClient().from('contacts').insert(toContact(row)).then()
  }
  const updateContact = (id: string, c: Partial<Contact>) => {
    setContacts(prev => prev.map(x => x.id === id ? { ...x, ...c } : x))
    createClient().from('contacts').update(toContact({ ...c, id } as Contact)).eq('id', id).then()
  }
  const deleteContact = (id: string) => {
    setContacts(prev => prev.filter(x => x.id !== id))
    createClient().from('contacts').delete().eq('id', id).then()
  }
  const setPrimaryContact = (customerId: string, contactId: string) => {
    setContacts(prev =>
      prev.map(x => x.customerId === customerId ? { ...x, isPrimary: x.id === contactId } : x)
    )
    const sb = createClient()
    sb.from('contacts').update({ is_primary: false }).eq('customer_id', customerId).then(() =>
      sb.from('contacts').update({ is_primary: true }).eq('id', contactId).then()
    )
  }

  // ─── Cases ────────────────────────────────────────────────────────────────

  const addCase = (c: Omit<Case, 'id' | 'createdAt'>): string => {
    const customer = customers.find(x => x.id === c.customerId)
    const template = getWorkflowTemplate(c.caseType, workflowTemplates, customer?.businessType)
    const row: Case = { ...c, id: generateId(), createdAt: nowIso(), updatedAt: nowIso(), workflowTemplateId: template?.id }
    setCases(prev => [row, ...prev])
    createClient().from('cases').insert(toCase(row)).then(({ error }) => {
      if (error) console.error('[Supabase] addCase failed:', error.message, '| hint:', error.hint, '| details:', error.details)
      else console.log('[Supabase] addCase saved:', row.caseTitle)
    })
    return row.id
  }
  const updateCase = (id: string, c: Partial<Case>) => {
    const updated = { ...c, updatedAt: nowIso() }
    setCases(prev => prev.map(x => x.id === id ? { ...x, ...updated } : x))
    createClient().from('cases').update(toCase({ ...updated, id } as Case)).eq('id', id).then()
  }

  // ─── Email Templates (customer-facing, sent manually from a case) ──────────

  const addEmailTemplate = (t: Omit<EmailTemplate, 'id'>) => {
    const row: EmailTemplate = { ...t, id: generateId() }
    setEmailTemplates(prev => [...prev, row])
    createClient().from('email_templates').insert(toEmailTemplate(row)).then(({ error }) => {
      if (error) console.error('[Supabase] addEmailTemplate failed:', error.message)
    })
  }
  const updateEmailTemplate = (id: string, t: Partial<EmailTemplate>) => {
    setEmailTemplates(prev => prev.map(x => x.id === id ? { ...x, ...t } : x))
    createClient().from('email_templates').update(toEmailTemplate({ ...emailTemplates.find(x => x.id === id), ...t, id } as EmailTemplate)).eq('id', id).then()
  }
  const deleteEmailTemplate = (id: string) => {
    setEmailTemplates(prev => prev.filter(x => x.id !== id))
    createClient().from('email_templates').delete().eq('id', id).then()
  }

  // ─── Case Emails (sent manually from the case's Emails tab) ────────────────

  const sendCaseEmail = async (data: { caseId: string; templateName?: string; toEmail: string; subject: string; body: string }) => {
    let status: 'sent' | 'failed' = 'sent'
    let errorMessage: string | undefined

    try {
      const res = await fetch('/api/send-graph-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailTo: data.toEmail, emailSubject: data.subject, emailBody: data.body }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        status = 'failed'
        errorMessage = err.error ?? 'Failed to send email'
      }
    } catch (err) {
      status = 'failed'
      errorMessage = err instanceof Error ? err.message : 'Network error'
    }

    const row: CaseEmailLog = {
      id: generateId(), caseId: data.caseId, templateName: data.templateName,
      toEmail: data.toEmail, subject: data.subject, body: data.body,
      status, errorMessage, sentAt: nowIso(),
    }
    setCaseEmails(prev => [row, ...prev])
    createClient().from('case_emails').insert(toCaseEmailLog(row)).then()

    if (status === 'failed') throw new Error(errorMessage)
  }

  // ─── Ops notification (manual test trigger — "new case received") ─────────

  const notifyOpsTeam = async (caseItem: Case) => {
    let status: 'sent' | 'failed' = 'sent'
    let errorMessage: string | undefined
    let toEmail = 'operations team'
    let subject = `New Case Received – ${caseItem.caseTitle} (${caseItem.customerName})`

    try {
      const res = await fetch('/api/notify-ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: caseItem.id,
          caseTitle: caseItem.caseTitle,
          customerName: caseItem.customerName,
          caseType: caseItem.caseType,
          amount: caseItem.amount,
          personInCharge: caseItem.personInCharge,
          currentStatus: caseItem.currentStatus,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        status = 'failed'
        errorMessage = data.error ?? 'Failed to send notification'
      } else {
        toEmail = data.to ?? toEmail
        subject = data.subject ?? subject
      }
    } catch (err) {
      status = 'failed'
      errorMessage = err instanceof Error ? err.message : 'Network error'
    }

    const row: CaseEmailLog = {
      id: generateId(), caseId: caseItem.id, templateName: 'Ops Notification (test)',
      toEmail, subject, body: '', status, errorMessage, sentAt: nowIso(),
    }
    setCaseEmails(prev => [row, ...prev])
    createClient().from('case_emails').insert(toCaseEmailLog(row)).then()

    if (status === 'failed') throw new Error(errorMessage)
  }

  // ─── Telegram Inbox ─────────────────────────────────────────────────────────

  const deleteTelegramUpload = (id: string, opts?: { keepFile?: boolean }) => {
    const upload = telegramUploads.find(x => x.id === id)
    setTelegramUploads(prev => prev.filter(x => x.id !== id))
    const sb = createClient()
    sb.from('telegram_uploads').delete().eq('id', id).then()
    const path = opts?.keepFile ? null : storagePath(upload?.fileDataUrl)
    if (path) sb.storage.from(STORAGE_BUCKET).remove([path]).then()
  }

  const sendCaseFileToInbox = (file: CaseFile) => {
    const row: TelegramUpload = {
      id: generateId(), fileName: file.fileName, fileSize: file.fileSize, fileType: file.fileType,
      fileDataUrl: file.fileDataUrl, uploadedBy: file.uploadedBy, uploadedAt: nowIso(),
    }
    setTelegramUploads(prev => [row, ...prev])
    setCaseFiles(prev => prev.filter(x => x.id !== file.id))
    const sb = createClient()
    sb.from('telegram_uploads').insert(toTelegramUpload(row)).then(({ error }) => {
      if (error) console.error('[Supabase] sendCaseFileToInbox insert failed:', error.message)
    })
    sb.from('case_files').delete().eq('id', file.id).then()
  }

  const deleteCase = (id: string) => {
    // Remove from memory immediately
    setCases(prev => prev.filter(x => x.id !== id))
    setCaseNotes(prev => prev.filter(x => x.caseId !== id))
    setFollowUps(prev => prev.filter(x => x.caseId !== id))
    setActivityLogs(prev => prev.filter(x => x.caseId !== id))
    setCaseFiles(prev => prev.filter(x => x.caseId !== id))

    // Delete from Supabase — related records first to avoid FK constraint errors
    const sb = createClient()
    sb.from('case_files').delete().eq('case_id', id).then()
    sb.from('case_notes').delete().eq('case_id', id).then()
    sb.from('follow_ups').delete().eq('case_id', id).then()
    sb.from('activity_logs').delete().eq('case_id', id).then()
    sb.from('cases').delete().eq('id', id).then(({ error }) => {
      if (error) console.error('[Supabase] deleteCase failed:', error.message)
      else console.log('[Supabase] deleteCase removed:', id)
    })
  }
  const archiveCase = (id: string) => {
    const archivedAt = nowIso()
    setCases(prev => prev.map(x => x.id === id ? { ...x, archivedAt } : x))
    createClient().from('cases').update({ archived_at: archivedAt }).eq('id', id).then()
  }
  const restoreCase = (id: string) => {
    setCases(prev => prev.map(x => x.id === id ? { ...x, archivedAt: undefined } : x))
    createClient().from('cases').update({ archived_at: null }).eq('id', id).then()
  }

  // ─── Case Notes ───────────────────────────────────────────────────────────

  const addCaseNote = (n: Omit<CaseNote, 'id' | 'createdAt'>) => {
    const row: CaseNote = { ...n, id: generateId(), createdAt: nowIso() }
    setCaseNotes(prev => [row, ...prev])
    createClient().from('case_notes').insert(toCaseNote(row)).then()
  }

  // ─── Follow-Ups ───────────────────────────────────────────────────────────

  const addFollowUp = (f: Omit<FollowUp, 'id' | 'createdAt'>) => {
    const row: FollowUp = { ...f, id: generateId(), createdAt: nowIso() }
    setFollowUps(prev => [row, ...prev])
    createClient().from('follow_ups').insert(toFollowUp(row)).then()
  }
  const updateFollowUp = (id: string, f: Partial<FollowUp>) => {
    setFollowUps(prev => prev.map(x => x.id === id ? { ...x, ...f } : x))
    createClient().from('follow_ups').update(toFollowUp({ ...f, id } as FollowUp)).eq('id', id).then()
  }
  const deleteFollowUp = (id: string) => {
    setFollowUps(prev => prev.filter(x => x.id !== id))
    createClient().from('follow_ups').delete().eq('id', id).then()
  }
  const toggleFollowUp = (id: string) => {
    setFollowUps(prev =>
      prev.map(x => x.id === id ? { ...x, status: x.status === 'Open' ? 'Done' : 'Open' } : x)
    )
    const fu = followUps.find(x => x.id === id)
    if (fu) createClient().from('follow_ups').update({ status: fu.status === 'Open' ? 'Done' : 'Open' }).eq('id', id).then()
  }

  // ─── PICs ─────────────────────────────────────────────────────────────────

  const addPic = (p: Omit<PicUser, 'id'>) => {
    const row = { ...p, id: generateId() }
    setPics(prev => [...prev, row])
    createClient().from('pics').insert(row).then(({ error }) => {
      if (error) console.error('[Supabase] addPic failed:', error.message)
    })
  }
  const deletePic = (id: string) => {
    setPics(prev => prev.filter(x => x.id !== id))
    createClient().from('pics').delete().eq('id', id).then()
  }

  // ─── Users (Supabase Auth accounts + user_roles, Admins only) ─────────────

  const callUsersApi = async (method: 'POST' | 'PATCH', body: Row): Promise<Row> => {
    const res = await fetch('/api/admin/users', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
    return data
  }
  const addUser = async (u: Omit<User, 'id' | 'createdAt' | 'status'> & { password: string }) => {
    const data = await callUsersApi('POST', u)
    setUsers(prev => [...prev, fromUser(data.user)])
  }
  const updateUser = async (id: string, u: Partial<Omit<User, 'id' | 'createdAt' | 'email'>> & { password?: string }) => {
    await callUsersApi('PATCH', { id, ...u })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...shown } = u
    setUsers(prev => prev.map(x => x.id === id ? { ...x, ...shown } : x))
  }

  // ─── Case Files ───────────────────────────────────────────────────────────

  const notifyDocFlow = (file: CaseFile) => {
    fetch('/api/notify-n8n', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'case_file_uploaded',
        caseId: file.caseId,
        fileId: file.id,
        fileName: file.fileName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        documentType: file.documentType,
        uploadedBy: file.uploadedBy,
        uploadedAt: file.uploadedAt,
        fileUrl: file.fileDataUrl,
      }),
    }).catch(err => console.error('[n8n] docflow notify failed:', err))
  }

  const addCaseFile = (f: Omit<CaseFile, 'id' | 'uploadedAt'>): string => {
    const row: CaseFile = { ...f, id: generateId(), uploadedAt: nowIso() }
    setCaseFiles(prev => [...prev, row])
    createClient().from('case_files').upsert(toCaseFile(row)).then()
    notifyDocFlow(row)
    return row.id
  }
  const deleteCaseFile = (id: string) => {
    const file = caseFiles.find(f => f.id === id)
    setCaseFiles(prev => prev.filter(x => x.id !== id))
    const sb = createClient()
    sb.from('case_files').delete().eq('id', id).then()
    // Also remove the actual file from Supabase Storage
    const path = storagePath(file?.fileDataUrl)
    if (path) sb.storage.from(STORAGE_BUCKET).remove([path]).then()
  }
  const updateCaseFile = (id: string, f: Partial<CaseFile>) => {
    setCaseFiles(prev => prev.map(x => x.id === id ? { ...x, ...f } : x))
    const updateData: Row = {}
    if (f.aiStatus !== undefined) updateData.ai_status = f.aiStatus
    if (f.aiScanned !== undefined) updateData.ai_scanned = f.aiScanned
    if (f.aiExtractedData !== undefined) updateData.ai_extracted_data = f.aiExtractedData
    if (f.documentType !== undefined) updateData.document_type = f.documentType
    if (f.requiredDocumentId !== undefined) updateData.required_document_id = f.requiredDocumentId
    if (Object.keys(updateData).length > 0)
      createClient().from('case_files').update(updateData).eq('id', id).then()
  }

  // Scanning itself happens in n8n, not here — this just fires the trigger
  // and flips the file to "Processing". n8n reports the actual result
  // (Extracted + data, or Failed) back via POST /api/ai-scan/callback.
  //
  // Prompt resolution: file.aiPrompt (an explicit per-file override, e.g.
  // Quotation panel) if set, else the checklist slot's own prompt —
  // required_documents.aiPrompt for file.requiredDocumentId, edited under
  // Settings → Workflow Templates → Required Documents. Files are always
  // tagged to a required document before being scanned, so there's no
  // untagged case to fall back for.
  const resolveRequiredDocPrompt = (requiredDocumentId: string | undefined): string | undefined => {
    if (!requiredDocumentId) return undefined
    for (const t of workflowTemplates) {
      const doc = t.requiredDocuments.find(d => d.id === requiredDocumentId)
      if (doc?.aiPrompt?.trim()) return doc.aiPrompt.trim()
    }
    return undefined
  }

  const startAiScan = (id: string) => {
    const file = caseFiles.find(f => f.id === id)
    if (!file?.fileDataUrl) return

    updateCaseFile(id, { aiStatus: 'Processing' })

    fetch('/api/notify-n8n', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'ai_scan_requested',
        caseFileId: id,
        caseId: file.caseId,
        fileName: file.fileName,
        fileType: file.fileType,
        documentType: file.documentType,
        aiPrompt: file.aiPrompt ?? resolveRequiredDocPrompt(file.requiredDocumentId),
        fileUrl: file.fileDataUrl,
      }),
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data.error) throw new Error(data.error ?? `n8n trigger failed (${res.status})`)
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'AI scan trigger failed'
        updateCaseFile(id, { aiStatus: 'Failed' })
        alert(`AI Scan failed: ${msg}`)
      })
  }

  // ─── Activity Logs ────────────────────────────────────────────────────────

  const addActivityLog = (log: Omit<ActivityLog, 'id' | 'timestamp'> & { timestamp?: string }) => {
    const row: ActivityLog = { ...log, id: generateId(), timestamp: log.timestamp ?? nowIso() }
    setActivityLogs(prev => [row, ...prev])
    createClient().from('activity_logs').insert(toActivityLog(row)).then()
  }

  // ─── Settings lists (settings_items) ──────────────────────────────────────

  const addSettingsItem = (category: SettingsCategory, name: string) => {
    const row: SettingsItem = { id: generateId(), name, isActive: true }
    const sortOrder = settingsState[category].length
    setSettingsState(prev => ({ ...prev, [category]: [...prev[category], row] }))
    createClient().from('settings_items').insert({
      id: row.id, category, name: row.name, is_active: row.isActive, sort_order: sortOrder,
    }).then(({ error }) => {
      if (error) console.error('[Supabase] addSettingsItem failed:', error.message)
    })
  }
  const updateSettingsItem = (category: SettingsCategory, id: string, name: string) => {
    setSettingsState(prev => ({ ...prev, [category]: prev[category].map(x => x.id === id ? { ...x, name } : x) }))
    createClient().from('settings_items').update({ name }).eq('id', id).then()
  }
  const toggleSettingsItem = (category: SettingsCategory, id: string) => {
    const item = settingsState[category].find(x => x.id === id)
    if (!item) return
    setSettingsState(prev => ({ ...prev, [category]: prev[category].map(x => x.id === id ? { ...x, isActive: !x.isActive } : x) }))
    createClient().from('settings_items').update({ is_active: !item.isActive }).eq('id', id).then()
  }
  const deleteSettingsItem = (category: SettingsCategory, id: string) => {
    setSettingsState(prev => ({ ...prev, [category]: prev[category].filter(x => x.id !== id) }))
    createClient().from('settings_items').delete().eq('id', id).then()
  }

  // ─── Workflow Templates ───────────────────────────────────────────────────

  const addWorkflowTemplate = (t: Omit<WorkflowTemplate, 'id'>) => {
    const row: WorkflowTemplate = { ...t, id: generateId() }
    setWorkflowTemplates(prev => [...prev, row])
    createClient().from('workflow_templates').insert({
      id: row.id, name: row.caseType, case_type: row.caseType,
      business_type: row.businessType ?? null, description: row.description, is_active: row.isActive,
    }).then()
  }
  const updateWorkflowTemplate = (id: string, t: Partial<WorkflowTemplate>) => {
    setWorkflowTemplates(prev => prev.map(x => x.id === id ? { ...x, ...t } : x))
    const upd: Row = {}
    if (t.caseType !== undefined) { upd.case_type = t.caseType; upd.name = t.caseType }
    if (t.businessType !== undefined) upd.business_type = t.businessType
    if (t.description !== undefined) upd.description = t.description
    if (t.isActive !== undefined) upd.is_active = t.isActive
    if (Object.keys(upd).length > 0) createClient().from('workflow_templates').update(upd).eq('id', id).then()
  }
  const deleteWorkflowTemplate = (id: string) => {
    setWorkflowTemplates(prev => prev.filter(x => x.id !== id))
    createClient().from('workflow_templates').delete().eq('id', id).then()
  }

  const addWorkflowStep = (templateId: string, step: Omit<WorkflowStep, 'id' | 'caseTypeId'>) => {
    const row: WorkflowStep = { ...step, id: generateId(), caseTypeId: templateId }
    setWorkflowTemplates(prev => prev.map(t =>
      t.id === templateId ? { ...t, workflowSteps: [...t.workflowSteps, row] } : t
    ))
    createClient().from('workflow_steps').insert({
      id: row.id, template_id: templateId, case_type_id: templateId,
      name: row.name, description: row.description, order: row.order,
      require_documents_complete: row.requireDocumentsComplete,
      default_follow_up_suggestion: row.defaultFollowUpSuggestion,
      is_active: row.isActive, ai_email_enabled: row.aiEmailEnabled ?? false,
      ai_email_prompt: row.aiEmailPrompt ?? null,
    }).then()
  }
  const updateWorkflowStep = (templateId: string, stepId: string, step: Partial<WorkflowStep>) => {
    setWorkflowTemplates(prev => prev.map(t =>
      t.id === templateId
        ? { ...t, workflowSteps: t.workflowSteps.map(s => s.id === stepId ? { ...s, ...step } : s) }
        : t
    ))
    const upd: Row = {}
    if (step.name !== undefined) upd.name = step.name
    if (step.description !== undefined) upd.description = step.description
    if (step.order !== undefined) upd.order = step.order
    if (step.isActive !== undefined) upd.is_active = step.isActive
    if (step.requireDocumentsComplete !== undefined) upd.require_documents_complete = step.requireDocumentsComplete
    if (step.defaultFollowUpSuggestion !== undefined) upd.default_follow_up_suggestion = step.defaultFollowUpSuggestion
    if (step.aiEmailEnabled !== undefined) upd.ai_email_enabled = step.aiEmailEnabled
    if (step.aiEmailPrompt !== undefined) upd.ai_email_prompt = step.aiEmailPrompt
    if (Object.keys(upd).length > 0) createClient().from('workflow_steps').update(upd).eq('id', stepId).then()
  }
  const deleteWorkflowStep = (templateId: string, stepId: string) => {
    setWorkflowTemplates(prev => prev.map(t =>
      t.id === templateId ? { ...t, workflowSteps: t.workflowSteps.filter(s => s.id !== stepId) } : t
    ))
    createClient().from('workflow_steps').delete().eq('id', stepId).then()
  }

  const addRequiredDocument = (templateId: string, doc: Omit<RequiredDocument, 'id' | 'caseTypeId'>) => {
    const row: RequiredDocument = { ...doc, id: generateId(), caseTypeId: templateId }
    setWorkflowTemplates(prev => prev.map(t =>
      t.id === templateId ? { ...t, requiredDocuments: [...t.requiredDocuments, row] } : t
    ))
    createClient().from('required_documents').insert({
      id: row.id, template_id: templateId, case_type_id: templateId,
      step_id: row.workflowStepId ?? null, name: row.name, description: row.description,
      required: row.required, accepted_file_types: row.acceptedFileTypes,
      is_active: row.isActive, ai_prompt: row.aiPrompt ?? null,
    }).then()
  }
  const updateRequiredDocument = (templateId: string, docId: string, doc: Partial<RequiredDocument>) => {
    setWorkflowTemplates(prev => prev.map(t =>
      t.id === templateId
        ? { ...t, requiredDocuments: t.requiredDocuments.map(d => d.id === docId ? { ...d, ...doc } : d) }
        : t
    ))
    const upd: Row = {}
    if (doc.name !== undefined) upd.name = doc.name
    if (doc.description !== undefined) upd.description = doc.description
    if (doc.required !== undefined) upd.required = doc.required
    if (doc.isActive !== undefined) upd.is_active = doc.isActive
    if (doc.workflowStepId !== undefined) upd.step_id = doc.workflowStepId
    if (doc.aiPrompt !== undefined) upd.ai_prompt = doc.aiPrompt
    if (Object.keys(upd).length > 0) createClient().from('required_documents').update(upd).eq('id', docId).then()
  }
  const deleteRequiredDocument = (templateId: string, docId: string) => {
    setWorkflowTemplates(prev => prev.map(t =>
      t.id === templateId ? { ...t, requiredDocuments: t.requiredDocuments.filter(d => d.id !== docId) } : t
    ))
    createClient().from('required_documents').delete().eq('id', docId).then()
  }

  // ─── Product Master ───────────────────────────────────────────────────────

  const addProduct = (p: Omit<Product, 'id'>) => {
    const row: Product = { ...p, id: generateId() }
    setProducts(prev => [...prev, row])
    createClient().from('products').insert({ ...toProduct(row), sort_order: products.length }).then(({ error }) => {
      if (error) console.error('[Supabase] addProduct failed:', error.message)
    })
  }
  const updateProduct = (id: string, p: Partial<Product>) => {
    setProducts(prev => prev.map(x => x.id === id ? { ...x, ...p } : x))
    createClient().from('products').update(defined(toProduct({ ...p, id }))).eq('id', id).then()
  }
  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(x => x.id !== id))
    createClient().from('products').delete().eq('id', id).then()
  }

  const addProductPackage = (p: Omit<ProductPackage, 'id'>) => {
    const row: ProductPackage = { ...p, id: generateId() }
    setProductPackages(prev => [...prev, row])
    createClient().from('product_packages').insert({ ...toProductPackage(row), sort_order: productPackages.length }).then(({ error }) => {
      if (error) console.error('[Supabase] addProductPackage failed:', error.message)
    })
  }
  const updateProductPackage = (id: string, p: Partial<ProductPackage>) => {
    setProductPackages(prev => prev.map(x => x.id === id ? { ...x, ...p } : x))
    createClient().from('product_packages').update(defined(toProductPackage({ ...p, id }))).eq('id', id).then()
  }
  const deleteProductPackage = (id: string) => {
    setProductPackages(prev => prev.filter(x => x.id !== id))
    createClient().from('product_packages').delete().eq('id', id).then()
  }

  const addSubmissionLetterTemplate = (t: Omit<SubmissionLetterTemplate, 'id'>) => {
    const row: SubmissionLetterTemplate = { ...t, id: generateId() }
    setSubmissionLetterTemplates(prev => [...prev, row])
    createClient().from('submission_letter_templates').insert(toSubmissionLetterTemplate(row)).then(({ error }) => {
      if (error) console.error('[Supabase] addSubmissionLetterTemplate failed:', error.message)
    })
  }
  const updateSubmissionLetterTemplate = (id: string, t: Partial<SubmissionLetterTemplate>) => {
    setSubmissionLetterTemplates(prev => prev.map(x => x.id === id ? { ...x, ...t } : x))
    createClient().from('submission_letter_templates').update(defined(toSubmissionLetterTemplate({ ...t, id }))).eq('id', id).then()
  }
  const deleteSubmissionLetterTemplate = (id: string) => {
    setSubmissionLetterTemplates(prev => prev.filter(x => x.id !== id))
    createClient().from('submission_letter_templates').delete().eq('id', id).then()
  }

  return (
    <StoreContext.Provider value={{
      customers, contacts, cases, caseNotes, followUps, pics,
      users, caseFiles, activityLogs, settingsData: settingsState, workflowTemplates,
      products, productPackages, emailTemplates, caseEmails, telegramUploads, loading,
      loadCase, loadInbox,
      addCustomer, updateCustomer, deleteCustomer,
      addContact, updateContact, deleteContact, setPrimaryContact,
      addCase, updateCase, deleteCase, archiveCase, restoreCase,
      addCaseNote,
      addFollowUp, updateFollowUp, deleteFollowUp, toggleFollowUp,
      addPic, deletePic,
      addUser, updateUser,
      addCaseFile, deleteCaseFile, updateCaseFile, startAiScan,
      addActivityLog,
      addSettingsItem, updateSettingsItem, toggleSettingsItem, deleteSettingsItem,
      addWorkflowTemplate, updateWorkflowTemplate, deleteWorkflowTemplate,
      addWorkflowStep, updateWorkflowStep, deleteWorkflowStep,
      addRequiredDocument, updateRequiredDocument, deleteRequiredDocument,
      addProduct, updateProduct, deleteProduct,
      addProductPackage, updateProductPackage, deleteProductPackage,
      submissionLetterTemplates,
      addSubmissionLetterTemplate, updateSubmissionLetterTemplate, deleteSubmissionLetterTemplate,
      addEmailTemplate, updateEmailTemplate, deleteEmailTemplate, sendCaseEmail, notifyOpsTeam,
      deleteTelegramUpload, sendCaseFileToInbox,
    }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore(): StoreCtx {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
