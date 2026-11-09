// Tests for lib/mail-links.ts — run with: npm test
// An in-memory store stands in for case_conversations / case_references,
// with the same rules (one row per thread + case; each reference number
// belongs to one case, first one kept).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyCaseMatch, attachmentForPolicy, findCaseMatch, groupThreads, normalizeReference, recordFiling, referenceCandidates, withoutCaseFilings,
} from './mail-links.ts'

function memoryStore() {
  const conversations = []   // { caseId, conversationId }, newest last
  const references = []      // { caseId, kind, value, valueNormalized }
  return {
    conversations, references,
    async casesForConversation(id) {
      return conversations.filter(c => c.conversationId === id).map(c => c.caseId).reverse()
    },
    async findReferences(normalized) {
      return references.filter(r => normalized.includes(r.valueNormalized))
    },
    async link(caseIds, conversationId, refs, referencesCaseId) {
      for (const caseId of caseIds) {
        if (conversationId && !conversations.some(c => c.caseId === caseId && c.conversationId === conversationId)) {
          conversations.push({ caseId, conversationId })
        }
      }
      for (const r of refs) {
        const valueNormalized = normalizeReference(r.value)
        if (!references.some(x => x.kind === r.kind && x.valueNormalized === valueNormalized)) {
          references.push({ caseId: referencesCaseId, kind: r.kind, value: r.value, valueNormalized })
        }
      }
    },
  }
}

const CASES = { 'case-a': '2026-031', 'case-b': '2026-040' }
const label = id => CASES[id] ?? id

// What the AI might say about an email it can't place
const aiSaysNewCase = (extra = {}) => ({
  action: 'create_case', summary: 'Quotation for a new project', confidence: 0.6,
  caseTitle: '2026/11 - Roller shutter, BSN Terengganu', policies: [], attachments: { att1: { documentType: 'Quotation' } },
  ...extra,
})

// The thread: insurer's quotation, our reply, their revised quote — then a
// colleague forwards the first email, which starts a new conversation.
const thread = [
  { id: 'm1', conversationId: 'CONV-1', receivedAt: '2026-11-01T09:00:00Z', subject: 'Quotation - KY Jaya CAR',
    body: 'Dear Sir, please find our quotation QTS: B62716/26 for CAR cover.' },
  { id: 'm2', conversationId: 'CONV-1', receivedAt: '2026-11-01T11:00:00Z', subject: 'RE: Quotation - KY Jaya CAR',
    body: 'Thanks, can you revise the sum insured?' },
  { id: 'm3', conversationId: 'CONV-1', receivedAt: '2026-11-02T08:30:00Z', subject: 'RE: Quotation - KY Jaya CAR',
    body: 'Revised quotation attached.' },
]
const forward = { id: 'm4', conversationId: 'CONV-2', receivedAt: '2026-11-02T10:00:00Z', subject: 'FW: Quotation - KY Jaya CAR',
  body: 'FYI\n\n---------- Forwarded message ----------\nPlease find our quotation QTS: B62716/26 for CAR cover.' }

const emailFor = (m, references = []) => ({
  conversationId: m.conversationId, references, text: `${m.subject}\n${m.body}`,
})

test('references compare without their label, case or punctuation', () => {
  assert.equal(normalizeReference('QTS: B62716/26'), 'B6271626')
  assert.equal(normalizeReference('b62716/26'), 'B6271626')
  assert.equal(normalizeReference('Ref No: ANCKL0032785'), 'ANCKL0032785')
  assert.equal(normalizeReference('PO#45120'), '45120')
  assert.ok(referenceCandidates('quotation QTS: B62716/26 for CAR').includes('B6271626'))
  assert.ok(!referenceCandidates('call 1234 about CAR').includes('1234'), 'short numbers are ignored')
})

test('a three-message thread and a forward with the same QTS reference', async () => {
  const store = memoryStore()

  // 1. The first email: nothing known yet, so the AI's "create new case" stands
  const m1Refs = [{ kind: 'quote', value: 'B62716/26' }]
  const match1 = await findCaseMatch(store, emailFor(thread[0], m1Refs))
  assert.equal(match1, undefined)
  assert.equal(applyCaseMatch(aiSaysNewCase(), match1, label).action, 'create_case')

  // The person creates case A from it; filing records the thread and the reference
  await recordFiling(store, { mailId: 'm1', caseIds: ['case-a'], conversationId: 'CONV-1', references: m1Refs })
  assert.deepEqual(store.conversations, [{ caseId: 'case-a', conversationId: 'CONV-1' }])
  assert.equal(store.references.length, 1)

  // 2. and 3. Replies in the same thread: suggested for case A, not a new case
  for (const reply of thread.slice(1)) {
    const match = await findCaseMatch(store, emailFor(reply))
    assert.deepEqual(match, { by: 'thread', caseIds: ['case-a'] })
    const s = applyCaseMatch(aiSaysNewCase(), match, label)
    assert.equal(s.action, 'existing_case')
    assert.equal(s.caseId, 'case-a')
    assert.equal(s.caseTitle, undefined)
    assert.ok(s.confidence >= 0.95)
    assert.equal(s.matchReason, 'Same email thread as 2026-031')
    assert.equal(s.attachments.att1.documentType, 'Quotation', 'document types from the AI are kept')
    await recordFiling(store, { mailId: reply.id, caseIds: ['case-a'], conversationId: 'CONV-1', references: [] })
  }
  assert.equal(store.conversations.length, 1, 'the thread is recorded once per case')

  // 4. The forward starts a new conversation but carries the QTS reference —
  //    found in its text even when the AI lists no references
  const match4 = await findCaseMatch(store, emailFor(forward))
  assert.equal(match4.by, 'reference')
  assert.equal(match4.caseId, 'case-a')
  const s4 = applyCaseMatch(aiSaysNewCase(), match4, label)
  assert.equal(s4.action, 'existing_case')
  assert.equal(s4.caseId, 'case-a')
  assert.ok(s4.confidence >= 0.9)
  assert.equal(s4.matchReason, 'Quote ref B62716/26 is on 2026-031')

  // Also when the AI wrote the reference with its label
  const match4b = await findCaseMatch(store, { conversationId: 'CONV-2', references: [{ kind: 'quote', value: 'QTS: B62716/26' }], text: '' })
  assert.equal(match4b?.caseId, 'case-a')

  // The thread view: two rows, newest first; the thread's messages oldest first
  const rows = groupThreads([thread[2], forward, thread[0], thread[1]])
  assert.deepEqual(rows.map(r => r.key), ['CONV-2', 'CONV-1'])
  assert.deepEqual(rows[1].messages.map(m => m.id), ['m1', 'm2', 'm3'])
  assert.equal(rows[1].latest.id, 'm3')
})

test('the suggestion can still be changed by the person', async () => {
  // applyCaseMatch only suggests: the result is a plain suggestion the
  // Emails screen pre-fills; nothing is filed until someone chooses.
  const store = memoryStore()
  await recordFiling(store, { mailId: 'm1', caseIds: ['case-a'], conversationId: 'CONV-1', references: [] })
  const s = applyCaseMatch(aiSaysNewCase(), await findCaseMatch(store, emailFor(thread[1])), label)
  const changed = { ...s, caseId: 'case-b' }
  assert.equal(changed.caseId, 'case-b')
})

test('a thread filed to two cases suggests one of them, or a split between them', async () => {
  const store = memoryStore()
  await recordFiling(store, { mailId: 'm1', caseIds: ['case-a', 'case-b'], conversationId: 'CONV-1', references: [{ kind: 'quote', value: 'B62716/26' }] })
  assert.equal(store.references.length, 0, 'a split email\'s references are not kept')

  const match = await findCaseMatch(store, emailFor(thread[1]))
  assert.equal(match.caseIds.length, 2)

  const toB = applyCaseMatch({ ...aiSaysNewCase(), action: 'existing_case', caseId: 'case-b' }, match, label)
  assert.equal(toB.caseId, 'case-b', 'the AI\'s choice among the thread\'s cases is kept')

  const split = applyCaseMatch({
    ...aiSaysNewCase(), action: 'split',
    attachments: { att1: { documentType: 'Quotation', caseId: 'case-a' }, att2: { documentType: 'Quotation', caseId: 'case-x' } },
  }, match, label)
  assert.equal(split.action, 'split')
  assert.equal(split.attachments.att1.caseId, 'case-a')
  assert.equal(split.attachments.att2.caseId, undefined, 'cases outside the thread are dropped')
  assert.equal(split.matchReason, 'Same email thread as 2026-040, 2026-031', 'most recently linked first')
})

test('a reference already kept for one case stays with it', async () => {
  const store = memoryStore()
  const refs = [{ kind: 'cover_note', value: 'ANCKL0032785' }]
  await recordFiling(store, { mailId: 'm1', caseIds: ['case-a'], conversationId: null, references: refs })
  await recordFiling(store, { mailId: 'm9', caseIds: ['case-b'], conversationId: null, references: refs })
  assert.deepEqual(store.references.map(r => r.caseId), ['case-a'])
})

test('deleting a case takes its filings off an email\'s attachments', () => {
  const filing = caseId => ({ caseId, caseFileId: `file-${caseId}`, documentType: 'Quotation' })
  const [onlyThere, firstOfTwo, secondOfTwo, elsewhere] = withoutCaseFilings([
    { id: 'a', name: 'a.pdf', size: 1, contentType: 'application/pdf', filedTo: filing('case-a') },
    { id: 'b', name: 'b.pdf', size: 1, contentType: 'application/pdf', filedTo: filing('case-a'), alsoFiledTo: [filing('case-b')] },
    { id: 'c', name: 'c.pdf', size: 1, contentType: 'application/pdf', filedTo: filing('case-b'), alsoFiledTo: [filing('case-a')] },
    { id: 'd', name: 'd.pdf', size: 1, contentType: 'application/pdf', filedTo: filing('case-b') },
  ], 'case-a')
  assert.equal(onlyThere.filedTo, undefined, 'free to be filed again')
  assert.equal(firstOfTwo.filedTo.caseId, 'case-b', 'the other case becomes its filing')
  assert.equal(firstOfTwo.alsoFiledTo, undefined)
  assert.equal(secondOfTwo.filedTo.caseId, 'case-b')
  assert.equal(secondOfTwo.alsoFiledTo, undefined)
  assert.equal(elsewhere.filedTo.caseId, 'case-b')
})

test('a policy is matched to the attachment named after it', () => {
  const files = [{ name: 'INDEN AA RINGGIT.pdf' }, { name: 'ANCKL0032785_1793114745210.pdf' }, { name: 'ancKL-0032786.PDF' }]
  assert.equal(attachmentForPolicy('ANCKL0032785', files)?.name, 'ANCKL0032785_1793114745210.pdf')
  assert.equal(attachmentForPolicy('ANCKL0032786', files)?.name, 'ancKL-0032786.PDF')
  assert.equal(attachmentForPolicy('ANCKL0099999', files), undefined)
  assert.equal(attachmentForPolicy('', files), undefined, 'no number, no match')
})
