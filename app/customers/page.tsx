'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import type { Case, Customer } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import CustomerForm, { customerFormData, emptyCustomerForm as empty } from '@/components/ui/CustomerForm'

type Tab = 'all' | 'principals' | 'contractors'

type PartyRow = {
  name: string
  linked: string[]   // the names on the other side of the same cases
  totalCases: number
  activeCases: number
  wonCases: number
  totalExposure: number
}

/** One row per name, from the cases that aren't archived. Cases with no name for this side are left out. */
function summarise(cases: Case[], nameOf: (c: Case) => string | undefined, linkedOf: (c: Case) => string | undefined): PartyRow[] {
  const groups = new Map<string, Case[]>()
  for (const c of cases) {
    const name = nameOf(c)?.trim()
    if (!name || c.archivedAt) continue
    groups.set(name, [...(groups.get(name) ?? []), c])
  }
  return Array.from(groups, ([name, list]) => ({
    name,
    linked: Array.from(new Set(list.map(c => linkedOf(c)?.trim()).filter((n): n is string => !!n))),
    totalCases: list.length,
    activeCases: list.filter(c => c.currentStatus !== 'Done' && !c.result).length,
    wonCases: list.filter(c => c.result === 'Won').length,
    totalExposure: list.reduce((sum, c) => sum + (c.finalAmount ?? c.amount), 0),
  })).sort((a, b) => b.totalCases - a.totalCases)
}

function PartyTable({ rows, nameHeading, linkedHeading, casesParam, emptyMessage }: {
  rows: PartyRow[]; nameHeading: string; linkedHeading: string; casesParam: 'principal' | 'contractor'; emptyMessage: string
}) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-stone-50">
            <th className="table-th">{nameHeading}</th>
            <th className="table-th">{linkedHeading}</th>
            <th className="table-th">Total Cases</th>
            <th className="table-th">Active</th>
            <th className="table-th">Won</th>
            <th className="table-th">Total Exposure</th>
            <th className="table-th">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-5 py-12 text-center text-gray-400">{emptyMessage}</td>
            </tr>
          ) : rows.map(p => (
            <tr key={p.name} className="hover:bg-stone-50 transition-colors">
              <td className="table-td">
                <p className="font-semibold text-indigo-700 whitespace-nowrap">{p.name}</p>
              </td>
              <td className="table-td">
                {p.linked.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {p.linked.map(n => (
                      <span key={n} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{n}</span>
                    ))}
                  </div>
                ) : <span className="text-gray-400">—</span>}
              </td>
              <td className="table-td">
                <span className="text-sm font-semibold text-gray-800">{p.totalCases}</span>
                <span className="text-xs text-gray-400 ml-1">case{p.totalCases !== 1 ? 's' : ''}</span>
              </td>
              <td className="table-td">
                {p.activeCases > 0
                  ? <span className="text-xs font-semibold bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">{p.activeCases} active</span>
                  : <span className="text-xs text-gray-300">—</span>}
              </td>
              <td className="table-td">
                {p.wonCases > 0
                  ? <span className="text-xs font-semibold bg-green-100 text-green-700 rounded-full px-2 py-0.5">{p.wonCases} won</span>
                  : <span className="text-xs text-gray-300">—</span>}
              </td>
              <td className="table-td font-semibold text-gray-800 whitespace-nowrap">
                {formatCurrency(p.totalExposure)}
              </td>
              <td className="table-td whitespace-nowrap">
                <Link
                  href={`/cases?${casesParam}=${encodeURIComponent(p.name)}`}
                  className="btn-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                >
                  View Cases →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}

export default function CustomersPage() {
  const { customers, contacts, cases, addCustomer, updateCustomer, deleteCustomer } = useStore()
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [selected, setSelected] = useState<Customer | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const filteredCustomers = customers.filter(c =>
    [c.customerName, c.companyRegistrationNo, c.industry, c.mainPhone, c.mainEmail].some(f =>
      f?.toLowerCase().includes(search.toLowerCase())
    )
  )

  const getPrimary = (customerId: string) =>
    contacts.find(c => c.customerId === customerId && c.isPrimary) ??
    contacts.find(c => c.customerId === customerId)

  const getCaseCount = (customerId: string) => cases.filter(c => c.customerId === customerId && !c.archivedAt).length

  const principals = summarise(cases, c => c.customerName, c => c.bondPrincipal)
  const contractors = summarise(cases, c => c.bondPrincipal, c => c.customerName)

  const q = search.toLowerCase()
  const matching = (rows: PartyRow[]) => rows.filter(p => [p.name, ...p.linked].some(n => n.toLowerCase().includes(q)))

  const closeModal = () => { setModal(null); setSelected(null) }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'principals', label: 'Principals', count: principals.length },
    { key: 'contractors', label: 'Contractor / Customers', count: contractors.length },
  ]

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader
        title="Customers"
        subtitle={
          tab === 'all' ? `${customers.length} companies on record`
          : tab === 'principals' ? `${principals.length} principals across all cases`
          : `${contractors.length} contractors / customers across all cases`
        }
        action={
          tab === 'all'
            ? <button className="btn-primary" onClick={() => setModal('add')}>+ Add Customer</button>
            : null
        }
      />

      {/* Tab switcher */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch('') }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
            {!!t.count && (
              <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 leading-none ${tab === t.key ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={tab === 'all' ? 'Search by name, registration number, industry…' : 'Search by principal or contractor / customer…'}
          className="input max-w-md"
        />
      </div>

      {tab === 'all' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-stone-50">
                <th className="table-th">Customer Name</th>
                <th className="table-th">Business Type</th>
                <th className="table-th">Reg. No.</th>
                <th className="table-th">Industry</th>
                <th className="table-th">Primary Contact</th>
                <th className="table-th">Phone</th>
                <th className="table-th">Cases</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-gray-400">
                    {search ? 'No customers match your search.' : 'No customers yet. Add your first customer to get started.'}
                  </td>
                </tr>
              ) : filteredCustomers.map(c => {
                const primary = getPrimary(c.id)
                const caseCount = getCaseCount(c.id)
                return (
                  <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                    <td className="table-td">
                      <Link href={`/customers/${c.id}`} className="font-semibold text-gray-900 hover:text-blue-600 whitespace-nowrap">
                        {c.customerName}
                      </Link>
                    </td>
                    <td className="table-td">
                      {c.businessType
                        ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.businessType === 'Sole Proprietor' ? 'bg-amber-100 text-amber-700' : c.businessType === 'Partnership' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{c.businessType}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="table-td text-gray-500 whitespace-nowrap">{c.companyRegistrationNo || '—'}</td>
                    <td className="table-td">
                      {c.industry
                        ? <span className="bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 text-xs font-medium">{c.industry}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="table-td">
                      {primary ? (
                        <div>
                          <p className="text-sm font-medium text-gray-800">{primary.contactName}</p>
                          <p className="text-xs text-gray-400">{primary.contactType}</p>
                        </div>
                      ) : <span className="text-gray-400 text-sm">—</span>}
                    </td>
                    <td className="table-td text-gray-500 whitespace-nowrap">{c.mainPhone || '—'}</td>
                    <td className="table-td">
                      <span className="text-sm font-semibold text-gray-700">{caseCount}</span>
                      <span className="text-xs text-gray-400 ml-1">case{caseCount !== 1 ? 's' : ''}</span>
                    </td>
                    <td className="table-td whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Link href={`/customers/${c.id}`} className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700">View</Link>
                        <button
                          onClick={() => { setSelected(c); setModal('edit') }}
                          className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
                        >
                          Edit
                        </button>
                        {deleteId === c.id ? (
                          <>
                            <button onClick={() => { deleteCustomer(c.id); setDeleteId(null) }} className="btn-xs bg-red-600 text-white hover:bg-red-700">Confirm</button>
                            <button onClick={() => setDeleteId(null)} className="btn-xs bg-gray-100 text-gray-600 hover:bg-gray-200">Cancel</button>
                          </>
                        ) : (
                          <button onClick={() => setDeleteId(c.id)} className="btn-xs bg-red-50 text-red-600 hover:bg-red-100">Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === 'principals' && (
        <PartyTable
          rows={matching(principals)}
          nameHeading="Principal Name"
          linkedHeading="Contractor / Customers"
          casesParam="principal"
          emptyMessage={search ? 'No principals match your search.' : 'No principals yet. The Principal is chosen when a case is created.'}
        />
      )}

      {tab === 'contractors' && (
        <PartyTable
          rows={matching(contractors)}
          nameHeading="Contractor / Customer Name"
          linkedHeading="Principal"
          casesParam="contractor"
          emptyMessage={search ? 'No contractors / customers match your search.' : 'None yet. Choose a Contractor / Customer on a case and it will appear here.'}
        />
      )}

      <Modal isOpen={modal === 'add'} onClose={closeModal} title="Add Customer">
        <CustomerForm initial={empty} onSave={d => { addCustomer(d); closeModal() }} onCancel={closeModal} />
      </Modal>

      <Modal isOpen={modal === 'edit'} onClose={closeModal} title="Edit Customer">
        {selected && (
          <CustomerForm
            initial={customerFormData(selected)}
            editingId={selected.id}
            person={selected.isPerson}
            onSave={d => { updateCustomer(selected.id, d); closeModal() }}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </div>
  )
}
