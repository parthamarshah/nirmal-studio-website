import { requireSession, json } from './_lib/auth.js'
import { DOC_ID, mediaDirFor, isMediaPath, mediaKvKey as kvKey } from './_lib/documents.js'
import { explainGitHubError } from './_lib/github.js'
import { publishSetup } from './_lib/publishes.js'

// Images from /admin, uploaded ahead of a publish.
//
// POST /api/admin/upload  { docId, data, width?, height?, hint } → { path, file, sha, bytes }
// GET  /api/admin/upload?path=content/media/...                → the image bytes
//
// The browser has already done the heavy lifting (HEIC → JPEG, EXIF rotation applied and
// stripped, shrunk to the size the build expects) and sends base64 — the form GitHub's
// blob API takes, so the Worker passes it through instead of spending CPU re-encoding it.
//
// The bytes go to GitHub as a blob immediately (one request per upload, so a publish never
// has to push many megabytes through one invocation), the blob sha is recorded in D1 by the
// path it will be published at, and a copy goes to KV for previews. Nothing reaches the
// site until a draft that points at the file is published.

// A drawing at 4000px and JPEG quality 95 is the largest legitimate file (a few MB). This
// leaves headroom without letting a stray 50MB original through.
const MAX_BYTES = 12 * 1024 * 1024
// Staged copies outlive any realistic draft; D1 keeps the record either way.
const KV_TTL = 90 * 24 * 60 * 60

const bad = (error, status = 400) => json({ error }, { status })

// The browser re-encodes every image to JPEG (src/admin/images.js), so JPEG is the only
// kind accepted — fewer formats, fewer ways for a file to pass here and fail the build.
// Checked from the bytes, never from a name or a header the client sets.
//
// The build opens every image strictly (sharp, failOn: 'error'), so a file that passes
// here but can't be decoded there would fail the build and freeze the live site until an
// Undo. Two cheap checks cover what a re-encode can't produce but a hand-made request can:
// the file must END like a complete JPEG, and its real pixel size (read from the frame
// header, not from the client's width/height) must be within what the build can decode.
//
// Deliberately NOT a character-by-character check of the whole base64 string: on the free
// plan that alone costs ~5ms CPU per MB (measured), most of the 10ms budget. GitHub's
// blob API refuses malformed base64 itself.
const MAX_PIXELS = 50_000_000

function jpegInfo(base64) {
  let head
  let tail
  try {
    // 64KB covers the frame header of any camera or canvas JPEG.
    head = atob(base64.slice(0, 87384))
    tail = atob(base64.slice(-16))
  } catch {
    return null
  }
  const b = (i) => head.charCodeAt(i)
  if (!(b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff)) return null
  if (!tail.endsWith('\xff\xd9')) return { incomplete: true }
  let i = 2
  while (i + 9 < head.length) {
    if (b(i) !== 0xff) return null
    const marker = b(i + 1)
    // SOF0–SOF15 carry the size, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: (b(i + 5) << 8) | b(i + 6), width: (b(i + 7) << 8) | b(i + 8) }
    }
    i += 2 + ((b(i + 2) << 8) | b(i + 3))
  }
  return null
}

const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

function randomTag() {
  const b = crypto.getRandomValues(new Uint8Array(5))
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export async function onRequestPost(context) {
  const session = await requireSession(context)
  if (session instanceof Response) return session
  const { env } = context
  if (!env.UPLOADS) return bad('Uploads aren’t set up on this deployment (no UPLOADS storage).', 503)
  const setup = publishSetup(env)
  if (setup instanceof Response) return setup
  const { gh, branch } = setup

  let body
  try {
    body = await context.request.json()
  } catch {
    return bad('Expected JSON.')
  }
  const { docId, data, hint = '' } = body || {}
  if (typeof docId !== 'string' || !DOC_ID.test(docId) || !mediaDirFor(docId)) return bad('Images can only be added to the founders or a project.')
  if (typeof data !== 'string' || !data) return bad('No image was sent.')
  const bytes = Math.floor((data.length * 3) / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0)
  if (bytes > MAX_BYTES) return bad('That image is too large, even after shrinking. Try a smaller one.', 413)
  const info = jpegInfo(data)
  if (!info) return bad('That file isn’t a JPEG image.', 415)
  if (info.incomplete) return bad('That image arrived incomplete. Try adding it again.', 422)
  if (!info.width || !info.height || info.width * info.height > MAX_PIXELS) return bad('That image’s size can’t be used. Try a smaller copy.', 422)
  const kind = { ext: 'jpg', type: 'image/jpeg' }
  // Recorded from the file itself; the client's own numbers are only a cross-check.
  const width = info.width
  const height = info.height
  if ((body.width != null && body.width !== width) || (body.height != null && body.height !== height)) {
    return bad('The image’s size didn’t match what was sent. Try adding it again.', 422)
  }

  // The name is made here: a stem from the hint (e.g. the person's id), squeezed into the
  // build's file-name rule, plus a random tag so two uploads never collide.
  const stem = String(hint).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'image'
  const dir = mediaDirFor(docId)
  const file = `${stem}-${randomTag()}.${kind.ext}`
  const path = `${dir}/${file}`
  if (!isMediaPath(path)) return bad('Couldn’t make a valid file name for that image.', 500)

  let sha
  try {
    // A publish only ever ADDS media, never replaces it, so a name already in the repo is
    // refused rather than overwritten. With a random tag this is a belt-and-braces check.
    const existing = await gh.listDir(dir, await gh.head(branch))
    if (existing.has(file)) return bad('That file name is already taken. Try the upload again.', 409)
    sha = await gh.createBlob(data)
  } catch (err) {
    return bad(explainGitHubError(err, 'The image wasn’t uploaded.'), 502)
  }

  const now = Date.now()
  try {
    await env.DB.prepare('INSERT INTO uploads (path, doc_id, blob_sha, bytes, width, height, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(path, docId, sha, bytes, width, height, now, String(session.id).slice(0, 8))
      .run()
  } catch {
    return bad('The image reached GitHub but couldn’t be recorded. Try the upload again.', 503)
  }
  // The preview copy is a convenience: if it fails, publishing still works from D1.
  let previewable = true
  try {
    await env.UPLOADS.put(kvKey(path), data, { expirationTtl: KV_TTL, metadata: { type: kind.type } })
  } catch {
    previewable = false
  }
  return json({ ok: true, path, file, sha, bytes, previewable })
}

export async function onRequestGet(context) {
  const session = await requireSession(context)
  if (session instanceof Response) return session
  const path = new URL(context.request.url).searchParams.get('path') || ''
  if (!isMediaPath(path)) return bad('Unknown image.')
  const data = context.env.UPLOADS ? await context.env.UPLOADS.get(kvKey(path)) : null
  if (!data) return bad('That image isn’t available to preview.', 404)
  const ext = path.split('.').pop().toLowerCase()
  return new Response(decode(data), {
    headers: { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' },
  })
}

function decode(base64) {
  if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(base64)
  const bin = atob(base64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
