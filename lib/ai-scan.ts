import Anthropic from '@anthropic-ai/sdk'

export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

type SupportedMime = (typeof SUPPORTED_MIME_TYPES)[number]

export interface AIScanResult {
  customerName: string
  projectName: string
  caseType: string
  amount: string
  bondValue: string
  expiryDate: string
  notes: string
  raw?: Record<string, unknown>
  error?: string
}

function formatRM(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  const num = Number(value)
  if (isNaN(num)) return String(value)
  return `RM ${num.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function mapCustomResponse(data: Record<string, unknown>): AIScanResult {
  const cd = (data.cover_duration ?? {}) as Record<string, unknown>

  const customerName = String(
    data.customerName ?? data.contractor_name ?? data.customer_name ??
    data.company_name ?? data.insured ?? ''
  )
  const projectName = String(
    data.projectName ?? data.project_name ?? data.scope_of_works ?? data.description_of_works ?? ''
  )
  const caseType = String(
    data.caseType ?? data.case_type ?? data.bond_type ?? data.insurance_type ?? ''
  )

  const amount = data.amount != null
    ? (typeof data.amount === 'number' ? formatRM(data.amount) : String(data.amount))
    : data.ContractValue != null
    ? (typeof data.ContractValue === 'number' ? formatRM(data.ContractValue) : String(data.ContractValue))
    : formatRM(data.contract_value)

  const bondValue = data.bondValue != null
    ? (typeof data.bondValue === 'number' ? formatRM(data.bondValue) : String(data.bondValue))
    : data.BondValue != null
    ? (typeof data.BondValue === 'number' ? formatRM(data.BondValue) : String(data.BondValue))
    : data.bond_value != null ? formatRM(data.bond_value)
    : data.performance_bond_value != null
    ? (typeof data.performance_bond_value === 'number' ? formatRM(data.performance_bond_value) : String(data.performance_bond_value))
    : data.bonPelaksanaan != null ? formatRM(data.bonPelaksanaan) : ''

  const expiryDate = String(
    data.expiryDate ?? data.expiry_date ??
    data.completion_date ??
    data.workEndDate ?? data.work_end_date ??
    cd.work_insurance_end ?? cd.public_liability_end ?? ''
  )

  const noteParts = [
    data.sebut_harga_no ? `Sebut Harga: ${data.sebut_harga_no}` : '',
    data.sstNo ? `SST: ${data.sstNo}` : '',
    data.sebuthargaNo ? `Sebutharga: ${data.sebuthargaNo}` : '',
    data.ssm_number ? `SSM: ${data.ssm_number}` : '',
    data.issuingAgency ? `Agency: ${data.issuingAgency}` : '',
    data.notes ? String(data.notes) : '',
  ].filter(Boolean)
  const notes = noteParts.join(' | ')

  const MONETARY_RAW_KEYS = [
    'thirdPartyLiability', 'workInsuranceValue', 'bonPelaksanaan',
    'third_party_liability', 'work_insurance_value', 'bon_pelaksanaan',
    'performance_bond_value', 'public_liability',
  ]
  const formattedRaw = { ...data }
  for (const key of MONETARY_RAW_KEYS) {
    if (typeof formattedRaw[key] === 'number') {
      formattedRaw[key] = formatRM(formattedRaw[key] as number)
    }
  }

  return { customerName, projectName, caseType, amount, bondValue, expiryDate, notes, raw: formattedRaw }
}

function buildPrompt(documentType?: string, aiPrompt?: string): string {
  if (aiPrompt?.trim()) return aiPrompt.trim()

  const hint = documentType?.toLowerCase() ?? ''

  let specific: string
  if (hint.includes('sst') || hint.includes('setuju terima') || hint.includes('contract') || hint.includes('kontrak') || hint.includes('award') || hint.includes('acceptance')) {
    specific = `This is likely a Surat Setuju Terima (SST) / Letter of Award. Focus on:
- customerName: The CONTRACTOR's company name + registration number (NOT the government agency)
- projectName: Full description of works / skop kerja
- caseType: Type of bond/security deposit required (e.g. "Performance Bond", "Bon Pelaksanaan")
- amount: CONTRACT VALUE / Harga Kontrak / Harga Sebutharga
- bondValue: Bond amount (typically 5% of contract value)
- expiryDate: Contract completion date / end of Defect Liability Period (DLP)
- notes: SST no., tender no., issuing government agency/department name`
  } else if (hint.includes('bond') || hint.includes('guarantee') || hint.includes('jaminan') || hint.includes('pelaksanaan')) {
    specific = `This is likely a Performance Bond / Bank Guarantee certificate. Focus on:
- customerName: The PRINCIPAL — contractor named as bond principal
- projectName: Project description in the bond certificate
- caseType: Bond type (e.g. "Performance Bond", "Bon Pelaksanaan")
- amount: Contract value if stated, otherwise leave empty
- bondValue: The GUARANTEED AMOUNT / sum of the bond
- expiryDate: Bond expiry date / Tarikh Tamat
- notes: Certificate number, issuing bank or insurer name`
  } else if (hint.includes('insurance') || hint.includes('policy') || hint.includes('insurans') || hint.includes('polisi')) {
    specific = `This is likely an insurance policy or schedule. Focus on:
- customerName: The INSURED's full name and registration number
- projectName: Description of insured works or risk location
- caseType: Insurance class (e.g. "Contractor All Risk", "Public Liability")
- amount: Sum insured / Nilai Insuran
- bondValue: Leave empty or use sum insured if single-sum policy
- expiryDate: Policy expiry date / Tarikh Tamat
- notes: Policy number, certificate number, insurer name`
  } else {
    specific = `This may be an SST, bond certificate, insurance policy, or similar document. Extract whatever is most relevant.`
  }

  return `You are a document data extraction specialist for a Malaysian insurance and bond broker. Extract structured information from this document. The document may be in Malay or English.

${specific}

IMPORTANT RULES:
- For customerName: extract the CONTRACTOR / APPLICANT / INSURED company name, not the government agency
- For amounts: always include the "RM" prefix and use comma-formatted numbers (e.g. RM 267,740.00)
- For expiryDate: return YYYY-MM-DD format only; if only month/year given use the last day of that month
- For notes: include ALL reference numbers (SST no., Tender no., Quotation no., Certificate no.) separated by " | "
- If a field cannot be found, return an empty string — do NOT guess

Return ONLY a valid JSON object with exactly these keys:
{
  "customerName": "Full company name and registration number of the contractor/applicant/insured",
  "projectName": "Full project title or description of works",
  "caseType": "Type of bond or insurance (e.g. Performance Bond, Contractor All Risk, Public Liability)",
  "amount": "Contract value or sum insured as RM x,xxx.xx",
  "bondValue": "Bond/guarantee amount or policy sum as RM x,xxx.xx",
  "expiryDate": "Expiry or completion date in YYYY-MM-DD format",
  "notes": "All reference numbers and key identifiers found in the document"
}

Return only the JSON object, no markdown, no explanation.`
}

export async function scanDocument({
  fileDataUrl,
  fileName,
  documentType,
  aiPrompt,
}: {
  fileDataUrl: string
  fileName: string
  documentType?: string
  aiPrompt?: string
}): Promise<AIScanResult> {
  const empty: AIScanResult = { customerName: '', projectName: '', caseType: '', amount: '', bondValue: '', expiryDate: '', notes: '' }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ...empty, error: 'ANTHROPIC_API_KEY not configured' }

  // Dev mock mode
  if (process.env.AI_MOCK === 'true') {
    if (aiPrompt?.trim()) {
      return mapCustomResponse({
        company_name: '[MOCK] Syarikat Contoh Sdn Bhd (0123456-X)',
        project_name: '[MOCK] Kerja-kerja Menaik Taraf Jalan Raya',
        sebut_harga_no: '[MOCK] JKR/SH/2024/001',
        contract_value: 'RM 534,700.00',
        site_possession_date: '2024-03-01',
        completion_date: '2025-02-28',
        defect_liability_period: '24 bulan',
        performance_bond_value: 'RM 26,735.00',
        third_party_liability: 'RM 200,000.00',
        public_liability: 'RM 500,000.00',
        company_address: '[MOCK] No. 12, Jalan Contoh, 50000 Kuala Lumpur',
        ssm_number: '[MOCK] MOF/2024/12345',
      })
    }
    return {
      customerName: '[MOCK] ABC Construction Sdn Bhd',
      projectName: '[MOCK] Supply and Install Works at Site',
      caseType: 'Performance Bond',
      amount: 'RM 500,000.00',
      bondValue: 'RM 25,000.00',
      expiryDate: '2026-12-31',
      notes: '[MOCK] Ref: TENDER/2024/001',
    }
  }

  const commaIdx = fileDataUrl.indexOf(',')
  const header = fileDataUrl.slice(0, commaIdx)
  const base64Data = fileDataUrl.slice(commaIdx + 1)
  const mimeType = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'

  if (!(SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    const ext = fileName.split('.').pop()?.toUpperCase()
    return { ...empty, notes: `AI scan not supported for ${ext} files. Supported: PDF, JPG, PNG.` }
  }

  const prompt = buildPrompt(documentType, aiPrompt)
  const useCustomPrompt = Boolean(aiPrompt?.trim())
  const client = new Anthropic({ apiKey })

  type DocSource = { type: 'base64'; media_type: 'application/pdf'; data: string }
  type ImgSource = { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string }

  const contentBlock = mimeType === 'application/pdf'
    ? { type: 'document' as const, source: { type: 'base64', media_type: 'application/pdf', data: base64Data } as DocSource }
    : { type: 'image' as const, source: { type: 'base64', media_type: mimeType as SupportedMime, data: base64Data } as ImgSource }

  let response
  try {
    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: prompt }] }],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ai-scan] Anthropic API error:', msg)
    return { ...empty, error: `Anthropic API error: ${msg}` }
  }

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  if (!text) {
    return { ...empty, error: `Empty response from Anthropic (stop_reason: ${response.stop_reason})` }
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('[ai-scan] No JSON in response:', text.slice(0, 300))
    return { ...empty, error: 'No JSON found in AI response' }
  }

  try {
    const extracted = JSON.parse(jsonMatch[0])
    if (useCustomPrompt) return mapCustomResponse(extracted)
    return {
      customerName: extracted.customerName ?? '',
      projectName: extracted.projectName ?? '',
      caseType: extracted.caseType ?? '',
      amount: extracted.amount ?? '',
      bondValue: extracted.bondValue ?? '',
      expiryDate: extracted.expiryDate ?? '',
      notes: extracted.notes ?? '',
    }
  } catch {
    console.error('[ai-scan] JSON parse failed:', text.slice(0, 500))
    return { ...empty, error: 'Failed to parse AI response' }
  }
}
