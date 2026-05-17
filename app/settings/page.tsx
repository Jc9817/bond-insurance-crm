'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { USER_ROLES, USER_STATUSES, CASE_STATUSES } from '@/lib/types'
import type { SettingsCategory, User, UserRole, UserStatus } from '@/lib/types'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'users' | 'caseTypes' | 'caseStatuses' | 'industries' | 'contactTypes' | 'followUpCategories' | 'documentTypes' | 'pic'

const TABS: { key: Tab; label: string }[] = [
  { key: 'users', label: 'Users' },
  { key: 'caseTypes', label: 'Case Types' },
  { key: 'caseStatuses', label: 'Case Statuses' },
  { key: 'industries', label: 'Industries' },
  { key: 'contactTypes', label: 'Contact Types' },
  { key: 'followUpCategories', label: 'Follow-Up Categories' },
  { key: 'documentTypes', label: 'Document Types' },
  { key: 'pic', label: 'Person in Charge' },
]

// ─── User form modal ──────────────────────────────────────────────────────────

type UserFormData = { fullName: string; email: string; password: string; role: UserRole; status: UserStatus }
const emptyUserForm = (): UserFormData => ({ fullName: '', email: '', password: '', role: 'Staff', status: 'Active' })

function UserModal({ initial, onSave, onClose, title }: {
  initial: UserFormData; onSave: (d: UserFormData) => void; onClose: () => void; title: string
}) {
  const [form, setForm] = useState<UserFormData>(initial)
  const [error, setError] = useState('')

  const set = (k: keyof UserFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fullName.trim()) { setError('Full name is required.'); return }
    if (!form.email.trim()) { setError('Email is required.'); return }
    if (!form.password.trim()) { setError('Password is required.'); return }
    onSave(form)
  }

  return (
    <Modal isOpen onClose={onClose} title={title} maxWidth="sm">
      <form onSubmit={submit} className="px-6 py-5 space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
        <div>
          <label className="label">Full Name *</label>
          <input className="input" value={form.fullName} onChange={set('fullName')} placeholder="e.g. Ahmad Farid" />
        </div>
        <div>
          <label className="label">Email *</label>
          <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="ahmad@bondinsurance.com" />
        </div>
        <div>
          <label className="label">Password *</label>
          <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="Set a password" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={set('role')}>
              {USER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={set('status')}>
              {USER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" className="btn-primary flex-1">Save User</button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Editable list section ────────────────────────────────────────────────────

function ListSection({ category }: { category: SettingsCategory }) {
  const { settingsData, addSettingsItem, updateSettingsItem, toggleSettingsItem, deleteSettingsItem } = useStore()
  const items = settingsData[category]
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    addSettingsItem(category, newName.trim())
    setNewName('')
  }

  const startEdit = (id: string, name: string) => { setEditId(id); setEditName(name) }
  const saveEdit = (id: string) => {
    if (editName.trim()) updateSettingsItem(category, id, editName.trim())
    setEditId(null)
  }

  return (
    <div>
      <div className="overflow-x-auto mb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="pb-2 font-semibold">Name</th>
              <th className="pb-2 font-semibold w-24">Status</th>
              <th className="pb-2 font-semibold w-48 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map(item => (
              <tr key={item.id}>
                <td className="py-3">
                  {editId === item.id ? (
                    <input
                      className="input py-1.5 text-sm w-64"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(item.id); if (e.key === 'Escape') setEditId(null) }}
                      autoFocus
                    />
                  ) : (
                    <span className={`font-medium ${item.isActive ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                      {item.name}
                    </span>
                  )}
                </td>
                <td className="py-3">
                  <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <div className="flex items-center gap-2 justify-end">
                    {editId === item.id ? (
                      <>
                        <button onClick={() => saveEdit(item.id)} className="btn-xs bg-blue-600 text-white hover:bg-blue-700">Save</button>
                        <button onClick={() => setEditId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(item.id, item.name)} className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700">Edit</button>
                        <button onClick={() => toggleSettingsItem(category, item.id)} className={`btn-xs ${item.isActive ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                          {item.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        {deleteId === item.id ? (
                          <>
                            <button onClick={() => { deleteSettingsItem(category, item.id); setDeleteId(null) }} className="btn-xs bg-red-600 text-white hover:bg-red-700">Confirm</button>
                            <button onClick={() => setDeleteId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
                          </>
                        ) : (
                          <button onClick={() => setDeleteId(item.id)} className="btn-xs bg-red-50 text-red-500 hover:bg-red-100">Delete</button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={3} className="py-4 text-sm text-gray-400">No items yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <form onSubmit={handleAdd} className="flex gap-3">
        <input
          className="input flex-1 max-w-xs"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New item name…"
        />
        <button type="submit" className="btn-primary">+ Add</button>
      </form>
    </div>
  )
}

// ─── Main settings page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const { users, addUser, updateUser, pics, addPic, deletePic } = useStore()
  const { currentUser } = useAuth()
  const [tab, setTab] = useState<Tab>('users')

  // User management
  const [userModal, setUserModal] = useState<'add' | 'edit' | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  // PIC management
  const [newPicName, setNewPicName] = useState('')
  const [newPicEmail, setNewPicEmail] = useState('')
  const [picError, setPicError] = useState('')
  const [deletePicId, setDeletePicId] = useState<string | null>(null)

  const isAdmin = currentUser?.role === 'Admin'

  const closeUserModal = () => { setUserModal(null); setSelectedUser(null) }

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
      <PageHeader title="Settings" subtitle="Manage users, configuration, and master data" />

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Users tab ─────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="card-section">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Users</h2>
            {isAdmin && (
              <button onClick={() => setUserModal('add')} className="btn-primary text-xs px-4 py-2">
                + Add User
              </button>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-5">
            <p className="text-xs text-blue-700">
              <strong>Roles:</strong> Admin — full access · Manager — cases & reports · Staff — customers, cases & follow-ups · Viewer — read only
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="pb-3 font-semibold">Name</th>
                  <th className="pb-3 font-semibold">Email</th>
                  <th className="pb-3 font-semibold">Role</th>
                  <th className="pb-3 font-semibold">Status</th>
                  {isAdmin && <th className="pb-3 font-semibold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="py-3 font-semibold text-gray-800">{u.fullName}</td>
                    <td className="py-3 text-gray-500">{u.email}</td>
                    <td className="py-3">
                      <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${
                        u.role === 'Admin' ? 'bg-blue-100 text-blue-700' :
                        u.role === 'Manager' ? 'bg-violet-100 text-violet-700' :
                        u.role === 'Staff' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${u.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => { setSelectedUser(u); setUserModal('edit') }} className="btn-xs bg-gray-100 hover:bg-gray-200 text-gray-700">Edit</button>
                          <button
                            onClick={() => updateUser(u.id, { status: u.status === 'Active' ? 'Inactive' : 'Active' })}
                            className={`btn-xs ${u.status === 'Active' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                          >
                            {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Case Types tab ─────────────────────────────────────────────────── */}
      {tab === 'caseTypes' && (
        <div className="card-section">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Case Types</h2>
          <p className="text-sm text-gray-500 mb-5">These are the types available when creating a new case.</p>
          <ListSection category="caseTypes" />
        </div>
      )}

      {/* ── Case Statuses tab ──────────────────────────────────────────────── */}
      {tab === 'caseStatuses' && (
        <div className="card-section">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Case Workflow Statuses</h2>
          <p className="text-sm text-gray-500 mb-5">
            Fixed stages that every case moves through, in order. These are part of the core workflow.
          </p>
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
          <p className="text-xs text-gray-400 mt-5">
            Case statuses are part of the core workflow and are managed in the system configuration.
          </p>
        </div>
      )}

      {/* ── Industries tab ─────────────────────────────────────────────────── */}
      {tab === 'industries' && (
        <div className="card-section">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Industries</h2>
          <p className="text-sm text-gray-500 mb-5">Industry options shown in customer profiles.</p>
          <ListSection category="industries" />
        </div>
      )}

      {/* ── Contact Types tab ──────────────────────────────────────────────── */}
      {tab === 'contactTypes' && (
        <div className="card-section">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Contact Types</h2>
          <p className="text-sm text-gray-500 mb-5">Types used when adding contacts under a customer.</p>
          <ListSection category="contactTypes" />
        </div>
      )}

      {/* ── Follow-Up Categories tab ───────────────────────────────────────── */}
      {tab === 'followUpCategories' && (
        <div className="card-section">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Follow-Up Categories</h2>
          <p className="text-sm text-gray-500 mb-5">Categories used to classify follow-up tasks.</p>
          <ListSection category="followUpCategories" />
        </div>
      )}

      {/* ── Document Types tab ─────────────────────────────────────────────── */}
      {tab === 'documentTypes' && (
        <div className="card-section">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Document Types</h2>
          <p className="text-sm text-gray-500 mb-5">Document categories used when uploading files to a case.</p>
          <ListSection category="documentTypes" />
        </div>
      )}

      {/* ── Person in Charge tab ───────────────────────────────────────────── */}
      {tab === 'pic' && (
        <div className="card-section">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Person in Charge</h2>
          <p className="text-sm text-gray-500 mb-5">Staff members who can be assigned to cases and follow-ups.</p>
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
                    <td className="py-3 font-semibold text-gray-800">{p.name}</td>
                    <td className="py-3 text-gray-500">{p.email || '—'}</td>
                    <td className="py-3">
                      {deletePicId === p.id ? (
                        <span className="flex gap-2">
                          <button onClick={() => { deletePic(p.id); setDeletePicId(null) }} className="btn-xs bg-red-600 text-white hover:bg-red-700">Confirm</button>
                          <button onClick={() => setDeletePicId(null)} className="btn-xs bg-gray-100 text-gray-600">Cancel</button>
                        </span>
                      ) : (
                        <button onClick={() => setDeletePicId(p.id)} className="btn-xs text-red-600 bg-red-50 hover:bg-red-100">Remove</button>
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
        </div>
      )}

      {/* User modals */}
      {userModal === 'add' && (
        <UserModal
          title="Add User"
          initial={emptyUserForm()}
          onSave={d => { addUser(d); closeUserModal() }}
          onClose={closeUserModal}
        />
      )}
      {userModal === 'edit' && selectedUser && (
        <UserModal
          title="Edit User"
          initial={{ fullName: selectedUser.fullName, email: selectedUser.email, password: selectedUser.password, role: selectedUser.role, status: selectedUser.status }}
          onSave={d => { updateUser(selectedUser.id, d); closeUserModal() }}
          onClose={closeUserModal}
        />
      )}
    </div>
  )
}
