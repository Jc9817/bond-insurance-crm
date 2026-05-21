'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import type {
  Customer, Contact, Case, CaseNote, FollowUp, PicUser,
  User, CaseFile, ActivityLog, SettingsItem, SettingsCategory,
  WorkflowTemplate, RequiredDocument, WorkflowStep,
} from './types'
import {
  mockCustomers, mockContacts, mockCases, mockCaseNotes, mockFollowUps, mockPics,
  mockUsers, mockCaseFiles, mockActivityLogs, mockWorkflowTemplates,
  mockSettingsCaseTypes, mockSettingsIndustries, mockSettingsContactTypes,
  mockSettingsFollowUpCategories, mockSettingsDocumentTypes,
} from './mock-data'
import { generateId, nowIso } from './utils'

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

  // Customers
  addCustomer: (c: Omit<Customer, 'id' | 'createdAt'>) => void
  updateCustomer: (id: string, c: Partial<Customer>) => void
  deleteCustomer: (id: string) => void

  // Contacts
  addContact: (c: Omit<Contact, 'id'>) => void
  updateContact: (id: string, c: Partial<Contact>) => void
  deleteContact: (id: string) => void
  setPrimaryContact: (customerId: string, contactId: string) => void

  // Cases
  addCase: (c: Omit<Case, 'id' | 'createdAt'>) => void
  updateCase: (id: string, c: Partial<Case>) => void
  deleteCase: (id: string) => void

  // Case Notes
  addCaseNote: (n: Omit<CaseNote, 'id' | 'createdAt'>) => void

  // Follow-Ups
  addFollowUp: (f: Omit<FollowUp, 'id' | 'createdAt'>) => void
  updateFollowUp: (id: string, f: Partial<FollowUp>) => void
  deleteFollowUp: (id: string) => void
  toggleFollowUp: (id: string) => void

  // PICs
  addPic: (p: Omit<PicUser, 'id'>) => void
  deletePic: (id: string) => void

  // Users
  addUser: (u: Omit<User, 'id' | 'createdAt'>) => void
  updateUser: (id: string, u: Partial<Omit<User, 'id' | 'createdAt'>>) => void

  // Case Files
  addCaseFile: (f: Omit<CaseFile, 'id' | 'uploadedAt'>) => void
  deleteCaseFile: (id: string) => void
  updateCaseFile: (id: string, f: Partial<CaseFile>) => void
  startAiScan: (id: string) => void

  // Activity Logs
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'> & { timestamp?: string }) => void

  // Settings
  addSettingsItem: (category: SettingsCategory, name: string) => void
  updateSettingsItem: (category: SettingsCategory, id: string, name: string) => void
  toggleSettingsItem: (category: SettingsCategory, id: string) => void
  deleteSettingsItem: (category: SettingsCategory, id: string) => void

  // Workflow Templates
  addWorkflowTemplate: (t: Omit<WorkflowTemplate, 'id'>) => void
  updateWorkflowTemplate: (id: string, t: Partial<WorkflowTemplate>) => void
  deleteWorkflowTemplate: (id: string) => void
  addWorkflowStep: (templateId: string, step: Omit<WorkflowStep, 'id' | 'caseTypeId'>) => void
  updateWorkflowStep: (templateId: string, stepId: string, step: Partial<WorkflowStep>) => void
  deleteWorkflowStep: (templateId: string, stepId: string) => void
  addRequiredDocument: (templateId: string, doc: Omit<RequiredDocument, 'id' | 'caseTypeId'>) => void
  updateRequiredDocument: (templateId: string, docId: string, doc: Partial<RequiredDocument>) => void
  deleteRequiredDocument: (templateId: string, docId: string) => void
}

const StoreContext = createContext<StoreCtx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>(mockCustomers)
  const [contacts, setContacts] = useState<Contact[]>(mockContacts)
  const [cases, setCases] = useState<Case[]>(mockCases)
  const [caseNotes, setCaseNotes] = useState<CaseNote[]>(mockCaseNotes)
  const [followUps, setFollowUps] = useState<FollowUp[]>(mockFollowUps)
  const [pics, setPics] = useState<PicUser[]>(mockPics)
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [caseFiles, setCaseFiles] = useState<CaseFile[]>(mockCaseFiles)
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(mockActivityLogs)
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>(mockWorkflowTemplates)
  const [settingsData, setSettingsData] = useState<SettingsData>({
    caseTypes: mockSettingsCaseTypes,
    industries: mockSettingsIndustries,
    contactTypes: mockSettingsContactTypes,
    followUpCategories: mockSettingsFollowUpCategories,
    documentTypes: mockSettingsDocumentTypes,
  })

  // Customers
  const addCustomer = (c: Omit<Customer, 'id' | 'createdAt'>) =>
    setCustomers(prev => [{ ...c, id: generateId(), createdAt: nowIso() }, ...prev])
  const updateCustomer = (id: string, c: Partial<Customer>) =>
    setCustomers(prev => prev.map(x => x.id === id ? { ...x, ...c } : x))
  const deleteCustomer = (id: string) =>
    setCustomers(prev => prev.filter(x => x.id !== id))

  // Contacts
  const addContact = (c: Omit<Contact, 'id'>) =>
    setContacts(prev => [...prev, { ...c, id: generateId() }])
  const updateContact = (id: string, c: Partial<Contact>) =>
    setContacts(prev => prev.map(x => x.id === id ? { ...x, ...c } : x))
  const deleteContact = (id: string) =>
    setContacts(prev => prev.filter(x => x.id !== id))
  const setPrimaryContact = (customerId: string, contactId: string) =>
    setContacts(prev =>
      prev.map(x => x.customerId === customerId ? { ...x, isPrimary: x.id === contactId } : x)
    )

  // Cases
  const addCase = (c: Omit<Case, 'id' | 'createdAt'>) =>
    setCases(prev => [{ ...c, id: generateId(), createdAt: nowIso(), updatedAt: nowIso() }, ...prev])
  const updateCase = (id: string, c: Partial<Case>) =>
    setCases(prev => prev.map(x => x.id === id ? { ...x, ...c, updatedAt: nowIso() } : x))
  const deleteCase = (id: string) =>
    setCases(prev => prev.filter(x => x.id !== id))

  // Case Notes
  const addCaseNote = (n: Omit<CaseNote, 'id' | 'createdAt'>) =>
    setCaseNotes(prev => [{ ...n, id: generateId(), createdAt: nowIso() }, ...prev])

  // Follow-Ups
  const addFollowUp = (f: Omit<FollowUp, 'id' | 'createdAt'>) =>
    setFollowUps(prev => [{ ...f, id: generateId(), createdAt: nowIso() }, ...prev])
  const updateFollowUp = (id: string, f: Partial<FollowUp>) =>
    setFollowUps(prev => prev.map(x => x.id === id ? { ...x, ...f } : x))
  const deleteFollowUp = (id: string) =>
    setFollowUps(prev => prev.filter(x => x.id !== id))
  const toggleFollowUp = (id: string) =>
    setFollowUps(prev =>
      prev.map(x => x.id === id ? { ...x, status: x.status === 'Open' ? 'Done' : 'Open' } : x)
    )

  // PICs
  const addPic = (p: Omit<PicUser, 'id'>) =>
    setPics(prev => [...prev, { ...p, id: generateId() }])
  const deletePic = (id: string) =>
    setPics(prev => prev.filter(x => x.id !== id))

  // Users
  const addUser = (u: Omit<User, 'id' | 'createdAt'>) =>
    setUsers(prev => [...prev, { ...u, id: generateId(), createdAt: nowIso() }])
  const updateUser = (id: string, u: Partial<Omit<User, 'id' | 'createdAt'>>) =>
    setUsers(prev => prev.map(x => x.id === id ? { ...x, ...u } : x))

  // Case Files
  const addCaseFile = (f: Omit<CaseFile, 'id' | 'uploadedAt'>) =>
    setCaseFiles(prev => [...prev, { ...f, id: generateId(), uploadedAt: nowIso() }])
  const deleteCaseFile = (id: string) =>
    setCaseFiles(prev => prev.filter(x => x.id !== id))
  const updateCaseFile = (id: string, f: Partial<CaseFile>) =>
    setCaseFiles(prev => prev.map(x => x.id === id ? { ...x, ...f } : x))
  const startAiScan = (id: string) => {
    updateCaseFile(id, { aiStatus: 'Processing' })
    const file = caseFiles.find(f => f.id === id)
    if (!file?.fileDataUrl) {
      setCaseFiles(prev => prev.map(x => x.id === id
        ? { ...x, aiStatus: 'Not Scanned' }
        : x
      ))
      return
    }
    fetch('/api/ai-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileDataUrl: file.fileDataUrl,
        fileName: file.fileName,
        documentType: file.documentType,
        aiPrompt: file.aiPrompt,
      }),
    })
      .then(res => res.json())
      .then(data => {
        setCaseFiles(prev => prev.map(x => x.id === id
          ? { ...x, aiStatus: 'Ready for Review', aiScanned: true, aiExtractedData: data }
          : x
        ))
      })
      .catch(() => {
        setCaseFiles(prev => prev.map(x => x.id === id
          ? { ...x, aiStatus: 'Not Scanned' }
          : x
        ))
      })
  }

  // Activity Logs
  const addActivityLog = (log: Omit<ActivityLog, 'id' | 'timestamp'> & { timestamp?: string }) =>
    setActivityLogs(prev => [{ ...log, id: generateId(), timestamp: log.timestamp ?? nowIso() }, ...prev])

  // Settings
  const addSettingsItem = (category: SettingsCategory, name: string) =>
    setSettingsData(prev => ({
      ...prev,
      [category]: [...prev[category], { id: generateId(), name, isActive: true }],
    }))
  const updateSettingsItem = (category: SettingsCategory, id: string, name: string) =>
    setSettingsData(prev => ({
      ...prev,
      [category]: prev[category].map(x => x.id === id ? { ...x, name } : x),
    }))
  const toggleSettingsItem = (category: SettingsCategory, id: string) =>
    setSettingsData(prev => ({
      ...prev,
      [category]: prev[category].map(x => x.id === id ? { ...x, isActive: !x.isActive } : x),
    }))
  const deleteSettingsItem = (category: SettingsCategory, id: string) =>
    setSettingsData(prev => ({
      ...prev,
      [category]: prev[category].filter(x => x.id !== id),
    }))

  // Workflow Templates
  const addWorkflowTemplate = (t: Omit<WorkflowTemplate, 'id'>) =>
    setWorkflowTemplates(prev => [...prev, { ...t, id: generateId() }])
  const updateWorkflowTemplate = (id: string, t: Partial<WorkflowTemplate>) =>
    setWorkflowTemplates(prev => prev.map(x => x.id === id ? { ...x, ...t } : x))
  const deleteWorkflowTemplate = (id: string) =>
    setWorkflowTemplates(prev => prev.filter(x => x.id !== id))

  const addWorkflowStep = (templateId: string, step: Omit<WorkflowStep, 'id' | 'caseTypeId'>) =>
    setWorkflowTemplates(prev => prev.map(t =>
      t.id === templateId
        ? { ...t, workflowSteps: [...t.workflowSteps, { ...step, id: generateId(), caseTypeId: templateId }] }
        : t
    ))
  const updateWorkflowStep = (templateId: string, stepId: string, step: Partial<WorkflowStep>) =>
    setWorkflowTemplates(prev => prev.map(t =>
      t.id === templateId
        ? { ...t, workflowSteps: t.workflowSteps.map(s => s.id === stepId ? { ...s, ...step } : s) }
        : t
    ))
  const deleteWorkflowStep = (templateId: string, stepId: string) =>
    setWorkflowTemplates(prev => prev.map(t =>
      t.id === templateId
        ? { ...t, workflowSteps: t.workflowSteps.filter(s => s.id !== stepId) }
        : t
    ))

  const addRequiredDocument = (templateId: string, doc: Omit<RequiredDocument, 'id' | 'caseTypeId'>) =>
    setWorkflowTemplates(prev => prev.map(t =>
      t.id === templateId
        ? { ...t, requiredDocuments: [...t.requiredDocuments, { ...doc, id: generateId(), caseTypeId: templateId }] }
        : t
    ))
  const updateRequiredDocument = (templateId: string, docId: string, doc: Partial<RequiredDocument>) =>
    setWorkflowTemplates(prev => prev.map(t =>
      t.id === templateId
        ? { ...t, requiredDocuments: t.requiredDocuments.map(d => d.id === docId ? { ...d, ...doc } : d) }
        : t
    ))
  const deleteRequiredDocument = (templateId: string, docId: string) =>
    setWorkflowTemplates(prev => prev.map(t =>
      t.id === templateId
        ? { ...t, requiredDocuments: t.requiredDocuments.filter(d => d.id !== docId) }
        : t
    ))

  return (
    <StoreContext.Provider value={{
      customers, contacts, cases, caseNotes, followUps, pics,
      users, caseFiles, activityLogs, settingsData, workflowTemplates,
      addCustomer, updateCustomer, deleteCustomer,
      addContact, updateContact, deleteContact, setPrimaryContact,
      addCase, updateCase, deleteCase,
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
