import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]

function formatRM(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  const num = Number(value)
  if (isNaN(num)) return String(value)
  return `RM ${num.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function mapCustomResponse(data: Record<string, unknown>) {
  const cd = (data.cover_duration ?? {}) as Record<string, unknown>

  const customerName = String(
    data.customerName ?? data.contractor_name ?? data.customer_name ?? data.insured ?? ''
  )
  const projectName = String(
    data.projectName ?? data.project_name ?? data.scope_of_works ?? data.description_of_works ?? ''
  )
  const caseType = String(
    data.caseType ?? data.case_type ?? data.bond_type ?? data.insurance_type ?? ''
  )
  const amount = data.amount ? String(data.amount) : formatRM(data.contract_value)
  const bondValue = data.bondValue ? String(data.bondValue) : formatRM(data.bond_value)
  const expiryDate = String(
    data.expiryDate ?? data.expiry_date ??
    cd.work_insurance_end ?? cd.public_liability_end ?? ''
  )
  const notes = String(data.notes ?? '')

  return { customerName, projectName, caseType, amount, bondValue, expiryDate, notes, raw: data }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const { fileDataUrl, fileName, documentType, aiPrompt } = await req.json()
  if (!fileDataUrl) {
    return NextResponse.json({ error: 'No file data provided' }, { status: 400 })
  }

  const commaIdx = fileDataUrl.indexOf(',')
  const header = fileDataUrl.slice(0, commaIdx)
  const base64Data = fileDataUrl.slice(commaIdx + 1)
  const mimeType = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'

  if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
    return NextResponse.json({
      customerName: '', projectName: '', caseType: '', amount: '', bondValue: '', expiryDate: '',
      notes: `AI scan not supported for ${fileName.split('.').pop()?.toUpperCase()} files. Supported: PDF, JPG, PNG.`,
    })
  }

  const useCustomPrompt = Boolean(aiPrompt?.trim())

  let prompt: string
  if (useCustomPrompt) {
    prompt = aiPrompt.trim()
  } else {
    let docSpecificInstructions: string
    const docTypeHint = documentType ? documentType.toLowerCase() : ''

    if (docTypeHint.includes('sst') || docTypeHint.includes('setuju terima') || docTypeHint.includes('contract') || docTypeHint.includes('kontrak') || docTypeHint.includes('award') || docTypeHint.includes('acceptance')) {
      docSpecificInstructions = `This is likely a Surat Setuju Terima (SST) / Letter of Award. Focus on:
- customerName: The CONTRACTOR's company name + registration number (NOT the government agency)
- projectName: Full description of works / skop kerja
- caseType: Type of bond/security deposit required (e.g. "Performance Bond", "Bon Pelaksanaan")
- amount: CONTRACT VALUE / Harga Kontrak / Harga Sebutharga
- bondValue: Bond amount (typically 5% of contract value)
- expiryDate: Contract completion date / end of Defect Liability Period (DLP)
- notes: SST no., tender no., issuing government agency/department name`
    } else if (docTypeHint.includes('bond') || docTypeHint.includes('guarantee') || docTypeHint.includes('jaminan') || docTypeHint.includes('pelaksanaan')) {
      docSpecificInstructions = `This is likely a Performance Bond / Bank Guarantee certificate. Focus on:
- customerName: The PRINCIPAL — contractor named as bond principal
- projectName: Project description in the bond certificate
- caseType: Bond type (e.g. "Performance Bond", "Bon Pelaksanaan")
- amount: Contract value if stated, otherwise leave empty
- bondValue: The GUARANTEED AMOUNT / sum of the bond
- expiryDate: Bond expiry date / Tarikh Tamat
- notes: Certificate number, issuing bank or insurer name`
    } else if (docTypeHint.includes('insurance') || docTypeHint.includes('policy') || docTypeHint.includes('insurans') || docTypeHint.includes('polisi')) {
      docSpecificInstructions = `This is likely an insurance policy or schedule. Focus on:
- customerName: The INSURED's full name and registration number
- projectName: Description of insured works or risk location
- caseType: Insurance class (e.g. "Contractor All Risk", "Public Liability")
- amount: Sum insured / Nilai Insuran
- bondValue: Leave empty or use sum insured if single-sum policy
- expiryDate: Policy expiry date / Tarikh Tamat
- notes: Policy number, certificate number, insurer name`
    } else {
      docSpecificInstructions = `This may be an SST, bond certificate, insurance policy, or similar document. Extract whatever is most relevant.`
    }

    prompt = `You are a document data extraction specialist for a Malaysian insurance and bond broker. Extract structured information from this document. The document may be in Malay or English.

${docSpecificInstructions}

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

  const client = new Anthropic({ apiKey })

  // Build the content block — Claude handles both PDF documents and images
  type DocumentSource = { type: 'base64'; media_type: 'application/pdf'; data: string }
  type ImageSource = { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string }

  const contentBlock = mimeType === 'application/pdf'
    ? {
        type: 'document' as const,
        source: { type: 'base64', media_type: 'application/pdf', data: base64Data } as DocumentSource,
      }
    : {
        type: 'image' as const,
        source: { type: 'base64', media_type: mimeType, data: base64Data } as ImageSource,
      }

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          contentBlock,
          { type: 'text', text: prompt },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  // Strip markdown code fences if Claude wrapped the JSON
  const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  try {
    const extracted = JSON.parse(jsonText)

    if (useCustomPrompt) {
      return NextResponse.json(mapCustomResponse(extracted))
    }

    return NextResponse.json({
      customerName: extracted.customerName ?? '',
      projectName: extracted.projectName ?? '',
      caseType: extracted.caseType ?? '',
      amount: extracted.amount ?? '',
      bondValue: extracted.bondValue ?? '',
      expiryDate: extracted.expiryDate ?? '',
      notes: extracted.notes ?? '',
    })
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }
}
