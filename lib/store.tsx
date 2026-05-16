'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import type { Customer, Contact, Case, CaseNote, FollowUp, PicUser } from './types'
import {
  mockCustomers, mockContacts, mockCases, mockCaseNotes, mockFollowUps, mockPics,
} from './mock-data'
import { generateId, nowIso } from './utils'

type StoreCtx = {
  customers: Customer[]
  contacts: Contact[]
  cases: Case[]
  caseNotes: CaseNote[]
  followUps: FollowUp[]
  pics: PicUser[]

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

  // Settings
  addPic: (p: Omit<PicUser, 'id'>) => void
  deletePic: (id: string) => void
}

const StoreContext = createContext<StoreCtx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>(mockCustomers)
  const [contacts, setContacts] = useState<Contact[]>(mockContacts)
  const [cases, setCases] = useState<Case[]>(mockCases)
  const [caseNotes, setCaseNotes] = useState<CaseNote[]>(mockCaseNotes)
  const [followUps, setFollowUps] = useState<FollowUp[]>(mockFollowUps)
  const [pics, setPics] = useState<PicUser[]>(mockPics)

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

  return (
    <StoreContext.Provider value={{
      customers, contacts, cases, caseNotes, followUps, pics,
      addCustomer, updateCustomer, deleteCustomer,
      addContact, updateContact, deleteContact, setPrimaryContact,
      addCase, updateCase, deleteCase,
      addCaseNote,
      addFollowUp, updateFollowUp, deleteFollowUp, toggleFollowUp,
      addPic, deletePic,
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
