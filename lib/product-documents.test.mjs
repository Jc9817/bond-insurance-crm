// Tests for lib/product-documents.ts — run with: npm test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { automaticWorkflow, companyTypeFor, productChecklist, workflowForSave } from './product-documents.ts'

const doc = (id, isActive = true) => ({ id, caseTypeId: 'wt_product_docs', name: id, description: '', required: true, acceptedFileTypes: [], isActive })
const master = ['loa', 'ssm', 'form-d', 'workers', 'old'].map(id => doc(id, id !== 'old'))
const link = (productId, documentId, required = true, companyType = 'Sdn. Bhd.') => ({ productId, documentId, required, companyType })

const links = [
  link('bond', 'loa'), link('bond', 'ssm'), link('bond', 'loa', true, 'Sole Proprietor'), link('bond', 'form-d', true, 'Sole Proprietor'),
  link('car', 'loa', false), link('car', 'ssm', false),
  link('wc', 'workers', false), link('wc', 'loa', false),
  link('fire', 'old'),
]
const products = [{ id: 'bond' }, { id: 'car', workflowType: 'Project Insurance Workflow' }, { id: 'wc', workflowType: 'Simple Policy Workflow' }]
const pick = (...ids) => ids.map(productId => ({ productId, productName: productId, category: productId === 'bond' ? 'Bond' : 'Insurance' }))
const names = docs => docs.map(d => d.id).sort()

test('a product already covered adds nothing; a new one adds its documents', () => {
  assert.deepEqual(names(productChecklist(pick('bond'), 'Sdn. Bhd.', links, master)), ['loa', 'ssm'])
  assert.deepEqual(names(productChecklist(pick('bond', 'car'), 'Sdn. Bhd.', links, master)), ['loa', 'ssm'], 'each document once')
  assert.deepEqual(names(productChecklist(pick('bond', 'wc'), 'Sdn. Bhd.', links, master)), ['loa', 'ssm', 'workers'])
})

test('a document is required if any selected product requires it', () => {
  const required = docs => docs.find(d => d.id === 'loa').required
  assert.equal(required(productChecklist(pick('car'), 'Sdn. Bhd.', links, master)), false)
  assert.equal(required(productChecklist(pick('car', 'bond'), 'Sdn. Bhd.', links, master)), true)
})

test('Sole Proprietors and Partnerships get their own lists; every other company type the Sdn. Bhd. list', () => {
  assert.deepEqual(names(productChecklist(pick('bond'), 'Sole Proprietor', links, master)), ['form-d', 'loa'])
  assert.equal(companyTypeFor('Sole Proprietor'), 'Sole Proprietor')
  assert.equal(companyTypeFor('Partnership'), 'Partnership')
  for (const t of ['Bhd.', 'PLT (LLP)', 'Other', '', undefined]) assert.equal(companyTypeFor(t), 'Sdn. Bhd.')
})

test('an inactive document is left out', () => {
  assert.deepEqual(productChecklist(pick('fire'), 'Sdn. Bhd.', links, master), [])
})

test('the most complete workflow decides the steps', () => {
  assert.equal(automaticWorkflow('New Business', pick('wc', 'car', 'bond'), products).caseType, 'Bond Workflow')
  assert.equal(automaticWorkflow('New Business', pick('wc', 'car'), products).caseType, 'Project Insurance Workflow')
  assert.equal(automaticWorkflow('New Business', pick('wc'), products).caseType, 'Simple Policy Workflow')
  assert.deepEqual(automaticWorkflow('New Business', [], products), { caseType: '', usesProductDocuments: false })
})

test('Claim, Renewal and the like keep their own workflow and documents', () => {
  assert.deepEqual(automaticWorkflow('Claim', pick('bond'), products), { caseType: 'Claim Workflow', usesProductDocuments: false })
  assert.deepEqual(automaticWorkflow('Renewal', pick('bond'), products), { caseType: 'Renewal Workflow', usesProductDocuments: false })
})

const template = (id, ...stepIds) => ({
  id, caseType: id, description: '', requiredDocuments: [], isActive: true,
  workflowSteps: stepIds.map((s, i) => ({ id: s, caseTypeId: id, name: s, order: i + 1, isActive: true })),
})
const templates = { 'Bond Workflow': template('Bond Workflow', 'b1', 'b2'), 'Simple Policy Workflow': template('Simple Policy Workflow', 's1', 's2') }
const find = t => templates[t] ?? null
const form = (selected, caseType = '') => ({ caseType, requestType: 'New Business', selectedProducts: pick(...selected) })

test('a new case starts on the first step of the automatic workflow', () => {
  assert.deepEqual(workflowForSave(form(['bond']), products, find), {
    caseType: 'Bond Workflow', usesProductDocuments: true, currentWorkflowStepId: 'b1', workflowTemplateId: 'Bond Workflow',
  })
})

test('a workflow picked by hand keeps its own documents', () => {
  const saved = workflowForSave(form(['bond'], 'Simple Policy Workflow'), products, find)
  assert.equal(saved.caseType, 'Simple Policy Workflow')
  assert.equal(saved.usesProductDocuments, false)
})

test('adding a bond upgrades the steps only on the first step', () => {
  const onFirst = { caseType: 'Simple Policy Workflow', currentWorkflowStepId: 's1', workflowTemplateId: 'Simple Policy Workflow' }
  assert.equal(workflowForSave(form(['wc', 'bond']), products, find, onFirst).caseType, 'Bond Workflow')

  const underWay = { ...onFirst, currentWorkflowStepId: 's2' }
  const kept = workflowForSave(form(['wc', 'bond']), products, find, underWay)
  assert.equal(kept.caseType, 'Simple Policy Workflow')
  assert.equal(kept.currentWorkflowStepId, 's2')
  assert.equal(kept.usesProductDocuments, true, 'the documents still follow the products')
})

test('unticking every product does not blank an existing workflow', () => {
  const existing = { caseType: 'Bond Workflow', currentWorkflowStepId: 'b1', workflowTemplateId: 'Bond Workflow' }
  const saved = workflowForSave(form([]), products, find, existing)
  assert.equal(saved.caseType, 'Bond Workflow')
  assert.equal(saved.usesProductDocuments, false)
})
