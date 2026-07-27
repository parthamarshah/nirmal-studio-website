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

- **Featured Projects**: the confirmed list in `src/data/projects.js` has **9** entries.
  7 are the "Ongoing" projects from `/Users/parth/Downloads/Fold Architects_2.pdf` —
  everything else in that PDF is prior-firm work (@UA Lab, @Terrafirma, @Studio CC,
  @Stapati, @R+R) done by the four architects at their previous employers,
  **excluded**, not Nirmal Studio's to claim. Those 7 are under construction — expect
  renders/plans, not finished-building photography. The other 2 — **Shimla House** and
  **Nishee House** — came direct from Parth (not the PDF), confirmed as genuine current
  Nirmal Studio work; their construction status isn't confirmed, so don't assert
  "ongoing" or "complete" for either. Both are backed by a real floor-plan drawing
  (`drawings` field) rather than renders.
- **AI-generated concept art (`conceptArt` field, Shimla House / Nishee House only)**:
  11 images Parth generated to visualize these two projects — **not real Nirmal Studio
  design output or photography**. Never merge into `gallery` or use as `heroImage`,
  both of which every other project treats as real project imagery. Any component
  rendering `conceptArt` must carry a visible label (e.g. "Concept visualization") —
  no exceptions, and don't put it in a section's most load-bearing/payoff frame (e.g.
  don't use it to represent a finished building). The same 11 images are shared across
  both projects since there's no reliable way to tell which room belongs to which
  house from the files themselves — if Parth ever clarifies the split, update
  `SHIMLA_NISHEE_CONCEPT_ART` in `projects.js` accordingly.
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
- **Fonts (decided)**: heading serif is **Fraunces** (`--font-heading`), wordmark is
  **Syne** (`--font-wordmark`, bold 800 for "nirmal" + regular 400 for "studio",
  replacing the unlicensed Stinger Wide trial), body stays Open Sans. Both pulled via
  Google Fonts link in `index.html`; self-hosting them is a later polish-pass item, not
  urgent now. Chosen by Parth via a live visual comparison, not from font names — don't
  re-ask or re-litigate this.

## Tech stack & architecture

- **Vite + React, plain JavaScript** (not TypeScript) — Parth is an "advanced vibe
  coder," not a professional dev; keep tooling friction low. Single-page app, all
  sections on one scrollable home route for now.
- **Mobile-first, not desktop-first-then-adapt.** Mobile is the primary "ultra smooth"
  target; desktop can be comparatively subdued but must feel equally polished. Build
  each section's mobile layout/interaction first, then layer desktop-only enhancements
  (parallax, pinning/scrub) on top.
- **No custom cursor.** The brief called for one; built it (a mouse-follow dot
  replacing the native cursor), Parth reviewed it live and rejected it — "normal mouse
  look is fine." Removed entirely (`src/components/CustomCursor.jsx` deleted, no
  `data-cursor-hover`/`data-cursor-native` attributes, no `has-custom-cursor` CSS). Use
  the plain native cursor everywhere; don't reintroduce this without him asking for it
  again.
- **Motion libraries have separate, non-overlapping jobs** (this avoids two systems
  fighting over scroll):
  - **Lenis** — smooth-scroll only, initialized once (`src/lib/scroll.js`).
  - **GSAP + ScrollTrigger** — all scroll-driven animation: pinning, scrub, parallax,
    mask reveals, split-text, image sequences. Synced to Lenis in the same file.
  - **Framer Motion** — mount/exit transitions and micro-interactions only (hover
    states, mount/exit transitions). Never scroll-linked.
- **Content-as-data pattern**: components read from `src/data/*.js`. Adding/editing
  real content later should be a data edit, not a component rewrite.
- **Image paths go in `public/images/<slug>/...`, never `src/assets/`.** Files in
  `public/` are copied to the build output as-is, so a plain root-relative string path
  in a data file (e.g. `/images/citadel-tower/hero.jpg`) resolves correctly in both
  `npm run dev` and the production build. A path under `src/` works in dev (which
  serves all of `src/`) but silently 404s after `npm run build`, since Vite only
  bundles files that are actually `import`ed somewhere — a data file holding a bare
  string path never triggers that. Don't reintroduce `src/assets/images`.
- **In-page navigation goes through `scrollTo()`** (`src/lib/scroll.js`), never a
  native anchor jump or `element.scrollIntoView()` directly — those bypass Lenis and
  desync it from ScrollTrigger. `scrollTo()` accepts a CSS selector, a DOM element, or
  a number (pixel offset), and falls back correctly to native scrolling when Lenis is
  off (the `prefers-reduced-motion` case). See `Hero.jsx`'s CTA for the pattern:
  `<a href="#target" onClick={(e) => { e.preventDefault(); scrollTo('#target') }}>` —
  keep the real `href` so it still works if JS fails.
- Respect `prefers-reduced-motion`. `src/lib/scroll.js` already checks it and skips
  Lenis/ScrollTrigger init when set, and exports a `prefersReducedMotion()` helper for
  reuse. **The CSS block in `src/index.css` only covers CSS `animation`/`transition` —
  it has no effect on GSAP or Framer Motion, which both animate via inline
  transforms.** Every new component doing its own GSAP/Framer animation must call the
  `prefersReducedMotion()` helper itself before registering that animation — don't
  assume the CSS block covers it.
- Dark mode is explicitly **out of scope** (fixed cream `#F6F4EF` / `#111` palette) —
  don't add a toggle.

## Known incident patterns — check new code against these

These recurred or were caught in review during earlier build phases. Check new code
against them rather than rediscovering them by chance:

- **(Historical — the custom cursor this applied to is now removed.)** A custom
  mouse-follow cursor went through two rounds of "invisible cursor" bugs (hiding the
  native cursor before the dot had a real position; the dot's fill color matching a
  full-screen overlay's background) before Parth rejected the feature outright on
  review. Kept here as a reminder: a decorative interaction can be bug-free and still
  get cut because the person who owns the site just doesn't like it — verify with him
  before sinking more time into fixing something like this rather than reconsidering it.
- **Anonymous callbacks passed to `gsap.ticker.add()` or similar "add a listener,
  keep no reference" APIs can never be removed.** `scroll.js`'s ticker callback hit
  this once. Always store the reference if there's any teardown path.
- **`ScrollTrigger.getAll().forEach(kill)` is a global operation** — it kills every
  component's triggers, not just the caller's own. Each section owns cleanup of the
  triggers *it* registered; don't add a blanket kill-all anywhere.
- **Any full-screen overlay (a new Loader-like component, a modal) needs an explicit
  `background` on the section immediately behind it too**, not just on the overlay —
  otherwise there's a flash-of-uncomposited-content window (e.g. before an image
  loads) where light text sits on the page's light body background.
- **A data-file lookup that can return `undefined` (e.g. `array.find(...)`) must be
  guarded before its result is dereferenced** — there is no error boundary anywhere in
  this app, so an unguarded read white-screens the entire site over a single data typo.
- **An inline `style` property always beats a stylesheet rule targeting the same
  element, regardless of selector specificity (short of `!important`) — including a
  scoped `<style>` block's own `@media` query.** Philosophy.jsx's desktop split-screen
  was silently defeated by an inline `gridTemplateColumns: '1fr'` that its own injected
  `@media (min-width: 768px)` rule could never override. If a property needs to change
  at a breakpoint, that property must not also be set inline — put the whole thing (base
  case included) in the `<style>` block, not just the override.
- **A `ScrollTrigger` `start`/`end` expressed as a fixed viewport percentage (e.g.
  `'bottom 60%'`, `'top 80%'`) can be mathematically unreachable if there isn't enough
  scrollable content past the trigger element** — most commonly when the element is the
  last thing on the page. IdeaTimeline.jsx hit this twice in one component: a scrub
  animation that could never reach 100%, and a reveal whose trigger point fell beyond
  max scroll on tall viewports, leaving that content stuck invisible forever. Prefix
  the value with `clamp(...)` (e.g. `'clamp(bottom bottom)'`) so it always resolves
  inside the actually-achievable scroll range.
- **Any nested scrollable element (`overflow: auto`/`scroll`) needs `data-lenis-prevent`
  on it, or a desktop mouse wheel over it scrolls the page behind it instead** — Lenis
  (`src/lib/scroll.js`) installs a global wheel handler with no concept of nested
  scroll containers; it checks for this attribute on the event target's ancestor chain
  and skips those events if present. IdeaTimeline.jsx's floor-plan lightbox hit this —
  worked fine on mobile (Lenis only smooths wheel input, not touch, so touch panning
  was never affected) but silently broke on desktop, which is easy to miss if testing
  happens on a phone. The next scrollable overlay (e.g. a project gallery lightbox in
  Task #9) will hit this too if `data-lenis-prevent` isn't added from the start.
- **The inverse of the rule above also holds: an element that's only conditionally a
  scroll container must drop `data-lenis-prevent` when it isn't one** — leaving it on
  unconditionally silences Lenis's wheel smoothing/sync over that whole region even
  when there's nothing nested to protect from it. Process.jsx's horizontal-scroll track
  hit this: on desktop it's pinned and transform-driven (not actually scrollable,
  `overflow: visible`), but on mobile/reduced-motion it's a real native `overflow-x:
  auto` scroll-snap container. The attribute is only correct in the second case — gate
  it on the same state that switches between the two modes (`data-lenis-prevent={pinned
  ? undefined : ''}`, not `false`, since React still renders `data-lenis-prevent="false"`
  for a literal `false` and Lenis only checks the attribute's presence). Any future
  component with a "pinned/transform-driven on desktop, natively scrollable on
  mobile" split needs this checked both ways, not just the "add it" direction.
- **`gsap.to()` cleanup via `.kill()` alone doesn't reset the target's own last-applied
  inline style** — it stops the tween, but whatever transform/width/etc. it last wrote
  stays on the element. Process.jsx's pin-to-mobile-fallback transition hit this: on a
  desktop→mobile resize mid-scroll, killing the scrub tween left a stale inline
  `transform` on the track (and a stale inline `width` on its progress-fill bar), which
  the very next render's mobile CSS could never override — same "inline beats
  stylesheet" failure class as the entry below, just reached via a leftover animated
  style instead of a hardcoded one. Fix: `gsap.set(el, { clearProps: 'transform' })` (or
  the relevant prop) in the same cleanup that calls `.kill()`, whenever the element gets
  handed off to a different (non-GSAP-driven) CSS layout afterward.
- **A full-screen overlay's backdrop `onClick={close}` also fires when the click
  bubbles up from content inside it** — a plain `onClick` on the overlay div doesn't
  distinguish "clicked the backdrop" from "clicked the child that bubbled up to it."
  IdeaTimeline.jsx's lightbox hit this: the drawing image had no `stopPropagation`, so
  a double-tap-to-zoom gesture on the image fired a click on its first tap and closed
  the lightbox before the zoom registered — defeating the feature entirely. Fix:
  `onClick={(e) => { if (e.target === e.currentTarget) close() }}` on the backdrop,
  not a bare `() => close()`. Check any future full-screen overlay with interactive
  content inside it (not just a dismiss-on-click scrim) against this.

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
