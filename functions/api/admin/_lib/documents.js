// What a draft id means on disk, how a document is written, and what may be published.

import { EDITABLE_KEYS as PROJECT_EDITABLE, projectProblems, IMAGE_TYPE_NAMES, STATUS_NAMES, richTextWords } from '../../../../src/lib/projectRules.js'

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
    // It is a commit message and a history line: past a few, a count reads better.
    if (who.length > 3) return `${name} — ${who.slice(0, 2).join(', ')} and ${who.length - 2} more changes`
    return who.length ? `${name} — ${who.join(', ')}` : name
  }
  if (id.startsWith('project:') && published) {
    const what = projectChanges(doc, published).map((c) => c.field)
    if (what.length > 3) return `${name} — ${what.slice(0, 2).join(', ')} and ${what.length - 2} more changes`
    return what.length ? `${name} — ${what.join(', ')}` : name
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
  if (id.startsWith('project:') && doc) return projectChanges(doc, published)
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
// the founders' editable fields (intros, role, based in, previously, bio, photo,
// contacts). The settings contact rules therefore live in THREE places, which is the
// cost of the build running in Node and this running in a Worker: build-content.mjs (the
// `if (site)` block), src/admin/SettingsEditor.jsx (FIELDS), and here. Change one, change
// all three. The founders rules are copied from build-content.mjs's founders block
// (and mirrored in src/admin/founderRules.js) — same rule.
//
// Everything else in site.json references other documents (homepage spots → a project's
// images), which only the build can see. No editor changes those parts yet, so rather
// than half-check them they must be IDENTICAL to what is published; when the Phase 3
// editors start changing them, this is where their checks go.

const isStr = (v) => typeof v === 'string' && v.trim().length > 0
const isNullableStr = (v) => v === null || v === undefined || typeof v === 'string'
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// Per person, field by field, old → new. Text is shown as text (long bios shortened);
// photos are described in words, not file names; contacts as their value or "off".
const FIELD_LABELS = { role: 'role', basedIn: 'based in', previously: 'previously', bio: 'bio' }
const CONTACT_NAMES = { whatsapp: 'WhatsApp', email: 'email', linkedin: 'LinkedIn', instagram: 'Instagram' }
const INTRO_NAMES = { nirmal: 'Nirmal Studio introduction', fold: 'FOLD introduction' }
const excerpt = (v) => {
  if (v == null || v === '') return null
  const t = String(v).trim().replace(/\s+/g, ' ')
  return t.length > 90 ? `${t.slice(0, 88)}… (${countWords(t)} words)` : t
}
const contactShown = (c) => (c?.on && c.value ? c.value : 'off')

function founderChanges(doc, published) {
  const list = (d) => (Array.isArray(d?.people) ? d.people : [])
  const before = new Map(list(published).map((p) => [p?.id, p]))
  const out = []
  for (const k of Object.keys(INTRO_NAMES)) {
    const was = published?.intro?.[k] ?? null
    const now = doc?.intro?.[k] ?? null
    if (!same(was || null, now || null)) out.push({ field: `the ${INTRO_NAMES[k]}`, from: excerpt(was), to: excerpt(now) })
  }
  for (const p of list(doc)) {
    const prev = before.get(p?.id) ?? {}
    const name = p?.name || p?.id
    for (const [k, l] of Object.entries(FIELD_LABELS)) {
      if (!same(prev[k] || null, p?.[k] || null)) out.push({ field: `${name}’s ${l}`, from: excerpt(prev[k]), to: excerpt(p?.[k]) })
    }
    const was = prev.photo ?? null
    const now = p?.photo ?? null
    if (!same(was, now)) {
      // Read as "<from> → <to>" in the confirmations, and the Undo confirmation calls this
      // the other way round — so both sides describe a state, not an action.
      const to = !now ? 'no photo' : !was ? 'a photo' : was.file !== now.file ? 'a different photo' : 'same photo, new framing or filter'
      out.push({ field: `${name}’s photo`, from: was ? 'current photo' : 'no photo', to })
    }
    for (const [k, l] of Object.entries(CONTACT_NAMES)) {
      const a = contactShown(prev.contacts?.[k])
      const b = contactShown(p?.contacts?.[k])
      if (a !== b) out.push({ field: `${name}’s ${l}`, from: a, to: b })
    }
  }
  // The site switches between two whole layouts on this (src/lib/content.js
  // foundersReady), so the publish that completes — or breaks — the set should say so.
  const ready = (d) => list(d).length > 0 && list(d).every((p) => p?.photo && isStr(p?.bio))
  if (published && ready(published) !== ready(doc)) {
    const nu = 'the new section with all four people'
    const old = 'the older Tej + FOLD section'
    out.unshift({ field: 'founders on the site', from: ready(published) ? nu : old, to: ready(doc) ? nu : old })
  }
  return out
}

// Project, part by part. Images are named by caption (or their place in the list), never
// by file name; text is summarised by word count — a section's text can be hundreds of
// words and the confirmation is for deciding, not proofreading.
const FACT_NAMES = { type: 'type', city: 'city', status: 'status', siteArea: 'site area', builtUpArea: 'built-up area' }
function projectChanges(doc, published) {
  if (!published) return [{ field: 'project', from: null, to: 'new' }]
  const out = []
  const push = (field, from, to) => out.push({ field, from: from ?? null, to: to ?? null })
  if (!same(doc.name ?? null, published.name ?? null)) push('name', published.name, doc.name)
  const fa = published.facts ?? {}
  const fb = doc.facts ?? {}
  for (const [k, n] of Object.entries(FACT_NAMES)) {
    const show = (v) => (k === 'status' ? STATUS_NAMES[v] ?? null : v || null)
    if (!same(fa[k] ?? null, fb[k] ?? null)) push(n, show(fa[k]), show(fb[k]))
  }
  if (!same(fa.custom ?? [], fb.custom ?? [])) {
    const list = (c) => (Array.isArray(c) && c.length ? c.map((x) => `${x?.label}: ${x?.value}`).join('; ') : null)
    push('extra facts', list(fa.custom), list(fb.custom))
  }
  const poolA = new Map((published.pool ?? []).map((i) => [i?.id, i]))
  const poolB = new Map((doc.pool ?? []).map((i) => [i?.id, i]))
  const imgName = (img, list) => (img?.caption?.trim() ? img.caption.trim().slice(0, 50) : `image ${[...list.keys()].indexOf(img?.id) + 1}`)
  const added = [...poolB.values()].filter((i) => !poolA.has(i?.id)).length
  const removed = [...poolA.values()].filter((i) => !poolB.has(i?.id)).length
  if (added || removed) push('images', `${poolA.size}`, `${poolB.size} (${[added && `${added} added`, removed && `${removed} removed`].filter(Boolean).join(', ')})`)
  for (const [id, b] of poolB) {
    const a = poolA.get(id)
    if (!a) continue
    const n = imgName(b, poolB)
    if (!same(a.hidden ?? false, b.hidden ?? false)) push(`${n}`, a.hidden ? 'hidden' : 'shown', b.hidden ? 'hidden' : 'shown')
    if (!same(a.type, b.type)) push(`${n} type`, IMAGE_TYPE_NAMES[a.type] ?? a.type, IMAGE_TYPE_NAMES[b.type] ?? b.type)
    if (!same(a.caption || null, b.caption || null)) push(`${n} caption`, a.caption || null, b.caption || null)
    if (!same(a.rotation ?? 0, b.rotation ?? 0) || !same(a.crop ?? null, b.crop ?? null)) push(`${n}`, 'as it was', 'rotated or trimmed')
    if (!same(a.showTag ?? false, b.showTag ?? false)) push(`${n} type label`, a.showTag ? 'shown' : 'off', b.showTag ? 'shown' : 'off')
  }
  const ca = published.cover ?? {}
  const cb = doc.cover ?? {}
  if (!same(ca.image ?? null, cb.image ?? null)) push('cover', ca.image ? imgName(poolA.get(ca.image), poolA) : 'none', cb.image ? imgName(poolB.get(cb.image), poolB) : 'none')
  else if (!same(ca.crop ?? null, cb.crop ?? null)) push('cover', 'framing as it was', 'new framing')
  if (!same(ca.phoneImage ?? null, cb.phoneImage ?? null) || !same(ca.phoneCrop ?? null, cb.phoneCrop ?? null)) push('phone cover', ca.phoneImage || ca.phoneCrop ? 'its own framing' : 'same as desktop', cb.phoneImage || cb.phoneCrop ? 'its own framing' : 'same as desktop')
  const secA = new Map((published.sections ?? []).map((x) => [x?.id, x]))
  const secB = new Map((doc.sections ?? []).map((x) => [x?.id, x]))
  const sname = (x) => `section “${x?.heading || 'untitled'}”`
  for (const [id, b] of secB) {
    const a = secA.get(id)
    if (!a) {
      push(sname(b), 'not there', 'added')
      continue
    }
    if (!same(a.heading ?? null, b.heading ?? null)) push(`${sname(a)} heading`, a.heading, b.heading)
    if (!same(a.body ?? null, b.body ?? null)) push(`${sname(b)} text`, `${richTextWords(a.body)} words`, `${richTextWords(b.body)} words`)
    if (!same(a.images ?? [], b.images ?? [])) push(`${sname(b)} images`, `${(a.images ?? []).length}`, `${(b.images ?? []).length}`)
  }
  for (const [id, a] of secA) if (!secB.has(id)) push(sname(a), 'there', 'removed')
  const orderA = [...secA.keys()].filter((k) => secB.has(k))
  const orderB = [...secB.keys()].filter((k) => secA.has(k))
  if (!same(orderA, orderB)) push('section order', 'as it was', 'changed')
  return out
}

function validateProject(id, doc, published, ctx) {
  if (!published) return ['There is no published version of this project to compare with, so it can’t be checked yet.']
  const problems = []
  if (!isObj(doc)) return ['The project is broken.']
  if (doc.slug !== id.slice('project:'.length)) problems.push('The project’s link name was changed, and nothing here can check that yet.')
  for (const k of new Set([...Object.keys(doc), ...Object.keys(published)])) {
    if (!PROJECT_EDITABLE.has(k) && !same(doc[k], published[k])) problems.push(`“${k}” was changed, and nothing here can check that part yet.`)
  }
  for (const p of projectProblems(doc, { homepage: ctx?.site?.homepage })) problems.push(p.text)
  return problems
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

// Copied from build-content.mjs (FOUNDER_ID, BIO_WORDS, countWords) and the founders
// block's contact rules, and mirrored for typing-time feedback in
// src/admin/founderRules.js — change one, change all three.
const FOUNDER_ID = 'tej-shah'
const BIO_WORDS = { founder: [70, 100], others: [50, 80] }
const countWords = (s) => String(s).trim().split(/\s+/).filter(Boolean).length
const isHttps = (v) => {
  try {
    return new URL(v).protocol === 'https:'
  } catch {
    return false
  }
}
// What the editor may change per person. Names, ids, `background` and `expertise` stay
// exactly as published (names are locked by decision; the other two have no editor).
const EDITABLE = new Set(['role', 'basedIn', 'previously', 'bio', 'photo', 'contacts'])
const CONTACT_KEYS = ['whatsapp', 'email', 'linkedin', 'instagram']

function contactProblem(k, c) {
  if (!isObj(c) || typeof c.on !== 'boolean') return `${CONTACT_NAMES[k]} needs an on/off switch.`
  if ([...Object.keys(c)].some((x) => x !== 'on' && x !== 'value')) return `${CONTACT_NAMES[k]} has settings this editor doesn’t know.`
  if (!isNullableStr(c.value)) return `${CONTACT_NAMES[k]} must be text.`
  if (!c.on) return null
  if (!isStr(c.value)) return `${CONTACT_NAMES[k]} is switched on but empty.`
  if ((k === 'linkedin' || k === 'instagram') && !isHttps(c.value)) return `${CONTACT_NAMES[k]} must be a full https:// link.`
  if (k === 'whatsapp' && !/^\d{8,15}$/.test(c.value)) return 'WhatsApp must be digits only, with the country code (e.g. 919106998434).'
  if (k === 'email' && !/^[^\s@?&]+@[^\s@?&]+\.[^\s@?&]+$/.test(c.value)) return 'that email doesn’t look like an email address.'
  return null
}

function validateFounders(doc, published) {
  if (!published) return ['There is no published founders file to compare with, so this can’t be checked.']
  const problems = []
  for (const k of new Set([...Object.keys(doc), ...Object.keys(published)])) {
    if (k !== 'people' && k !== 'intro' && !same(doc[k], published[k])) problems.push(`“${k}” was changed, and nothing here can check that part yet.`)
  }
  if (!isObj(doc.intro)) problems.push('The introductions are missing.')
  else {
    if (Object.keys(doc.intro).some((k) => !(k in INTRO_NAMES))) problems.push('The introductions have a part this editor doesn’t know.')
    for (const k of Object.keys(INTRO_NAMES)) if (!isNullableStr(doc.intro[k])) problems.push(`The ${INTRO_NAMES[k]} must be text.`)
  }
  const was = published.people || []
  const now = Array.isArray(doc.people) ? doc.people : null
  if (!now || now.length !== was.length || now.some((p, i) => p?.id !== was[i]?.id)) {
    return [...problems, 'The list of people was changed, and nothing here can check that yet.']
  }
  now.forEach((p, i) => {
    if (!isObj(p)) return problems.push(`Person ${i + 1} is broken.`)
    const name = p.name || p.id
    for (const k of new Set([...Object.keys(p), ...Object.keys(was[i])])) {
      if (!EDITABLE.has(k) && !same(p[k], was[i][k])) problems.push(`${name}: “${k}” was changed, and nothing here can check that part yet.`)
    }
    for (const k of ['role', 'basedIn', 'previously', 'bio']) if (!isNullableStr(p[k])) problems.push(`${name}: ${FIELD_LABELS[k]} must be text.`)
    if (isStr(p.bio)) {
      const max = (p.id === FOUNDER_ID ? BIO_WORDS.founder : BIO_WORDS.others)[1]
      const n = countWords(p.bio)
      if (n > max) problems.push(`${name}: the bio is ${n} words — keep it to ${max} or fewer.`)
    }
    if (!isObj(p.contacts)) problems.push(`${name}: the contact switches are missing.`)
    else {
      if (Object.keys(p.contacts).some((k) => !CONTACT_KEYS.includes(k))) problems.push(`${name}: a contact this editor doesn’t know was added.`)
      for (const k of CONTACT_KEYS) {
        const c = contactProblem(k, p.contacts[k])
        if (c) problems.push(`${name}: ${c}`)
      }
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

// `ctx.site`: content/site.json as this publish would leave it (the draft being published
// with it, else the file at the head being committed onto) — a project's images are
// pointed at from the homepage, and only together can that be checked.
export function validate(id, doc, published, ctx = {}) {
  if (id === 'founders') return validateFounders(doc, published)
  if (id.startsWith('project:')) return validateProject(id, doc, published, ctx)
  if (id !== 'site') return [`${label(id, doc)} can’t be published from here yet — its editor hasn’t been built.`]
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
