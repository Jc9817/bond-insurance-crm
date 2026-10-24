// One-off (fix list 2.3): moves files that are still stored inside the
// database as base64 "data:" URLs into the private case-files bucket, and
// replaces each with a storage reference ("storage:<path>") — the same form
// every new upload uses.
//
//   node scripts/move-base64-files.mjs           # dry run: only counts, changes nothing
//   node scripts/move-base64-files.mjs --apply   # moves the files
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
// Safe to run again: rows already moved are skipped, and a row is only
// updated if it still holds base64 data when the move finishes.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const BUCKET = 'case-files'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter(l => /^[A-Z_]+=/.test(l))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()] }),
)
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  process.exit(1)
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Same path rule as newStoragePath() in lib/storage.ts
const newPath = (folder, fileName) =>
  `${folder}/${Date.now()}_${String(fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')}`

const TABLES = [
  { table: 'case_files', key: 'id', col: 'file_data_url', extra: 'case_id', folder: r => `cases/${r.case_id}` },
  { table: 'telegram_uploads', key: 'id', col: 'file_data_url', extra: null, folder: () => 'inbox' },
  { table: 'telegram_pending_uploads', key: 'user_id', col: 'file_data_url', extra: null, folder: () => 'inbox' },
  // Stage 3 Inbox — exists once 20261024100000_intake_items.sql has run
  { table: 'intake_items', key: 'id', col: 'file_ref', extra: null, folder: () => 'inbox', optional: true },
]

let moved = 0, failed = 0, found = 0

for (const t of TABLES) {
  // Select only small columns here — the file data is fetched one row at a time
  const cols = [t.key, 'file_name', 'file_size', t.extra].filter(Boolean).join(', ')
  const { data: rows, error } = await sb.from(t.table).select(cols).like(t.col, 'data:%')
  if (error) {
    if (t.optional) { console.log(`${t.table}: not created yet, skipped`); continue }
    console.error(`${t.table}: ${error.message}`); failed++; continue
  }

  const bytes = rows.reduce((n, r) => n + (r.file_size ?? 0), 0)
  console.log(`${t.table}: ${rows.length} file(s) in the database (${(bytes / 1024 / 1024).toFixed(1)} MB)`)
  found += rows.length
  if (!APPLY) continue

  for (const r of rows) {
    const label = `  ${t.table} ${r[t.key]} ${r.file_name}`
    try {
      const { data: full, error: readErr } = await sb.from(t.table)
        .select(t.col).eq(t.key, r[t.key]).single()
      if (readErr) throw readErr
      const dataUrl = full[t.col]
      if (!dataUrl?.startsWith('data:')) { console.log(`${label}: already moved`); continue }

      const comma = dataUrl.indexOf(',')
      const contentType = dataUrl.slice(5, dataUrl.indexOf(';')) || 'application/octet-stream'
      const body = Buffer.from(dataUrl.slice(comma + 1), 'base64')
      const path = newPath(t.folder(r), r.file_name)

      const { error: upErr } = await sb.storage.from(BUCKET).upload(path, body, { contentType, upsert: false })
      if (upErr) throw upErr

      const { data: updated, error: updErr } = await sb.from(t.table)
        .update({ [t.col]: `storage:${path}` })
        .eq(t.key, r[t.key]).like(t.col, 'data:%')
        .select(t.key)
      if (updErr || !updated?.length) {
        await sb.storage.from(BUCKET).remove([path])
        throw updErr ?? new Error('row changed while moving — left as it was')
      }
      moved++
      console.log(`${label}: moved to ${path}`)
    } catch (err) {
      failed++
      console.error(`${label}: FAILED — ${err.message ?? err}`)
    }
  }
}

if (!APPLY) {
  console.log(found ? `\nDry run only. Run again with --apply to move these ${found} file(s).` : '\nNothing to move.')
} else {
  console.log(`\nDone: ${moved} moved, ${failed} failed.`)
  if (failed) process.exitCode = 1
}
