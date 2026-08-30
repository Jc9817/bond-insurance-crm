'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import type { CaseFile, AiExtractedData } from '@/lib/types'
import Modal from './Modal'

type Props = {
  file: CaseFile
  onClose: () => void
}

const SST_KEYS = new Set([
  // camelCase keys (older prompts)
  'thirdPartyLiability', 'workStartDate', 'workEndDate', 'dlpEndDate', 'workInsuranceValue',
  'sebuthargaNo', 'sstNo', 'issuingAgency', 'latePenaltyRate', 'bondValidUntil',
  'dlpBreakdown', 'bonPelaksanaan', 'defectLiabilityPeriod',
  // snake_case keys (new SST prompt)
  'sebut_harga_no', 'site_possession_date', 'completion_date', 'defect_liability_period',
  'performance_bond_value', 'third_party_liability', 'public_liability',
  'company_address', 'ssm_number',
])

const INPUT_CLS = 'w-full text-sm font-medium text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400'

export default function AIScanPanel({ file, onClose }: Props) {
  const { updateCaseFile, addActivityLog } = useStore()
  const { currentUser } = useAuth()
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<AiExtractedData>(() => ({
    ...(file.aiExtractedData ?? {
      customerName: '', projectName: '', caseType: '',
      amount: '', bondValue: '', expiryDate: '', notes: '',
    }),
  }))

  const setField = (key: keyof Omit<AiExtractedData, 'raw'>, value: string) =>
    setForm(f => ({ ...f, [key]: value }))

  const setRaw = (key: string, value: string) =>
    setForm(f => ({ ...f, raw: { ...f.raw, [key]: value } }))

  const save = () => {
    updateCaseFile(file.id, { aiExtractedData: form })
    addActivityLog({
      caseId: file.caseId,
      actionType: 'AI_EXTRACTION_APPROVED',
      title: 'AI data saved',
      description: `Extracted data from ${file.fileName} updated`,
      changedBy: currentUser?.fullName ?? 'Unknown',
    })
    setSaved(true)
  }

  const rescan = () => {
    updateCaseFile(file.id, { aiStatus: 'Pending' })
    onClose()
  }

  const raw = (form.raw ?? {}) as Record<string, unknown>
  const isSSTDoc = Object.keys(raw).some(k => SST_KEYS.has(k))

  return (
    <Modal isOpen onClose={onClose} title="Extracted Data" maxWidth="lg">
      <div className="px-6 py-5 overflow-y-auto">
        {/* File info */}
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-green-100">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{file.fileName}</p>
            <p className="text-xs text-gray-400">{file.documentType}</p>
          </div>
          <span className="ml-auto shrink-0 text-xs bg-green-100 text-green-700 font-medium rounded-full px-2.5 py-1">
            Extracted
          </span>
        </div>

        {!saved ? (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mb-4 flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-blue-700">
                This data is showing in the case report. Edit any field below and click <strong>Save Changes</strong> to correct it.
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {file.aiPrompt ? (
                // Custom prompt — show raw extracted fields directly, no remapping confusion
                <CustomRawFields raw={raw} onChange={setRaw} />
              ) : (
                // Default generic form
                <>
                  <EditField label="Principal">
                    <input className={INPUT_CLS} value={form.customerName} onChange={e => setField('customerName', e.target.value)} />
                  </EditField>
                  <EditField label="Project Title / Description of Works">
                    <textarea className={`${INPUT_CLS} resize-none`} rows={2} value={form.projectName} onChange={e => setField('projectName', e.target.value)} />
                  </EditField>
                  <EditField label="Bond / Insurance Type">
                    <input className={INPUT_CLS} value={form.caseType} onChange={e => setField('caseType', e.target.value)} />
                  </EditField>
                  <div className="grid grid-cols-2 gap-3">
                    <EditField label="Contract Value">
                      <input className={INPUT_CLS} value={form.amount} onChange={e => setField('amount', e.target.value)} />
                    </EditField>
                    <EditField label="Bond Value">
                      <input className={INPUT_CLS} value={form.bondValue} onChange={e => setField('bondValue', e.target.value)} />
                    </EditField>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <EditField label="Third Party Value">
                      <input className={INPUT_CLS} value={String(raw.thirdPartyLiability ?? '')} onChange={e => setRaw('thirdPartyLiability', e.target.value)} placeholder="e.g. RM 200,000.00" />
                    </EditField>
                    <EditField label="WC (Workmanship Insurance)">
                      <input className={INPUT_CLS} value={String(raw.workInsuranceValue ?? '')} onChange={e => setRaw('workInsuranceValue', e.target.value)} placeholder="e.g. RM 46,598.00" />
                    </EditField>
                  </div>
                  <EditField label="Bond / Policy Expiry (YYYY-MM-DD)">
                    <input className={INPUT_CLS} value={form.expiryDate} onChange={e => setField('expiryDate', e.target.value)} />
                  </EditField>
                  <EditField label="Reference / Notes">
                    <input className={INPUT_CLS} value={form.notes} onChange={e => setField('notes', e.target.value)} />
                  </EditField>
                  {isSSTDoc && <SSTEditFields raw={raw} onChange={setRaw} />}
                </>
              )}
            </div>

            <div className="flex gap-3 mb-3">
              <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} className="btn-primary flex-1">Save Changes</button>
            </div>
            <p className="text-center text-xs text-gray-400">
              Extraction is completely wrong?{' '}
              <button onClick={rescan} className="text-violet-600 hover:underline">
                Re-scan with AI
              </button>
            </p>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-base font-semibold text-gray-800">Changes Saved</p>
            <p className="text-sm text-gray-400 mt-1">The case report has been updated with your corrections.</p>
            <button onClick={onClose} className="btn-primary mt-5 px-8">Close</button>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-0.5">{label}</label>
      {children}
    </div>
  )
}

// ─── Custom prompt: show all raw fields directly ─────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  project_name: 'Project Name / Description of Works',
  sebut_harga_no: 'No. Sebut Harga',
  contract_value: 'Contract Value (Harga Kontrak)',
  site_possession_date: 'Site Possession Date',
  completion_date: 'Completion Date',
  defect_liability_period: 'Defect Liability Period (DLP)',
  performance_bond_value: 'Bon Pelaksanaan (5%)',
  third_party_liability: 'Insurans Kerja (Third Party Liability)',
  public_liability: 'Tanggungan Awam (Public Liability)',
  company_name: 'Contractor / Company Name',
  company_address: 'Company Address',
  ssm_number: 'No. Pendaftaran SSM / MOF',
  // camelCase fallbacks
  customerName: 'Principal',
  projectName: 'Project Name',
  caseType: 'Bond / Insurance Type',
  amount: 'Contract Value',
  bondValue: 'Bond Value',
  expiryDate: 'Expiry Date',
  notes: 'Notes / References',
  bonPelaksanaan: 'Bon Pelaksanaan',
  thirdPartyLiability: 'Third Party Liability',
  workInsuranceValue: 'WC Insurance',
  sebuthargaNo: 'No. Sebutharga',
  sstNo: 'SST No.',
  issuingAgency: 'Issuing Agency',
}

// Keys that are internal/derived and shouldn't be shown as editable fields
const SKIP_KEYS = new Set(['raw'])

function formatKeyLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function CustomRawFields({ raw, onChange }: { raw: Record<string, unknown>; onChange: (key: string, value: string) => void }) {
  // Guard: raw may be a string if a previous scan failed and stored error text instead of JSON
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 text-xs text-amber-700 space-y-1">
        <p className="font-semibold">Previous scan data is corrupted.</p>
        <p>Close this panel and click <strong>Re-scan</strong> to extract the data again.</p>
      </div>
    )
  }

  const entries = Object.entries(raw).filter(([k]) => !SKIP_KEYS.has(k))
  if (entries.length === 0) return <p className="text-xs text-gray-400">No extracted fields found. Try re-scanning.</p>

  const multilineKeys = new Set(['company_address', 'projectName', 'project_name'])

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
        Fields shown exactly as extracted by your custom prompt — what you see is what gets saved.
      </p>
      {entries.map(([key, value]) => (
        <EditField key={key} label={formatKeyLabel(key)}>
          {multilineKeys.has(key) ? (
            <textarea
              className={`${INPUT_CLS} resize-none`}
              rows={2}
              value={String(value ?? '')}
              onChange={e => onChange(key, e.target.value)}
            />
          ) : (
            <input
              className={INPUT_CLS}
              value={String(value ?? '')}
              onChange={e => onChange(key, e.target.value)}
            />
          )}
        </EditField>
      ))}
    </div>
  )
}

// ─── SST extended fields editor ───────────────────────────────────────────────

function SSTEditFields({ raw, onChange }: { raw: Record<string, unknown>; onChange: (key: string, value: string) => void }) {
  const str = (v: unknown) => (v != null ? String(v) : '')

  const Chip = ({ label, fieldKey, accent = 'bg-gray-50' }: { label: string; fieldKey: string; accent?: string }) => (
    <div className={`rounded-lg px-3 py-2.5 ${accent}`}>
      <label className="block text-xs text-gray-400 mb-0.5">{label}</label>
      <input
        className="w-full text-sm font-semibold text-gray-800 bg-transparent border-0 p-0 focus:outline-none"
        value={str(raw[fieldKey])}
        onChange={e => onChange(fieldKey, e.target.value)}
        placeholder="—"
      />
    </div>
  )

  const hasDate = raw.workStartDate != null || raw.workEndDate != null || raw.dlpEndDate != null || raw.bondValidUntil != null || raw.defectLiabilityPeriod != null
    || raw.site_possession_date != null || raw.completion_date != null || raw.defect_liability_period != null
  const hasInsurance = raw.workInsuranceValue != null || raw.thirdPartyLiability != null || raw.bonPelaksanaan != null
    || raw.third_party_liability != null || raw.public_liability != null || raw.performance_bond_value != null
  const hasRef = raw.sstNo != null || raw.sebuthargaNo != null || raw.issuingAgency != null
    || raw.sebut_harga_no != null || raw.ssm_number != null
  const hasAddress = raw.company_address != null

  return (
    <div className="space-y-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">SST Extended Fields</p>

      {hasDate && (
        <div>
          <p className="text-xs text-gray-400 mb-1.5">Key Dates</p>
          <div className="grid grid-cols-2 gap-2">
            {raw.site_possession_date != null && <Chip label="Site Possession Date" fieldKey="site_possession_date" />}
            {raw.workStartDate != null && <Chip label="Work Start Date" fieldKey="workStartDate" />}
            {raw.completion_date != null && <Chip label="Completion Date" fieldKey="completion_date" accent="bg-amber-50" />}
            {raw.workEndDate != null && <Chip label="Work End Date" fieldKey="workEndDate" accent="bg-amber-50" />}
            {raw.defect_liability_period != null && <Chip label="Defect Liability Period (DLP)" fieldKey="defect_liability_period" accent="bg-orange-50" />}
            {raw.defectLiabilityPeriod != null && <Chip label="Defect Liability Period" fieldKey="defectLiabilityPeriod" accent="bg-orange-50" />}
            {raw.dlpEndDate != null && <Chip label="DLP End Date" fieldKey="dlpEndDate" accent="bg-orange-50" />}
            {raw.bondValidUntil != null && <Chip label="Bond Valid Until" fieldKey="bondValidUntil" accent="bg-violet-50" />}
          </div>
        </div>
      )}

      {hasInsurance && (
        <div>
          <p className="text-xs text-gray-400 mb-1.5">Bond &amp; Insurance Values</p>
          <div className="grid grid-cols-2 gap-2">
            {raw.performance_bond_value != null && <Chip label="Bon Pelaksanaan (5%)" fieldKey="performance_bond_value" accent="bg-violet-50" />}
            {raw.bonPelaksanaan != null && <Chip label="Bon Pelaksanaan (5%)" fieldKey="bonPelaksanaan" accent="bg-violet-50" />}
            {raw.third_party_liability != null && <Chip label="Insurans Kerja (Third Party)" fieldKey="third_party_liability" accent="bg-blue-50" />}
            {raw.thirdPartyLiability != null && <Chip label="Third Party Liability" fieldKey="thirdPartyLiability" accent="bg-blue-50" />}
            {raw.public_liability != null && <Chip label="Tanggungan Awam (Public Liability)" fieldKey="public_liability" accent="bg-blue-50" />}
            {raw.workInsuranceValue != null && <Chip label="WC (Workmanship Insurance)" fieldKey="workInsuranceValue" accent="bg-blue-50" />}
          </div>
        </div>
      )}

      {hasRef && (
        <div>
          <p className="text-xs text-gray-400 mb-1.5">References</p>
          <div className="space-y-1.5">
            {raw.sebut_harga_no != null && <Chip label="No. Sebut Harga" fieldKey="sebut_harga_no" />}
            {raw.sebuthargaNo != null && <Chip label="No. Sebutharga / Tender" fieldKey="sebuthargaNo" />}
            {raw.sstNo != null && <Chip label="SST / Contract No." fieldKey="sstNo" />}
            {raw.ssm_number != null && <Chip label="No. Pendaftaran SSM / MOF" fieldKey="ssm_number" />}
            {raw.issuingAgency != null && <Chip label="Issuing Agency" fieldKey="issuingAgency" />}
          </div>
        </div>
      )}

      {hasAddress && (
        <div>
          <p className="text-xs text-gray-400 mb-1.5">Company Details</p>
          <Chip label="Company Address" fieldKey="company_address" />
        </div>
      )}

      {raw.latePenaltyRate != null && (
        <div>
          <p className="text-xs text-gray-400 mb-1.5">Penalty</p>
          <Chip label="Daily Late Penalty (LAD) per day" fieldKey="latePenaltyRate" accent="bg-red-50" />
        </div>
      )}
    </div>
  )
}
