'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import type { Customer } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import CustomerForm, { emptyCustomerForm as empty } from '@/components/ui/CustomerForm'

export default function CustomersPage() {
  const { customers, contacts, cases, addCustomer, updateCustomer, deleteCustomer } = useStore()
  const [tab, setTab] = useState<'customers' | 'principals'>('customers')
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

  // Build principals list from cases
  const principalsMap = cases
    .filter(c => c.bondPrincipal && c.bondPrincipal.trim() && !c.archivedAt)
    .reduce<Record<string, { name: string; cases: typeof cases }>>((acc, c) => {
      const key = c.bondPrincipal!
      if (!acc[key]) acc[key] = { name: key, cases: [] }
      acc[key].cases.push(c)
      return acc
    }, {})

  const principals = Object.values(principalsMap)
    .map(p => ({
      name: p.name,
      totalCases: p.cases.length,
      activeCases: p.cases.filter(c => c.currentStatus !== 'Done' && !c.result).length,
      wonCases: p.cases.filter(c => c.result === 'Won').length,
      totalExposure: p.cases.reduce((sum, c) => sum + (c.finalAmount ?? c.amount), 0),
      customers: Array.from(new Set(p.cases.map(c => c.customerName))),
    }))
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.customers.some(c => c.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => b.totalCases - a.totalCases)

  const closeModal = () => { setModal(null); setSelected(null) }

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader
        title="Customers"
        subtitle={tab === 'customers' ? `${customers.length} companies on record` : `${Object.keys(principalsMap).length} principals across all cases`}
        action={
          tab === 'customers'
            ? <button className="btn-primary" onClick={() => setModal('add')}>+ Add Customer</button>
            : null
        }
      />

      {/* Tab switcher */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        <button
          onClick={() => { setTab('customers'); setSearch('') }}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'customers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Customers
        </button>
        <button
          onClick={() => { setTab('principals'); setSearch('') }}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'principals' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Principals
          {Object.keys(principalsMap).length > 0 && (
            <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 leading-none ${tab === 'principals' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
              {Object.keys(principalsMap).length}
            </span>
          )}
        </button>
      </div>

      <div className="mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={tab === 'customers' ? 'Search by name, registration number, industry…' : 'Search principals or customers…'}
          className="input max-w-md"
        />
      </div>

      {tab === 'customers' ? (
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
      ) : (
        /* ── Principals tab ── */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-stone-50">
                <th className="table-th">Principal Name</th>
                <th className="table-th">Submitted By (Customer)</th>
                <th className="table-th">Total Cases</th>
                <th className="table-th">Active</th>
                <th className="table-th">Won</th>
                <th className="table-th">Total Exposure</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {principals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                    {search ? 'No principals match your search.' : 'No principals yet. Set a "Principal" on a case when the bond is issued in a different name from the customer.'}
                  </td>
                </tr>
              ) : principals.map(p => (
                <tr key={p.name} className="hover:bg-stone-50 transition-colors">
                  <td className="table-td">
                    <p className="font-semibold text-indigo-700 whitespace-nowrap">{p.name}</p>
                  </td>
                  <td className="table-td">
                    <div className="flex flex-wrap gap-1">
                      {p.customers.map(c => (
                        <span key={c} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{c}</span>
                      ))}
                    </div>
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
                      href={`/cases?principal=${encodeURIComponent(p.name)}`}
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
      )}

      <Modal isOpen={modal === 'add'} onClose={closeModal} title="Add Customer">
        <CustomerForm initial={empty} onSave={d => { addCustomer(d); closeModal() }} onCancel={closeModal} />
      </Modal>

      <Modal isOpen={modal === 'edit'} onClose={closeModal} title="Edit Customer">
        {selected && (
          <CustomerForm
            initial={{ customerName: selected.customerName, companyRegistrationNo: selected.companyRegistrationNo, businessType: selected.businessType ?? '', industry: selected.industry, mainPhone: selected.mainPhone, mainEmail: selected.mainEmail, notes: selected.notes }}
            onSave={d => { updateCustomer(selected.id, d); closeModal() }}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </div>
  )
}
