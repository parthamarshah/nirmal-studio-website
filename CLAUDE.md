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
- Respect `prefers-reduced-motion` — already handled at the scroll-stack level
  (`src/lib/scroll.js`) and in global CSS (`src/index.css`); any new component doing
  its own GSAP/Framer animation should check this too.
- Dark mode is explicitly **out of scope** (fixed cream `#F6F4EF` / `#111` palette) —
  don't add a toggle.

## Deploy

- Repo: `https://github.com/parthamarshah/nirmal-studio-website`
- Cloudflare Pages: `nirmalstudio.com` is on Cloudflare (account "Gurjar") but as of
  planning, **no Pages project was bound to it** — a new Pages project needs creating
  and connecting to the GitHub repo, then the custom domain added to it. This requires
  Parth's Cloudflare dashboard access, done step-by-step, not something Claude can do
  via CLI (no `gh`/Homebrew on this machine either — plain `git` is what's used).
  Build command: `npm run build`, output directory: `dist`. Node version pinned via
  `.node-version` / `package.json` engines — set `NODE_VERSION` in the Cloudflare Pages
  dashboard to match if the build fails on Node version detection.

## Working style for this project

- Parth is an "advanced vibe coder" — curious, not a professional developer. Explain
  technical choices in plain language; avoid unexplained jargon. Prefer showing a
  visual comparison over describing visual choices in words when feasible (see the
  font-comparison task).
- Full planning history and rationale: `/Users/parth/.claude-personal/plans/elegant-frolicking-seal.md`
- Cross-session memory: `/Users/parth/.claude-personal/projects/-Users-parth-Documents-Projects-Nirmal-Studio-Website/memory/`
