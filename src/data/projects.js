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
    challenge: null,
    drawings: null,
    materials: null,
    construction: null,
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
    challenge: null,
    drawings: null,
    materials: null,
    construction: null,
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
    heroImage: null,
    gallery: [
      '/images/agrawals-office/gallery-1.jpg',
      '/images/agrawals-office/gallery-2.jpg',
      '/images/agrawals-office/gallery-3.jpg',
      '/images/agrawals-office/gallery-4.jpg',
      '/images/agrawals-office/gallery-5.jpg',
      '/images/agrawals-office/gallery-6.jpg',
    ],
    challenge: null,
    drawings: null,
    materials: null,
    construction: null,
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
    heroImage: null,
    gallery: [
      '/images/jewelry-store/gallery-1.jpg',
      '/images/jewelry-store/gallery-2.jpg',
      '/images/jewelry-store/gallery-3.jpg',
      '/images/jewelry-store/gallery-4.jpg',
    ],
    challenge: null,
    drawings: null,
    materials: null,
    construction: null,
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
    heroImage: null,
    gallery: [
      '/images/law-office/gallery-1.jpg',
      '/images/law-office/gallery-2.jpg',
      '/images/law-office/gallery-3.jpg',
      '/images/law-office/gallery-4.jpg',
    ],
    challenge: null,
    drawings: null,
    materials: null,
    construction: null,
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
    challenge: null,
    drawings: null,
    materials: null,
    construction: null,
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
    challenge: null,
    drawings: null,
    materials: null,
    construction: null,
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
