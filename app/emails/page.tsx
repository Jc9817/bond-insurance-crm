'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import type { MailMessage, MailStatus, MailSuggestion } from '@/lib/types'
import { formatCurrency, formatDate, formatFileSize, timeAgo } from '@/lib/utils'
import { CreateCaseFromEmail, FileEmailModal } from '@/components/ui/EmailDecisionModals'

// The Emails screen: a read-only view of the shared mailbox (operation@).
// For each email the AI suggests what it is — a new case, part of an existing
// case, split across cases, or not a case — and a person decides. Attachments
// stay in the mailbox until they are filed (lib/mail-inbox.ts).

type Filter = 'todo' | 'done' | 'all'
const TODO: MailStatus[] = ['new', 'analysing', 'ready']
const DONE: MailStatus[] = ['filed', 'not_case']

// Emails this recent are read by the AI as soon as the screen opens;
// older ones when someone opens them
const AUTO_AI_DAYS = 7

const LIST_COLUMNS =
  'id, graph_id, subject, from_name, from_address, to_recipients, cc_recipients, received_at, attachments, status, ai_suggestion, ai_error, case_ids, decided_by, decided_at'

type Row = Record<string, unknown>
const fromRow = (r: Row): MailMessage => ({
  id: String(r.id), graphId: String(r.graph_id), subject: String(r.subject ?? ''),
  fromName: String(r.from_name ?? ''), fromAddress: String(r.from_address ?? ''),
  toRecipients: String(r.to_recipients ?? ''), ccRecipients: String(r.cc_recipients ?? ''),
  receivedAt: String(r.received_at), bodyText: String(r.body_text ?? ''),
  attachments: (r.attachments as MailMessage['attachments']) ?? [],
  status: r.status as MailStatus, aiSuggestion: (r.ai_suggestion as MailSuggestion | null) ?? null,
  aiError: (r.ai_error as string | null) ?? undefined, caseIds: (r.case_ids as string[]) ?? [],
  decidedBy: (r.decided_by as string | null) ?? undefined, decidedAt: (r.decided_at as string | null) ?? undefined,
})

const ACTION_LABELS: Record<MailSuggestion['action'], string> = {
  create_case: 'create new case',
  existing_case: 'add to existing case',
  split: 'split across cases',
  not_case: 'not a case',
}

function useCaseNumber() {
  const { cases } = useStore()
  return (id?: string) => {
    const c = cases.find(x => x.id === id)
    return c?.caseNumber ?? c?.caseTitle ?? 'case'
  }
}

// ─── List tag ────────────────────────────────────────────────────────────────

function Tag({ mail }: { mail: MailMessage }) {
  const caseNumber = useCaseNumber()
  const tag = (text: string, cls: string) => (
    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border ${cls}`}>{text}</span>
  )
  const s = mail.aiSuggestion
  switch (mail.status) {
    case 'filed':
      return mail.caseIds.length > 1
        ? tag(`split · ${mail.caseIds.length} cases`, 'bg-amber-50 text-amber-800 border-amber-200')
        : tag(`→ ${caseNumber(mail.caseIds[0])}`, 'bg-green-50 text-green-700 border-green-200')
    case 'not_case': return tag('not a case', 'bg-white text-gray-500 border-gray-200')
    case 'analysing': return tag('AI reading…', 'bg-blue-50 text-blue-700 border-blue-200')
    case 'new': return tag('new', 'bg-gray-50 text-gray-500 border-gray-200')
  }
  if (!s) return tag('needs you', 'bg-amber-50 text-amber-800 border-amber-200')
  const label = s.action === 'existing_case' && s.caseId ? caseNumber(s.caseId)
    : s.action === 'create_case' ? 'new case' : ACTION_LABELS[s.action]
  return tag(`AI: ${label}`, 'bg-blue-50 text-blue-700 border-blue-200')
}

// ─── Right-hand panel ────────────────────────────────────────────────────────

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-sm text-gray-500 leading-6">
      {label} <span className="text-gray-900">{children}</span>
    </p>
  )
}

function DecisionPanel({ mail, onAction, onAskAi, onUndo }: {
  mail: MailMessage
  onAction: (a: 'create' | 'existing' | 'split' | 'not_case') => void
  onAskAi: () => void
  onUndo: () => void
}) {
  const { cases } = useStore()
  const caseNumber = useCaseNumber()
  const s = mail.aiSuggestion
  const unfiled = mail.attachments.filter(a => !a.filedTo).length

  if (mail.status === 'not_case') {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          Marked <b>not a case</b>{mail.decidedBy ? ` by ${mail.decidedBy}` : ''}{mail.decidedAt ? `, ${timeAgo(mail.decidedAt)}` : ''}.
        </div>
        <button onClick={onUndo} className="btn-secondary w-full">Undo</button>
      </div>
    )
  }

  if (mail.status === 'filed') {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 space-y-1.5">
          <p className="font-semibold">Filed{mail.decidedBy ? ` by ${mail.decidedBy}` : ''}</p>
          {mail.caseIds.map(id => (
            <Link key={id} href={`/cases/${id}`} className="block hover:underline">
              → {caseNumber(id)} {cases.find(c => c.id === id)?.caseTitle ?? ''}
            </Link>
          ))}
        </div>
        {unfiled > 0 && <p className="text-xs text-gray-500">{unfiled} attachment{unfiled === 1 ? '' : 's'} not filed.</p>}
        <button onClick={() => onAction('existing')} className="btn-secondary w-full">Add to another case</button>
        <button onClick={() => onAction('split')} className="btn-secondary w-full">Split across cases</button>
      </div>
    )
  }

  const expiries = (s?.policies ?? []).map(p => p.expiryDate).filter((d): d is string => !!d).sort()
  const primary = (a: MailSuggestion['action']) => s?.action === a ? 'btn-primary' : 'btn-secondary'

  return (
    <div className="space-y-3">
      {mail.status === 'analysing' ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">The AI is reading this email…</div>
      ) : mail.aiError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          The AI could not read this email: {mail.aiError}
        </div>
      ) : s ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="font-semibold text-blue-800">
            Suggest: {s.action === 'existing_case' && s.caseId ? `add to ${caseNumber(s.caseId)}` : ACTION_LABELS[s.action]}
          </p>
          {s.summary && <p className="text-sm text-gray-600 mt-0.5">{s.summary}</p>}
          <p className="text-xs text-gray-400 mt-1">AI {Math.round(s.confidence * 100)}% sure</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">Not read by the AI yet.</div>
      )}

      {s && s.action !== 'not_case' && (
        <div>
          {s.customer && <Detail label="Customer">{s.customer.name}{s.customer.ssm ? ` · ${s.customer.ssm}` : ''}{s.customer.isNew ? ' (new)' : ''}</Detail>}
          {s.caseTitle && <Detail label="Project">{s.caseTitle}</Detail>}
          {s.principal && <Detail label="Principal">{s.principal}</Detail>}
          {s.amount ? <Detail label="Value">{formatCurrency(s.amount)}</Detail> : null}
          {s.coverTypes && <Detail label="Covers">{s.coverTypes}</Detail>}
          {s.policies.length > 0 && (
            <Detail label="Policies">
              {s.policies.map(p => p.policyNumber || p.policyType).join(', ')}
            </Detail>
          )}
          {s.references && <Detail label="Refs">{s.references}</Detail>}
        </div>
      )}

      {expiries.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Cover expires {formatDate(expiries[0])}
        </div>
      )}

      <button onClick={() => onAction('create')} className={`${primary('create_case')} w-full`}>Create case</button>
      <button onClick={() => onAction('existing')} className={`${primary('existing_case')} w-full`}>Add to existing case</button>
      <button onClick={() => onAction('split')} className={`${primary('split')} w-full`}>Split across cases</button>
      <button onClick={() => onAction('not_case')} className={`${primary('not_case')} w-full`}>Not a case</button>
      {mail.status !== 'analysing' && (
        <button onClick={onAskAi} className="text-xs font-semibold text-blue-600 hover:underline w-full">
          {s || mail.aiError ? 'Ask the AI again' : 'Ask the AI'}
        </button>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function EmailsPage() {
  const { currentUser } = useAuth()
  const caseNumber = useCaseNumber()
  const [mails, setMails] = useState<MailMessage[]>([])
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState<Filter>('todo')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [body, setBody] = useState<{ id: string; text: string } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState<'create' | 'existing' | 'split' | null>(null)
  const asked = useRef(new Set<string>())   // emails already sent to the AI from this screen

  const load = useCallback(async () => {
    const { data, error } = await createClient()
      .from('mail_messages').select(LIST_COLUMNS).order('received_at', { ascending: false }).limit(500)
    if (error) setNotice(`Could not load emails: ${error.message}`)
    else setMails((data ?? []).map(fromRow))
    setLoaded(true)
  }, [])

  const reloadOne = useCallback(async (id: string) => {
    const { data } = await createClient().from('mail_messages').select(LIST_COLUMNS).eq('id', id).single()
    if (data) setMails(prev => prev.map(m => m.id === id ? fromRow(data) : m))
  }, [])

  const askAi = useCallback(async (id: string) => {
    asked.current.add(id)
    setMails(prev => prev.map(m => m.id === id ? { ...m, status: 'analysing' } : m))
    await fetch('/api/mail/analyse', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    }).catch(() => {})
    await reloadOne(id)
  }, [reloadOne])

  const sync = useCallback(async () => {
    setSyncing(true)
    const res = await fetch('/api/mail/sync', { method: 'POST' }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    if (!res?.ok) setNotice(data?.error ?? 'Could not reach the mailbox — please try again.')
    else if (data.added) setNotice(`${data.added} new email${data.added === 1 ? '' : 's'}.`)
    await load()
    setSyncing(false)
  }, [load])

  // On opening: show what DocFlow has, then check the mailbox for anything new
  useEffect(() => {
    Promise.resolve().then(load).then(sync)
  }, [load, sync])

  // Recent emails with attachments are read by the AI straight away, two at a time
  useEffect(() => {
    const since = Date.now() - AUTO_AI_DAYS * 86400000
    const queue = mails.filter(m => m.status === 'new' && m.attachments.length > 0
      && Date.parse(m.receivedAt) >= since && !asked.current.has(m.id))
    if (queue.length === 0) return
    queue.forEach(m => asked.current.add(m.id))
    let next = 0
    const worker = async () => { while (next < queue.length) await askAi(queue[next++].id) }
    worker()
    worker()
  }, [mails, askAi])

  const selected = mails.find(m => m.id === selectedId) ?? null

  // The email's text is loaded when it is opened; older emails go to the AI then
  useEffect(() => {
    if (!selected) return
    if (selected.status === 'new' && !asked.current.has(selected.id)) askAi(selected.id)
    if (body?.id === selected.id) return
    createClient().from('mail_messages').select('body_text').eq('id', selected.id).single()
      .then(({ data }) => setBody({ id: selected.id, text: String(data?.body_text ?? '') }))
  }, [selected, body, askAi])

  const decide = async (status: 'not_case' | 'undo') => {
    if (!selected) return
    const update = status === 'not_case'
      ? { status: 'not_case', decided_by: currentUser?.fullName ?? 'Unknown', decided_at: new Date().toISOString() }
      : { status: selected.aiSuggestion || selected.aiError ? 'ready' : 'new', decided_by: null, decided_at: null }
    const { error } = await createClient().from('mail_messages').update(update).eq('id', selected.id)
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
    if (selected) await reloadOne(selected.id)
  }

  const q = search.trim().toLowerCase()
  const shown = mails
    .filter(m => filter === 'all' || (filter === 'todo' ? TODO : DONE).includes(m.status))
    .filter(m => !q || `${m.subject} ${m.fromName} ${m.fromAddress} ${m.attachments.map(a => a.name).join(' ')}`.toLowerCase().includes(q))
  const todoCount = mails.filter(m => TODO.includes(m.status)).length

  return (
    <div className="p-4 sm:p-8 max-w-screen-2xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Emails</h1>
          <p className="text-sm text-gray-500">
            The shared mailbox, last 30 days · {todoCount} to sort out
          </p>
        </div>
        <button onClick={sync} disabled={syncing} className="btn-secondary disabled:opacity-50">
          {syncing ? 'Checking mailbox…' : 'Refresh'}
        </button>
      </div>

      {notice && (
        <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded-xl px-4 py-2.5 flex justify-between gap-3">
          {notice}
          <button onClick={() => setNotice('')} className="text-blue-500 hover:text-blue-700">✕</button>
        </p>
      )}

      <div className="card overflow-hidden grid lg:grid-cols-[320px_1fr_300px] lg:h-[calc(100vh-170px)]">
        {/* ── List ── */}
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
            <input className="input text-sm" placeholder="Search subject, sender, file…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="overflow-y-auto flex-1">
            {!loaded ? (
              <p className="p-4 text-sm text-gray-400">Loading…</p>
            ) : shown.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">{filter === 'todo' ? 'Nothing to sort out.' : 'No emails.'}</p>
            ) : shown.map(m => (
              <button key={m.id} onClick={() => setSelectedId(m.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 ${m.id === selectedId ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                <div className="flex justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900 truncate">{m.fromName || m.fromAddress}</span>
                  <span className="text-xs text-gray-400 shrink-0">{timeAgo(m.receivedAt)}</span>
                </div>
                <p className="text-sm text-gray-700 truncate">{m.subject || '(no subject)'}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Tag mail={m} />
                  {m.attachments.length > 0 && <span className="text-[11px] text-gray-400">📎 {m.attachments.length}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Email ── */}
        <div className="border-b lg:border-b-0 lg:border-r border-gray-200 overflow-y-auto min-h-0">
          {!selected ? (
            <p className="p-6 text-sm text-gray-400">Choose an email on the left.</p>
          ) : (
            <div className="p-5 sm:p-6">
              <p className="text-xs text-gray-400 mb-3">Read-only view of the shared mailbox</p>
              <h2 className="text-lg font-semibold text-gray-900 break-words">{selected.subject || '(no subject)'}</h2>
              <p className="text-sm text-gray-500 mt-1 break-words">
                {selected.fromName ? `${selected.fromName} <${selected.fromAddress}>` : selected.fromAddress}
                {selected.toRecipients && <> → {selected.toRecipients}</>}
              </p>
              {selected.ccRecipients && <p className="text-sm text-gray-500 break-words">Cc {selected.ccRecipients}</p>}
              <p className="text-xs text-gray-400 mt-1">{new Date(selected.receivedAt).toLocaleString()}</p>

              <div className="mt-5 text-sm text-gray-800 whitespace-pre-wrap break-words">
                {body?.id === selected.id ? (body.text || '(no text)') : 'Loading…'}
              </div>

              {selected.attachments.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {selected.attachments.map(a => {
                    const ai = selected.aiSuggestion?.attachments[a.id]
                    return (
                      <a key={a.id} href={`/api/mail/attachment?id=${selected.id}&att=${encodeURIComponent(a.id)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="block border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 max-w-full">
                        <p className="text-sm font-medium text-gray-800 truncate">{a.name}</p>
                        <p className="text-xs text-blue-700">
                          {a.filedTo ? `✓ ${a.filedTo.documentType} → ${caseNumber(a.filedTo.caseId)}`
                            : ai ? ai.documentType : formatFileSize(a.size)}
                        </p>
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Decision ── */}
        <div className="p-4 overflow-y-auto min-h-0 bg-gray-50/50">
          {selected ? (
            <DecisionPanel mail={selected} onAction={onAction} onAskAi={() => askAi(selected.id)} onUndo={() => decide('undo')} />
          ) : (
            <p className="text-sm text-gray-400">The AI&apos;s suggestion and your options appear here.</p>
          )}
        </div>
      </div>

      {selected && modal === 'create' && (
        <CreateCaseFromEmail mail={selected} onClose={() => setModal(null)} onDone={finished} />
      )}
      {selected && (modal === 'existing' || modal === 'split') && (
        <FileEmailModal mail={selected} mode={modal} onClose={() => setModal(null)} onDone={finished} />
      )}
    </div>
  )
}
