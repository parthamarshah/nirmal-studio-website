// What a project document may look like when it comes from the /admin project editor.
// Imported by the editor (feedback while typing) AND by the server's publish check
// (functions/api/admin/_lib/documents.js), so the two can't drift. Plain JS, no browser
// or Worker APIs.
//
// scripts/build-content.mjs (the project loop) stays the authority: it runs on every build
// and a failure there keeps the last good deploy live. These rules are the same ones plus
// a few limits of their own (lengths, counts) — never looser. Change the build, change this.

export const IMAGE_TYPES = ['render', 'drawing', 'photograph', 'site-progress', 'other']
export const IMAGE_TYPE_NAMES = { render: 'Render', drawing: 'Drawing', photograph: 'Photograph', 'site-progress': 'Site progress', other: 'Other' }
export const STATUSES = [null, 'concept', 'under-construction', 'completed']
export const STATUS_NAMES = { concept: 'Concept', 'under-construction': 'Under construction', completed: 'Completed' }
export const SHAPES = ['original', '3:2', '16:9', '4:5', '1:1']
export const SHAPE_NAMES = { original: 'Original', '3:2': '3:2', '16:9': '16:9', '4:5': '4:5', '1:1': 'Square' }
export const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(jpe?g|png|webp)$/i
// Same test RichText.jsx applies before rendering a link.
export const SAFE_LINK = /^(https?:\/\/|mailto:|tel:|\/(?!\/))/i

export const LIMITS = { name: 80, heading: 80, caption: 200, factLabel: 40, factValue: 120, customFacts: 8, sections: 20, sectionImages: 24, pool: 120 }

// What the editor and the project list may change. The slug and old links never change
// from here (a renamed project keeps its link), so they must stay exactly as published.
export const EDITABLE_KEYS = new Set(['name', 'facts', 'cover', 'sections', 'pool', 'order', 'hidden', 'deleted'])
export const PROJECT_KEYS = new Set(['slug', 'previousSlugs', ...EDITABLE_KEYS])
const FACT_KEYS = new Set(['type', 'city', 'status', 'siteArea', 'builtUpArea', 'custom'])
const IMAGE_KEYS = new Set(['id', 'file', 'type', 'caption', 'rotation', 'crop', 'hidden', 'showTag'])
const COVER_KEYS = new Set(['image', 'crop', 'phoneImage', 'phoneCrop'])
const SECTION_KEYS = new Set(['id', 'heading', 'body', 'images'])

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isStr = (v) => typeof v === 'string' && v.trim().length > 0
const isNullableStr = (v) => v === null || v === undefined || typeof v === 'string'
const num01 = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1
const extraKeys = (o, allowed) => Object.keys(o).filter((k) => !allowed.has(k))

export function cropProblem(crop) {
  if (crop == null) return null
  const ok = isObj(crop) && ['x', 'y', 'w', 'h'].every((k) => num01(crop[k])) && extraKeys(crop, new Set(['x', 'y', 'w', 'h'])).length === 0
  if (!ok || crop.x + crop.w > 1.0001 || crop.y + crop.h > 1.0001 || crop.w === 0 || crop.h === 0) return 'the framing must stay inside the image'
  return null
}

// The text of a section: only what RichText.jsx renders, so nothing written in the editor
// can reach the site as something else.
const NODE_TYPES = new Set(['doc', 'paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'listItem', 'hardBreak', 'text'])
const MARK_TYPES = new Set(['bold', 'italic', 'link'])
export function richTextProblem(doc) {
  if (doc == null) return null
  if (!isObj(doc) || doc.type !== 'doc') return 'the text isn’t in the editor’s format'
  let nodes = 0
  const walk = (n, depth) => {
    if (++nodes > 5000 || depth > 12) return 'the text is too long or too deeply nested'
    if (!isObj(n) || !NODE_TYPES.has(n.type)) return `the text contains something the site can’t show (${isObj(n) ? n.type : typeof n})`
    if (n.type === 'heading' && ![3, 4].includes(n.attrs?.level)) return 'a heading in the text has an unknown size'
    if (n.type === 'text') {
      if (typeof n.text !== 'string') return 'the text is broken'
      for (const m of n.marks ?? []) {
        if (!isObj(m) || !MARK_TYPES.has(m.type)) return `the text has formatting the site can’t show (${m?.type})`
        if (m.type === 'link' && !SAFE_LINK.test(m.attrs?.href ?? '')) return `the link “${m.attrs?.href ?? ''}” must start with https://, mailto: or tel:`
      }
    }
    if (n.content !== undefined) {
      if (!Array.isArray(n.content)) return 'the text is broken'
      for (const c of n.content) {
        const p = walk(c, depth + 1)
        if (p) return p
      }
    }
    return null
  }
  return walk(doc, 0)
}

// Words of plain text in a rich-text doc — for "empty section" hints.
export function richTextWords(doc) {
  let n = 0
  const walk = (x) => {
    if (x?.type === 'text') n += x.text.trim().split(/\s+/).filter(Boolean).length
    for (const c of x?.content ?? []) walk(c)
  }
  walk(doc)
  return n
}

// Homepage spots that show the project's COVER when they don't name an image of their own
// (src/lib/content.js homepageProject → toHomeShape), plus the link preview, which needs one.
export const COVER_SPOTS = new Set(['hero', 'focus', 'philosophy', 'shareImage'])

// Which homepage spots show this project, from site.json's `homepage`.
export const SPOT_NAMES = { hero: 'the homepage hero', focus: 'the homepage focus image', philosophy: 'the homepage philosophy image', timeline: 'the homepage timeline', shareImage: 'the link preview for the homepage' }
export function spotsUsing(slug, homepage) {
  return Object.entries(isObj(homepage) ? homepage : {})
    .filter(([, v]) => isObj(v) && v.project === slug)
    .map(([spot, v]) => ({ spot, image: v.image ?? null }))
}

// Every problem that would stop a publish (or fail the build), in plain English, each
// tagged with where it is so the editor can point at it: { where, text }.
// `where`: 'name' | 'facts' | 'cover' | 'section:<id>' | 'image:<id>' | 'project'.
export function projectProblems(doc, { homepage } = {}) {
  const out = []
  const add = (where, text) => out.push({ where, text })
  if (!isObj(doc)) return [{ where: 'project', text: 'The project is broken.' }]

  if (!isStr(doc.slug) || !ID_RE.test(doc.slug)) add('project', 'The project’s link name is invalid.')
  if (typeof doc.order !== 'number' || !Number.isFinite(doc.order)) add('project', 'The project’s place in the list is broken.')
  if (typeof doc.hidden !== 'boolean') add('project', '“Show on site” is broken.')
  if (doc.deleted !== undefined && typeof doc.deleted !== 'boolean') add('project', '“In Trash” is broken.')
  if (!Array.isArray(doc.previousSlugs)) add('project', 'The old links list is broken.')
  if (!isStr(doc.name)) add('name', 'The project needs a name.')
  else if (doc.name.length > LIMITS.name) add('name', `Keep the name to ${LIMITS.name} characters.`)

  const f = doc.facts
  if (!isObj(f)) add('facts', 'The facts are missing.')
  else {
    if (extraKeys(f, FACT_KEYS).length) add('facts', 'The facts have a part this editor doesn’t know.')
    for (const k of ['type', 'city', 'siteArea', 'builtUpArea']) if (!isNullableStr(f[k])) add('facts', `${k} must be text.`)
    for (const k of ['type', 'city', 'siteArea', 'builtUpArea']) if (typeof f[k] === 'string' && f[k].length > LIMITS.factValue) add('facts', `Keep ${k} shorter.`)
    if (!STATUSES.includes(f.status ?? null)) add('facts', 'Unknown status.')
    const custom = f.custom ?? []
    if (!Array.isArray(custom)) add('facts', 'The extra facts are broken.')
    else {
      if (custom.length > LIMITS.customFacts) add('facts', `Up to ${LIMITS.customFacts} extra facts.`)
      custom.forEach((c, i) => {
        if (!isObj(c) || extraKeys(c, new Set(['label', 'value'])).length) return add('facts', `Extra fact ${i + 1} is broken.`)
        if (!isStr(c.label) || !isStr(c.value)) add('facts', `Extra fact ${i + 1} needs both a label and a value (or remove it).`)
        else if (c.label.length > LIMITS.factLabel || c.value.length > LIMITS.factValue) add('facts', `Extra fact “${c.label.slice(0, 30)}” is too long.`)
      })
    }
  }

  const pool = new Map()
  if (!Array.isArray(doc.pool)) add('project', 'The image list is broken.')
  else {
    if (doc.pool.length > LIMITS.pool) add('project', `Up to ${LIMITS.pool} images per project.`)
    doc.pool.forEach((img, i) => {
      const where = `image:${isObj(img) ? img.id : i}`
      if (!isObj(img)) return add(where, `Image ${i + 1} is broken.`)
      if (!isStr(img.id) || !ID_RE.test(img.id)) return add(where, `Image ${i + 1} has an invalid id.`)
      if (pool.has(img.id)) add(where, `Two images share the id “${img.id}”.`)
      pool.set(img.id, img)
      if (extraKeys(img, IMAGE_KEYS).length) add(where, 'This image has settings this editor doesn’t know.')
      if (typeof img.file !== 'string' || !FILE_RE.test(img.file)) add(where, 'This image’s file name isn’t valid.')
      if (!IMAGE_TYPES.includes(img.type)) add(where, 'Choose what kind of image this is.')
      if (![0, 90, 180, 270].includes(img.rotation ?? 0)) add(where, 'Unknown rotation.')
      if (img.hidden !== undefined && typeof img.hidden !== 'boolean') add(where, '“Show on site” is broken.')
      if (img.showTag !== undefined && typeof img.showTag !== 'boolean') add(where, '“Show the type label” is broken.')
      if (!isNullableStr(img.caption)) add(where, 'The caption must be text.')
      else if (typeof img.caption === 'string' && img.caption.length > LIMITS.caption) add(where, `Keep the caption to ${LIMITS.caption} characters.`)
      const c = cropProblem(img.crop)
      if (c) add(where, `The trim: ${c}.`)
    })
  }

  const cv = doc.cover
  if (!isObj(cv)) add('cover', 'The cover is missing.')
  else {
    if (extraKeys(cv, COVER_KEYS).length) add('cover', 'The cover has settings this editor doesn’t know.')
    for (const [k, n] of [['image', 'cover'], ['phoneImage', 'phone cover']]) {
      const ref = cv[k]
      if (ref == null) continue
      if (!pool.has(ref)) add('cover', `The ${n} image isn’t in this project any more — choose another.`)
      else if (pool.get(ref).hidden) add('cover', `The ${n} image is hidden — show it, or choose another cover.`)
    }
    if (cv.phoneImage != null && cv.image == null) add('cover', 'A phone cover needs a main cover too.')
    for (const [k, n] of [['crop', 'cover'], ['phoneCrop', 'phone cover']]) {
      const c = cropProblem(cv[k])
      if (c) add('cover', `The ${n} framing: ${c}.`)
    }
  }

  if (!Array.isArray(doc.sections)) add('project', 'The sections are broken.')
  else {
    if (doc.sections.length > LIMITS.sections) add('project', `Up to ${LIMITS.sections} sections.`)
    const ids = new Set()
    doc.sections.forEach((s, i) => {
      const where = `section:${isObj(s) ? s.id : i}`
      const name = isObj(s) && isStr(s.heading) ? `“${s.heading}”` : `Section ${i + 1}`
      if (!isObj(s)) return add(where, `${name} is broken.`)
      if (extraKeys(s, SECTION_KEYS).length) add(where, `${name} has settings this editor doesn’t know.`)
      if (!isStr(s.id) || !ID_RE.test(s.id)) add(where, `${name} has an invalid id.`)
      else if (ids.has(s.id)) add(where, `Two sections share the id “${s.id}”.`)
      ids.add(s.id)
      if (!isNullableStr(s.heading)) add(where, `${name}: the heading must be text.`)
      else if (typeof s.heading === 'string' && s.heading.length > LIMITS.heading) add(where, `${name}: keep the heading to ${LIMITS.heading} characters.`)
      const t = richTextProblem(s.body)
      if (t) add(where, `${name}: ${t}.`)
      if (!Array.isArray(s.images)) return add(where, `${name}: its images are broken.`)
      if (s.images.length > LIMITS.sectionImages) add(where, `${name}: up to ${LIMITS.sectionImages} images.`)
      s.images.forEach((ref) => {
        if (!isObj(ref) || extraKeys(ref, new Set(['image', 'shape'])).length) return add(where, `${name}: an image entry is broken.`)
        if (!pool.has(ref.image)) add(where, `${name} uses an image that isn’t in this project any more.`)
        if (!SHAPES.includes(ref.shape)) add(where, `${name}: unknown image shape.`)
      })
    })
  }

  // A project on the site needs a picture for its card: a cover, or a drawing in a section
  // (src/lib/content.js cardImage). Without either the card would be an empty box.
  if (doc.hidden === false && doc.deleted !== true && !cv?.image) {
    const drawing = (doc.sections ?? []).some((s) => (s?.images ?? []).some((r) => pool.get(r?.image)?.type === 'drawing' && !pool.get(r.image).hidden))
    if (!drawing) add('cover', 'A project shown on the site needs a cover image (or a drawing in one of its sections) for its card.')
  }

  // The homepage points at this project (content/site.json). The build fails if those
  // pointers break, which would freeze the live site — so they are checked here too.
  const spots = spotsUsing(doc.slug, homepage)
  if (spots.length && doc.deleted === true) add('project', `This project is ${spots.map((x) => SPOT_NAMES[x.spot]).join(' and ')} — change that in Settings before moving it to Trash.`)
  else if (spots.length && doc.hidden === true) add('project', `This project is ${spots.map((x) => SPOT_NAMES[x.spot]).join(' and ')} — change that in Settings before hiding it.`)
  for (const { spot, image } of spots) {
    const id = image ?? (COVER_SPOTS.has(spot) ? cv?.image : null)
    if (image != null && !pool.has(image)) add(`image:${image}`, `${SPOT_NAMES[spot]} uses an image that was removed from this project — put it back, or change the homepage in Settings first.`)
    else if (id && pool.get(id)?.hidden) add(`image:${id}`, `${SPOT_NAMES[spot]} uses this image, so it can’t be hidden.`)
    else if (COVER_SPOTS.has(spot) && !id) add('cover', `This project is ${SPOT_NAMES[spot]}, so it needs a cover image.`)
  }
  return out
}

// A link name (slug) for a new project from its name, unique among `taken` — every
// project file's slug, Trash included, and every old link (a slug stays reserved).
export function newSlug(name, taken) {
  // A name with no Latin letters or digits (e.g. written in Gujarati) would otherwise
  // become "image"; "project" at least reads right.
  const latin = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  return newImageId(latin ? name : 'project', taken)
}

// A brand-new project, hidden until it's ready.
export function blankProject(slug, name, order) {
  return {
    slug,
    previousSlugs: [],
    order,
    hidden: true,
    deleted: false,
    name,
    facts: { type: null, city: null, status: null, siteArea: null, builtUpArea: null, custom: [] },
    cover: { image: null, crop: null, phoneImage: null, phoneCrop: null },
    sections: [{ id: 'concept', heading: 'Concept', body: null, images: [] }],
    pool: [],
  }
}

// A fresh pool id from a file or caption hint, unique within `taken`.
export function newImageId(hint, taken) {
  // Cut to length BEFORE trimming dashes, or a cut landing on a dash leaves an invalid id.
  const stem = String(hint || 'image').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/^-+|-+$/g, '') || 'image'
  let id = stem
  for (let n = 2; taken.has(id); n++) id = `${stem}-${n}`
  return id
}
