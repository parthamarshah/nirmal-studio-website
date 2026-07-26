# Build progress

Section-by-section log. Update this after each phase lands. Full context/decisions
live in `CLAUDE.md` — read that first if you're picking this up cold.

## Done

- **Foundation** — Vite + React (plain JS) scaffolded. Installed `gsap`, `lenis`,
  `framer-motion`. Wired Lenis + GSAP ScrollTrigger scroll stack (`src/lib/scroll.js`),
  respecting `prefers-reduced-motion`. Custom cursor component (desktop/mouse only,
  `src/components/CustomCursor.jsx`). Global palette/type/spacing tokens
  (`src/styles/tokens.css`) using the brief's cream/bronze/stone/beige palette —
  heading font is a serif placeholder pending the font-comparison pass. Content-as-data
  files created for projects, founders/FOLD, journal, testimonials
  (`src/data/*.js`) — journal and testimonials are empty arrays on purpose.

## Not started yet

- Git init + push to `github.com/parthamarshah/nirmal-studio-website`
- Cloudflare Pages project creation + custom domain connection (needs Parth, dashboard access)
- Font comparison pass (heading serif + wordmark alternative to Stinger Wide)
- Loader + Hero + Statement sections
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
