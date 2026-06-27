import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SUPPORTED_MIME_TYPES } from '@/lib/ai-scan'
import { generateId } from '@/lib/utils'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const ALLOWED_CHAT_ID = Number(process.env.TELEGRAM_ALLOWED_CHAT_ID!)
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET!
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

// Service role key bypasses RLS — required for bot to create customers/cases/files
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseKey = serviceRoleKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
let keyRole = 'unknown'
try { keyRole = JSON.parse(Buffer.from(supabaseKey.split('.')[1], 'base64').toString()).role } catch {}
console.log('[telegram-webhook] key role:', keyRole, '| service_role env set:', !!serviceRoleKey)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey
)

// ── Session state per Telegram user ──────────────────────────────────────────
// Resets on server restart — acceptable for a small internal team.
type Session =
  | { state: 'idle' }
  | {
      state: 'awaiting_customer'
      fileId: string       // Telegram file_id — re-downloaded when customer name is received
      fileName: string
      fileSize: number
      mimeType: string
    }

const sessions = new Map<number, Session>()

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function send(chatId: number, html: string, replyTo?: number) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: html,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(replyTo ? { reply_to_message_id: replyTo } : {}),
    }),
  })
}

async function downloadTelegramFile(fileId: string): Promise<{ url: string } | null> {
  const res = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`)
  const json = await res.json()
  if (!json.ok || !json.result?.file_path) return null
  return { url: `https://api.telegram.org/file/bot${BOT_TOKEN}/${json.result.file_path}` }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (req.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const update = await req.json()
  const msg = update.message
  if (!msg) return NextResponse.json({ ok: true })

  const chatId: number = msg.chat.id
  const fromId: number = msg.from?.id
  const msgId: number = msg.message_id
  const senderName: string = msg.from?.first_name ?? 'Someone'
  const rawText: string = (msg.text ?? msg.caption ?? '').trim()

  // Only respond inside the allowed group
  if (chatId !== ALLOWED_CHAT_ID) return NextResponse.json({ ok: true })

  const session: Session = sessions.get(fromId) ?? { state: 'idle' }
  const cmdBase = rawText.split(' ')[0].split('@')[0].toLowerCase()

  // ── /help ─────────────────────────────────────────────────────────────────
  if (cmdBase === '/help' || cmdBase === '/start') {
    await send(chatId,
      `<b>Bond CRM Bot</b>\n\n` +
      `Just send a <b>PDF or image</b> here and I'll walk you through creating a new case.\n\n` +
      `<b>/cases</b> [keyword] — browse existing open cases`,
      msgId
    )
    return NextResponse.json({ ok: true })
  }

  // ── /cases [keyword] — read-only browse ───────────────────────────────────
  if (cmdBase === '/cases') {
    const keyword = rawText.replace(/^\/cases(@\S+)?/i, '').trim().toLowerCase()

    const { data: rows, error } = await supabase
      .from('cases')
      .select('id, case_title, customer_name, current_status')
      .is('archived_at', null)
      .neq('current_status', 'Closed')
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      await send(chatId, `❌ Could not fetch cases: ${esc(error.message)}`, msgId)
      return NextResponse.json({ ok: true })
    }

    const filtered = keyword
      ? (rows ?? []).filter(c =>
          c.case_title?.toLowerCase().includes(keyword) ||
          c.customer_name?.toLowerCase().includes(keyword)
        )
      : (rows ?? [])

    if (!filtered.length) {
      await send(chatId,
        keyword ? `No open cases found for "<b>${esc(keyword)}</b>".` : 'No open cases found.',
        msgId
      )
      return NextResponse.json({ ok: true })
    }

    const lines = filtered.slice(0, 10).map(c =>
      `• <b>${esc(c.case_title ?? '')}</b>\n  ${esc(c.customer_name ?? '')} · <code>${esc(c.id)}</code>`
    ).join('\n\n')

    await send(chatId,
      `<b>Open cases${keyword ? ` matching "${esc(keyword)}"` : ''}:</b>\n\n${lines}`,
      msgId
    )
    return NextResponse.json({ ok: true })
  }

  // ── Step 2: user replies with a customer/company name ─────────────────────
  if (session.state === 'awaiting_customer' && rawText && !cmdBase.startsWith('/')) {
    const companyName = rawText.trim()

    await send(chatId, `⏳ Looking up <b>${esc(companyName)}</b>…`, msgId)

    // Search for existing customer (case-insensitive, partial match)
    const { data: matches } = await supabase
      .from('customers')
      .select('id, customer_name')
      .ilike('customer_name', `%${companyName}%`)
      .limit(1)

    let customerId: string
    let customerName: string
    let isNewCustomer = false

    if (matches && matches.length > 0) {
      // Use the closest existing customer
      customerId = matches[0].id
      customerName = matches[0].customer_name
    } else {
      // Create a minimal customer record — details can be filled in the app later
      customerId = generateId()
      customerName = companyName
      isNewCustomer = true

      const { error: custErr } = await supabase.from('customers').insert({
        id: customerId,
        customer_name: companyName,
        company_registration_no: '',
        business_type: '',
        industry: '',
        main_phone: '',
        main_email: '',
        notes: 'Created via Telegram bot',
        created_at: new Date().toISOString(),
      })

      if (custErr) {
        await send(chatId, `❌ Failed to create customer: ${esc(custErr.message)}`, msgId)
        sessions.set(fromId, { state: 'idle' })
        return NextResponse.json({ ok: true })
      }
    }

    // Download the pending file from Telegram
    const { fileId, fileName, fileSize, mimeType } = session

    const fileInfo = await downloadTelegramFile(fileId)
    if (!fileInfo) {
      await send(chatId, `❌ Could not retrieve the file from Telegram. Please resend it.`, msgId)
      sessions.set(fromId, { state: 'idle' })
      return NextResponse.json({ ok: true })
    }

    const fileRes = await fetch(fileInfo.url)
    if (!fileRes.ok) {
      await send(chatId, `❌ Failed to download the file.`, msgId)
      sessions.set(fromId, { state: 'idle' })
      return NextResponse.json({ ok: true })
    }

    const buffer = await fileRes.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const fileDataUrl = `data:${mimeType};base64,${base64}`

    // Create a blank case — to be filled in later via the app
    const caseId = generateId()
    const caseTitle = `${customerName} — New Submission`
    const now = new Date().toISOString()

    const { error: caseErr } = await supabase.from('cases').insert({
      id: caseId,
      case_title: caseTitle,
      customer_id: customerId,
      customer_name: customerName,
      case_type: '',
      amount: 0,
      person_in_charge: '',
      current_status: 'New',
      current_workflow_step_id: null,
      result: '',
      closing_remarks: '',
      created_at: now,
      updated_at: now,
    })

    if (caseErr) {
      await send(chatId, `❌ Failed to create case: ${esc(caseErr.message)}`, msgId)
      sessions.set(fromId, { state: 'idle' })
      return NextResponse.json({ ok: true })
    }

    // Attach the file to the new case — not AI scanned yet
    const { error: fileErr } = await supabase.from('case_files').insert({
      id: generateId(),
      case_id: caseId,
      file_name: fileName,
      file_size: fileSize,
      file_type: mimeType,
      document_type: 'Uploaded via Telegram',
      uploaded_by: `Telegram: ${senderName}`,
      uploaded_at: now,
      file_data_url: fileDataUrl,
      ai_scanned: false,
      ai_status: 'Not Scanned',
      ai_extracted_data: null,
    })

    if (fileErr) {
      await send(chatId, `❌ Case created but failed to attach file: ${esc(fileErr.message)}`, msgId)
      sessions.set(fromId, { state: 'idle' })
      return NextResponse.json({ ok: true })
    }

    sessions.set(fromId, { state: 'idle' })

    await send(chatId,
      `✅ <b>Case created!</b>\n\n` +
      `<b>Customer:</b> ${esc(customerName)}${isNewCustomer ? ' <i>(new — please fill in details)</i>' : ''}\n` +
      `<b>File:</b> ${esc(fileName)}\n\n` +
      `Open and fill in the details when you're back:\n` +
      `${APP_URL}/cases/${caseId}`,
      msgId
    )

    return NextResponse.json({ ok: true })
  }

  // ── Step 1: user sends a file ─────────────────────────────────────────────
  const doc = msg.document ?? null
  const photos: { file_id: string; file_size?: number }[] | null = msg.photo ?? null
  const photo = photos ? photos[photos.length - 1] : null

  if (doc || photo) {
    const fileId: string = doc ? doc.file_id : photo!.file_id
    const fileName: string = doc?.file_name ?? `telegram_photo_${Date.now()}.jpg`
    const fileSize: number = doc?.file_size ?? photo?.file_size ?? 0
    const mimeType: string = doc?.mime_type ?? 'image/jpeg'

    if (!(SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType)) {
      const ext = fileName.split('.').pop()?.toUpperCase()
      await send(chatId,
        `❌ <b>${esc(ext ?? mimeType)}</b> files are not supported.\n\nSupported: PDF, JPG, PNG, WEBP`,
        msgId
      )
      return NextResponse.json({ ok: true })
    }

    // Save file info to session and ask for customer name
    sessions.set(fromId, { state: 'awaiting_customer', fileId, fileName, fileSize, mimeType })

    await send(chatId,
      `📄 Got <b>${esc(fileName)}</b>\n\n` +
      `Who is this for? Reply with the <b>company or customer name</b>.`,
      msgId
    )

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
