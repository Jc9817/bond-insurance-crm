'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { CASE_STATUSES, CASE_TYPES, CONTACT_TYPES, INDUSTRIES } from '@/lib/types'
import PageHeader from '@/components/ui/PageHeader'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-section mb-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">{title}</h2>
      {children}
    </div>
  )
}

function ReadonlyList({ items }: { items: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(item => (
        <span key={item} className="bg-gray-100 text-gray-700 rounded-full px-3 py-1 text-sm">{item}</span>
      ))}
    </div>
  )
}

export default function SettingsPage() {
  const { pics, addPic, deletePic } = useStore()
  const [newPicName, setNewPicName] = useState('')
  const [newPicEmail, setNewPicEmail] = useState('')
  const [picError, setPicError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const submitPic = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPicName.trim()) { setPicError('Name is required.'); return }
    addPic({ name: newPicName.trim(), email: newPicEmail.trim() })
    setNewPicName('')
    setNewPicEmail('')
    setPicError('')
  }

  return (
    <div className="p-8 max-w-screen-lg mx-auto">
      <PageHeader title="Settings" subtitle="Manage master data" />

      {/* Person in Charge / Users */}
      <Section title="Person in Charge">
        <div className="overflow-x-auto mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-semibold">Name</th>
                <th className="pb-2 font-semibold">Email</th>
                <th className="pb-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pics.map(p => (
                <tr key={p.id}>
                  <td className="py-3 font-medium text-gray-800">{p.name}</td>
                  <td className="py-3 text-gray-500">{p.email || '—'}</td>
                  <td className="py-3">
                    {deleteId === p.id ? (
                      <span className="flex gap-2">
                        <button onClick={() => { deletePic(p.id); setDeleteId(null) }} className="btn-xs bg-red-600 text-white hover:bg-red-700">Confirm</button>
                        <button onClick={() => setDeleteId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => setDeleteId(p.id)} className="btn-xs text-red-600 bg-red-50 hover:bg-red-100">Remove</button>
                    )}
                  </td>
                </tr>
              ))}
              {pics.length === 0 && (
                <tr><td colSpan={3} className="py-4 text-sm text-gray-400">No staff added yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={submitPic} className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="label">Name *</label>
            <input className="input w-44" value={newPicName} onChange={e => setNewPicName(e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input w-52" type="email" value={newPicEmail} onChange={e => setNewPicEmail(e.target.value)} placeholder="email@company.com" />
          </div>
          <button type="submit" className="btn-primary">Add Person</button>
        </form>
        {picError && <p className="text-sm text-red-600 mt-2">{picError}</p>}
      </Section>

      {/* Case statuses (workflow, read-only) */}
      <Section title="Case Workflow Statuses">
        <p className="text-xs text-gray-400 mb-4">Fixed stages that every case moves through, in order.</p>
        <div className="flex flex-wrap gap-2 items-center">
          {CASE_STATUSES.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                <span className="text-sm text-gray-700">{s}</span>
              </div>
              {i < CASE_STATUSES.length - 1 && <span className="text-gray-300">→</span>}
            </div>
          ))}
        </div>
      </Section>

      {/* Case types */}
      <Section title="Case Types">
        <p className="text-xs text-gray-400 mb-3">Available options when creating a new case.</p>
        <ReadonlyList items={CASE_TYPES} />
      </Section>

      {/* Contact types */}
      <Section title="Contact Types">
        <p className="text-xs text-gray-400 mb-3">Types used when adding contacts under a customer.</p>
        <ReadonlyList items={CONTACT_TYPES} />
      </Section>

      {/* Industries */}
      <Section title="Industries">
        <p className="text-xs text-gray-400 mb-3">Industry options for customer profiles.</p>
        <ReadonlyList items={INDUSTRIES} />
      </Section>

      <p className="text-xs text-gray-400 mt-2">
        Case types, contact types, and industries are defined in{' '}
        <code className="bg-gray-100 px-1 rounded">lib/types.ts</code>. Edit that file to add or remove options.
      </p>
    </div>
  )
}
