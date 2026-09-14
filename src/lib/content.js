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

export const SITE_URL = 'https://nirmalstudio.com'
// Trailing slash: the pre-rendered file is projects/<slug>/index.html, and
// Cloudflare Pages serves directory pages at the slashed address.
export const projectPath = (slug) => `/projects/${slug}/`
export const projectUrl = (slug) => `${SITE_URL}${projectPath(slug)}`
