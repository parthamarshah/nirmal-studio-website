# Build progress

Section-by-section log. Update this after each phase lands. Full context/decisions
live in `CLAUDE.md` — read that first if you're picking this up cold.

## Resume here

Next up: **Task #8 — Process horizontal-scroll journey** (Section 8:
Discovery→...→Completion). Build mobile-first, run `npm run build && npm run lint`,
deploy via `npx wrangler pages deploy dist --project-name nirmal-studio-website`,
commit + push, update this file.

Everything below is committed and pushed to `main`
(`github.com/parthamarshah/nirmal-studio-website`) and deployed at
`nirmal-studio-website.pages.dev` as of the last session.

## Done

- **Foundation** — Vite + React (plain JS) scaffolded. Installed `gsap`, `lenis`,
  `framer-motion`. Wired Lenis + GSAP ScrollTrigger scroll stack (`src/lib/scroll.js`),
  respecting `prefers-reduced-motion`. Global palette/type/spacing tokens
  (`src/styles/tokens.css`) using the brief's cream/bronze/stone/beige palette —
  heading font is a serif placeholder pending the font-comparison pass. Content-as-data
  files created for projects, founders/FOLD, journal, testimonials
  (`src/data/*.js`) — journal and testimonials are empty arrays on purpose. Fixed a
  ticker-leak bug, a cursor-invisible-on-load bug, and a src/assets image-path
  convention that would have 404'd in production — see git log for details.
- **Repo + deploy pipeline** — pushed to
  `github.com/parthamarshah/nirmal-studio-website`. Wrangler CLI authenticated against
  the "Gurjar" Cloudflare account. Pages project `nirmal-studio-website` created and
  verified live at `nirmal-studio-website.pages.dev` (deploy via `npx wrangler pages
  deploy dist --project-name nirmal-studio-website` after each build phase).
  `nirmalstudio.com` custom domain is deliberately NOT yet attached — still showing
  Parth's Lovable placeholder until Hero is ready.
- **Fonts chosen** — Fraunces (heading), Syne (wordmark), via a live visual comparison
  page deployed to Pages and reviewed by Parth (page since deleted, decision baked into
  `src/styles/tokens.css` and `index.html`'s Google Fonts link).
- **Loader + Hero + Statement** — black-screen wordmark loader (skips entirely for
  `prefers-reduced-motion`), full-bleed Hero with a slow Ken Burns zoom on the Citadel
  Tower render (landscape for desktop, portrait crop for mobile via `<picture>`),
  scroll-triggered Statement fade-in. Extracted the Citadel Tower images from the
  source PDF into `public/images/citadel-tower/` — confirmed they actually resolve in
  the production build (`curl` 200, not just `npm run dev`). Added `scrollTo()` to
  `src/lib/scroll.js` (routes in-page navigation through Lenis instead of a native
  anchor jump, so scroll state doesn't desync) and a `--z-loader` token.
- **Custom cursor built, then removed** — a mouse-follow custom cursor was built
  (fixing two rounds of "invisible cursor" bugs along the way), then Parth reviewed it
  live and preferred the plain native cursor. Deleted `CustomCursor.jsx` and all
  related CSS/attributes/tokens entirely (not disabled — fully removed). See
  `CLAUDE.md`'s "No custom cursor" note — don't reintroduce without him asking again.
- **Focus-Image + Philosophy split-screen** — Section 3 (`FocusImage.jsx`): full-bleed
  scroll-scrubbed-parallax photo of the Terra Row Houses render (a father and son
  walking in), with a plain project-credit caption (name/type/location) rather than
  more "people/life" copy, since Hero and Philosophy already cover that idea. Section 4
  (`Philosophy.jsx`): split-screen, stacked on mobile/side-by-side from 768px, philosophy
  copy touching light/movement/context/materials/climate/vastu/lifestyle plus a row of
  theme tags. No real sketch/tracing-paper photography exists yet for the image half —
  used the Dolomite/Calcite Factory Office interior render instead (real project
  imagery, chosen because its stone/wood materiality actually matches the copy) behind
  a single swappable `project.heroImage` path, same pattern as Hero's media. While in
  the source PDF for these two, extracted every remaining image for all 7 confirmed
  projects (27 files, `public/images/<slug>/gallery-N.jpg`, via a one-off PyMuPDF
  script — `pdftoppm`/`pdfimages`/ImageMagick aren't installed on this machine,
  `pip install pymupdf` was) and listed them in each project's `gallery` array in
  `src/data/projects.js` — Task #9 (Featured Projects) now has real imagery for every
  project to pick from, not just this task's two curated picks (`heroImage` stays null
  for the 3 projects with no dedicated hero shot chosen yet — that's still a Task #9
  curation call, not this task's). Hero's CTA now points at `#philosophy` instead of
  `#statement`, since Philosophy is a better fit for "Our Approach" copy than the
  single-sentence Statement was.
- **Two new confirmed projects: Shimla House + Nishee House** — Parth confirmed these
  as genuine current Nirmal Studio work, sourced directly from him (not the PDF): a
  real floor-plan drawing for each (`public/images/shimla-house/` and
  `nishee-house/drawings-ground-floor.jpg`, one with "Architect: Nirmal Studio" on the
  title block) plus 11 AI-generated concept-visualization images he shared, which are
  explicitly **not** real design output — stored separately as `conceptArt` in
  `projects.js` (shared across both projects, since there's no way to tell which room
  belongs to which house from the files) and must always render with a visible
  "concept visualization" label, never mixed into `gallery`/`heroImage`. See
  `CLAUDE.md`'s Content rules for the full constraint — read that before touching
  either project's imagery. Confirmed project count is now 9, not 7.
- **Idea-to-Home timeline** (`IdeaTimeline.jsx`) — vertical scroll-reveal timeline,
  6 stages (Idea/Sketch/Model/Drawings/Construction/Finished Home), typographic per
  Parth's call except "Drawings," which shows the real Nishee House floor plan
  (`project.drawings`, content-as-data like every other section) cropped to drop the
  title block so the plan itself fills the frame — legible at desktop width (~700px),
  but the image displays at roughly 20% scale on a 375px phone and dimension-text
  legibility there is **unverified** (no visual QA was done this session — see below).
  If it reads as illegible on a real phone, the fix is either full-bleed width on
  mobile or a tap-to-enlarge, not a smaller crop. Note for Task #9: only Nishee
  House's drawing was cropped this way — Shimla House's (`public/images/shimla-house/
  drawings-ground-floor.jpg`) is still the full sheet with its title block, so the two
  will look inconsistent side by side until that's reconciled. A bronze line grows
  down a connecting
  track as you scroll, in sync with each stage fading in. Two real GSAP bugs came out
  of review and are now documented in
  CLAUDE.md's known-incident list so they don't recur silently: a `ScrollTrigger`
  `start`/`end` expressed as a fixed viewport percentage can be unreachable when the
  trigger element is the last thing on the page (the line could never finish filling,
  and the last stage could get stuck invisible on tall viewports) — fixed by prefixing
  values with `clamp(...)`. Also added the inline-style-beats-media-query cascade rule
  (from the Philosophy fix earlier this session) to that same list, since it wasn't
  written down anywhere before now.

## Not started yet

- Featured Projects immersive storytelling section (raw image extraction from the PDF
  is done for all 7 projects — see `Done` above — but curating which shots become each
  project's hero/gallery lead, and writing challenge/materials/construction copy, is
  still this task's job)
- Studio (Tej Shah) + Network (FOLD) sections
- Process horizontal-scroll journey
- Journal + Testimonials (hidden until real content exists)
- Contact section
- Polish pass (perf/accessibility/SEO) + final comparison against the Lovable baseline video

## How to preview

```
npm run dev
```
