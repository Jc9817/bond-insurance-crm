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
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

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
// Every document/photo dropped into the group is stored as an unassigned
// upload — no back-and-forth in the chat. Staff review, assign, or discard it
// from the CRM's Inbox page (/inbox).

export async function POST(req: NextRequest) {
  if (req.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const update = await req.json()
  const msg = update.message
  if (!msg) return NextResponse.json({ ok: true })

  const chatId: number = msg.chat.id
  const msgId: number = msg.message_id
  const senderName: string = msg.from?.first_name ?? 'Someone'
  const rawText: string = (msg.text ?? msg.caption ?? '').trim()

  // Only respond inside the allowed group
  if (chatId !== ALLOWED_CHAT_ID) return NextResponse.json({ ok: true })

  const cmdBase = rawText.split(' ')[0].split('@')[0].toLowerCase()

  // ── /help ─────────────────────────────────────────────────────────────────
  if (cmdBase === '/help' || cmdBase === '/start') {
    await send(chatId,
      `<b>Bond CRM Bot</b>\n\n` +
      `Send a <b>PDF or image</b> here and it'll land in the CRM's Unassigned Inbox for review.\n\n` +
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
      .neq('current_status', 'Done')
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

  // ── Document/photo upload → straight into the Unassigned Inbox ────────────
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

    const fileInfo = await downloadTelegramFile(fileId)
    if (!fileInfo) {
      await send(chatId, `❌ Could not retrieve the file from Telegram. Please resend it.`, msgId)
      return NextResponse.json({ ok: true })
    }

    const fileRes = await fetch(fileInfo.url)
    if (!fileRes.ok) {
      await send(chatId, `❌ Failed to download the file.`, msgId)
      return NextResponse.json({ ok: true })
    }

    const buffer = await fileRes.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const fileDataUrl = `data:${mimeType};base64,${base64}`

    const { error } = await supabase.from('telegram_uploads').insert({
      id: generateId(),
      file_name: fileName,
      file_size: fileSize,
      file_type: mimeType,
      file_data_url: fileDataUrl,
      uploaded_by: `Telegram: ${senderName}`,
      uploaded_at: new Date().toISOString(),
      telegram_chat_id: chatId,
      telegram_message_id: msgId,
      telegram_file_id: fileId,
    })

    if (error) {
      await send(chatId, `❌ Failed to save upload: ${esc(error.message)}`, msgId)
      return NextResponse.json({ ok: true })
    }

    await send(chatId,
      `📥 Got <b>${esc(fileName)}</b> — added to the Unassigned Inbox.\n\n` +
      `Review and assign it here:\n${APP_URL}/inbox`,
      msgId
    )

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
