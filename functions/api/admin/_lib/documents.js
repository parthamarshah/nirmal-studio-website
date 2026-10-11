// What a draft id means on disk, how a document is written, and what may be published.

// The same ids draft.js accepts.
export const DOC_ID = /^(site|founders|project:[a-z0-9][a-z0-9-]{0,79})$/

export function pathFor(id) {
  if (id === 'site') return 'content/site.json'
  if (id === 'founders') return 'content/founders.json'
  if (id.startsWith('project:')) return `content/projects/${id.slice('project:'.length)}.json`
  return null
}

// The line that makes "a publish can never touch code" checkable rather than argued:
// every path a publish or an undo writes goes through this, whatever computed it.
const CONTENT_PATH = /^content\/(site\.json|founders\.json|projects\/[a-z0-9][a-z0-9-]*\.json)$/
const MEDIA_PATH = /^content\/media\/(founders|projects\/[a-z0-9][a-z0-9-]*)\/[A-Za-z0-9][A-Za-z0-9._-]*\.(jpe?g|png|webp)$/
export const isMediaPath = (p) => MEDIA_PATH.test(p)
export const isContentPath = (p) => CONTENT_PATH.test(p) || isMediaPath(p)
// The KV key holding an upload's bytes (base64) for previews and blob repair.
export const mediaKvKey = (path) => `media:${path}`

// The build's own file-name rule (scripts/build-content.mjs FILE_RE).
export const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(jpe?g|png|webp)$/i

// Where a document's images live. Decided here from the document id, never from anything
// the browser sends, so an upload can't be aimed at another folder.
export function mediaDirFor(id) {
  if (id === 'founders') return 'content/media/founders'
  if (id.startsWith('project:')) return `content/media/projects/${id.slice('project:'.length)}`
  return null
}

// Every image file a document points at, as repo paths. Publish checks each one is either
// already in the repo or uploaded and waiting — a build that can't find a file fails, and
// a failed build freezes the live site on its last good version until someone fixes it.
export function referencedMedia(id, doc) {
  const dir = mediaDirFor(id)
  if (!dir || !doc) return []
  const files = []
  if (id === 'founders' && Array.isArray(doc.people)) for (const p of doc.people) if (p?.photo?.file) files.push(p.photo.file)
  if (id.startsWith('project:') && Array.isArray(doc.pool)) for (const img of doc.pool) if (img?.file) files.push(img.file)
  return [...new Set(files)].filter((f) => typeof f === 'string' && FILE_RE.test(f)).map((f) => `${dir}/${f}`)
}

// Exactly how content/*.json is formatted in the repo — two-space indent, trailing
// newline. Verified byte-for-byte against every file on 2026-09-22; if this drifted,
// every publish would rewrite whole files and the diff would stop being readable.
export const serialize = (doc) => JSON.stringify(doc, null, 2) + '\n'

export function label(id, doc) {
  if (id === 'site') return 'Studio settings'
  if (id === 'founders') return 'Founders'
  return `Project: ${doc?.name || id.slice('project:'.length)}`
}

// A short "what changed" for the commit message and the publish history. For settings it
// names the contact fields, which is what the editor can change today.
export function describeChange(id, doc, published) {
  const name = label(id, doc)
  if (id === 'founders' && published) {
    const who = founderChanges(doc, published).map((c) => c.field)
    return who.length ? `${name} — ${who.join(', ')}` : name
  }
  if (id !== 'site' || !published) return name
  const keys = new Set([...Object.keys(doc.contact || {}), ...Object.keys(published.contact || {})])
  const changed = [...keys].filter((k) => !same(doc.contact?.[k], published.contact?.[k]))
  const other = Object.keys({ ...doc, ...published }).filter((k) => k !== 'contact' && !same(doc[k], published[k]))
  const parts = [...changed.map((k) => CONTACT_LABELS[k] || k), ...other]
  return parts.length ? `${name} — ${parts.join(', ')}` : name
}

// Field by field, old → new, for the Publish confirmation. A publish can change the
// phone or WhatsApp number people use to reach Tej, so "Publish Studio settings?" is not
// enough to decide on — the values are.
export function listChanges(id, doc, published) {
  if (id === 'founders' && doc) return founderChanges(doc, published)
  if (id !== 'site' || !doc) return []
  const from = published?.contact || {}
  const to = doc.contact || {}
  return [...new Set([...Object.keys(from), ...Object.keys(to)])]
    .filter((k) => !same(to[k], from[k]))
    .map((k) => ({ field: CONTACT_LABELS[k] || k, from: from[k] ?? null, to: to[k] ?? null }))
}

const CONTACT_LABELS = {
  phoneDisplay: 'phone (shown)',
  phone: 'phone (dial link)',
  whatsapp: 'WhatsApp number',
  whatsappGreeting: 'WhatsApp message',
  email: 'email',
  address: 'address',
  addressShort: 'short address',
  hours: 'hours',
  replyTime: 'reply time',
}

// Order-insensitive deep equality for plain JSON values.
export function same(a, b) {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return (a ?? null) === (b ?? null)
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => same(v, b[i]))
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && same(a[k], b[k]))
}

// ---------------------------------------------------------------- validation
//
// scripts/build-content.mjs is the authority: it runs on every build and a failure there
// keeps the previous deploy live. This exists so a mistake shows up in the editor with
// the draft kept, instead of as a failed build nobody is watching.
//
// It deliberately covers only what an editor can produce today: the contact block, and
// each founder's photo. The contact rules therefore live in THREE places, which is the
// cost of the build running in Node and this running in a Worker: build-content.mjs (the
// `if (site)` block), src/admin/SettingsEditor.jsx (FIELDS), and here. Change one, change
// all three. The photo rules (file name, crop, zoom, filter) are copied from
// build-content.mjs's FILE_RE, validateCrop and founders photo block — same rule.
//
// Everything else in site.json references other documents (homepage spots → a project's
// images), which only the build can see. No editor changes those parts yet, so rather
// than half-check them they must be IDENTICAL to what is published; when the Phase 3
// editors start changing them, this is where their checks go.

const isStr = (v) => typeof v === 'string' && v.trim().length > 0
const isNullableStr = (v) => v === null || v === undefined || typeof v === 'string'
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// Per person, what the editor can change today: the photo. Described in words, not file
// names — "new photo", "photo framing", "photo removed".
function founderChanges(doc, published) {
  const list = (d) => (Array.isArray(d?.people) ? d.people : [])
  const before = new Map(list(published).map((p) => [p?.id, p]))
  const out = []
  for (const p of list(doc)) {
    const was = before.get(p?.id)?.photo ?? null
    const now = p?.photo ?? null
    if (same(was, now)) continue
    // Read as "<from> → <to>" in the confirmations, and the Undo confirmation calls this
    // the other way round — so both sides describe a state, not an action.
    const to = !now ? 'no photo' : !was ? 'a photo' : was.file !== now.file ? 'a different photo' : 'same photo, new framing or filter'
    out.push({ field: `${p?.name || p?.id}’s photo`, from: was ? 'current photo' : 'no photo', to })
  }
  return out
}

const PHOTO_FILTERS = ['original', 'warm', 'bw']
const PHOTO_KEYS = new Set(['file', 'crop', 'zoom', 'filter'])
const num01 = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1

// Same rule as build-content.mjs validateCrop.
function cropProblem(crop) {
  if (crop == null) return null
  const ok = isObj(crop) && ['x', 'y', 'w', 'h'].every((k) => num01(crop[k]))
  if (!ok || crop.x + crop.w > 1.0001 || crop.y + crop.h > 1.0001 || crop.w === 0 || crop.h === 0) return 'the crop must stay inside the image'
  return null
}

// Founders: only each person's photo may change from here so far (the rest of the editor
// is Phase 3 step 2). Everything else must be IDENTICAL to what is published, the same
// way `site` locks the parts its editor doesn't cover.
function validateFounders(doc, published) {
  if (!published) return ['There is no published founders file to compare with, so this can’t be checked.']
  const problems = []
  for (const k of new Set([...Object.keys(doc), ...Object.keys(published)])) {
    if (k !== 'people' && !same(doc[k], published[k])) problems.push(`“${k}” was changed, and nothing here can check that part yet.`)
  }
  const was = published.people || []
  const now = Array.isArray(doc.people) ? doc.people : null
  if (!now || now.length !== was.length || now.some((p, i) => p?.id !== was[i]?.id)) {
    return [...problems, 'The list of people was changed, and nothing here can check that yet.']
  }
  now.forEach((p, i) => {
    const name = p.name || p.id
    for (const k of new Set([...Object.keys(p), ...Object.keys(was[i])])) {
      if (k !== 'photo' && !same(p[k], was[i][k])) problems.push(`${name}: “${k}” was changed, and nothing here can check that part yet.`)
    }
    const ph = p.photo
    // Only a photo that changed is checked here; an unchanged one is what is already
    // published, which the build has accepted (it may carry keys this editor doesn't set).
    if (ph == null || same(ph, was[i].photo)) return
    if (!isObj(ph)) return problems.push(`${name}: the photo setting is broken.`)
    if ([...Object.keys(ph)].some((k) => !PHOTO_KEYS.has(k))) problems.push(`${name}: the photo has settings this editor doesn’t know.`)
    if (typeof ph.file !== 'string' || !FILE_RE.test(ph.file)) problems.push(`${name}: the photo file name isn’t valid.`)
    const c = cropProblem(ph.crop)
    if (c) problems.push(`${name}: ${c}.`)
    if (ph.filter != null && !PHOTO_FILTERS.includes(ph.filter)) problems.push(`${name}: unknown photo filter.`)
    if (ph.zoom != null && !(typeof ph.zoom === 'number' && ph.zoom >= 1 && ph.zoom <= 4)) problems.push(`${name}: zoom must be between 1 and 4.`)
  })
  return problems
}

export function validate(id, doc, published) {
  if (id === 'founders') return validateFounders(doc, published)
  if (id !== 'site') {
    // No editor writes these yet, so nothing has checked a draft of them either.
    return [`${label(id, doc)} can’t be published from here yet — its editor hasn’t been built.`]
  }
  const problems = []
  const c = doc.contact
  if (!isObj(c)) return ['The contact details are missing.']
  const names = { email: 'Email', phone: 'Phone, for the dial link', phoneDisplay: 'Phone, as shown on the site', whatsapp: 'WhatsApp number', address: 'Studio address' }
  for (const [k, n] of Object.entries(names)) if (!isStr(c[k])) problems.push(`${n} can’t be empty.`)
  for (const k of ['whatsappGreeting', 'hours', 'replyTime', 'addressShort']) if (!isNullableStr(c[k])) problems.push(`${CONTACT_LABELS[k]} must be text.`)
  if (isStr(c.whatsapp) && !/^\d{8,15}$/.test(c.whatsapp)) problems.push('WhatsApp number must be digits only, 8–15 of them, including the country code.')
  if (isStr(c.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) problems.push('That email doesn’t look like an email address.')

  if (!published) problems.push('There is no published settings file to compare with, so this can’t be checked.')
  else
    for (const k of new Set([...Object.keys(doc), ...Object.keys(published)])) {
      if (k !== 'contact' && !same(doc[k], published[k])) problems.push(`“${k}” was changed, and nothing here can check that part yet.`)
    }
  return problems
}
