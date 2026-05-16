'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import type { FollowUp } from '@/lib/types'
import { formatDate, getDaysUntil, todayDate } from '@/lib/utils'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'

type FormData = Omit<FollowUp, 'id' | 'createdAt'>
const emptyForm = (): FormData => ({
  title: '', customerId: '', customerName: '', caseId: '', caseTitle: '',
  personInCharge: '', dueDate: '', status: 'Open',
})

function FollowUpForm({ initial, customers, cases, pics, onSave, onCancel }: {
  initial: FormData
  customers: { id: string; customerName: string }[]
  cases: { id: string; caseTitle: string; customerId: string; customerName: string }[]
  pics: { name: string }[]
  onSave: (d: FormData) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<FormData>(initial)
  const [error, setError] = useState('')

  const filteredCases = form.customerId ? cases.filter(c => c.customerId === form.customerId) : cases

  const set = (k: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (k === 'customerId') {
        const cust = customers.find(c => c.id === e.target.value)
        setForm(prev => ({ ...prev, customerId: e.target.value, customerName: cust?.customerName ?? '', caseId: '', caseTitle: '' }))
      } else if (k === 'caseId') {
        const c = cases.find(x => x.id === e.target.value)
        setForm(prev => ({ ...prev, caseId: e.target.value, caseTitle: c?.caseTitle ?? '' }))
      } else {
        setForm(prev => ({ ...prev, [k]: e.target.value }))
      }
    }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('Please describe what needs to be done.'); return }
    onSave(form)
  }

  return (
    <form onSubmit={submit} className="px-6 py-5 space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
      <div>
        <label className="label">What needs to be done? *</label>
        <input className="input" value={form.title} onChange={set('title')} placeholder="e.g. Call client to confirm quotation" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Customer</label>
          <select className="input" value={form.customerId} onChange={set('customerId')}>
            <option value="">— None —</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.customerName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Related Case</label>
          <select className="input" value={form.caseId} onChange={set('caseId')}>
            <option value="">— None —</option>
            {filteredCases.map(c => <option key={c.id} value={c.id}>{c.caseTitle}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Person in Charge</label>
          <select className="input" value={form.personInCharge} onChange={set('personInCharge')}>
            <option value="">— Select —</option>
            {pics.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Due Date</label>
          <input type="date" className="input" value={form.dueDate} onChange={set('dueDate')} />
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" className="btn-primary flex-1">Save Follow-Up</button>
      </div>
    </form>
  )
}

type Tab = 'All' | 'Open' | 'Today' | 'Overdue' | 'Done'

export default function FollowUpsPage() {
  const { followUps, customers, cases, pics, addFollowUp, updateFollowUp, deleteFollowUp, toggleFollowUp } = useStore()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('Open')
  const [picFilter, setPicFilter] = useState('All')
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [selected, setSelected] = useState<FollowUp | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const today = todayDate()

  const filtered = followUps.filter(f => {
    const d = getDaysUntil(f.dueDate)
    const matchTab =
      tab === 'All' ? true :
      tab === 'Open' ? f.status === 'Open' :
      tab === 'Done' ? f.status === 'Done' :
      tab === 'Today' ? f.dueDate === today && f.status === 'Open' :
      tab === 'Overdue' ? f.status === 'Open' && d !== null && d < 0 : true
    const matchPic = picFilter === 'All' || f.personInCharge === picFilter
    const matchSearch = search === '' || [f.title, f.customerName, f.caseTitle, f.personInCharge].some(x =>
      x?.toLowerCase().includes(search.toLowerCase())
    )
    return matchTab && matchPic && matchSearch
  })

  const overdueCnt = followUps.filter(f => f.status === 'Open' && getDaysUntil(f.dueDate) !== null && getDaysUntil(f.dueDate)! < 0).length
  const todayCnt = followUps.filter(f => f.status === 'Open' && f.dueDate === today).length

  const closeModal = () => { setModal(null); setSelected(null) }

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'Open', label: 'Open' },
    { key: 'Today', label: 'Due Today', badge: todayCnt },
    { key: 'Overdue', label: 'Overdue', badge: overdueCnt },
    { key: 'Done', label: 'Done' },
    { key: 'All', label: 'All' },
  ]

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader
        title="Follow-Ups"
        subtitle={`${followUps.filter(f => f.status === 'Open').length} open · ${overdueCnt} overdue`}
        action={
          <button className="btn-primary" onClick={() => setModal('add')}>+ Add Follow-Up</button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none min-w-[18px] text-center">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search follow-ups…" className="input w-64" />
        <select className="input w-44" value={picFilter} onChange={e => setPicFilter(e.target.value)}>
          <option value="All">All — Person in Charge</option>
          {pics.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </div>

      {/* Follow-up list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="card-section text-center py-12">
            <p className="text-gray-400">No follow-ups in this category.</p>
          </div>
        ) : filtered.map(f => {
          const d = getDaysUntil(f.dueDate)
          const isOD = f.status === 'Open' && d !== null && d < 0
          const isToday = f.status === 'Open' && d === 0

          return (
            <div
              key={f.id}
              className={`bg-white rounded-xl border shadow-sm px-5 py-4 flex items-center gap-4 transition-all ${
                isOD ? 'border-red-200 bg-red-50' : isToday ? 'border-amber-200 bg-amber-50' : 'border-gray-100'
              }`}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleFollowUp(f.id)}
                className={`w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                  f.status === 'Done' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-blue-400'
                }`}
              >
                {f.status === 'Done' && <span className="text-xs leading-none">✓</span>}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-base font-medium ${f.status === 'Done' ? 'line-through text-gray-400' : isOD ? 'text-red-800' : 'text-gray-900'}`}>
                  {f.title}
                </p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {f.customerId && (
                    <Link href={`/customers/${f.customerId}`} className="text-sm text-blue-600 hover:underline">
                      {f.customerName}
                    </Link>
                  )}
                  {f.caseId && (
                    <>
                      <span className="text-gray-300">·</span>
                      <Link href={`/cases/${f.caseId}`} className="text-sm text-gray-500 hover:text-blue-600 line-clamp-1 max-w-[200px]">
                        {f.caseTitle}
                      </Link>
                    </>
                  )}
                  {f.personInCharge && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="text-sm text-gray-500">{f.personInCharge}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Due date */}
              <div className="shrink-0 text-right">
                {f.dueDate && (
                  <p className={`text-sm font-semibold ${isOD ? 'text-red-600' : isToday ? 'text-amber-600' : 'text-gray-500'}`}>
                    {isOD ? `${Math.abs(d!)}d overdue` : isToday ? 'Due today' : formatDate(f.dueDate)}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => { setSelected(f); setModal('edit') }} className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700">Edit</button>
                {deleteId === f.id ? (
                  <>
                    <button onClick={() => { deleteFollowUp(f.id); setDeleteId(null) }} className="btn-xs bg-red-600 text-white hover:bg-red-700">Confirm</button>
                    <button onClick={() => setDeleteId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setDeleteId(f.id)} className="btn-xs bg-red-50 text-red-500 hover:bg-red-100">Delete</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Modal isOpen={modal === 'add'} onClose={closeModal} title="Add Follow-Up">
        <FollowUpForm initial={emptyForm()} customers={customers} cases={cases} pics={pics} onSave={d => { addFollowUp(d); closeModal() }} onCancel={closeModal} />
      </Modal>

      <Modal isOpen={modal === 'edit'} onClose={closeModal} title="Edit Follow-Up">
        {selected && (
          <FollowUpForm
            initial={{ title: selected.title, customerId: selected.customerId, customerName: selected.customerName, caseId: selected.caseId, caseTitle: selected.caseTitle, personInCharge: selected.personInCharge, dueDate: selected.dueDate, status: selected.status }}
            customers={customers}
            cases={cases}
            pics={pics}
            onSave={d => { updateFollowUp(selected.id, d); closeModal() }}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </div>
  )
}
