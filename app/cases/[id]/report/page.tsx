'use client'

import { useParams, useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { CaseFile, AiExtractedData } from '@/lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STANDARD_KEYS = new Set(['customerName', 'projectName', 'caseType', 'amount', 'bondValue', 'expiryDate', 'notes', 'raw'])
// Old camelCase SST keys (legacy)
const SST_KEYS = new Set(['thirdPartyLiability', 'workStartDate', 'workEndDate', 'dlpEndDate', 'workInsuranceValue', 'sebuthargaNo', 'sstNo', 'issuingAgency', 'latePenaltyRate', 'bondValidUntil', 'dlpBreakdown', 'bonPelaksanaan'])
// Custom prompt snake_case SST keys
const CUSTOM_SST_KEYS = new Set(['sebut_harga_no', 'performance_bond_value', 'company_name', 'third_party_liability', 'public_liability', 'site_possession_date', 'completion_date', 'defect_liability_period'])

const CUSTOM_FIELD_LABELS: Record<string, string> = {
  company_name: 'Kontraktor / Nama Syarikat',
  project_name: 'Skop Kerja / Tajuk Projek',
  sebut_harga_no: 'No. Sebut Harga',
  ssm_number: 'No. Pendaftaran SSM / MOF',
  company_address: 'Alamat Syarikat',
  contract_value: 'Harga Kontrak',
  performance_bond_value: 'Bon Pelaksanaan (5%)',
  third_party_liability: 'Insurans Kerja (Third Party Liability)',
  public_liability: 'Tanggungan Awam (Public Liability)',
  site_possession_date: 'Tarikh Milikan Tapak',
  completion_date: 'Tarikh Siap',
  defect_liability_period: 'Tempoh Liabiliti Kecacatan (DLP)',
}

function formatLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function isMoneyKey(key: string): boolean {
  return /value|compensation|liability|amount|sum|price|cost/i.test(key)
}

function formatRMNumber(value: unknown): string {
  const num = Number(value)
  if (isNaN(num)) return String(value)
  return `RM ${num.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function todayLong(): string {
  return new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b-2 border-gray-800 pb-1 mb-4">
      <h2 className="text-xs font-bold tracking-widest uppercase text-gray-600">{children}</h2>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-2 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-800">{value || '—'}</span>
    </div>
  )
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-5 mb-2 first:mt-0">{children}</p>
}

function SSTDocSection({ file, data }: { file: CaseFile; data: AiExtractedData }) {
  const r = (data.raw ?? {}) as Record<string, unknown>
  const dlp = r.dlpBreakdown as Record<string, unknown> | null | undefined

  return (
    <div className="mb-10 break-inside-avoid">
      {/* Document header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
        <div>
          <p className="text-sm font-bold text-gray-800">{file.documentType}</p>
          <p className="text-xs text-gray-400">{file.fileName} &nbsp;·&nbsp; Approved {formatDate(file.uploadedAt)}</p>
        </div>
      </div>

      <div className="pl-5 border-l-2 border-green-200">
        {/* Contractor & Project */}
        <SubTitle>Contract Overview</SubTitle>
        <div className="bg-gray-50 rounded-lg p-4 space-y-0">
          {data.customerName && <DetailRow label="Principal" value={data.customerName} />}
          {data.projectName && <DetailRow label="Description of Works" value={data.projectName} />}
          {data.caseType && <DetailRow label="Bond / Security Type" value={data.caseType} />}
          {r.issuingAgency != null && <DetailRow label="Issuing Agency" value={String(r.issuingAgency)} />}
        </div>

        {/* Financial summary */}
        <SubTitle>Contract & Bond Amounts</SubTitle>
        <div className="bg-gray-50 rounded-lg p-4 space-y-0">
          {data.amount && <DetailRow label="Contract Value" value={<span className="font-bold">{data.amount}</span>} />}
          {(data.bondValue || r.bonPelaksanaan != null) && <DetailRow label="Bon Pelaksanaan (5%)" value={<span className="font-bold text-violet-700">{data.bondValue || formatRMNumber(r.bonPelaksanaan)}</span>} />}
          {r.workInsuranceValue != null && <DetailRow label="WC (Workmanship Insurance)" value={<span className="font-semibold">{formatRMNumber(r.workInsuranceValue)}</span>} />}
          {r.thirdPartyLiability != null && <DetailRow label="Third Party Value" value={<span className="font-semibold">{formatRMNumber(r.thirdPartyLiability)}</span>} />}
          {r.latePenaltyRate != null && (
            <DetailRow
              label="Daily Penalty (LAD)"
              value={<span className="text-red-700 font-semibold">RM {Number(r.latePenaltyRate).toLocaleString('en-MY', { minimumFractionDigits: 2 })} / day</span>}
            />
          )}
        </div>

        {/* Key Dates */}
        <SubTitle>Key Dates</SubTitle>
        <div className="bg-gray-50 rounded-lg p-4 space-y-0">
          {r.workStartDate != null && <DetailRow label="Work Start Date" value={formatDate(String(r.workStartDate))} />}
          {r.workEndDate != null && <DetailRow label="Contract Completion Date" value={<span className="font-semibold">{formatDate(String(r.workEndDate))}</span>} />}
          {r.dlpEndDate != null && (
            <DetailRow
              label="DLP End Date"
              value={
                <span className="font-semibold">
                  {formatDate(String(r.dlpEndDate))}
                  {dlp && <span className="text-xs font-normal text-gray-400 ml-2">({String(dlp.label)})</span>}
                </span>
              }
            />
          )}
          {r.bondValidUntil != null && <DetailRow label="Bond Valid Until" value={<span className="font-semibold text-violet-700">{formatDate(String(r.bondValidUntil))}</span>} />}
        </div>

        {/* Reference Numbers */}
        <SubTitle>Reference Numbers</SubTitle>
        <div className="bg-gray-50 rounded-lg p-4 space-y-0">
          {r.sstNo != null && <DetailRow label="SST / Contract No." value={<span className="font-mono text-sm">{String(r.sstNo)}</span>} />}
          {r.sebuthargaNo != null && <DetailRow label="No. Sebutharga / Tender" value={<span className="font-mono text-sm">{String(r.sebuthargaNo)}</span>} />}
          {data.notes && r.sstNo == null && r.sebuthargaNo == null && <DetailRow label="Reference Numbers" value={data.notes} />}
        </div>
      </div>
    </div>
  )
}

function CustomSSTDocSection({ file, data }: { file: CaseFile; data: AiExtractedData }) {
  const r = (data.raw ?? {}) as Record<string, unknown>
  const label = (key: string) => CUSTOM_FIELD_LABELS[key] ?? formatLabel(key)
  const val = (key: string) => r[key] != null ? String(r[key]) : null

  return (
    <div className="mb-10 break-inside-avoid">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
        <div>
          <p className="text-sm font-bold text-gray-800">{file.documentType}</p>
          <p className="text-xs text-gray-400">{file.fileName} &nbsp;·&nbsp; Approved {formatDate(file.uploadedAt)}</p>
        </div>
      </div>

      <div className="pl-5 border-l-2 border-green-200 space-y-0">
        <SubTitle>Maklumat Kontraktor</SubTitle>
        <div className="bg-gray-50 rounded-lg p-4 space-y-0">
          {val('company_name') && <DetailRow label={label('company_name')} value={<span className="font-semibold">{val('company_name')}</span>} />}
          {val('ssm_number') && <DetailRow label={label('ssm_number')} value={<span className="font-mono text-sm">{val('ssm_number')}</span>} />}
          {val('company_address') && <DetailRow label={label('company_address')} value={val('company_address')} />}
        </div>

        <SubTitle>Maklumat Projek</SubTitle>
        <div className="bg-gray-50 rounded-lg p-4 space-y-0">
          {val('project_name') && <DetailRow label={label('project_name')} value={val('project_name')} />}
          {val('sebut_harga_no') && <DetailRow label={label('sebut_harga_no')} value={<span className="font-mono text-sm">{val('sebut_harga_no')}</span>} />}
        </div>

        <SubTitle>Nilai Kontrak & Insurans</SubTitle>
        <div className="bg-gray-50 rounded-lg p-4 space-y-0">
          {(val('contract_value') || data.amount) && (
            <DetailRow label={label('contract_value')} value={<span className="font-bold">{val('contract_value') ?? data.amount}</span>} />
          )}
          {(val('performance_bond_value') || data.bondValue) && (
            <DetailRow label={label('performance_bond_value')} value={<span className="font-bold text-violet-700">{val('performance_bond_value') ?? data.bondValue}</span>} />
          )}
          {val('third_party_liability') && (
            <DetailRow label={label('third_party_liability')} value={<span className="font-semibold">{val('third_party_liability')}</span>} />
          )}
          {val('public_liability') && (
            <DetailRow label={label('public_liability')} value={<span className="font-semibold">{val('public_liability')}</span>} />
          )}
        </div>

        <SubTitle>Tarikh Penting</SubTitle>
        <div className="bg-gray-50 rounded-lg p-4 space-y-0">
          {val('site_possession_date') && <DetailRow label={label('site_possession_date')} value={formatDate(val('site_possession_date')!)} />}
          {val('completion_date') && <DetailRow label={label('completion_date')} value={<span className="font-semibold">{formatDate(val('completion_date')!)}</span>} />}
          {val('defect_liability_period') && <DetailRow label={label('defect_liability_period')} value={val('defect_liability_period')} />}
        </div>
      </div>
    </div>
  )
}

function ExtractedDocSection({ file }: { file: CaseFile }) {
  const data = file.aiExtractedData as AiExtractedData
  const r = (data.raw ?? {}) as Record<string, unknown>
  const isCustomSST = Object.keys(r).some(k => CUSTOM_SST_KEYS.has(k))
  const isSSTDoc = !isCustomSST && data.raw && Object.keys(data.raw).some(k => SST_KEYS.has(k))

  if (isCustomSST) return <CustomSSTDocSection file={file} data={data} />
  if (isSSTDoc) return <SSTDocSection file={file} data={data} />

  const extras = data.raw ? Object.entries(data.raw).filter(([k]) => !STANDARD_KEYS.has(k)) : []

  return (
    <div className="mb-8 break-inside-avoid">
      {/* Document header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
        <div>
          <p className="text-sm font-bold text-gray-800">{file.documentType}</p>
          <p className="text-xs text-gray-400">
            {file.fileName} &nbsp;·&nbsp; Approved {formatDate(file.uploadedAt)}
          </p>
        </div>
      </div>

      {/* Standard fields */}
      <div className="pl-5 border-l-2 border-green-200">
        <div className="bg-gray-50 rounded-lg p-4 space-y-0">
          {data.customerName && <DetailRow label="Principal" value={data.customerName} />}
          {data.projectName && <DetailRow label="Project / Works" value={data.projectName} />}
          {data.caseType && <DetailRow label="Bond / Insurance Type" value={data.caseType} />}
          {data.amount && <DetailRow label="Contract Value" value={<span className="font-semibold">{data.amount}</span>} />}
          {data.bondValue && <DetailRow label="Bond / Policy Value" value={<span className="font-semibold text-violet-700">{data.bondValue}</span>} />}
          {data.expiryDate && <DetailRow label="Expiry / Completion Date" value={formatDate(data.expiryDate)} />}
          {data.notes && <DetailRow label="Reference Numbers" value={data.notes} />}
        </div>

        {/* Extra fields from custom prompt */}
        {extras.length > 0 && (
          <div className="mt-3 bg-blue-50 rounded-lg p-4 space-y-0">
            <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-2">Additional Extracted Fields</p>
            {extras.map(([key, value]) => {
              if (value === null || value === undefined) return null

              if (typeof value === 'object' && !Array.isArray(value)) {
                const nested = value as Record<string, unknown>
                return (
                  <div key={key} className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{formatLabel(key)}</p>
                    <div className="pl-3 border-l border-blue-200 space-y-1">
                      {Object.entries(nested).map(([nk, nv]) => (
                        <div key={nk} className="grid grid-cols-[200px_1fr] gap-2">
                          <span className="text-xs text-gray-500">{formatLabel(nk)}</span>
                          <span className="text-xs text-gray-800">{nv !== null && nv !== undefined && nv !== '' ? String(nv) : '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }

              if (key.endsWith('_note') || key.endsWith('_reason')) {
                return (
                  <div key={key} className="py-1.5 border-b border-blue-100 last:border-0">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">{formatLabel(key)}</span>
                    <span className="text-xs text-blue-800 italic">{String(value)}</span>
                  </div>
                )
              }

              return (
                <DetailRow
                  key={key}
                  label={formatLabel(key)}
                  value={
                    typeof value === 'number' && isMoneyKey(key)
                      ? <span className="font-semibold">{formatRMNumber(value)}</span>
                      : String(value)
                  }
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main report page ─────────────────────────────────────────────────────────

export default function CaseReportPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { cases, customers, caseFiles, pics } = useStore()

  const caseItem = cases.find(c => c.id === id)
  const customer = customers.find(c => c.id === caseItem?.customerId)
  const pic = pics.find(p => p.name === caseItem?.personInCharge)

  const approvedFiles = caseFiles.filter(
    f => f.caseId === id && f.aiStatus === 'Approved' && f.aiExtractedData !== null
  )

  if (!caseItem) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-400">Case not found.</p>
      </div>
    )
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          html, body {
            background: white !important;
            overflow: visible !important;
            height: auto !important;
            min-height: auto !important;
          }
          ::-webkit-scrollbar { display: none !important; }
          .min-h-screen { min-height: auto !important; }
          @page { margin: 18mm 15mm; size: A4; }
        }
      `}</style>

      <div className="min-h-screen bg-white">
        {/* Toolbar — hidden when printing */}
        <div className="no-print sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push(`/cases/${id}`)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Case
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-5 py-2 rounded-xl hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / Save as PDF
          </button>
        </div>

        {/* Report body */}
        <div className="max-w-3xl mx-auto px-8 py-10">

          {/* Report header */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-800">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-1">Case Report</p>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{caseItem.caseTitle}</h1>
              <p className="text-sm text-gray-500 mt-1">{customer?.customerName ?? '—'}</p>
            </div>
            <div className="text-right shrink-0 ml-6">
              <p className="text-xs text-gray-400">Generated</p>
              <p className="text-sm font-semibold text-gray-700">{todayLong()}</p>
              <p className="text-xs text-gray-400 mt-2">Case ID</p>
              <p className="text-xs font-mono text-gray-600">{caseItem.id}</p>
            </div>
          </div>

          {/* Case Details */}
          <div className="mb-10">
            <SectionTitle>Case Details</SectionTitle>
            <div className="space-y-0">
              <DetailRow label="Case Title" value={caseItem.caseTitle} />
              <DetailRow label="Customer" value={customer?.customerName} />
              {customer?.companyRegistrationNo && (
                <DetailRow label="Registration No." value={customer.companyRegistrationNo} />
              )}
              <DetailRow label="Case Type" value={caseItem.caseType} />
              <DetailRow label="Person in Charge" value={caseItem.personInCharge} />
              {pic?.email && <DetailRow label="Person in Charge Email" value={pic.email} />}
              <DetailRow label="Status" value={caseItem.currentStatus} />
              {caseItem.amount > 0 && (
                <DetailRow label="Case Amount" value={<span className="font-semibold">{formatCurrency(caseItem.amount)}</span>} />
              )}
              {caseItem.finalAmount != null && caseItem.finalAmount > 0 && (
                <DetailRow label="Final Amount" value={<span className="font-semibold">{formatCurrency(caseItem.finalAmount)}</span>} />
              )}
              {caseItem.finalInsurer && <DetailRow label="Insurer" value={caseItem.finalInsurer} />}
              <DetailRow label="Created" value={formatDate(caseItem.createdAt)} />
              {caseItem.updatedAt && <DetailRow label="Last Updated" value={formatDate(caseItem.updatedAt)} />}
              {caseItem.closingRemarks && <DetailRow label="Closing Remarks" value={caseItem.closingRemarks} />}
            </div>
          </div>

          {/* AI-Extracted Document Information */}
          <div className="mb-10">
            <SectionTitle>AI-Extracted Document Information</SectionTitle>

            {approvedFiles.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">
                No documents have been scanned and approved yet. AI-extracted information will appear here after documents are scanned.
              </p>
            ) : (
              <div>
                {approvedFiles.map(file => (
                  <ExtractedDocSection key={file.id} file={file} />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-400">
              Generated by Bond Insurance CRM &nbsp;·&nbsp; {todayLong()}
            </p>
            <p className="text-xs text-gray-300 mt-0.5">
              This report contains AI-extracted information. Always verify against original documents.
            </p>
          </div>

        </div>
      </div>
    </>
  )
}
