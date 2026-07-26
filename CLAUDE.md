# Nirmal Studio Website — Project Context

Read this before doing anything else in this repo. It captures decisions made during
an extensive planning conversation — don't re-litigate them without new input from
Parth. See `progress.md` for what's actually been built so far.

## What this is

The public website for **Nirmal Studio**, the personal architecture practice of
**Tej Shah**, at `nirmalstudio.com`. A cinematic, editorial, scroll-driven experience
(not a template portfolio) — inspired by Apple/Aesop/Porsche/Leica/Foster+Partners/BIG/
Studio MK27/Norm Architects, but **grounded in premium Indian urban residential and
commercial design** (primarily Western, Central, and Southern India — Ahmedabad,
Udaipur, Bangalore, Ajmer, Indore), not a copy of Western/Scandinavian minimalism.

Explicit bar to beat: an existing single-prompt Lovable draft
(`~/Downloads/WhatsApp Video 2026-07-21 at 18.21.04.mp4`). This needs to be decisively
better than that, not a marginal improvement.

## GitHub and Cloudflare are both already connected — self-serve these

- **GitHub**: this repo is pushed to `github.com/parthamarshah/nirmal-studio-website`
  and `git push`/`git pull` work directly, no `gh` CLI needed.
- **Cloudflare**: Wrangler CLI is authenticated (`npx wrangler whoami` confirms it)
  against the "Gurjar" account, with a `pages:write` scope. The `nirmal-studio-website`
  Pages project exists and deploys work via `npx wrangler pages deploy dist
  --project-name nirmal-studio-website`.
- **Do not ask Parth to do GitHub or Cloudflare dashboard steps** (creating things,
  pushing, deploying) — just run the commands directly. The only exception is
  attaching the `nirmalstudio.com` custom domain to the Pages project: that replaces
  whatever's currently live on the real domain, so confirm with him immediately before
  running `wrangler pages domain add` (see Task list / Deploy section below) — that's
  the one case where asking is mandatory, not optional.
- If a genuinely new Cloudflare/GitHub permission is needed beyond what's already
  authorized (e.g. a scope the current OAuth token doesn't cover), that's the other
  case where asking is unavoidable — otherwise, just proceed.

## Brand structure — do not misrepresent this

**Nirmal Studio = Tej Shah's personal brand/practice, not a multi-founder firm.**
**FOLD** is a separate, informal, *non-legal* network of four architects (Bhumika Tak,
Rachit Sinvhal, Tej Shah, Hardik Maheshwari) who collaborate project-by-project for
added scale/expertise/geography. Tej is a member of both.

On this site: Tej/Nirmal Studio gets primary billing. FOLD gets a real, substantial
secondary section (~3/4 the space of the Tej section) — but the other three FOLD
members must **never** be framed as co-founders of Nirmal Studio itself. That would
misrepresent the actual legal/brand structure.

Services: Architecture, Interior Design, Landscape Design.
Tagline: "Designing Spaces. Crafting Experiences."

## Content rules

- **Featured Projects**: only the "Ongoing" projects from
  `/Users/parth/Downloads/Fold Architects_2.pdf` count as genuine Nirmal Studio work —
  see `src/data/projects.js` for the confirmed list of 7. Everything else in that PDF
  is prior-firm work (@UA Lab, @Terrafirma, @Studio CC, @Stapati, @R+R) done by the
  four architects at their previous employers — **excluded**, not Nirmal Studio's to
  claim. All 7 confirmed projects are under construction — expect renders/plans, not
  finished-building photography.
- **Founder bios**: deep bio copy only for Tej Shah. The other three FOLD members use
  the PDF facts as-is (`src/data/founders.js`). Never invent years of experience,
  favourite material, or favourite architect for any of the four — not real facts we
  have, and these are real named people.
- **Journal & Testimonials**: no real content yet. Sections **hide entirely** from the
  site/nav when their data array is empty (`src/data/journal.js`,
  `src/data/testimonials.js`) — no "coming soon" placeholder. This was a deliberate
  choice: a placeholder undercuts the confident, non-marketing tone the brief itself
  asks for. The moment real entries are added to those data files, the sections should
  reappear with no component changes needed.
- **Contact**: Tej Shah, WhatsApp/phone `910 699 8434`, email `tej@nirmalstudio.com`.
  No office address yet for the map/office-photos part of Contact — placeholder until
  supplied.
- **Hero media**: no real video exists (all projects are under construction). Use a
  slow Ken Burns-style pan/zoom on a strong still render (e.g. Citadel Tower exterior)
  until/unless Parth supplies real generated video — media is a swappable asset, not
  something to rebuild the section around.

## Tech stack & architecture

- **Vite + React, plain JavaScript** (not TypeScript) — Parth is an "advanced vibe
  coder," not a professional dev; keep tooling friction low. Single-page app, all
  sections on one scrollable home route for now.
- **Mobile-first, not desktop-first-then-adapt.** Mobile is the primary "ultra smooth"
  target; desktop can be comparatively subdued but must feel equally polished. Build
  each section's mobile layout/interaction first, then layer desktop-only enhancements
  (parallax, custom cursor, pinning/scrub) on top.
- **Motion libraries have separate, non-overlapping jobs** (this avoids two systems
  fighting over scroll):
  - **Lenis** — smooth-scroll only, initialized once (`src/lib/scroll.js`).
  - **GSAP + ScrollTrigger** — all scroll-driven animation: pinning, scrub, parallax,
    mask reveals, split-text, image sequences. Synced to Lenis in the same file.
  - **Framer Motion** — mount/exit transitions and micro-interactions only (custom
    cursor, hover states). Never scroll-linked.
- **Content-as-data pattern**: components read from `src/data/*.js`. Adding/editing
  real content later should be a data edit, not a component rewrite.
- **Image paths go in `public/images/<slug>/...`, never `src/assets/`.** Files in
  `public/` are copied to the build output as-is, so a plain root-relative string path
  in a data file (e.g. `/images/citadel-tower/hero.jpg`) resolves correctly in both
  `npm run dev` and the production build. A path under `src/` works in dev (which
  serves all of `src/`) but silently 404s after `npm run build`, since Vite only
  bundles files that are actually `import`ed somewhere — a data file holding a bare
  string path never triggers that. Don't reintroduce `src/assets/images`.
- **Custom cursor hover attributes**: any interactive element that isn't already an
  `<a>`/`<button>` but should trigger the cursor's hover-scale can opt in with
  `data-cursor-hover`. An element that needs its *native* cursor back (e.g. something
  overlapping a form field visually) can opt out with `data-cursor-native`. Both are
  read by `src/components/CustomCursor.jsx` / `src/index.css`.
- Respect `prefers-reduced-motion`. `src/lib/scroll.js` already checks it and skips
  Lenis/ScrollTrigger init when set, and exports a `prefersReducedMotion()` helper for
  reuse. **The CSS block in `src/index.css` only covers CSS `animation`/`transition` —
  it has no effect on GSAP or Framer Motion, which both animate via inline
  transforms.** Every new component doing its own GSAP/Framer animation must call the
  `prefersReducedMotion()` helper itself before registering that animation — don't
  assume the CSS block covers it.
- Dark mode is explicitly **out of scope** (fixed cream `#F6F4EF` / `#111` palette) —
  don't add a toggle.

## Deploy

- Repo: `https://github.com/parthamarshah/nirmal-studio-website` (plain `git push`,
  no `gh` CLI/Homebrew on this machine).
- Cloudflare: Wrangler CLI is authenticated (`npx wrangler whoami`) against the
  "Gurjar" account (where `nirmalstudio.com`'s DNS actually lives — OAuth via
  `wrangler login` needs `dangerouslyDisableSandbox: true` on the Bash call, since the
  loopback callback server otherwise isn't reachable from the real browser).
- **Pages project**: `nirmal-studio-website`, already created, live at
  `https://nirmal-studio-website.pages.dev`. Deploy mechanism is direct CLI, not git
  integration: `npm run build && npx wrangler pages deploy dist --project-name
  nirmal-studio-website`. Run this after each build phase lands, alongside the git
  commit/push.
- **`nirmalstudio.com` custom domain is intentionally NOT yet attached** to this Pages
  project — the domain currently shows Parth's Lovable placeholder, and connecting it
  now would replace that with whatever's currently built (which was just the
  foundation placeholder text). Attach it once Hero is genuinely ready to be the
  public face of the site, via `npx wrangler pages domain add nirmalstudio.com
  --project-name nirmal-studio-website` (or the dashboard's Custom domains tab).

## Working style for this project

- Parth is an "advanced vibe coder" — curious, not a professional developer. Explain
  technical choices in plain language; avoid unexplained jargon. Prefer showing a
  visual comparison over describing visual choices in words when feasible (see the
  font-comparison task).
- Full planning history and rationale: `/Users/parth/.claude-personal/plans/elegant-frolicking-seal.md`
- Cross-session memory: `/Users/parth/.claude-personal/projects/-Users-parth-Documents-Projects-Nirmal-Studio-Website/memory/`
