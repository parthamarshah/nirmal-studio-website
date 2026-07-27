# Build progress

Section-by-section log. Update this after each phase lands. Full context/decisions
live in `CLAUDE.md` — read that first if you're picking this up cold.

## Resume here

Next up: **Task #6 — Focus-Image + Philosophy split-screen sections** (Section 3:
full-screen photography with minimal text; Section 4: split-screen with
sketches/tracing-paper imagery on one side, philosophy copy — light, movement,
context, materials, climate, vastu, lifestyle — on the other). Build mobile-first,
run `npm run build && npm run lint`, deploy via `npx wrangler pages deploy dist
--project-name nirmal-studio-website`, commit + push, update this file.

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

## Not started yet

- Focus-Image + Philosophy split-screen
- Idea-to-Home animated timeline
- Extract project images from `Fold Architects_2.pdf`
- Featured Projects immersive storytelling section
- Studio (Tej Shah) + Network (FOLD) sections
- Process horizontal-scroll journey
- Journal + Testimonials (hidden until real content exists)
- Contact section
- Polish pass (perf/accessibility/SEO) + final comparison against the Lovable baseline video

## How to preview

```
npm run dev
```
