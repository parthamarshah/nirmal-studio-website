// Confirmed Nirmal Studio commissions. The first 7 are the "Ongoing" projects
// in the source portfolio PDF (Fold Architects_2.pdf) — prior-firm work by
// the founders (@UA Lab, @Terrafirma, @Studio CC, @Stapati, @R+R) is
// intentionally excluded from that PDF's list, see project memory. Shimla
// House and Nishee House were added later, direct from Parth, sourced from
// real floor-plan drawings (not the PDF) — see the `conceptArt` note below
// for why their imagery is handled differently from the other 7.
//
// Fields left null are deliberate placeholders (drawings/construction/video/
// clientExperience aren't ready yet) — render them as absent, not fabricated.
// `challenge`/`materials`/`construction` copy on the 7 PDF projects is generic
// studio-voice language grounded only in already-confirmed facts (type,
// location, sqft, what's visible in the renders) — not specific claims Tej
// hasn't verified. Same flag as Philosophy/IdeaTimeline/Process's copy: needs
// his sign-off before treating it as final. Left null on Shimla/Nishee since
// their construction status isn't confirmed (see Content rules in CLAUDE.md)
// and a `construction` field is specifically a claim about build stage.
//
// Image paths are root-relative into public/images/<slug>/... (NOT
// src/assets) — files in public/ are copied to the build output as-is, so a
// plain string path here resolves correctly in both dev and the production
// build. A path under src/ would work in `npm run dev` (which serves all of
// src/) but silently 404 after `npm run build`, since Vite only bundles
// files that are actually `import`ed somewhere.
//
// `conceptArt` (Shimla House / Nishee House only) is AI-generated imagery,
// not real Nirmal Studio design output or photography — keep it out of
// `gallery`/`heroImage`, which every other project's consumer treats as real
// project imagery. Any component that renders `conceptArt` MUST visibly
// label it as concept visualization, not present it like `gallery`. The same
// 11 images are shared across both projects because there's no reliable way
// to tell which room belongs to which house from the files themselves.
const SHIMLA_NISHEE_CONCEPT_ART = Array.from(
  { length: 11 },
  (_, i) => `/images/shimla-nishee-concept/concept-${i + 1}.jpg`,
)

export const projects = [
  {
    slug: 'citadel-tower',
    name: 'The Citadel Tower',
    type: 'Commercial',
    location: 'Indore',
    siteArea: '2,400 sqft',
    builtUpArea: '9,600 sqft',
    concept:
      'An ongoing commercial tower bringing ground-floor retail and café life to the street, with upper-floor offices set behind a textured, plant-softened façade.',
    heroImage: '/images/citadel-tower/exterior-landscape.jpg',
    heroImageMobile: '/images/citadel-tower/exterior-portrait.jpg',
    gallery: [
      '/images/citadel-tower/gallery-1.jpg',
      '/images/citadel-tower/gallery-2.jpg',
      '/images/citadel-tower/gallery-3.jpg',
    ],
    challenge:
      'A commercial address that needed to work at two different speeds — ground-floor retail and café life that reads at street level, and upper-floor offices that stay calm and private above it, on a tight 2,400 sqft footprint carrying a 9,600 sqft tower.',
    drawings: null,
    materials:
      "A textured, plant-softened façade breaks up the tower's mass and filters Indore's harsh sun without the building hiding behind heavy shading.",
    construction: 'Currently under construction — structure and façade work progressing on site.',
    video: null,
    clientExperience: null,
  },
  {
    slug: 'terra-row-houses',
    name: 'Terra Row Houses',
    type: 'Residential',
    location: 'Indore',
    siteArea: '3,000 sqft',
    builtUpArea: '5,300 sqft',
    concept: 'An ongoing row-house development in Indore.',
    heroImage: '/images/terra-row-houses/exterior-landscape.jpg',
    heroImageMobile: '/images/terra-row-houses/exterior-portrait.jpg',
    gallery: ['/images/terra-row-houses/gallery-1.jpg'],
    challenge:
      'Fitting genuinely private, full-sized homes into a row-house format — shared party walls without the compressed, look-alike feel row housing often falls into.',
    drawings: null,
    materials:
      "Materials chosen to give each unit its own identity within a consistent street rhythm — warm textures rather than one finish repeated across every façade.",
    construction: 'Currently under construction.',
    video: null,
    clientExperience: null,
  },
  {
    slug: 'agrawals-office',
    name: "Agrawal's Office",
    type: 'Office Interior',
    location: 'Indore',
    siteArea: null,
    builtUpArea: '300 sqft',
    concept: 'An ongoing office interior fit-out in Indore.',
    heroImage: '/images/agrawals-office/gallery-3.jpg',
    gallery: [
      '/images/agrawals-office/gallery-1.jpg',
      '/images/agrawals-office/gallery-2.jpg',
      '/images/agrawals-office/gallery-4.jpg',
      '/images/agrawals-office/gallery-5.jpg',
      '/images/agrawals-office/gallery-6.jpg',
    ],
    challenge:
      'A working professional office in a compact 300 sqft footprint — every square foot had to double up, without the space ever feeling cramped or purely functional.',
    drawings: null,
    materials: 'Warm wood panelling, marble accents, and soft upholstery, chosen to read as considered rather than corporate.',
    construction: 'Fit-out currently underway.',
    video: null,
    clientExperience: null,
  },
  {
    slug: 'jewelry-store',
    name: 'Jewelry Store',
    type: 'Showroom Interior',
    location: 'Ahmedabad',
    siteArea: null,
    builtUpArea: '660 sqft',
    concept: 'An ongoing showroom interior in Ahmedabad.',
    // gallery-3, not gallery-1 — gallery-1 has the client's "KOHIRAA" store
    // signage clearly legible, and this data file deliberately doesn't name
    // the client (see plan doc). Keeping the un-badged shot as the primary/
    // card-level image; the branded shot still exists further into the
    // gallery, same exposure level every other project's incidental branding
    // gets, just not promoted to the payoff frame.
    heroImage: '/images/jewelry-store/gallery-3.jpg',
    gallery: [
      '/images/jewelry-store/gallery-1.jpg',
      '/images/jewelry-store/gallery-2.jpg',
      '/images/jewelry-store/gallery-4.jpg',
    ],
    challenge:
      "A showroom that has to hold a client's attention on individual pieces of jewellery — the space needed to recede, not compete, while still feeling distinctly premium.",
    drawings: null,
    materials: 'Warm brass detailing, soft rose-toned surfaces, and focused display lighting built around the merchandise itself.',
    construction: 'Fit-out currently underway.',
    video: null,
    clientExperience: null,
  },
  {
    slug: 'law-office',
    name: 'Law Office',
    type: 'Office Interior',
    location: 'Ahmedabad',
    siteArea: null,
    builtUpArea: '350 sqft',
    concept: 'An ongoing office interior in Ahmedabad.',
    heroImage: '/images/law-office/gallery-3.jpg',
    gallery: [
      '/images/law-office/gallery-1.jpg',
      '/images/law-office/gallery-2.jpg',
      '/images/law-office/gallery-4.jpg',
    ],
    challenge:
      "A small legal practice's office needed to feel unhurried and private in 350 sqft, without losing the working efficiency a busy practice depends on.",
    drawings: null,
    materials: 'Timber screening and warm, textured finishes soften what could otherwise read as a purely transactional office.',
    construction: 'Fit-out currently underway.',
    video: null,
    clientExperience: null,
  },
  {
    slug: 'dolomite-factory-office',
    name: 'Dolomite/Calcite Factory Office',
    type: 'Office Interior',
    location: 'Udaipur',
    siteArea: null,
    builtUpArea: '1,000 sqft',
    concept: 'An ongoing factory office interior in Udaipur.',
    heroImage: '/images/dolomite-factory-office/interior-office.jpg',
    gallery: [
      '/images/dolomite-factory-office/gallery-1.jpg',
      '/images/dolomite-factory-office/gallery-2.jpg',
      '/images/dolomite-factory-office/gallery-3.jpg',
      '/images/dolomite-factory-office/gallery-4.jpg',
    ],
    challenge:
      'An office attached to a working factory that needed its own calm identity — distinct from the industrial floor around it, without feeling disconnected from it.',
    drawings: null,
    materials:
      "Stone and wood surfaces that nod to the client's own material — dolomite and calcite — carried through as a quiet material language across the interior.",
    construction: 'Fit-out currently underway.',
    video: null,
    clientExperience: null,
  },
  {
    slug: 'gurjars-house-extension',
    name: "Gurjar's House Extension",
    type: 'Residential Interior',
    location: 'Udaipur',
    siteArea: null,
    builtUpArea: '2,500 sqft',
    concept: 'An ongoing residential extension in Udaipur.',
    heroImage: '/images/gurjars-house-extension/interior-bedroom.jpg',
    gallery: [
      '/images/gurjars-house-extension/gallery-1.jpg',
      '/images/gurjars-house-extension/gallery-2.jpg',
      '/images/gurjars-house-extension/gallery-3.jpg',
      '/images/gurjars-house-extension/gallery-4.jpg',
      '/images/gurjars-house-extension/gallery-5.jpg',
    ],
    challenge:
      "Extending a lived-in family home without it reading as an addition — the new 2,500 sqft had to feel like it always belonged.",
    drawings: null,
    materials: 'Materials matched and continued from the existing house, rather than introduced as a visibly newer layer.',
    construction: 'Currently under construction.',
    video: null,
    clientExperience: null,
  },
  {
    slug: 'shimla-house',
    name: 'Shimla House',
    type: 'Residential',
    location: 'Ahmedabad',
    siteArea: null,
    builtUpArea: null,
    concept: 'A residential home in Ahmedabad.',
    heroImage: null,
    gallery: [],
    conceptArt: SHIMLA_NISHEE_CONCEPT_ART,
    challenge: null,
    drawings: '/images/shimla-house/drawings-ground-floor.jpg',
    materials: null,
    construction: null,
    video: null,
    clientExperience: null,
  },
  {
    slug: 'nishee-house',
    name: 'Nishee House',
    type: 'Residential',
    location: 'Ahmedabad',
    siteArea: null,
    builtUpArea: null,
    concept: 'A residential home in Ahmedabad.',
    heroImage: null,
    gallery: [],
    conceptArt: SHIMLA_NISHEE_CONCEPT_ART,
    challenge: null,
    drawings: '/images/nishee-house/drawings-ground-floor.jpg',
    materials: null,
    construction: null,
    video: null,
    clientExperience: null,
  },
]
