import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { INBOX_FOLDER, SUPPORTED_MIME_TYPES } from '@/lib/storage'
import { generateId } from '@/lib/utils'
import { notifyDocFlowWebhook } from '@/lib/n8n'
import { removeFile, saveFile, signFileUrlForServer } from '@/lib/storage-server'
import { createIntakeItem, findDuplicate, sha256, type DuplicateMatch } from '@/lib/intake'
import { sharePointStorageEnabled, syncCaseFile } from '@/lib/sharepoint-files'

// OPTIONAL intake channel (fix list 5.5). The main ways documents come in are
// email to operation@ (4.1), the SharePoint _Inbox folder (4.2) and bulk upload
// on the Inbox page (4.3). This bot stays for quick phone photos; with
// TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET unset it does nothing (every
// call is refused). Removing it: delete app/api/telegram and the
// telegram_uploads / telegram_pending_uploads tables.
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

// A routing decision left un-answered this long is treated as expired.
const PENDING_TTL_MS = 10 * 60 * 1000

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function send(chatId: number, html: string, replyTo?: number, replyMarkup?: object) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: html,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(replyTo ? { reply_to_message_id: replyTo } : {}),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  })
}

async function answerCallback(callbackQueryId: string, text?: string) {
  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, ...(text ? { text } : {}) }),
  })
}

async function clearKeyboard(chatId: number, messageId: number) {
  await fetch(`${TELEGRAM_API}/editMessageReplyMarkup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
  })
}

async function downloadTelegramFile(fileId: string): Promise<{ url: string } | null> {
  const res = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`)
  const json = await res.json()
  if (!json.ok || !json.result?.file_path) return null
  return { url: `https://api.telegram.org/file/bot${BOT_TOKEN}/${json.result.file_path}` }
}

type PendingFile = {
  chatId: number
  msgId: number
  fileName: string
  fileSize: number
  mimeType: string
  fileDataUrl: string        // storage reference ("storage:inbox/..."), saved when the file arrived
  fileHash: string           // SHA-256, for duplicate detection (fix list 3.2)
  telegramFileId: string
  uploadedBy: string
}

// Tells the sender the file was already received and where it is.
async function replyDuplicate(chatId: number, msgId: number, fileName: string, match: DuplicateMatch) {
  const where = match.kind === 'case_file'
    ? `It is already filed in a case:\n${APP_URL}/cases/${match.caseId}`
    : `It is already waiting in the Unassigned Inbox:\n${APP_URL}/inbox`
  await send(chatId, `ℹ️ <b>${esc(fileName)}</b> was received before, so it was not added again.\n\n${where}`, msgId)
}

// ── Branch: "New Case — Letter of Award" ────────────────────────────────────
// Bare-bones case — customer / case type / amount are unknown at this point.
// Staff fill those in afterward (Edit Info + AI Scan on the LOA).
async function createCaseFromUpload(pending: PendingFile) {
  const uploadedAt = new Date().toISOString()
  const caseId = generateId()
  // Match the existing manual convention: "YYYY/MM - description".
  const now = new Date()
  const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`
  const description = pending.fileName.replace(/\.[^.]+$/, '')
  const caseTitle = `${yearMonth} - ${description}`

  const { data: newCase, error: caseError } = await supabase.from('cases').insert({
    id: caseId,
    case_title: caseTitle,
    // null, not '' — cases.customer_id has a foreign key to customers(id),
    // and an empty string doesn't match any customer row. NULL passes the
    // FK check unconditionally; staff fill in the real customer afterward.
    customer_id: null,
    customer_name: '',
    // Every bot-created case starts from a Letter of Award, which only the
    // Bond Workflow template defines — leaving this blank meant the Files
    // tab had no workflow template to pull tag options from at all.
    case_type: 'Bond Workflow',
    amount: 0,
    person_in_charge: '',
    current_status: 'Created',
    result: '',
    closing_remarks: '',
    created_at: uploadedAt,
    updated_at: uploadedAt,
  }).select('case_number').single()   // the database numbers the case (2026-005)

  if (caseError) {
    console.error('[Telegram] case creation failed:', caseError.message)
    await send(pending.chatId, `❌ Something went wrong. Please try again later.`, pending.msgId)
    return
  }

  const caseFileId = generateId()
  const { error: fileError } = await supabase.from('case_files').insert({
    id: caseFileId,
    case_id: caseId,
    file_name: pending.fileName,
    file_size: pending.fileSize,
    file_type: pending.mimeType,
    document_type: 'Letter of Award (LOA)',
    uploaded_by: pending.uploadedBy,
    uploaded_at: uploadedAt,
    file_data_url: pending.fileDataUrl,
    file_hash: pending.fileHash || null,
    ai_scanned: false,
    ai_status: 'Pending',
  })

  if (fileError) {
    console.error('[Telegram] case_files insert failed:', fileError.message)
    await send(pending.chatId, `❌ Upload failed. Please try again.`, pending.msgId)
    return
  }

  // Copy it into the case's SharePoint folder (fix list 4.4); the daily job retries on failure
  if (sharePointStorageEnabled()) {
    await syncCaseFile(supabase, caseFileId)
      .catch(err => console.error('[Telegram] SharePoint copy failed:', err instanceof Error ? err.message : err))
  }

  await notifyDocFlowWebhook({
    event: 'case_created_from_telegram',
    caseId,
    fileName: pending.fileName,
    fileType: pending.mimeType,
    fileSize: pending.fileSize,
    uploadedBy: pending.uploadedBy,
    uploadedAt,
    fileUrl: await signFileUrlForServer(pending.fileDataUrl),
    telegramChatId: pending.chatId,
    telegramMessageId: pending.msgId,
    status: 'pending',
  })

  await send(pending.chatId,
    `📄 <b>${esc(pending.fileName)}</b> received!\n` +
    `✅ New case created: <b>${esc(newCase?.case_number ?? caseId)}</b>\n\n` +
    `Tagged as Letter of Award. View it here:\n${APP_URL}/cases/${caseId}`,
    pending.msgId
  )
}

// ── Branch: "Add to Existing Case" ──────────────────────────────────────────
// Lands in the Unassigned Inbox — staff pick which case it belongs to
// from the CRM (/inbox).
async function sendToInbox(pending: PendingFile) {
  const uploadedAt = new Date().toISOString()

  let uploadId: string
  try {
    const result = await createIntakeItem(supabase, {
      source: 'telegram',
      sender: pending.uploadedBy,
      fileName: pending.fileName,
      fileSize: pending.fileSize,
      fileType: pending.mimeType,
      fileRef: pending.fileDataUrl,
      fileHash: pending.fileHash,
      sourceMeta: {
        telegramChatId: pending.chatId,
        telegramMessageId: pending.msgId,
        telegramFileId: pending.telegramFileId,
      },
    })
    if (result.duplicate) {
      await replyDuplicate(pending.chatId, pending.msgId, pending.fileName, result.duplicate)
      return
    }
    uploadId = result.id
  } catch (err) {
    console.error('[Telegram] intake insert failed:', err instanceof Error ? err.message : err)
    await send(pending.chatId, `❌ Upload failed. Please try again.`, pending.msgId)
    return
  }

  await notifyDocFlowWebhook({
    event: 'telegram_upload_received',
    fileId: uploadId,
    fileName: pending.fileName,
    fileType: pending.mimeType,
    fileSize: pending.fileSize,
    uploadedBy: pending.uploadedBy,
    uploadedAt,
    fileUrl: await signFileUrlForServer(pending.fileDataUrl),
    telegramChatId: pending.chatId,
    telegramMessageId: pending.msgId,
    status: 'pending',
  })

  await send(pending.chatId,
    `📥 Got <b>${esc(pending.fileName)}</b> — added to the Unassigned Inbox.\n\n` +
    `Assign it to a case here:\n${APP_URL}/inbox`,
    pending.msgId
  )
}

// ── Main handler ──────────────────────────────────────────────────────────────
// This is DocFlow's single bot. Any document/photo dropped into the group
// gets downloaded and held in `telegram_pending_uploads` (not an in-memory
// Map — this runs as a Vercel serverless function, so state has to survive
// between this request and the separate one Telegram sends for the button
// tap), then the bot asks whether it's a new case's Letter of Award or a
// document for an existing case, and branches accordingly on the answer.

export async function POST(req: NextRequest) {
  if (req.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const update = await req.json()

  // ── Button tap: New Case vs Add to Existing Case ───────────────────────────
  const callback = update.callback_query
  if (callback) {
    const chatId: number | undefined = callback.message?.chat?.id
    const messageId: number | undefined = callback.message?.message_id
    const userId: number = callback.from?.id ?? chatId

    if (!chatId || chatId !== ALLOWED_CHAT_ID) {
      await answerCallback(callback.id)
      return NextResponse.json({ ok: true })
    }

    const { data: row } = await supabase
      .from('telegram_pending_uploads')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    const isFresh = !!row && (Date.now() - new Date(row.created_at).getTime()) < PENDING_TTL_MS

    if (!isFresh) {
      if (row) {
        await removeFile(row.file_data_url)
        await supabase.from('telegram_pending_uploads').delete().eq('user_id', userId)
      }
      await answerCallback(callback.id, 'This request has expired — please resend the document.')
      return NextResponse.json({ ok: true })
    }

    await answerCallback(callback.id)
    if (messageId) await clearKeyboard(chatId, messageId)
    await supabase.from('telegram_pending_uploads').delete().eq('user_id', userId)

    const pending: PendingFile = {
      chatId: row.chat_id,
      msgId: row.message_id,
      fileName: row.file_name,
      fileSize: row.file_size,
      mimeType: row.file_type,
      fileDataUrl: row.file_data_url,
      fileHash: row.file_hash ?? '',
      telegramFileId: row.telegram_file_id,
      uploadedBy: row.uploaded_by,
    }

    if (callback.data === 'route_new_case') {
      await createCaseFromUpload(pending)
    } else if (callback.data === 'route_existing_case') {
      await sendToInbox(pending)
    }

    return NextResponse.json({ ok: true })
  }

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
      `<b>DocFlow</b>\n\n` +
      `Send a <b>PDF or image</b> here — you'll be asked whether it starts a new case (Letter of Award) or gets added to an existing one.\n\n` +
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

  // ── Document/photo upload → ask which flow it belongs to ───────────────────
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

    const bytes = await fileRes.arrayBuffer()
    const fileHash = sha256(bytes)
    const uploadedBy = `Telegram: ${senderName}`

    // Same file sent before? Record it as a duplicate and say where it is,
    // instead of asking about it and filing it twice.
    const earlier = await findDuplicate(supabase, fileHash)
    if (earlier) {
      await createIntakeItem(supabase, {
        source: 'telegram', sender: uploadedBy, fileName, fileSize, fileType: mimeType,
        fileRef: null, fileHash,
        sourceMeta: { telegramChatId: chatId, telegramMessageId: msgId, telegramFileId: fileId },
      }).catch(err => console.error('[Telegram] duplicate record failed:', err instanceof Error ? err.message : err))
      await replyDuplicate(chatId, msgId, fileName, earlier)
      return NextResponse.json({ ok: true })
    }

    // Saved to storage straight away; the pending row and, after the user
    // answers, the case file or Inbox row only keep the reference.
    let fileDataUrl: string
    try {
      fileDataUrl = await saveFile(INBOX_FOLDER, fileName, bytes, mimeType)
    } catch (err) {
      console.error('[Telegram] storage save failed:', err instanceof Error ? err.message : err)
      await send(chatId, `❌ Something went wrong saving the file. Please try again later.`, msgId)
      return NextResponse.json({ ok: true })
    }
    const userId: number = msg.from?.id ?? chatId

    // One pending decision per user — a new upload before they've answered
    // replaces whatever was waiting, so drop the file that was waiting too.
    const { data: previous } = await supabase
      .from('telegram_pending_uploads').select('file_data_url').eq('user_id', userId).maybeSingle()
    if (previous) await removeFile(previous.file_data_url)

    const { error: pendingError } = await supabase.from('telegram_pending_uploads').upsert({
      user_id: userId,
      chat_id: chatId,
      message_id: msgId,
      file_name: fileName,
      file_size: fileSize,
      file_type: mimeType,
      file_data_url: fileDataUrl,
      file_hash: fileHash,
      telegram_file_id: fileId,
      uploaded_by: uploadedBy,
      created_at: new Date().toISOString(),
    })

    if (pendingError) {
      console.error('[Telegram] pending upload save failed:', pendingError.message)
      await removeFile(fileDataUrl)
      await send(chatId, `❌ Something went wrong. Please try again later.`, msgId)
      return NextResponse.json({ ok: true })
    }

    await send(chatId, '📄 What type of document is this?', msgId, {
      inline_keyboard: [
        [{ text: '1️⃣ New Case — Letter of Award', callback_data: 'route_new_case' }],
        [{ text: '2️⃣ Add to Existing Case', callback_data: 'route_existing_case' }],
      ],
    })

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
