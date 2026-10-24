import type { SupabaseClient } from '@supabase/supabase-js'
import { GraphError, graphConfigured, graphRequest, getGraphToken } from './msGraph'
import { readFile } from './storage-server'

// Server-only. Keeps a copy of every case file in the SharePoint Customers
// library (fix list 4.4), laid out as decided:
//
//   <Customer>/<2026-005 Case title>/<topic folder>/<2026-005 Document type - original name>
//
// Topic folders: 01 LOA & Contract, 02 Company Docs, 03 Financials,
// 04 Quotations, 05 Policies & Bonds, 06 Correspondence (anything else).
// The case_files row keeps the Graph drive item id and a link to open it.
// syncCaseFile() is safe to call again: it uploads a file not yet in
// SharePoint, and moves or renames one whose case or document type changed.
// DocFlow's own copy (Supabase Storage) stays as the working copy for now.
//
// Uses SHAREPOINT_DRIVE_ID (the Customers library) with the Azure app's
// Sites.Selected write access — see docs/microsoft-365-setup.md.

const GRAPH = 'https://graph.microsoft.com/v1.0'
const SIMPLE_UPLOAD_LIMIT = 4 * 1024 * 1024
const UPLOAD_CHUNK = 320 * 1024 * 16          // Graph wants multiples of 320 KiB

const driveId = () => process.env.SHAREPOINT_DRIVE_ID ?? ''
export const sharePointStorageEnabled = () => graphConfigured() && !!driveId()

// ─── Layout ─────────────────────────────────────────────────────────────────

// First matching rule wins; checked against the document type name.
const TOPIC_RULES: { folder: string; words: RegExp }[] = [
  { folder: '04 Quotations', words: /quot/i },
  // Before the contract words, so "Tender Bond" is a bond, not a tender document
  { folder: '05 Policies & Bonds', words: /bond|\bbon\b|polic|polisi|cover note|guarantee|jaminan|indemnit/i },
  // The principal's documents (a Sebut Harga is the tender / contract notice)
  { folder: '01 LOA & Contract', words: /letter of award|\bloa\b|\bcontract\b|kontrak|\bsst\b|setuju terima|acceptance|tender|sebut harga|award/i },
  { folder: '03 Financials', words: /bank|financial|audited|account|statement|penyata|kewangan/i },
  { folder: '02 Company Docs', words: /ssm|cidb|company|syarikat|profile|form ?(9|24|44|49)|constitution|m ?& ?a|director|nric|\bic\b|identity|pkk|spkk|stb|bumiputra/i },
  { folder: '05 Policies & Bonds', words: /\bcar\b|\btpl\b|\bwc\b|workmen|insurance|insuran|premium|receipt|resit|proposal/i },
]
export const CORRESPONDENCE_FOLDER = '06 Correspondence'

export function topicFolder(documentType: string): string {
  return TOPIC_RULES.find(r => r.words.test(documentType))?.folder ?? CORRESPONDENCE_FOLDER
}

/** A name SharePoint accepts: no " * : < > ? / \ |, no leading/trailing dots or spaces. */
export function safeName(s: string, max = 100): string {
  const cleaned = s.replace(/["*:<>?/\\|]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[.\s]+|[.\s]+$/g, '')
  if (cleaned.length <= max) return cleaned || '_'
  // Keep the extension when shortening
  const dot = cleaned.lastIndexOf('.')
  const ext = dot > 0 && cleaned.length - dot <= 6 ? cleaned.slice(dot) : ''
  return cleaned.slice(0, max - ext.length).trim() + ext
}

export function sharePointPath(f: { caseNumber: string; caseTitle: string; customerName: string; documentType: string; fileName: string }) {
  const folders = [
    safeName(f.customerName || '_No customer'),
    safeName(`${f.caseNumber} ${f.caseTitle}`, 80),
    topicFolder(f.documentType),
  ]
  const name = safeName(`${f.caseNumber} ${f.documentType || 'Document'} - ${f.fileName}`, 150)
  return { folders, name }
}

// ─── Graph helpers ──────────────────────────────────────────────────────────

const pathUrl = (segments: string[]) => segments.map(encodeURIComponent).join('/')

/** Id of the folder at segments (created, with any missing parents, if needed). */
async function ensureFolder(segments: string[]): Promise<string> {
  let parentId: string | null = null
  for (let i = 0; i < segments.length; i++) {
    const here = segments.slice(0, i + 1)
    try {
      parentId = (await graphRequest<{ id: string }>('GET', `/drives/${driveId()}/root:/${pathUrl(here)}`)).id
    } catch (err) {
      if (!(err instanceof GraphError && err.status === 404)) throw err
      const parent: string = parentId ? `/drives/${driveId()}/items/${parentId}` : `/drives/${driveId()}/root`
      try {
        parentId = (await graphRequest<{ id: string }>('POST', `${parent}/children`, {
          name: here[i], folder: {}, '@microsoft.graph.conflictBehavior': 'fail',
        })).id
      } catch (createErr) {
        // Someone else created it at the same moment
        if (!(createErr instanceof GraphError && createErr.status === 409)) throw createErr
        parentId = (await graphRequest<{ id: string }>('GET', `/drives/${driveId()}/root:/${pathUrl(here)}`)).id
      }
    }
  }
  return parentId!
}

type DriveItem = { id: string; name: string; webUrl: string; parentReference?: { id?: string } }

async function upload(folderId: string, name: string, content: Buffer, contentType: string): Promise<DriveItem> {
  const target = `/drives/${driveId()}/items/${folderId}:/${encodeURIComponent(name)}:`
  if (content.length <= SIMPLE_UPLOAD_LIMIT) {
    const token = await getGraphToken()
    const res = await fetch(`${GRAPH}${target}/content?@microsoft.graph.conflictBehavior=rename`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType || 'application/octet-stream' },
      body: new Uint8Array(content),
    })
    if (!res.ok) throw new GraphError(res.status, `SharePoint upload failed (HTTP ${res.status}): ${await res.text()}`)
    return res.json()
  }
  // Large file: upload session, sent in chunks (the upload URL needs no token)
  const session = await graphRequest<{ uploadUrl: string }>('POST', `${target}/createUploadSession`, {
    item: { '@microsoft.graph.conflictBehavior': 'rename' },
  })
  let item: DriveItem | null = null
  for (let start = 0; start < content.length; start += UPLOAD_CHUNK) {
    const chunk = content.subarray(start, Math.min(start + UPLOAD_CHUNK, content.length))
    const res = await fetch(session.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.length),
        'Content-Range': `bytes ${start}-${start + chunk.length - 1}/${content.length}`,
      },
      body: new Uint8Array(chunk),
    })
    if (!res.ok) throw new GraphError(res.status, `SharePoint upload failed (HTTP ${res.status}): ${await res.text()}`)
    if (res.status === 200 || res.status === 201) item = await res.json()
  }
  if (!item) throw new Error('SharePoint upload did not finish')
  return item
}

// ─── Sync ───────────────────────────────────────────────────────────────────

/**
 * Puts a case file's copy in the right SharePoint folder under the right name:
 * uploads it the first time, moves/renames it afterwards. Returns what it did.
 */
export async function syncCaseFile(sb: SupabaseClient, caseFileId: string): Promise<string> {
  const { data: file } = await sb
    .from('case_files')
    .select('id, case_id, file_name, file_type, document_type, file_data_url, sharepoint_item_id, cases(case_number, case_title, customer_name)')
    .eq('id', caseFileId).maybeSingle()
  if (!file) return 'not found'
  const c = (file as unknown as { cases: { case_number: string | null; case_title: string; customer_name: string } | null }).cases
  if (!c?.case_number) return 'case has no number yet'

  const { folders, name } = sharePointPath({
    caseNumber: c.case_number, caseTitle: c.case_title ?? '', customerName: c.customer_name ?? '',
    documentType: file.document_type ?? '', fileName: file.file_name ?? 'file',
  })
  const folderId = await ensureFolder(folders)

  let item: DriveItem | null = null
  if (file.sharepoint_item_id) {
    try {
      const current = await graphRequest<DriveItem>('GET', `/drives/${driveId()}/items/${file.sharepoint_item_id}?$select=id,name,webUrl,parentReference`)
      if (current.parentReference?.id === folderId && current.name === name) return 'already in place'
      item = await graphRequest<DriveItem>('PATCH',
        `/drives/${driveId()}/items/${file.sharepoint_item_id}?@microsoft.graph.conflictBehavior=rename`,
        { name, parentReference: { id: folderId } })
    } catch (err) {
      if (!(err instanceof GraphError && err.status === 404)) throw err
      // Deleted in SharePoint — upload it again below
    }
  }
  if (!item) {
    if (!file.file_data_url) return 'no file content'
    item = await upload(folderId, name, await readFile(file.file_data_url), file.file_type ?? '')
  }

  await sb.from('case_files').update({ sharepoint_item_id: item.id, sharepoint_url: item.webUrl }).eq('id', caseFileId)
  return `${file.sharepoint_item_id ? 'moved' : 'uploaded'}: ${[...folders, item.name].join('/')}`
}

/** Moves a case file's SharePoint copy to the recycle bin (kept there ~93 days). */
export async function deleteSharePointCopy(itemId: string) {
  try {
    await graphRequest('DELETE', `/drives/${driveId()}/items/${itemId}`)
  } catch (err) {
    if (!(err instanceof GraphError && err.status === 404)) throw err
  }
}

/** Copies up to `limit` case files that aren't in SharePoint yet (the daily catch-up). */
export async function syncMissingFiles(sb: SupabaseClient, limit = 15): Promise<{ synced: number; failed: number }> {
  const { data } = await sb
    .from('case_files').select('id')
    .is('sharepoint_item_id', null).like('file_data_url', 'storage:%')
    .order('uploaded_at', { ascending: false }).limit(limit)
  let synced = 0, failed = 0
  for (const row of data ?? []) {
    try {
      await syncCaseFile(sb, row.id)
      synced++
    } catch (err) {
      failed++
      console.error('[sharepoint sync]', row.id, err instanceof Error ? err.message : err)
    }
  }
  return { synced, failed }
}
