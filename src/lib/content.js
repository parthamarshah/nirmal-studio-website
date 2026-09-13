// The one place components get content from. Reads src/generated/content.js
// (built from content/ by scripts/build-content.mjs) and exposes it in the
// shapes the current sections expect.
//
// Image fields are media objects ({ src, srcSet, width, height, placeholder,
// kind }), not path strings — render them with <Img> (src/components/Img.jsx).
//
// Phase 0 note: the legacy project shape below (heroImage / gallery / drawings
// / concept / challenge …) keeps today's takeover rendering identical. Phase 1
// renders a project's `sections` generically and most of this adapter goes away.
import { site, founders, projects as allProjects, unsorted } from '../generated/content.js'

export { site }

const plainText = (doc) =>
  doc?.content
    ?.map((block) => (block.content || []).map((n) => n.text || '').join(''))
    .filter(Boolean)
    .join('\n\n') || null

// Transitional (until Parth assigns each AI concept image to one house in the
// backend): the unsorted AI images keep showing, labelled, where they showed
// before. Phase 1's section renderer drops this — unassigned images show nowhere.
const LEGACY_CONCEPT_ART_SLUGS = ['shimla-house', 'nishee-house']

function toLegacy(p) {
  const image = (id) => p.pool.find((img) => img.id === id)?.media ?? null
  const section = (id) => p.sections.find((s) => s.id === id)
  const sectionImages = (id) => (section(id)?.images || []).map((ref) => image(ref.image)).filter(Boolean)
  return {
    slug: p.slug,
    name: p.name,
    hidden: p.hidden,
    type: p.facts.type,
    location: p.facts.city,
    siteArea: p.facts.siteArea,
    builtUpArea: p.facts.builtUpArea,
    concept: plainText(section('concept')?.body),
    heroImage: image(p.cover?.image),
    heroImageMobile: image(p.cover?.phoneImage),
    gallery: sectionImages('gallery'),
    challenge: plainText(section('challenge')?.body),
    drawings: sectionImages('drawings')[0] ?? null,
    materials: plainText(section('materials')?.body),
    construction: plainText(section('construction')?.body),
    conceptArt: LEGACY_CONCEPT_ART_SLUGS.includes(p.slug)
      ? unsorted.filter((img) => img.aiGenerated).map((img) => img.media)
      : [],
  }
}

const legacyProjects = allProjects.map(toLegacy)

// Projects shown in the Featured Projects grid (hidden ones stay out).
export const projects = legacyProjects.filter((p) => !p.hidden)

// Homepage image spots ('hero' | 'focus' | 'philosophy' | 'timeline'). Can be
// null if the picked project was removed — every caller already guards for that.
export const homepageProject = (spot) =>
  legacyProjects.find((p) => p.slug === site.homepage?.[spot]?.project) ?? null

export const isSectionOn = (key) => site.sections?.[key] !== false

// The build puts Tej (id "tej-shah") first and fails if he's missing, so the
// founder is never decided by list order alone.
const legacyPerson = (f) => ({ ...f, title: f.role })
export const tejShah = legacyPerson(founders.people.find((f) => f.id === 'tej-shah'))
export const foldNetwork = founders.people.filter((f) => f.id !== 'tej-shah').map(legacyPerson)

// Studio social links, only the switched-on ones (url or null per platform).
export const social = Object.fromEntries(
  Object.entries(site.socials || {})
    .filter(([key]) => key !== 'whatsapp')
    .map(([key, v]) => [key, v.on && v.url ? v.url : null]),
)
