// Content build step — runs automatically before `npm run dev` and `npm run build`.
//
// 1. Reads everything under content/ (the files the /admin backend edits).
// 2. Validates it — shape, references, file names, links. Any problem stops the
//    build with a plain-English list, so a broken publish can never replace the
//    live site (Cloudflare keeps serving the last successful deploy when a build
//    fails). Rule of thumb: anything src/lib/content.js or a component reads
//    without a guard must be checked here first.
// 3. Generates every image size the site needs into public/_media/ (gitignored).
//    File names carry a content hash, so unchanged images are skipped locally
//    and browsers can cache them forever (see public/_headers).
// 4. Writes src/generated/content.js (what components import),
//    src/generated/meta.json (what vite.config.js injects into index.html) and
//    public/_redirects.
//
// This replaces the old hand-made `.webp` siblings and src/lib/images.js's
// string-substitution helper — every <img> now points at a file this script
// has verifiably produced.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = path.join(ROOT, 'content')
const MEDIA_SRC = path.join(CONTENT, 'media')
const MEDIA_OUT = path.join(ROOT, 'public', '_media')
const GENERATED = path.join(ROOT, 'src', 'generated')
const SITE_URL = 'https://nirmalstudio.com'

// Bump when the processing below changes, so every derivative regenerates.
const PIPELINE_VERSION = 3
const PHOTO_WIDTHS = [640, 1024, 1600, 2400]
const MAX_PHOTO_WIDTH = 2400
// Drawings: the zoomable viewer shows the largest file, and dimension text needs
// every pixel, so keep up to this width.
const MAX_DRAWING_WIDTH = 4000
const IMAGE_TYPES = ['render', 'drawing', 'photograph', 'site-progress', 'other']
const STATUSES = [null, 'concept', 'under-construction', 'completed']
const SHAPES = ['original', '3:2', '16:9', '4:5', '1:1']
const SECTION_KEYS = ['statement', 'focusImage', 'philosophy', 'ideaTimeline', 'featuredProjects', 'studio', 'process', 'contact']
const HOMEPAGE_SPOTS = ['hero', 'focus', 'philosophy', 'timeline', 'shareImage']
const SOCIALS = ['facebook', 'instagram', 'whatsapp', 'linkedin']
const CONTACTS = ['whatsapp', 'email', 'linkedin', 'instagram']
const FOUNDER_ID = 'tej-shah' // Nirmal Studio's founder — always shown first, never inferred from order
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(jpe?g|png|webp)$/i

const errors = []
const fail = (where, msg) => errors.push(`${where}: ${msg}`)
const stop = (list) => {
  console.error(`\n✗ Content check failed — ${list.length} problem${list.length > 1 ? 's' : ''}. The live site is unchanged.\n`)
  list.forEach((e) => console.error('  • ' + e))
  console.error('')
  process.exit(1)
}
const readJson = (rel) => {
  const file = path.join(CONTENT, rel)
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('expected an object')
    return data
  } catch (e) {
    fail(`content/${rel}`, e.code === 'ENOENT' ? 'file is missing' : `not valid (${e.message})`)
    return null
  }
}
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isStr = (v) => typeof v === 'string' && v.trim().length > 0
const isNullableStr = (v) => v === null || v === undefined || typeof v === 'string'
const isHttps = (v) => {
  try {
    return new URL(v).protocol === 'https:'
  } catch {
    return false
  }
}
// Exact-case file listing: macOS ignores case, Cloudflare's Linux builder doesn't.
const dirCache = new Map()
const filesIn = (dir) => {
  if (!dirCache.has(dir)) dirCache.set(dir, new Set(fs.existsSync(dir) ? fs.readdirSync(dir) : []))
  return dirCache.get(dir)
}

// ---------------------------------------------------------------- read
const site = readJson('site.json')
const founders = readJson('founders.json')
const unsorted = readJson('unsorted.json')
const projectFiles = filesIn(path.join(CONTENT, 'projects'))
const projects = [...projectFiles]
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => ({ file: f, data: readJson(`projects/${f}`) }))
  .filter((p) => p.data)

// ---------------------------------------------------------------- validate
function validateCrop(at, crop) {
  if (crop == null) return
  const ok = isObj(crop) && ['x', 'y', 'w', 'h'].every((k) => typeof crop[k] === 'number' && crop[k] >= 0 && crop[k] <= 1)
  if (!ok || crop.x + crop.w > 1.0001 || crop.y + crop.h > 1.0001 || crop.w === 0 || crop.h === 0) {
    fail(at, 'crop must be {x, y, w, h} fractions between 0 and 1 that stay inside the image')
  }
}
function validateFile(at, dir, file) {
  if (!isStr(file)) return fail(at, 'missing "file"')
  if (!FILE_RE.test(file)) return fail(at, `file name "${file}" must be plain letters, numbers, dots, dashes or underscores, ending in .jpg, .jpeg, .png or .webp`)
  if (!filesIn(dir).has(file)) fail(at, `file not found (names are case-sensitive): ${path.relative(ROOT, path.join(dir, file))}`)
}
// Returns Map(id → image) of valid pool entries.
function validatePool(where, pool, mediaDir) {
  const byId = new Map()
  if (!Array.isArray(pool)) {
    fail(where, '"pool" must be a list')
    return byId
  }
  pool.forEach((img, i) => {
    const at = `${where} → image ${i + 1}${isObj(img) && img.id ? ` (${img.id})` : ''}`
    if (!isObj(img)) return fail(at, 'must be an object')
    if (!isStr(img.id) || !ID_RE.test(img.id)) return fail(at, 'image id must be lowercase letters, numbers and dashes')
    if (byId.has(img.id)) fail(at, 'duplicate image id')
    byId.set(img.id, img)
    validateFile(at, mediaDir, img.file)
    if (!IMAGE_TYPES.includes(img.type)) fail(at, `type must be one of ${IMAGE_TYPES.join(', ')}`)
    if (![0, 90, 180, 270].includes(img.rotation ?? 0)) fail(at, 'rotation must be 0, 90, 180 or 270')
    if (img.hidden !== undefined && typeof img.hidden !== 'boolean') fail(at, '"hidden" must be true or false')
    validateCrop(at, img.crop)
  })
  return byId
}

const slugs = new Map() // every project file, including deleted ones (a slug stays reserved)
const pools = new Map() // slug → Map(id → image)
const oldSlugs = new Map()
for (const { file, data: p } of projects) {
  const where = `content/projects/${file}`
  if (!isStr(p.slug) || !ID_RE.test(p.slug)) {
    fail(where, 'slug must be lowercase letters, numbers and dashes')
    continue
  }
  if (file !== `${p.slug}.json`) fail(where, `file name must match slug ("${p.slug}.json")`)
  if (slugs.has(p.slug)) fail(where, `slug "${p.slug}" is used twice`)
  slugs.set(p.slug, p)
  if (p.deleted === true) continue // in Trash: its media may already be gone, nothing reads it
  if (p.deleted !== undefined && p.deleted !== false) fail(where, '"deleted" must be true or false')
  if (typeof p.hidden !== 'boolean') fail(where, '"hidden" must be true or false')
  if (!isStr(p.name)) fail(where, 'project name is empty')
  if (typeof p.order !== 'number') fail(where, '"order" must be a number')
  if (!isObj(p.facts)) fail(where, '"facts" is missing')
  else {
    if (!STATUSES.includes(p.facts.status ?? null)) fail(where, 'status must be empty or one of concept, under-construction, completed')
    for (const k of ['type', 'city', 'siteArea', 'builtUpArea']) if (!isNullableStr(p.facts[k])) fail(where, `facts.${k} must be text`)
  }
  if (!Array.isArray(p.previousSlugs)) fail(where, '"previousSlugs" must be a list')
  else
    for (const old of p.previousSlugs) {
      if (!isStr(old) || !ID_RE.test(old)) fail(where, `old link "${old}" must be lowercase letters, numbers and dashes`)
      else if (oldSlugs.has(old)) fail(where, `old link "${old}" is also listed by ${oldSlugs.get(old)}`)
      else oldSlugs.set(old, p.slug)
    }
  const pool = validatePool(where, p.pool, path.join(MEDIA_SRC, 'projects', p.slug))
  pools.set(p.slug, pool)
  if (!isObj(p.cover)) fail(where, '"cover" is missing')
  else {
    for (const k of ['image', 'phoneImage']) {
      const ref = p.cover[k]
      if (ref == null) continue
      if (!pool.has(ref)) fail(where, `cover.${k} points to image "${ref}", which isn't in this project's images`)
      else if (pool.get(ref).hidden) fail(where, `cover.${k} is "${ref}", which is hidden — pick another cover or unhide it`)
    }
    validateCrop(`${where} → cover`, p.cover.crop)
    validateCrop(`${where} → cover (phone)`, p.cover.phoneCrop)
  }
  if (!Array.isArray(p.sections)) fail(where, '"sections" must be a list')
  else {
    const sectionIds = new Set()
    p.sections.forEach((s, i) => {
      const at = `${where} → section ${i + 1}${isObj(s) && s.heading ? ` (${s.heading})` : ''}`
      if (!isObj(s)) return fail(at, 'must be an object')
      if (!isStr(s.id) || !ID_RE.test(s.id)) fail(at, 'section id must be lowercase letters, numbers and dashes')
      else if (sectionIds.has(s.id)) fail(at, 'duplicate section id')
      sectionIds.add(s.id)
      if (!isNullableStr(s.heading)) fail(at, 'heading must be text')
      if (s.body != null && (!isObj(s.body) || s.body.type !== 'doc')) fail(at, 'text must be an editor document')
      if (!Array.isArray(s.images)) return fail(at, '"images" must be a list')
      // Hidden images are allowed here: they keep their place and are skipped on the site.
      s.images.forEach((ref) => {
        if (!isObj(ref) || !pool.has(ref.image)) fail(at, `uses image "${ref?.image}", which isn't in this project's images`)
        if (!SHAPES.includes(ref?.shape)) fail(at, `image shape must be one of ${SHAPES.join(', ')}`)
      })
    })
  }
}
for (const [old, owner] of oldSlugs) if (slugs.has(old)) fail(`content/projects/${owner}.json`, `old link "${old}" clashes with an existing project`)

if (unsorted) validatePool('content/unsorted.json', unsorted.pool, path.join(MEDIA_SRC, 'unsorted'))

if (founders) {
  const where = 'content/founders.json'
  if (!isObj(founders.intro)) fail(where, '"intro" is missing')
  if (!Array.isArray(founders.people) || founders.people.length === 0) fail(where, 'needs at least one person')
  else {
    const ids = new Set()
    founders.people.forEach((f, i) => {
      const at = `${where} → person ${i + 1}${isObj(f) && f.name ? ` (${f.name})` : ''}`
      if (!isObj(f)) return fail(at, 'must be an object')
      if (!isStr(f.id) || !ID_RE.test(f.id)) fail(at, 'id must be lowercase letters, numbers and dashes')
      else if (ids.has(f.id)) fail(at, 'duplicate id')
      ids.add(f.id)
      if (!isStr(f.name)) fail(at, 'name is empty')
      for (const k of ['role', 'basedIn', 'background', 'expertise', 'bio']) if (!isNullableStr(f[k])) fail(at, `${k} must be text`)
      if (f.photo != null) {
        if (!isObj(f.photo)) fail(at, 'photo must be an object')
        else {
          validateFile(`${at} → photo`, path.join(MEDIA_SRC, 'founders'), f.photo.file)
          validateCrop(`${at} → photo`, f.photo.crop)
        }
      }
      for (const k of CONTACTS) {
        const c = f.contacts?.[k]
        if (!isObj(c) || typeof c.on !== 'boolean') fail(at, `contacts.${k} needs an on/off switch`)
        else if (c.on && !isStr(c.value)) fail(at, `contacts.${k} is switched on but empty`)
        else if (c.on && ['linkedin', 'instagram'].includes(k) && !isHttps(c.value)) fail(at, `contacts.${k} must be a full https:// link`)
      }
    })
    if (!ids.has(FOUNDER_ID)) fail(where, `Tej Shah (id "${FOUNDER_ID}") must be in the list`)
  }
}

if (site) {
  const where = 'content/site.json'
  if (!isObj(site.contact)) fail(where, '"contact" is missing')
  else {
    for (const k of ['email', 'phone', 'phoneDisplay', 'whatsapp', 'address']) if (!isStr(site.contact[k])) fail(where, `contact.${k} is empty`)
    for (const k of ['whatsappGreeting', 'hours', 'replyTime']) if (!isNullableStr(site.contact[k])) fail(where, `contact.${k} must be text`)
    if (isStr(site.contact.whatsapp) && !/^\d{8,15}$/.test(site.contact.whatsapp)) fail(where, 'contact.whatsapp must be digits only, with country code (e.g. 919106998434)')
  }
  if (!isObj(site.socials)) fail(where, '"socials" is missing')
  else
    for (const k of SOCIALS) {
      const v = site.socials[k]
      if (!isObj(v) || typeof v.on !== 'boolean') fail(where, `socials.${k} needs an on/off switch`)
      else if (k !== 'whatsapp' && v.url != null && v.url !== '' && !isHttps(v.url)) fail(where, `socials.${k} must be a full https:// link`)
      else if (v.on && k !== 'whatsapp' && !isStr(v.url)) fail(where, `socials.${k} is switched on but has no link`)
    }
  if (!isObj(site.homepage)) fail(where, '"homepage" is missing')
  else
    for (const spot of HOMEPAGE_SPOTS) {
      const v = site.homepage[spot]
      const p = slugs.get(v?.project)
      if (!isObj(v) || !isStr(v.project)) fail(where, `homepage.${spot} is not set`)
      else if (!p || p.deleted) fail(where, `homepage.${spot} points to project "${v.project}", which doesn't exist`)
      else {
        const pool = pools.get(p.slug) || new Map()
        const imageId = v.image ?? (spot === 'shareImage' ? p.cover?.image : null)
        if (v.image != null && !pool.has(v.image)) fail(where, `homepage.${spot} points to image "${v.image}", which isn't in ${p.name}`)
        else if (imageId && pool.get(imageId)?.hidden) fail(where, `homepage.${spot} uses a hidden image of ${p.name}`)
        else if (spot === 'shareImage' && !imageId) fail(where, `homepage.shareImage: ${p.name} has no cover image to use as the link preview`)
      }
    }
  if (!isObj(site.sections)) fail(where, '"sections" is missing')
  else for (const k of SECTION_KEYS) if (typeof site.sections[k] !== 'boolean') fail(where, `sections.${k} needs an on/off switch`)
}

if (errors.length) stop(errors)

// ---------------------------------------------------------------- images
fs.mkdirSync(MEDIA_OUT, { recursive: true })
const produced = new Set()
const jobs = []
const hashOf = (file, params) =>
  crypto.createHash('sha1').update(fs.readFileSync(file)).update(JSON.stringify({ params, PIPELINE_VERSION })).digest('hex').slice(0, 10)

// Decodes once to raw pixels (so nothing is compressed twice), applying phone
// EXIF orientation, then rotation, then crop — the admin's crop tool must measure
// crops in that same orientation. Transparent areas become white.
async function decoded(file, { rotation = 0, crop = null }) {
  let img = sharp(file, { failOn: 'error' }).autoOrient()
  if (rotation) img = img.rotate(rotation)
  let { data, info } = await img.flatten({ background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true })
  if (crop) {
    const left = Math.round(crop.x * info.width)
    const top = Math.round(crop.y * info.height)
    const width = Math.max(1, Math.min(info.width - left, Math.round(crop.w * info.width)))
    const height = Math.max(1, Math.min(info.height - top, Math.round(crop.h * info.height)))
    ;({ data, info } = await sharp(data, { raw: info }).extract({ left, top, width, height }).raw().toBuffer({ resolveWithObject: true }))
  }
  return { data, info }
}
const fromRaw = ({ data, info }) => sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
// Write to a temp name, then rename — an interrupted run never leaves a
// half-written file that later runs would skip as "already done".
async function writeAtomic(pipeline, out) {
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const tmp = `${out}.tmp-${process.pid}`
  await pipeline.toFile(tmp)
  fs.renameSync(tmp, out)
}

// Returns a media object: { kind, src, srcSet, width, height, placeholder }.
// Fields are filled in when the job runs (before content.js is written).
function media(file, scope, id, opts = {}) {
  const kind = opts.kind === 'drawing' ? 'drawing' : 'photo'
  const params = { rotation: opts.rotation ?? 0, crop: opts.crop ?? null, kind }
  const base = `${scope}/${id}.${hashOf(file, params)}`
  const result = { kind }
  jobs.push({
    file,
    run: async () => {
      const raw = await decoded(file, params)
      const W = raw.info.width
      const H = raw.info.height
      const cap = kind === 'drawing' ? MAX_DRAWING_WIDTH : MAX_PHOTO_WIDTH
      const top = Math.min(W, cap)
      const widths = [...new Set([...PHOTO_WIDTHS.filter((w) => w < top), top])].sort((a, b) => a - b)
      // Drawings stay JPEG at high quality: fine dimension text under room labels
      // is barely legible even at full resolution (confirmed on a real phone).
      const ext = kind === 'drawing' ? 'jpg' : 'webp'
      const entries = []
      for (const w of widths) {
        const rel = `${base}-${w}.${ext}`
        const out = path.join(MEDIA_OUT, rel)
        produced.add(rel)
        entries.push({ w, url: `/_media/${rel}` })
        if (fs.existsSync(out)) continue
        const pipe = fromRaw(raw).resize({ width: w, withoutEnlargement: true })
        await writeAtomic(kind === 'drawing' ? pipe.jpeg({ quality: 95, mozjpeg: true }) : pipe.webp({ quality: 80 }), out)
      }
      result.width = top
      result.height = Math.round((H * top) / W)
      result.src = entries[entries.length - 1].url
      result.srcSet = entries.map((e) => `${e.url} ${e.w}w`).join(', ')
      if (kind === 'photo') {
        const tiny = await fromRaw(raw).resize({ width: 16 }).webp({ quality: 40 }).toBuffer()
        result.placeholder = `data:image/webp;base64,${tiny.toString('base64')}`
      }
    },
  })
  return result
}

function shareImage(file, opts) {
  const rel = `share.${hashOf(file, { ...opts, share: true })}.jpg`
  produced.add(rel)
  jobs.push({
    file,
    run: async () => {
      const out = path.join(MEDIA_OUT, rel)
      if (fs.existsSync(out)) return
      await writeAtomic(fromRaw(await decoded(file, opts)).resize({ width: 1200, height: 630, fit: 'cover' }).jpeg({ quality: 82, mozjpeg: true }), out)
    },
  })
  return `${SITE_URL}/_media/${rel}`
}

const imageOpts = (img) => ({ kind: img.type === 'drawing' ? 'drawing' : 'photo', rotation: img.rotation, crop: img.crop })

const outProjects = projects
  .map(({ data: p }) => p)
  .filter((p) => !p.deleted)
  .sort((a, b) => a.order - b.order)
  .map((p) => ({
    ...p,
    pool: p.pool
      .filter((img) => !img.hidden)
      .map((img) => ({ ...img, media: media(path.join(MEDIA_SRC, 'projects', p.slug, img.file), `projects/${p.slug}`, img.id, imageOpts(img)) })),
  }))

const outUnsorted = (unsorted?.pool || [])
  .filter((img) => !img.hidden)
  .map((img) => ({ ...img, media: media(path.join(MEDIA_SRC, 'unsorted', img.file), 'unsorted', img.id, imageOpts(img)) }))

// Tej first, always, whatever order the file lists people in.
const people = [...founders.people].sort((a, b) => (a.id === FOUNDER_ID ? -1 : b.id === FOUNDER_ID ? 1 : 0))
const outFounders = {
  ...founders,
  people: people.map((f) => ({
    ...f,
    photo: f.photo ? { ...f.photo, media: media(path.join(MEDIA_SRC, 'founders', f.photo.file), 'founders', f.id, { crop: f.photo.crop }) } : null,
  })),
}

const shareSpot = site.homepage.shareImage
const shareProject = slugs.get(shareSpot.project)
const shareImg = pools.get(shareProject.slug).get(shareSpot.image ?? shareProject.cover.image)
const shareUrl = shareImage(path.join(MEDIA_SRC, 'projects', shareProject.slug, shareImg.file), { rotation: shareImg.rotation ?? 0, crop: shareImg.crop ?? null })

const started = Date.now()
const queue = [...jobs]
const jobErrors = []
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const job = queue.shift()
      try {
        await job.run()
      } catch (e) {
        jobErrors.push(`${path.relative(ROOT, job.file)}: couldn't process this image (${e.message.split('\n')[0]}) — re-upload it as a JPG or PNG`)
      }
    }
  }),
)
if (jobErrors.length) stop(jobErrors)

// Remove derivatives nothing references any more (old hashes, deleted images).
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]))
let removed = 0
for (const f of walk(MEDIA_OUT)) {
  if (!produced.has(path.relative(MEDIA_OUT, f).split(path.sep).join('/'))) {
    fs.unlinkSync(f)
    removed++
  }
}

// ---------------------------------------------------------------- write
fs.mkdirSync(GENERATED, { recursive: true })
const header = '// GENERATED by scripts/build-content.mjs from content/ — do not edit by hand.\n'
fs.writeFileSync(
  path.join(GENERATED, 'content.js'),
  header +
    `export const site = ${JSON.stringify(site, null, 2)}\n\n` +
    `export const founders = ${JSON.stringify(outFounders, null, 2)}\n\n` +
    `export const projects = ${JSON.stringify(outProjects, null, 2)}\n\n` +
    `export const unsorted = ${JSON.stringify(outUnsorted, null, 2)}\n`,
)
const sameAs = SOCIALS.filter((k) => k !== 'whatsapp' && site.socials[k].on).map((k) => site.socials[k].url)
fs.writeFileSync(path.join(GENERATED, 'meta.json'), JSON.stringify({ shareImage: shareUrl, sameAs }, null, 2) + '\n')

const redirects = ['# GENERATED by scripts/build-content.mjs — do not edit by hand.']
// Keep the pre-v1 share-image URL (cached by link previews) working.
redirects.push(`/images/citadel-tower/exterior-landscape.jpg ${new URL(shareUrl).pathname} 302`)
fs.writeFileSync(path.join(ROOT, 'public', '_redirects'), redirects.join('\n') + '\n')

console.log(
  `✓ Content OK — ${outProjects.length} projects, ${produced.size} image files (${jobs.length} source images, ` +
    `${removed} stale removed) in ${((Date.now() - started) / 1000).toFixed(1)}s`,
)
