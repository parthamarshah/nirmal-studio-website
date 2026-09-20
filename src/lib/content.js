// The one place components get content from. Reads src/generated/content.js
// (built from content/ by scripts/build-content.mjs) and exposes it in the
// shapes components need.
//
// Image fields are media objects ({ src, srcSet, width, height, placeholder,
// kind }), not path strings — render them with <Img> (src/components/Img.jsx).
// Everything the build validates (facts, sections, cover, founders' Tej entry…)
// can be read here without guards; anything optional is guarded.
import { site, founders, projects as allProjects, unsorted } from '../generated/content.js'

export { site }

export const STATUS_LABELS = {
  concept: 'In design',
  'under-construction': 'Under construction',
  completed: 'Completed',
}

export const IMAGE_TYPE_LABELS = {
  render: 'Render',
  drawing: 'Drawing',
  photograph: 'Photograph',
  'site-progress': 'Site progress',
  other: 'Other',
}

// ---------------------------------------------------------------- projects (story model)

// Projects in site order, including hidden ones (hidden = not in the grid, no page).
const storyProjects = allProjects

// Visible projects, in order — the grid, project pages, prev/next.
export const visibleProjects = storyProjects.filter((p) => !p.hidden)

// Every project in site order, hidden ones INCLUDED. The public site must never use
// this — it wants `visibleProjects`. The /admin editor needs it, because a hidden
// project is exactly the thing you go into the editor to un-hide. Exported here rather
// than letting /admin read src/generated/content.js directly: CLAUDE.md's rule is that
// content reaches components only through this adapter, and the Phase 1a incident
// (a rewrite silently dropping fields a second consumer relied on) is what the rule is
// for.
export const projectsIncludingHidden = storyProjects

export const findVisibleProject = (slug) => visibleProjects.find((p) => p.slug === slug) ?? null

// Resolves a section's image references to pool entries (hidden images are
// already absent from the generated pool, so they simply drop out).
export const sectionImages = (project, section) =>
  section.images
    .map((ref) => {
      const img = project.pool.find((i) => i.id === ref.image)
      return img ? { ...img, shape: ref.shape } : null
    })
    .filter(Boolean)

// Transitional, until Parth assigns each AI concept image to exactly one house
// in the backend (Phase 3): the unassigned AI images keep showing, labelled, in
// the homepage takeover for the two houses where they showed before. NOT on the
// standalone project pages (ProjectStory's `showLegacyConceptArt`), which are
// public, shareable and in the sitemap — his rule is each image on one house only.
const LEGACY_CONCEPT_ART_SLUGS = ['shimla-house', 'nishee-house']
export const legacyConceptArt = (slug) =>
  LEGACY_CONCEPT_ART_SLUGS.includes(slug) ? unsorted.filter((img) => img.aiGenerated) : []

// The picture that represents a project on cards: its cover, else its first drawing.
export function cardImage(project) {
  if (project.coverMedia.desktop) return { media: project.coverMedia.desktop, isDrawing: false }
  for (const section of project.sections) {
    const drawing = sectionImages(project, section).find((img) => img.type === 'drawing')
    if (drawing) return { media: drawing.media, isDrawing: true }
  }
  return null
}

// ---------------------------------------------------------------- homepage sections

// The shape Hero / FocusImage / Philosophy / IdeaTimeline were written against.
function toHomeShape(p, imageOverride) {
  const firstDrawing = p.sections.flatMap((s) => sectionImages(p, s)).find((img) => img.type === 'drawing')
  return {
    slug: p.slug,
    name: p.name,
    type: p.facts.type,
    location: p.facts.city,
    status: STATUS_LABELS[p.facts.status] ?? null,
    heroImage: imageOverride ?? p.coverMedia.desktop,
    heroImageMobile: imageOverride ? null : p.coverMedia.phone,
    drawings: firstDrawing?.media ?? null,
  }
}

// Homepage image spots ('hero' | 'focus' | 'philosophy' | 'timeline'). A spot can
// name a specific image of the project; otherwise it uses the project's cover.
// Null if the picked project was removed — every caller guards for that.
export const homepageProject = (spot) => {
  const pick = site.homepage?.[spot]
  const p = storyProjects.find((x) => x.slug === pick?.project)
  if (!p) return null
  const override = pick.image ? p.pool.find((img) => img.id === pick.image)?.media : null
  return toHomeShape(p, override)
}

export const isSectionOn = (key) => site.sections?.[key] !== false

// ---------------------------------------------------------------- people & contact

// The build puts Tej (id "tej-shah") first and fails if he's missing, so the
// founder is never decided by list order alone.
const legacyPerson = (f) => ({ ...f, title: f.role })
export const tejShah = legacyPerson(founders.people.find((f) => f.id === 'tej-shah'))
export const foldNetwork = founders.people.filter((f) => f.id !== 'tej-shah').map(legacyPerson)

// The v1 founders section (Founders.jsx): everyone, Tej first (the build sorts).
export const people = founders.people
export const foundersIntro = founders.intro
// No placeholders on the live site: the new section only switches on once every
// person has a real photo and bio. Until then Studio.jsx keeps the older layout.
export const foundersReady = people.length > 0 && people.every((p) => p.photo?.media && p.bio?.trim())

// A person's switched-on contact links, in display order.
export const personContacts = (p) =>
  [
    ['whatsapp', 'WhatsApp', (v) => `https://wa.me/${v.replace(/\D/g, '')}`],
    ['email', 'Email', (v) => `mailto:${v}`],
    ['linkedin', 'LinkedIn', (v) => v],
    ['instagram', 'Instagram', (v) => v],
  ]
    .filter(([key]) => p.contacts?.[key]?.on && p.contacts[key].value)
    .map(([key, label, href]) => ({ key, label, href: href(p.contacts[key].value) }))

// Studio social links, only the switched-on ones (url or null per platform).
export const social = Object.fromEntries(
  Object.entries(site.socials || {})
    .filter(([key]) => key !== 'whatsapp')
    .map(([key, v]) => [key, v.on && v.url ? v.url : null]),
)

// ---------------------------------------------------------------- talk to Tej

const DEFAULT_GREETING = 'Hi Tej, I’d like to talk about a project.'
export const whatsappGreeting = () => site.contact.whatsappGreeting?.trim() || DEFAULT_GREETING
export const whatsappUrl = (text = whatsappGreeting()) => `https://wa.me/${site.contact.whatsapp}?text=${encodeURIComponent(text)}`
export const whatsappWebUrl = (text = whatsappGreeting()) =>
  `https://web.whatsapp.com/send?phone=${site.contact.whatsapp}&text=${encodeURIComponent(text)}`
export const mapsUrl = () => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.contact.address)}`

// "Desktop" for the purpose of WHICH WHATSAPP LINK to hand someone — deliberately not
// width alone: a phone in landscape is ~930px CSS wide, and web.whatsapp.com does not
// work on a phone. Layout breakpoints are a separate question and stay width-only.
// Mirrored by the `@media (min-width: 768px) and (pointer: fine)` blocks in
// TalkToTej.jsx and Contact.jsx — change all three together.
export const DESKTOP_POINTER = '(min-width: 768px) and (pointer: fine)'

// The first message the helper writes: the studio greeting, then what the
// visitor picked. `what`/`stage` are helper options ({ label, says }) or null.
export function composeMessage({ what, city, stage }) {
  // Slice by CHARACTERS, not UTF-16 code units: a plain .slice(40) can cut an emoji's
  // surrogate pair in half, and encodeURIComponent then throws URIError on the broken
  // half — at render time, on an href, which would white-screen a project page.
  const place = city ? [...city.replace(/\s+/g, ' ').trim()].slice(0, 40).join('') : ''
  const parts = [whatsappGreeting()]
  if (what?.says) parts.push(`It’s ${what.says}${place ? ` in ${place}` : ''}.`)
  else if (place) parts.push(`It’s in ${place}.`)
  if (stage?.says) parts.push(stage.says)
  return parts.join(' ')
}

export const SITE_URL = 'https://nirmalstudio.com'
// Trailing slash: the pre-rendered file is projects/<slug>/index.html, and
// Cloudflare Pages serves directory pages at the slashed address.
export const projectPath = (slug) => `/projects/${slug}/`
export const projectUrl = (slug) => `${SITE_URL}${projectPath(slug)}`
