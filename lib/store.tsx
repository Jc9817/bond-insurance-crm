'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/utils/supabase/client'
import type {
  Customer, Contact, Case, CaseNote, FollowUp, PicUser,
  User, CaseFile, ActivityLog, SettingsItem, SettingsCategory,
  WorkflowTemplate, RequiredDocument, WorkflowStep,
  Inquiry, InquiryQuotation, InquiryNote, InquiryDocument,
  Product, ProductPackage,
} from './types'
import {
  mockPics, mockUsers, mockWorkflowTemplates,
  mockSettingsCaseTypes, mockSettingsIndustries, mockSettingsContactTypes,
  mockSettingsFollowUpCategories, mockSettingsDocumentTypes,
  mockSettingsInquiryStatuses, mockSettingsQuotationStatuses,
  mockSettingsInsurers, mockProducts, mockProductPackages,
} from './mock-data'
import { generateId, nowIso } from './utils'
import { getWorkflowTemplate } from './workflow'

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
  inquiries: Inquiry[]
  inquiryQuotations: InquiryQuotation[]
  inquiryNotes: InquiryNote[]
  inquiryDocuments: InquiryDocument[]
  products: Product[]
  productPackages: ProductPackage[]
  loading: boolean

  addCustomer: (c: Omit<Customer, 'id' | 'createdAt'>) => void
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

  addUser: (u: Omit<User, 'id' | 'createdAt'>) => void
  updateUser: (id: string, u: Partial<Omit<User, 'id' | 'createdAt'>>) => void

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

  addInquiry: (i: Omit<Inquiry, 'id' | 'createdAt' | 'convertedToCase'>) => string
  updateInquiry: (id: string, i: Partial<Inquiry>) => void
  deleteInquiry: (id: string) => void
  addInquiryQuotation: (q: Omit<InquiryQuotation, 'id'>) => void
  updateInquiryQuotation: (id: string, q: Partial<InquiryQuotation>) => void
  deleteInquiryQuotation: (id: string) => void
  sendQuotationEmail: (quotationId: string, emailData: { emailTo: string; emailSubject: string; emailBody: string }) => Promise<void>
  addInquiryNote: (n: Omit<InquiryNote, 'id' | 'createdAt'>) => void
  addInquiryDocument: (d: Omit<InquiryDocument, 'id' | 'uploadedAt'>) => void
  deleteInquiryDocument: (id: string) => void
  convertInquiryToCase: (inquiryId: string, caseData: Omit<Case, 'id' | 'createdAt'>) => string
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
  currentStatus: r.current_status ?? 'New', currentWorkflowStepId: r.current_workflow_step_id ?? undefined,
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
  aiScanned: r.ai_scanned ?? false, aiStatus: r.ai_status ?? 'Not Scanned',
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

const fromInquiry = (r: Row): Inquiry => ({
  id: r.id, inquiryTitle: r.inquiry_title ?? '', customerId: r.customer_id ?? '',
  customerName: r.customer_name ?? '', contactId: r.contact_id ?? undefined,
  contactName: r.contact_name ?? undefined, inquiryType: r.inquiry_type ?? '',
  roughAmount: r.rough_amount ?? 0, status: r.status ?? 'New',
  assignedPerson: r.assigned_person ?? '', notes: r.notes ?? '',
  convertedToCase: r.converted_to_case ?? false, convertedCaseId: r.converted_case_id ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at ?? undefined,
})
const toInquiry = (i: Inquiry) => ({
  id: i.id, inquiry_title: i.inquiryTitle, customer_id: i.customerId,
  customer_name: i.customerName, contact_id: i.contactId ?? null,
  contact_name: i.contactName ?? null, inquiry_type: i.inquiryType,
  rough_amount: i.roughAmount, status: i.status, assigned_person: i.assignedPerson,
  notes: i.notes, converted_to_case: i.convertedToCase,
  converted_case_id: i.convertedCaseId ?? null,
  created_at: i.createdAt, updated_at: i.updatedAt ?? null,
})

const fromInquiryQuotation = (r: Row): InquiryQuotation => ({
  id: r.id, inquiryId: r.inquiry_id, providerName: r.provider_name ?? '',
  quotationAmount: r.quotation_amount ?? 0, requestedDate: r.requested_date ?? '',
  receivedDate: r.received_date ?? undefined, status: r.status ?? 'Pending',
  notes: r.notes ?? '', emailSent: r.email_sent ?? false,
  emailSentAt: r.email_sent_at ?? undefined, emailTo: r.email_to ?? undefined,
  emailSubject: r.email_subject ?? undefined, emailBody: r.email_body ?? undefined,
})
const toInquiryQuotation = (q: InquiryQuotation) => ({
  id: q.id, inquiry_id: q.inquiryId, provider_name: q.providerName,
  quotation_amount: q.quotationAmount, requested_date: q.requestedDate,
  received_date: q.receivedDate ?? null, status: q.status, notes: q.notes,
  email_sent: q.emailSent ?? false, email_sent_at: q.emailSentAt ?? null,
  email_to: q.emailTo ?? null, email_subject: q.emailSubject ?? null,
  email_body: q.emailBody ?? null,
})

// ─── Context ──────────────────────────────────────────────────────────────────

const StoreContext = createContext<StoreCtx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [cases, setCases] = useState<Case[]>([])
  const [caseNotes, setCaseNotes] = useState<CaseNote[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [pics, setPics] = useState<PicUser[]>(mockPics)
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [caseFiles, setCaseFiles] = useState<CaseFile[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([])
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [inquiryQuotations, setInquiryQuotations] = useState<InquiryQuotation[]>([])
  const [inquiryNotes, setInquiryNotes] = useState<InquiryNote[]>([])
  const [inquiryDocuments, setInquiryDocuments] = useState<InquiryDocument[]>([])
  const [products, setProducts] = useState<Product[]>(mockProducts)
  const [productPackages, setProductPackages] = useState<ProductPackage[]>(mockProductPackages)
  const [settingsData] = useState<SettingsData>({
    caseTypes: mockSettingsCaseTypes,
    industries: mockSettingsIndustries,
    contactTypes: mockSettingsContactTypes,
    followUpCategories: mockSettingsFollowUpCategories,
    documentTypes: mockSettingsDocumentTypes,
    inquiryStatuses: mockSettingsInquiryStatuses,
    quotationStatuses: mockSettingsQuotationStatuses,
    insurers: mockSettingsInsurers,
  })
  const [loading, setLoading] = useState(true)

  // ─── Load all data from Supabase on mount ──────────────────────────────────

  useEffect(() => {
    loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadAll() {
    const sb = createClient()
    setLoading(true)

    // Connection test — visible in browser DevTools console
    const { error: pingError } = await sb.from('customers').select('id').limit(1)
    if (pingError) {
      console.error('[Supabase] Connection failed:', pingError.message, pingError.code)
    } else {
      console.log('[Supabase] Connected successfully')
    }

    const [
      { data: cust, error: custErr },
      { data: cont },
      { data: caseRows },
      { data: noteRows },
      { data: fuRows },
      { data: fileRows },
      { data: logRows },
      { data: templates },
      { data: steps },
      { data: docs },
      { data: inqRows },
      { data: iqRows },
      { data: inRows },
      { data: idRows },
    ] = await Promise.all([
      sb.from('customers').select('*').order('created_at', { ascending: false }),
      sb.from('contacts').select('*'),
      sb.from('cases').select('*').order('created_at', { ascending: false }),
      sb.from('case_notes').select('*').order('created_at', { ascending: false }),
      sb.from('follow_ups').select('*').order('created_at', { ascending: false }),
      sb.from('case_files').select('*').order('uploaded_at', { ascending: false }),
      sb.from('activity_logs').select('*').order('timestamp', { ascending: false }),
      sb.from('workflow_templates').select('*'),
      sb.from('workflow_steps').select('*').order('order'),
      sb.from('required_documents').select('*'),
      sb.from('inquiries').select('*').order('created_at', { ascending: false }),
      sb.from('inquiry_quotations').select('*').order('created_at'),
      sb.from('inquiry_notes').select('*').order('created_at', { ascending: false }),
      sb.from('inquiry_documents').select('*').order('uploaded_at', { ascending: false }),
    ])

    if (custErr) console.error('[Supabase] customers load error:', custErr.message)
    if (cust) setCustomers(cust.map(fromCustomer))
    if (cont) setContacts(cont.map(fromContact))
    if (caseRows) setCases(caseRows.map(fromCase))
    if (noteRows) setCaseNotes(noteRows.map(fromCaseNote))
    if (fuRows) setFollowUps(fuRows.map(fromFollowUp))
    if (fileRows) setCaseFiles(fileRows.map(fromCaseFile))
    if (logRows) setActivityLogs(logRows.map(fromActivityLog))
    if (inqRows) setInquiries(inqRows.map(fromInquiry))
    if (iqRows) setInquiryQuotations(iqRows.map(fromInquiryQuotation))
    if (inRows) setInquiryNotes(inRows.map(r => ({
      id: r.id, inquiryId: r.inquiry_id, content: r.content ?? '',
      createdBy: r.created_by ?? '', createdAt: r.created_at,
    })))
    if (idRows) setInquiryDocuments(idRows.map(r => ({
      id: r.id, inquiryId: r.inquiry_id, fileName: r.file_name ?? '',
      fileSize: r.file_size ?? 0, fileType: r.file_type ?? '',
      documentType: r.document_type ?? '', uploadedBy: r.uploaded_by ?? '',
      fileDataUrl: r.file_data_url ?? '', uploadedAt: r.uploaded_at,
    })))

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

  // ─── Customers ────────────────────────────────────────────────────────────

  const addCustomer = (c: Omit<Customer, 'id' | 'createdAt'>) => {
    const row: Customer = { ...c, id: generateId(), createdAt: nowIso() }
    setCustomers(prev => [row, ...prev])
    createClient().from('customers').insert(toCustomer(row))
      .then(({ error }) => {
        if (error) console.error('[Supabase] addCustomer failed:', error.message, error.code)
        else console.log('[Supabase] addCustomer saved:', row.customerName)
      })
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
  const deleteCase = (id: string) => {
    setCases(prev => prev.filter(x => x.id !== id))
    createClient().from('cases').delete().eq('id', id).then()
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

  // ─── PICs (local only for now) ────────────────────────────────────────────

  const addPic = (p: Omit<PicUser, 'id'>) => {
    const row = { ...p, id: generateId() }
    setPics(prev => [...prev, row])
    createClient().from('pics').insert(row).then()
  }
  const deletePic = (id: string) => {
    setPics(prev => prev.filter(x => x.id !== id))
    createClient().from('pics').delete().eq('id', id).then()
  }

  // ─── Users (local only for now) ───────────────────────────────────────────

  const addUser = (u: Omit<User, 'id' | 'createdAt'>) =>
    setUsers(prev => [...prev, { ...u, id: generateId(), createdAt: nowIso() }])
  const updateUser = (id: string, u: Partial<Omit<User, 'id' | 'createdAt'>>) =>
    setUsers(prev => prev.map(x => x.id === id ? { ...x, ...u } : x))

  // ─── Case Files ───────────────────────────────────────────────────────────

  const addCaseFile = (f: Omit<CaseFile, 'id' | 'uploadedAt'>): string => {
    const row: CaseFile = { ...f, id: generateId(), uploadedAt: nowIso() }
    setCaseFiles(prev => [...prev, row])
    createClient().from('case_files').upsert(toCaseFile(row)).then()
    return row.id
  }
  const deleteCaseFile = (id: string) => {
    const file = caseFiles.find(f => f.id === id)
    setCaseFiles(prev => prev.filter(x => x.id !== id))
    const sb = createClient()
    sb.from('case_files').delete().eq('id', id).then()
    // Also remove the actual file from Supabase Storage
    if (file?.fileDataUrl?.startsWith('http')) {
      const marker = '/object/public/case-files/'
      const idx = file.fileDataUrl.indexOf(marker)
      if (idx !== -1) {
        const storagePath = decodeURIComponent(file.fileDataUrl.slice(idx + marker.length))
        sb.storage.from('case-files').remove([storagePath]).then()
      }
    }
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

  const startAiScan = (id: string) => {
    updateCaseFile(id, { aiStatus: 'Processing' })
    const file = caseFiles.find(f => f.id === id)
    if (!file?.fileDataUrl) {
      setCaseFiles(prev => prev.map(x => x.id === id ? { ...x, aiStatus: 'Not Scanned' } : x))
      createClient().from('case_files').update({ ai_status: 'Not Scanned' }).eq('id', id).then()
      return
    }

    // If fileDataUrl is a storage URL, fetch the file and convert to base64 first
    const getBase64 = async (): Promise<string> => {
      if (!file.fileDataUrl!.startsWith('http')) return file.fileDataUrl!
      const res = await fetch(file.fileDataUrl!)
      const blob = await res.blob()
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    }

    getBase64()
      .then(fileDataUrl => fetch('/api/ai-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileDataUrl, fileName: file.fileName,
          documentType: file.documentType, aiPrompt: file.aiPrompt,
        }),
      }))
      .then(res => res.json())
      .then(data => {
        setCaseFiles(prev => prev.map(x => x.id === id
          ? { ...x, aiStatus: 'Ready for Review', aiScanned: true, aiExtractedData: data } : x
        ))
        createClient().from('case_files').update({
          ai_status: 'Ready for Review', ai_scanned: true, ai_extracted_data: data,
        }).eq('id', id).then()
      })
      .catch(() => {
        setCaseFiles(prev => prev.map(x => x.id === id ? { ...x, aiStatus: 'Not Scanned' } : x))
        createClient().from('case_files').update({ ai_status: 'Not Scanned' }).eq('id', id).then()
      })
  }

  // ─── Activity Logs ────────────────────────────────────────────────────────

  const addActivityLog = (log: Omit<ActivityLog, 'id' | 'timestamp'> & { timestamp?: string }) => {
    const row: ActivityLog = { ...log, id: generateId(), timestamp: log.timestamp ?? nowIso() }
    setActivityLogs(prev => [row, ...prev])
    createClient().from('activity_logs').insert(toActivityLog(row)).then()
  }

  // ─── Settings (local only — no DB table) ─────────────────────────────────

  const [settingsState, setSettingsState] = useState<SettingsData>({
    caseTypes: mockSettingsCaseTypes, industries: mockSettingsIndustries,
    contactTypes: mockSettingsContactTypes, followUpCategories: mockSettingsFollowUpCategories,
    documentTypes: mockSettingsDocumentTypes, inquiryStatuses: mockSettingsInquiryStatuses,
    quotationStatuses: mockSettingsQuotationStatuses, insurers: mockSettingsInsurers,
  })
  const addSettingsItem = (category: SettingsCategory, name: string) =>
    setSettingsState(prev => ({ ...prev, [category]: [...prev[category], { id: generateId(), name, isActive: true }] }))
  const updateSettingsItem = (category: SettingsCategory, id: string, name: string) =>
    setSettingsState(prev => ({ ...prev, [category]: prev[category].map(x => x.id === id ? { ...x, name } : x) }))
  const toggleSettingsItem = (category: SettingsCategory, id: string) =>
    setSettingsState(prev => ({ ...prev, [category]: prev[category].map(x => x.id === id ? { ...x, isActive: !x.isActive } : x) }))
  const deleteSettingsItem = (category: SettingsCategory, id: string) =>
    setSettingsState(prev => ({ ...prev, [category]: prev[category].filter(x => x.id !== id) }))

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

  // ─── Inquiries ────────────────────────────────────────────────────────────

  const addInquiry = (i: Omit<Inquiry, 'id' | 'createdAt' | 'convertedToCase'>): string => {
    const id = generateId()
    const now = nowIso()
    const row: Inquiry = { ...i, id, createdAt: now, updatedAt: now, convertedToCase: false }
    setInquiries(prev => [row, ...prev])
    createClient().from('inquiries').insert(toInquiry(row)).then()
    addActivityLog({
      actionType: 'INQUIRY_CREATED', title: 'Inquiry created',
      description: `New inquiry: ${i.inquiryTitle}`, changedBy: i.assignedPerson,
    })
    return id
  }
  const updateInquiry = (id: string, i: Partial<Inquiry>) => {
    setInquiries(prev => prev.map(x => x.id === id ? { ...x, ...i, updatedAt: nowIso() } : x))
    createClient().from('inquiries').update(toInquiry({ ...i, id } as Inquiry)).eq('id', id).then()
  }
  const deleteInquiry = (id: string) => {
    setInquiries(prev => prev.filter(x => x.id !== id))
    setInquiryQuotations(prev => prev.filter(x => x.inquiryId !== id))
    setInquiryNotes(prev => prev.filter(x => x.inquiryId !== id))
    setInquiryDocuments(prev => prev.filter(x => x.inquiryId !== id))
    createClient().from('inquiries').delete().eq('id', id).then()
  }

  const addInquiryQuotation = (q: Omit<InquiryQuotation, 'id'>) => {
    const row: InquiryQuotation = { ...q, id: generateId() }
    setInquiryQuotations(prev => [...prev, row])
    setInquiries(prev => prev.map(x => x.id === q.inquiryId ? { ...x, updatedAt: nowIso() } : x))
    createClient().from('inquiry_quotations').insert(toInquiryQuotation(row)).then()
  }
  const updateInquiryQuotation = (id: string, q: Partial<InquiryQuotation>) => {
    setInquiryQuotations(prev => prev.map(x => x.id === id ? { ...x, ...q } : x))
    createClient().from('inquiry_quotations').update(toInquiryQuotation({ ...q, id } as InquiryQuotation)).eq('id', id).then()
  }
  const deleteInquiryQuotation = (id: string) => {
    setInquiryQuotations(prev => prev.filter(x => x.id !== id))
    createClient().from('inquiry_quotations').delete().eq('id', id).then()
  }

  const addInquiryNote = (n: Omit<InquiryNote, 'id' | 'createdAt'>) => {
    const now = nowIso()
    const row: InquiryNote = { ...n, id: generateId(), createdAt: now }
    setInquiryNotes(prev => [row, ...prev])
    setInquiries(prev => prev.map(x => x.id === n.inquiryId ? { ...x, updatedAt: now } : x))
    createClient().from('inquiry_notes').insert({
      id: row.id, inquiry_id: row.inquiryId, content: row.content,
      created_by: row.createdBy, created_at: row.createdAt,
    }).then()
  }

  const addInquiryDocument = (d: Omit<InquiryDocument, 'id' | 'uploadedAt'>) => {
    const now = nowIso()
    const row: InquiryDocument = { ...d, id: generateId(), uploadedAt: now }
    setInquiryDocuments(prev => [...prev, row])
    setInquiries(prev => prev.map(x => x.id === d.inquiryId ? { ...x, updatedAt: now } : x))
    createClient().from('inquiry_documents').insert({
      id: row.id, inquiry_id: row.inquiryId, file_name: row.fileName,
      file_size: row.fileSize, file_type: row.fileType, document_type: row.documentType,
      uploaded_by: row.uploadedBy, file_data_url: row.fileDataUrl, uploaded_at: row.uploadedAt,
    }).then()
  }
  const deleteInquiryDocument = (id: string) => {
    setInquiryDocuments(prev => prev.filter(x => x.id !== id))
    createClient().from('inquiry_documents').delete().eq('id', id).then()
  }

  const sendQuotationEmail = async (
    quotationId: string,
    emailData: { emailTo: string; emailSubject: string; emailBody: string }
  ) => {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quotationId, ...emailData }),
    })
    if (!res.ok) throw new Error('Failed to send email')
    const now = nowIso()
    setInquiryQuotations(prev => prev.map(q => q.id === quotationId ? {
      ...q, emailSent: true, emailSentAt: now,
      emailTo: emailData.emailTo, emailSubject: emailData.emailSubject, emailBody: emailData.emailBody,
    } : q))
    createClient().from('inquiry_quotations').update({
      email_sent: true, email_sent_at: now,
      email_to: emailData.emailTo, email_subject: emailData.emailSubject, email_body: emailData.emailBody,
    }).eq('id', quotationId).then()
  }

  // ─── Product Master (in-memory) ───────────────────────────────────────────

  const addProduct = (p: Omit<Product, 'id'>) =>
    setProducts(prev => [...prev, { ...p, id: generateId() }])
  const updateProduct = (id: string, p: Partial<Product>) =>
    setProducts(prev => prev.map(x => x.id === id ? { ...x, ...p } : x))
  const deleteProduct = (id: string) =>
    setProducts(prev => prev.filter(x => x.id !== id))

  const addProductPackage = (p: Omit<ProductPackage, 'id'>) =>
    setProductPackages(prev => [...prev, { ...p, id: generateId() }])
  const updateProductPackage = (id: string, p: Partial<ProductPackage>) =>
    setProductPackages(prev => prev.map(x => x.id === id ? { ...x, ...p } : x))
  const deleteProductPackage = (id: string) =>
    setProductPackages(prev => prev.filter(x => x.id !== id))

  const convertInquiryToCase = (inquiryId: string, caseData: Omit<Case, 'id' | 'createdAt'>): string => {
    const caseId = generateId()
    const now = nowIso()
    const newCase: Case = { ...caseData, id: caseId, createdAt: now, updatedAt: now }
    setCases(prev => [newCase, ...prev])
    setInquiries(prev => prev.map(x =>
      x.id === inquiryId ? { ...x, convertedToCase: true, convertedCaseId: caseId, updatedAt: now } : x
    ))
    createClient().from('cases').insert(toCase(newCase)).then()
    createClient().from('inquiries').update({
      converted_to_case: true, converted_case_id: caseId, updated_at: now,
    }).eq('id', inquiryId).then()
    return caseId
  }

  return (
    <StoreContext.Provider value={{
      customers, contacts, cases, caseNotes, followUps, pics,
      users, caseFiles, activityLogs, settingsData: settingsState, workflowTemplates,
      inquiries, inquiryQuotations, inquiryNotes, inquiryDocuments,
      products, productPackages, loading,
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
      addInquiry, updateInquiry, deleteInquiry,
      addInquiryQuotation, updateInquiryQuotation, deleteInquiryQuotation, sendQuotationEmail,
      addInquiryNote, addInquiryDocument, deleteInquiryDocument,
      convertInquiryToCase,
      addProduct, updateProduct, deleteProduct,
      addProductPackage, updateProductPackage, deleteProductPackage,
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
