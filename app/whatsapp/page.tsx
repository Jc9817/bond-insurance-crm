'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import type { MailSuggestion } from '@/lib/types'
import { waFileKey, type WaBundle, type WaMedia, type WaMessage, type WaStatus } from '@/lib/whatsapp-types'
import { formatCurrency, formatDate, formatFileSize, timeAgo } from '@/lib/utils'
import {
  CreateCaseFromWhatsApp, FileWhatsAppModal, LinkPhoneModal, type WaFile,
} from '@/components/ui/WhatsAppDecisionModals'

// The WhatsApp screen: a read-only view of what customers send the agency's
// WhatsApp Business number (through YCloud — docs/whatsapp-ycloud-setup.md).
// A burst of messages from one number (a text, then photos / PDFs) is one
// row; the AI suggests what it is and a person decides, as on Emails.
// Files are already in DocFlow's private storage. There is no reply box:
// DocFlow never sends WhatsApp messages.

type Filter = 'todo' | 'done' | 'all'
const TODO: WaStatus[] = ['new', 'analysing', 'ready']
const CONTEXT_MESSAGES = 5

type Row = Record<string, unknown>
const bundleFromRow = (r: Row): WaBundle => ({
  id: String(r.id), customerPhone: String(r.customer_phone),
  contactId: (r.contact_id as string | null) ?? undefined, customerId: (r.customer_id as string | null) ?? undefined,
  firstAt: String(r.first_at), lastAt: String(r.last_at), messageCount: Number(r.message_count ?? 0),
  status: r.status as WaStatus, aiSuggestion: (r.ai_suggestion as MailSuggestion | null) ?? null,
  aiError: (r.ai_error as string | null) ?? undefined, caseIds: (r.case_ids as string[]) ?? [],
  decidedBy: (r.decided_by as string | null) ?? undefined, decidedAt: (r.decided_at as string | null) ?? undefined,
})
const messageFromRow = (r: Row): WaMessage => ({
  id: String(r.id), direction: r.direction === 'out' ? 'out' : 'in',
  customerPhone: String(r.customer_phone ?? ''), customerName: String(r.customer_name ?? ''),
  contactId: (r.contact_id as string | null) ?? undefined, customerId: (r.customer_id as string | null) ?? undefined,
  type: String(r.type ?? 'other'), body: String(r.body ?? ''), sentAt: String(r.sent_at),
  media: (r.media as WaMedia[]) ?? [], bundleId: (r.bundle_id as string | null) ?? undefined,
})
const MESSAGE_COLUMNS = 'id, direction, customer_phone, customer_name, contact_id, customer_id, type, body, sent_at, media, bundle_id'

const ACTION_LABELS: Record<MailSuggestion['action'], string> = {
  create_case: 'create new case', existing_case: 'add to existing case', split: 'split across cases', not_case: 'not a case',
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }
const fileName = (m: WaMedia) => m.filename || `${m.mime_type.startsWith('image/') ? 'Photo' : 'File'}.${EXT[m.mime_type] ?? 'bin'}`
const mediaUrl = (messageId: string, i: number) => `/api/whatsapp/media?m=${encodeURIComponent(messageId)}&i=${i}`

function useCaseNumber() {
  const { cases } = useStore()
  return (id?: string) => {
    const c = cases.find(x => x.id === id)
    return c?.caseNumber ?? c?.caseTitle ?? 'case'
  }
}

/** Who a bundle is from: the contact / customer the number belongs to, else the WhatsApp name, else the number. */
function useSender() {
  const { customers, contacts } = useStore()
  return (b: { contactId?: string; customerId?: string; customerPhone: string }, profileName = '') => {
    const contact = contacts.find(c => c.id === b.contactId)
    const customer = customers.find(c => c.id === (b.customerId ?? contact?.customerId))
    const name = contact ? `${contact.contactName}${customer ? ` · ${customer.customerName}` : ''}` : customer?.customerName
    return { name: name || profileName || b.customerPhone, known: !!(contact || customer) }
  }
}

// ─── List tag ────────────────────────────────────────────────────────────────

function Tag({ bundle, hasFile }: { bundle: WaBundle; hasFile: boolean }) {
  const caseNumber = useCaseNumber()
  const tag = (text: string, cls: string) => (
    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border ${cls}`}>{text}</span>
  )
  const s = bundle.aiSuggestion
  switch (bundle.status) {
    case 'filed':
      return bundle.caseIds.length > 1
        ? tag(`split · ${bundle.caseIds.length} cases`, 'bg-amber-50 text-amber-800 border-amber-200')
        : tag(`→ ${caseNumber(bundle.caseIds[0])}`, 'bg-green-50 text-green-700 border-green-200')
    case 'not_case': return tag('not a case', 'bg-white text-gray-500 border-gray-200')
    case 'analysing': return tag('AI reading…', 'bg-blue-50 text-blue-700 border-blue-200')
    case 'new': return hasFile ? tag('new', 'bg-gray-50 text-gray-500 border-gray-200') : tag('text only', 'bg-gray-50 text-gray-500 border-gray-200')
  }
  if (!s) return tag('needs you', 'bg-amber-50 text-amber-800 border-amber-200')
  const label = s.action === 'existing_case' && s.caseId ? caseNumber(s.caseId)
    : s.action === 'create_case' ? 'new case' : ACTION_LABELS[s.action]
  return tag(`AI: ${label}`, 'bg-blue-50 text-blue-700 border-blue-200')
}

// ─── Right-hand panel ────────────────────────────────────────────────────────

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <p className="text-sm text-gray-500 leading-6">{label} <span className="text-gray-900">{children}</span></p>
}

function DecisionPanel({ bundle, known, hasFile, aiEnabled, onAction, onAskAi, onUndo, onLink }: {
  aiEnabled: boolean
  bundle: WaBundle
  known: boolean
  hasFile: boolean
  onAction: (a: 'create' | 'existing' | 'split' | 'not_case') => void
  onAskAi: () => void
  onUndo: () => void
  onLink: () => void
}) {
  const { cases } = useStore()
  const caseNumber = useCaseNumber()
  const s = bundle.aiSuggestion
  const phoneDigits = bundle.customerPhone.replace(/^\+/, '')

  const footer = (
    <div className="pt-3 mt-3 border-t border-gray-200 space-y-2">
      {!known && <button onClick={onLink} className="btn-secondary w-full">Link to customer / contact</button>}
      <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer"
        className="block text-center text-xs font-semibold text-green-700 hover:underline">
        Open chat in WhatsApp ↗
      </a>
    </div>
  )

  if (bundle.status === 'not_case') {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          Marked <b>not a case</b>{bundle.decidedBy ? ` by ${bundle.decidedBy}` : ''}{bundle.decidedAt ? `, ${timeAgo(bundle.decidedAt)}` : ''}.
        </div>
        <button onClick={onUndo} className="btn-secondary w-full">Undo</button>
        {footer}
      </div>
    )
  }

  if (bundle.status === 'filed') {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 space-y-1.5">
          <p className="font-semibold">Filed{bundle.decidedBy ? ` by ${bundle.decidedBy}` : ''}</p>
          {bundle.caseIds.map(id => (
            <Link key={id} href={`/cases/${id}`} className="block hover:underline">
              → {caseNumber(id)} {cases.find(c => c.id === id)?.caseTitle ?? ''}
            </Link>
          ))}
        </div>
        <button onClick={() => onAction('existing')} className="btn-secondary w-full">Add to another case</button>
        <button onClick={() => onAction('split')} className="btn-secondary w-full">Split across cases</button>
        {footer}
      </div>
    )
  }

  const expiries = (s?.policies ?? []).map(p => p.expiryDate).filter((d): d is string => !!d).sort()
  const primary = (a: MailSuggestion['action']) => s?.action === a ? 'btn-primary' : 'btn-secondary'
  const aiErrorBox = (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      The AI could not read these messages: {bundle.aiError}
    </div>
  )

  return (
    <div className="space-y-3">
      {bundle.status === 'analysing' ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">The AI is reading these messages…</div>
      ) : s ? (
        <>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="font-semibold text-blue-800">
              Suggest: {s.action === 'existing_case' && s.caseId ? `add to ${caseNumber(s.caseId)}` : ACTION_LABELS[s.action]}
            </p>
            {s.matchReason && <p className="text-sm font-medium text-blue-900 mt-0.5">{s.matchReason}</p>}
            {s.summary && <p className="text-sm text-gray-600 mt-0.5">{s.summary}</p>}
            <p className="text-xs text-gray-400 mt-1">{Math.round(s.confidence * 100)}% sure</p>
          </div>
          {bundle.aiError && aiErrorBox}
        </>
      ) : bundle.aiError ? (
        aiErrorBox
      ) : !aiEnabled ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          Open the files in the chat, then choose what to do with them below.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          {hasFile ? 'Not read by the AI yet (it waits until the customer has stopped sending for 2 minutes).' : 'Text only — the AI reads messages that include a file.'}
        </div>
      )}

      {s && s.action !== 'not_case' && (
        <div>
          {s.customer && <Detail label="Customer">{s.customer.name}{s.customer.ssm ? ` · ${s.customer.ssm}` : ''}{s.customer.isNew ? ' (new)' : ''}</Detail>}
          {s.caseTitle && <Detail label="Project">{s.caseTitle}</Detail>}
          {s.principal && <Detail label="Project Owner">{s.principal}</Detail>}
          {s.amount ? <Detail label="Value">{formatCurrency(s.amount)}</Detail> : null}
          {s.coverTypes && <Detail label="Covers">{s.coverTypes}</Detail>}
          {s.policies.length > 0 && <Detail label="Policies">{s.policies.map(p => p.policyNumber || p.policyType).join(', ')}</Detail>}
          {s.references && <Detail label="Refs">{s.references}</Detail>}
        </div>
      )}

      {expiries.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">Cover expires {formatDate(expiries[0])}</div>
      )}

      <button onClick={() => onAction('create')} className={`${primary('create_case')} w-full`}>Create case</button>
      <button onClick={() => onAction('existing')} className={`${primary('existing_case')} w-full`}>Add to existing case</button>
      <button onClick={() => onAction('split')} className={`${primary('split')} w-full`}>Split across cases</button>
      <button onClick={() => onAction('not_case')} className={`${primary('not_case')} w-full`}>Not a case</button>
      {aiEnabled && bundle.status !== 'analysing' && hasFile && (
        <button onClick={onAskAi} className="text-xs font-semibold text-blue-600 hover:underline w-full">
          {s || bundle.aiError ? 'Ask the AI again' : 'Ask the AI'}
        </button>
      )}
      {footer}
    </div>
  )
}

// ─── Chat bubbles ────────────────────────────────────────────────────────────

function Bubble({ message, faded, suggestion }: { message: WaMessage; faded: boolean; suggestion?: MailSuggestion | null }) {
  const caseNumber = useCaseNumber()
  const out = message.direction === 'out'
  return (
    <div className={`flex ${out ? 'justify-end' : 'justify-start'} ${faded ? 'opacity-50' : ''}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm ${out ? 'bg-green-50 border border-green-200' : 'bg-white border border-gray-200'}`}>
        {message.media.map((m, i) => {
          const ai = suggestion?.attachments[waFileKey(message.id, i)]
          const filed = m.filed_to ?? []
          const label = filed.length ? `✓ ${filed[0].documentType} → ${filed.map(f => caseNumber(f.caseId)).join(', ')}` : ai?.documentType
          if (m.download_status !== 'stored') {
            return (
              <p key={i} className="text-xs text-gray-500 italic mb-1">
                {m.download_status === 'pending' ? 'File downloading…' : `${fileName(m)} — not stored${m.error ? `: ${m.error}` : ''}`}
              </p>
            )
          }
          if (m.mime_type.startsWith('image/')) {
            return (
              <a key={i} href={mediaUrl(message.id, i)} target="_blank" rel="noopener noreferrer" className="block mb-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link to a private file */}
                <img src={mediaUrl(message.id, i)} alt={fileName(m)} className="rounded-lg max-h-56 max-w-full object-contain bg-gray-50" />
                {label && <span className="block text-xs text-blue-700 mt-1">{label}</span>}
              </a>
            )
          }
          return (
            <a key={i} href={mediaUrl(message.id, i)} target="_blank" rel="noopener noreferrer"
              className="block border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 mb-1.5 hover:bg-gray-100">
              <p className="text-sm font-medium text-gray-800 truncate">📄 {fileName(m)}</p>
              <p className="text-xs text-blue-700">{label ?? formatFileSize(m.size)}</p>
            </a>
          )
        })}
        {message.body && <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{message.body}</p>}
        {!message.body && message.media.length === 0 && <p className="text-sm text-gray-400 italic">({message.type})</p>}
        <p className="text-[11px] text-gray-400 mt-1 text-right">
          {out ? 'Sent from the phone · ' : ''}{new Date(message.sentAt).toLocaleString()}
        </p>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Status = { missing: string[]; aiEnabled?: boolean; lastEventAt: string | null; failedDownloads7d: number; unmatchedNumbers: number }
type TestResult = Status & { recentEvents: { type: string; result: string | null; receivedAt: string }[]; endpoint: { ok: boolean; message: string } }

const isTodo = (b: WaBundle) => TODO.includes(b.status)

export default function WhatsAppPage() {
  const { currentUser } = useAuth()
  const sender = useSender()
  const [bundles, setBundles] = useState<WaBundle[]>([])
  const [listMessages, setListMessages] = useState<WaMessage[]>([])
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState<Filter>('todo')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [chat, setChat] = useState<WaMessage[] | null>(null)
  const [notice, setNotice] = useState('')
  const [status, setStatus] = useState<Status | null>(null)
  const [test, setTest] = useState<TestResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [modal, setModal] = useState<'create' | 'existing' | 'split' | 'link' | null>(null)

  const load = useCallback(async () => {
    const sb = createClient()
    const { data, error } = await sb.from('whatsapp_bundles').select('*').order('last_at', { ascending: false }).limit(300)
    if (error) {
      setNotice(`Could not load WhatsApp messages: ${error.message}`)
      setLoaded(true)
      return
    }
    const list = (data ?? []).map(bundleFromRow)
    const msgs: WaMessage[] = []
    for (let i = 0; i < list.length; i += 100) {
      const { data: rows } = await sb.from('whatsapp_messages').select(MESSAGE_COLUMNS)
        .in('bundle_id', list.slice(i, i + 100).map(b => b.id)).order('sent_at', { ascending: true })
      msgs.push(...(rows ?? []).map(messageFromRow))
    }
    setBundles(list)
    setListMessages(msgs)
    setLoaded(true)
  }, [])

  const reloadOne = useCallback(async (id: string) => {
    const { data } = await createClient().from('whatsapp_bundles').select('*').eq('id', id).maybeSingle()
    if (data) setBundles(prev => prev.map(b => b.id === id ? bundleFromRow(data) : b))
  }, [])

  // On opening: show what DocFlow has, have the AI read bundles that are due, then show the result
  useEffect(() => {
    Promise.resolve().then(load).then(async () => {
      const res = await fetch('/api/whatsapp/analyse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ due: true }),
      }).catch(() => null)
      const data = await res?.json().catch(() => ({}))
      if (data?.analysed) await load()
    })
    fetch('/api/whatsapp/status').then(r => r.ok ? r.json() : null).then(setStatus).catch(() => {})
  }, [load])

  const byBundle = useMemo(() => {
    const map = new Map<string, WaMessage[]>()
    for (const m of listMessages) if (m.bundleId) map.set(m.bundleId, [...(map.get(m.bundleId) ?? []), m])
    return map
  }, [listMessages])
  const selected = bundles.find(b => b.id === selectedId) ?? null

  // The chat around the chosen bundle: a few earlier messages for context, the bundle, and
  // (if switched on) what staff sent from the phone in between
  useEffect(() => {
    if (!selected) return
    let cancelled = false
    const until = new Date(Date.parse(selected.lastAt) + 10 * 60 * 1000).toISOString()
    createClient().from('whatsapp_messages').select(MESSAGE_COLUMNS)
      .eq('customer_phone', selected.customerPhone).lte('sent_at', until)
      .order('sent_at', { ascending: false }).limit(80)
      .then(({ data }) => {
        if (cancelled) return
        const all = (data ?? []).map(messageFromRow).reverse()
        const firstIndex = all.findIndex(m => m.bundleId === selected.id || Date.parse(m.sentAt) >= Date.parse(selected.firstAt))
        setChat(firstIndex === -1 ? all : all.slice(Math.max(0, firstIndex - CONTEXT_MESSAGES)))
      })
    return () => { cancelled = true }
  }, [selected])

  const filesOf = (b: WaBundle): WaFile[] => (byBundle.get(b.id) ?? []).flatMap(m => m.media.flatMap((x, i) =>
    x.download_status === 'stored'
      ? [{ key: waFileKey(m.id, i), name: fileName(x), size: x.size, mimeType: x.mime_type, filedTo: x.filed_to ?? [] }]
      : []))

  const askAi = async (id: string) => {
    setBundles(prev => prev.map(b => b.id === id ? { ...b, status: 'analysing' } : b))
    await fetch('/api/whatsapp/analyse', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    }).catch(() => {})
    await reloadOne(id)
  }

  const decide = async (to: 'not_case' | 'undo') => {
    if (!selected) return
    const update = to === 'not_case'
      ? { status: 'not_case', decided_by: currentUser?.fullName ?? 'Unknown', decided_at: new Date().toISOString() }
      : { status: selected.aiSuggestion || selected.aiError ? 'ready' : 'new', decided_by: null, decided_at: null }
    const { error } = await createClient().from('whatsapp_bundles').update(update).eq('id', selected.id)
    if (error) setNotice(`Could not save: ${error.message}`)
    await reloadOne(selected.id)
  }

  const onAction = (a: 'create' | 'existing' | 'split' | 'not_case') => {
    setNotice('')
    if (a === 'not_case') decide('not_case')
    else setModal(a)
  }

  const finished = async (message: string) => {
    setModal(null)
    setNotice(message)
    setChat(null)
    await load()
  }

  const runTest = async () => {
    setTesting(true)
    const res = await fetch('/api/whatsapp/status?test=1').catch(() => null)
    const data = await res?.json().catch(() => null)
    if (res?.ok) setTest(data)
    else setNotice(data?.error ?? 'Could not run the test.')
    setTesting(false)
  }

  const q = search.trim().toLowerCase()
  const shown = bundles
    .filter(b => filter === 'all' || isTodo(b) === (filter === 'todo'))
    .filter(b => {
      if (!q) return true
      const msgs = byBundle.get(b.id) ?? []
      const who = sender(b, msgs.find(m => m.customerName)?.customerName).name
      return `${who} ${b.customerPhone} ${msgs.map(m => `${m.body} ${m.media.map(fileName).join(' ')}`).join(' ')}`.toLowerCase().includes(q)
    })
  const todoCount = bundles.filter(isTodo).length
  const selectedMessages = selected ? byBundle.get(selected.id) ?? [] : []
  const selectedSender = selected ? sender(selected, selectedMessages.find(m => m.customerName)?.customerName) : null
  const selectedFiles = selected ? filesOf(selected) : []

  return (
    <div className="p-4 sm:p-8 max-w-screen-2xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp</h1>
          <p className="text-sm text-gray-500">
            Messages to the WhatsApp Business number · {todoCount} to sort out
            {status?.lastEventAt && <> · last message {timeAgo(status.lastEventAt)}</>}
          </p>
        </div>
        <div className="flex gap-2">
          {currentUser?.role === 'Admin' && (
            <button onClick={runTest} disabled={testing} className="btn-secondary disabled:opacity-50">
              {testing ? 'Testing…' : 'Test connection'}
            </button>
          )}
          <button onClick={load} className="btn-secondary">Refresh</button>
        </div>
      </div>

      {status && status.missing.length > 0 && (
        <p className="mb-4 text-sm bg-amber-50 text-amber-800 rounded-xl px-4 py-2.5">
          WhatsApp is not connected yet. Missing in Vercel: <b>{status.missing.join(', ')}</b>.
          See docs/whatsapp-ycloud-setup.md.
        </p>
      )}
      {status && (status.failedDownloads7d > 0 || status.unmatchedNumbers > 0) && (
        <p className="mb-4 text-xs text-gray-500">
          {status.failedDownloads7d > 0 && <>{status.failedDownloads7d} file download{status.failedDownloads7d === 1 ? '' : 's'} failed in the last 7 days (retried each morning). </>}
          {status.unmatchedNumbers > 0 && <>{status.unmatchedNumbers} number{status.unmatchedNumbers === 1 ? '' : 's'} not linked to a customer.</>}
        </p>
      )}
      {test && (
        <div className="mb-4 text-sm bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 space-y-1">
          <div className="flex justify-between gap-3">
            <p className="font-semibold text-gray-800">
              YCloud webhook: <span className={test.endpoint.ok ? 'text-green-700' : 'text-red-600'}>{test.endpoint.message}</span>
            </p>
            <button onClick={() => setTest(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          {test.recentEvents.length === 0 ? <p className="text-gray-500">No events received yet.</p> : (
            <ul className="text-xs text-gray-600 space-y-0.5">
              {test.recentEvents.map((e, i) => (
                <li key={i}><span className="text-gray-400">{new Date(e.receivedAt).toLocaleString()}</span> · {e.type || '(no type)'} → {e.result ?? 'processing…'}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {notice && (
        <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded-xl px-4 py-2.5 flex justify-between gap-3">
          {notice}
          <button onClick={() => setNotice('')} className="text-blue-500 hover:text-blue-700">✕</button>
        </p>
      )}

      <div className="card overflow-hidden grid lg:grid-cols-[320px_1fr_300px] lg:h-[calc(100vh-170px)]">
        {/* ── List: one row per bundle ── */}
        <div className="border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col min-h-0 max-h-[50vh] lg:max-h-none">
          <div className="p-3 border-b border-gray-200 space-y-2">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(['todo', 'done', 'all'] as Filter[]).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`flex-1 text-xs font-medium px-2 py-1.5 rounded-md ${filter === f ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {f === 'todo' ? `To do (${todoCount})` : f === 'done' ? 'Done' : 'All'}
                </button>
              ))}
            </div>
            <input className="input text-sm" placeholder="Search name, number, text, file…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="overflow-y-auto flex-1">
            {!loaded ? (
              <p className="p-4 text-sm text-gray-400">Loading…</p>
            ) : shown.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">{filter === 'todo' ? 'Nothing to sort out.' : 'No WhatsApp messages.'}</p>
            ) : shown.map(b => {
              const msgs = byBundle.get(b.id) ?? []
              const who = sender(b, msgs.find(m => m.customerName)?.customerName)
              const first = msgs.find(m => m.body)?.body ?? ''
              const files = msgs.reduce((n, m) => n + m.media.filter(x => x.download_status === 'stored').length, 0)
              return (
                <button key={b.id} onClick={() => { setSelectedId(b.id); setChat(null) }}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 ${b.id === selectedId ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <div className="flex justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900 truncate">{who.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{timeAgo(b.lastAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 truncate">{first || (files ? '(files only)' : '(no text)')}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Tag bundle={b} hasFile={files > 0} />
                    {b.messageCount > 1 && <span className="text-[11px] font-medium text-gray-500">{b.messageCount} messages</span>}
                    {files > 0 && <span className="text-[11px] text-gray-400">📎 {files}</span>}
                    {!who.known && <span className="text-[11px] text-amber-700">unknown number</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Chat, oldest first ── */}
        <div className="border-b lg:border-b-0 lg:border-r border-gray-200 overflow-y-auto min-h-0 bg-gray-50/60">
          {!selected ? (
            <p className="p-6 text-sm text-gray-400">Choose a conversation on the left.</p>
          ) : (
            <div className="p-5 sm:p-6">
              <p className="text-xs text-gray-400 mb-1">Read-only — DocFlow never sends WhatsApp messages. Earlier messages are greyed.</p>
              <h2 className="text-lg font-semibold text-gray-900 break-words">{selectedSender?.name}</h2>
              <p className="text-sm text-gray-500 mb-4">{selected.customerPhone}</p>
              <div className="space-y-2.5">
                {chat === null ? <p className="text-sm text-gray-400">Loading…</p> : chat.map(m => (
                  <Bubble key={m.id} message={m} faded={m.direction === 'in' && m.bundleId !== selected.id} suggestion={selected.aiSuggestion} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Decision ── */}
        <div className="p-4 overflow-y-auto min-h-0 bg-gray-50/50">
          {selected && selectedSender ? (
            <DecisionPanel bundle={selected} known={selectedSender.known} hasFile={selectedFiles.length > 0} aiEnabled={!!status?.aiEnabled}
              onAction={onAction} onAskAi={() => askAi(selected.id)} onUndo={() => decide('undo')} onLink={() => setModal('link')} />
          ) : (
            <p className="text-sm text-gray-400">The AI&apos;s suggestion and your options appear here.</p>
          )}
        </div>
      </div>

      {selected && selectedSender && modal === 'create' && (
        <CreateCaseFromWhatsApp bundle={selected} files={selectedFiles} from={selectedSender.name} onClose={() => setModal(null)} onDone={finished} />
      )}
      {selected && selectedSender && (modal === 'existing' || modal === 'split') && (
        <FileWhatsAppModal bundle={selected} files={selectedFiles} from={selectedSender.name} mode={modal} onClose={() => setModal(null)} onDone={finished} />
      )}
      {selected && modal === 'link' && (
        <LinkPhoneModal phone={selected.customerPhone} onClose={() => setModal(null)} onDone={finished} />
      )}
    </div>
  )
}
