import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const {
    caseTitle, caseType, customerName, principalName, bondAmount, amount, personInCharge,
    insurerName, notes, aiEmailPrompt,
  } = await req.json()

  const principal = principalName || customerName
  const sumInsured = bondAmount || amount

  const systemContext = `You are an email drafting assistant for a Malaysian bond and insurance brokerage firm. Write professional, concise emails in a formal but friendly tone. Use Bahasa Malaysia terms where appropriate for local industry context (e.g. "Bon Pelaksanaan" for Performance Bond). Keep emails under 200 words.`

  const userPrompt = aiEmailPrompt?.trim()
    ? `${aiEmailPrompt}\n\nBond details:\n- Principal: ${principal}\n- Bond type: ${caseType}\n- Sum insured: ${sumInsured}\n- Applicant/Customer: ${customerName}\n- PIC: ${personInCharge}\n- Insurer: ${insurerName || 'to be determined'}\n- Notes: ${notes || 'none'}`
    : `Draft a professional quotation request email to ${insurerName || 'the insurer'} on behalf of our client.

Bond details:
- Principal (named on bond): ${principal}
- Bond / policy type: ${caseType}
- Sum insured: ${sumInsured}
- Applicant / customer: ${customerName}
- Person in charge: ${personInCharge}
- Additional notes: ${notes || 'none'}

Return ONLY a valid JSON object with two keys:
{
  "subject": "email subject line",
  "body": "full email body text (no HTML, use plain line breaks)"
}`

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: systemContext,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  try {
    const parsed = JSON.parse(jsonText)
    return NextResponse.json({ subject: parsed.subject ?? '', body: parsed.body ?? '' })
  } catch {
    // Fallback: return the raw text as body if not parseable JSON
    return NextResponse.json({ subject: `Quotation Request — ${customerName} | ${caseType}`, body: text })
  }
}
