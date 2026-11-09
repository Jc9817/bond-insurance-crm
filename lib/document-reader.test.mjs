// Tests for lib/document-reader.ts — run with: npm test
// These check how Claude's answer is handled; they do not call Claude.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mediaTypeFor, parseScanResult } from './document-reader.ts'

test('files Claude can read are recognised however their type was stored', () => {
  assert.equal(mediaTypeFor('loa.pdf', 'PDF'), 'application/pdf')
  assert.equal(mediaTypeFor('loa.pdf', 'application/pdf'), 'application/pdf')
  assert.equal(mediaTypeFor('ic.JPG', 'image/jpeg'), 'image/jpeg')
  assert.equal(mediaTypeFor('photo.png', ''), 'image/png')
})

test('Word and Excel files cannot be read', () => {
  assert.equal(mediaTypeFor('form.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), null)
  assert.equal(mediaTypeFor('list.xlsx', 'XLSX'), null)
  assert.equal(mediaTypeFor('noextension', ''), null)
})

test('an answer in the expected shape is stored for the Extracted window', () => {
  const r = parseScanResult('{"fields":{"projectName":"Kerja Jalan","totalContractValue":"RM 340,740.00","referenceNumber":null},"confidence":"High","reasoning":"Clear letter."}')
  assert.deepEqual(r.fields, { projectName: 'Kerja Jalan', totalContractValue: 'RM 340,740.00', referenceNumber: null })
  assert.equal(r.confidence, 'high')
  assert.equal(r.reasoning, 'Clear letter.')
  assert.equal(r.customerName, '', 'the fixed form fields start empty')
})

test('text around the JSON is ignored', () => {
  const r = parseScanResult('Here it is:\n```json\n{"fields":{"a":"1"},"confidence":"low","reasoning":"x"}\n```')
  assert.deepEqual(r.fields, { a: '1' })
})

test('a flat answer and nested values still work', () => {
  const r = parseScanResult('{"companyName":"KY Jaya","amounts":{"bond":"RM 1"},"count":3,"confidence":"medium"}')
  assert.deepEqual(r.fields, { companyName: 'KY Jaya', amounts: '{"bond":"RM 1"}', count: '3' })
  assert.equal(r.confidence, 'medium')
})

test('an unknown confidence is left out', () => {
  assert.equal(parseScanResult('{"fields":{"a":"1"},"confidence":"very sure"}').confidence, undefined)
})

test('an answer with no details counts as a failure', () => {
  assert.throws(() => parseScanResult('I could not read this.'), /did not return/)
  assert.throws(() => parseScanResult('{"fields":{"a":null,"b":""},"confidence":"low"}'), /found no details/)
  assert.throws(() => parseScanResult('{"fields":{"a":"1"'), /did not return/)
})
