'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import type {
  Customer, Contact, Case, CaseNote, FollowUp, PicUser,
  User, CaseFile, ActivityLog, SettingsItem, SettingsCategory,
} from './types'
import {
  mockCustomers, mockContacts, mockCases, mockCaseNotes, mockFollowUps, mockPics,
  mockUsers, mockCaseFiles, mockActivityLogs,
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
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void

  // Settings
  addSettingsItem: (category: SettingsCategory, name: string) => void
  updateSettingsItem: (category: SettingsCategory, id: string, name: string) => void
  toggleSettingsItem: (category: SettingsCategory, id: string) => void
  deleteSettingsItem: (category: SettingsCategory, id: string) => void
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
    setCases(prev => [{ ...c, id: generateId(), createdAt: nowIso() }, ...prev])
  const updateCase = (id: string, c: Partial<Case>) =>
    setCases(prev => prev.map(x => x.id === id ? { ...x, ...c } : x))
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
    setTimeout(() => {
      const file = caseFiles.find(f => f.id === id)
      const relatedCase = file ? cases.find(c => c.id === file.caseId) : null
      const mockData = {
        customerName: relatedCase?.customerName ?? 'Detected Customer Name',
        projectName: relatedCase?.caseTitle.replace(/^[^—–]+[—–]\s*/, '') ?? 'Detected Project Name',
        caseType: relatedCase?.caseType ?? 'Bond Request',
        amount: relatedCase ? `RM ${relatedCase.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}` : 'RM 0.00',
        expiryDate: '2027-12-31',
        notes: 'Document reviewed. Key fields extracted. Please verify before approving.',
      }
      setCaseFiles(prev =>
        prev.map(x => x.id === id
          ? { ...x, aiStatus: 'Ready for Review', aiScanned: true, aiExtractedData: mockData }
          : x
        )
      )
    }, 2000)
  }

  // Activity Logs
  const addActivityLog = (log: Omit<ActivityLog, 'id' | 'timestamp'>) =>
    setActivityLogs(prev => [{ ...log, id: generateId(), timestamp: nowIso() }, ...prev])

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

  return (
    <StoreContext.Provider value={{
      customers, contacts, cases, caseNotes, followUps, pics,
      users, caseFiles, activityLogs, settingsData,
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
