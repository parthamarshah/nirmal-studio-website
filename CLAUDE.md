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
- **Cloudflare**: the `nirmal-studio` Pages project (Gurjar account) is Git-connected
  to this repo — **pushing to `main` is the deploy**; no wrangler step needed. Wrangler
  CLI is also authenticated, but its OAuth token has **no DNS-edit scope**, so DNS
  record changes must go through the dashboard. See the Deploy section.
- **Do not ask Parth to do GitHub or Cloudflare dashboard steps** (creating things,
  pushing, deploying) — just do it directly, dashboard included if Claude-in-Chrome
  is connected and already logged into the Gurjar account (confirmed working this
  way for the domain-attach step below). The one exception requiring his explicit
  go-ahead first is attaching/changing the `nirmalstudio.com` custom domain, since
  that replaces whatever's currently live on the real domain — that's the one case
  where asking is mandatory, not optional. **`nirmalstudio.com` is now attached**
  (see Deploy section below) — this exception no longer applies going forward
  unless the domain needs to be reattached/changed again.
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

- **Featured Projects**: the confirmed list in `content/projects/*.json` has **9** entries.
  7 are the "Ongoing" projects from `/Users/parth/Downloads/Fold Architects_2.pdf` —
  everything else in that PDF is prior-firm work (@UA Lab, @Terrafirma, @Studio CC,
  @Stapati, @R+R) done by the four architects at their previous employers,
  **excluded**, not Nirmal Studio's to claim. Those 7 are under construction — expect
  renders/plans, not finished-building photography. The other 2 — **Shimla House** and
  **Nishee House** — came direct from Parth (not the PDF), confirmed as genuine current
  Nirmal Studio work; their construction status isn't confirmed, so don't assert
  "ongoing" or "complete" for either (their `facts.status` stays `null` until Parth sets
  it). Both are backed by a real floor-plan drawing (a `drawing`-type image in their
  "Drawings" section) rather than renders.
- **AI-generated concept art (Shimla House / Nishee House)**: 11 images Parth generated
  to visualize these two projects — **not real Nirmal Studio design output or
  photography**. **Rule changed by Parth on 2026-09-13 (v1 planning):** they become
  ordinary `render`-type images (type tags off by default), but **each image may be used
  on only one of the two houses** — never duplicated across both. Since the files can't
  be reliably matched to a house, they currently live unassigned in
  `content/unsorted.json` (`aiGenerated: true`); Parth assigns each to one house in the
  backend. **Transitional (until the Phase 3 backend lets Parth assign them):**
  `src/lib/content.js`'s `legacyConceptArt()` keeps showing them, labelled, **only in the
  homepage takeover** for both houses (as they were before v1). They are deliberately
  NOT rendered on the public, shareable `/projects/<slug>/` pages
  (`ProjectStory`'s `showLegacyConceptArt` is off there). Remove the shim once each
  image is assigned to one house.
- **Founder bios**: deep bio copy only for Tej Shah. The other three FOLD members use
  the PDF facts as-is (`content/founders.json`). (v1 changes this — see the v1 plan: Parth writes all four bios via the backend.) Never invent years of experience,
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
  coder," not a professional dev; keep tooling friction low. Two kinds of page (`src/main.jsx` picks one per URL, each its own code
  chunk): the homepage (`App.jsx`, all sections, rendered in the browser) and
  `/projects/<slug>/` (`ProjectPage.jsx`, **pre-rendered at build** by
  `scripts/prerender.mjs` and hydrated). Anything rendered on project pages —
  `ProjectStory`, `Nav`, `Img`, `RichText`, `ImageViewer` — must not read browser APIs
  (window, matchMedia, `prefersReducedMotion()`) during render, or hydration fails.
  Project pages don't load GSAP/Lenis/Framer; keep it that way. Always link to project
  pages with a trailing slash (`projectPath()`), since Pages serves the directory index there.
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
- **Content lives in `content/` (JSON + original images), not in components.**
  `content/site.json` (contact, socials, homepage image spots, section on/off),
  `content/founders.json`, `content/projects/<slug>.json`, `content/unsorted.json`,
  and original images under `content/media/`. The v1 `/admin` backend edits these
  files by committing to `main`. `scripts/build-content.mjs` runs before every
  `npm run dev`/`npm run build` (`predev`/`prebuild`): it **validates** everything
  (a problem fails the build with a plain-English list, so a broken publish never
  replaces the live site), generates every image size into `public/_media/`
  (gitignored, hashed file names, cached a year via `public/_headers`), and writes
  `src/generated/content.js` + `meta.json` (gitignored). Components import content only
  through `src/lib/content.js` and render images only through `src/components/Img.jsx`
  (media objects with srcset/width/height/blur placeholder — never bare path strings).
  Run `npm run content` after hand-editing `content/` while the dev server is running.
  `src/data/journal.js` / `testimonials.js` are the two not yet migrated.
- **Never reference image files by path.** Add the original to
  `content/media/projects/<slug>/` and a `pool` entry in that project's JSON; the build
  produces the files. `public/images/` and hand-made `.webp` siblings are gone — don't
  reintroduce either, or `src/assets/images` (bare string paths under `src/` 404 after
  build). Drawings are kept as quality-95 JPEG at full resolution (up to 4000px wide, EXIF
  stripped) because their dimension text is barely legible even uncompressed.
- **Each homepage section is wrapped in `SectionBoundary`** (`App.jsx`) — a section that
  throws hides itself instead of blanking the page. Still guard `find()` results (the
  boundary is a backstop, not a license to skip guards).
- **If backend-published commits land on `main`, `git pull` before starting code work**,
  and don't hand-edit `content/` while a backend draft may be open.
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
- **A `const`/`useCallback` referenced in an earlier `useEffect`'s dependency array
  throws "Cannot access before initialization" on every render** if that `const` is
  declared later in the same function body — `const` isn't hoisted, and the deps
  array is evaluated as part of the synchronous render, before execution reaches the
  later declaration. FeaturedProjects.jsx's back-button history integration hit this:
  a `closeTopLayer` `useCallback` was referenced in an Escape-key effect's deps array
  above its own declaration further down. Since this component mounts unconditionally
  and there's no error boundary anywhere in this app, this white-screened the entire
  site on every load — and neither `npm run build` (vite) nor `npm run lint` (oxlint)
  catch it, since it's a runtime-only ordering bug, not a syntax or static-analysis
  issue. Only actually rendering the component catches it. Fix: declare every
  `const`/`useCallback`/`useRef` an effect's deps array references *above* that
  effect, not just above where it's called. To verify a component that has no error
  boundary and isn't easy to click-test live, an SSR render is a fast, real check:
  bundle it with `vite`'s `build({ build: { ssr: true, write: false, rollupOptions:
  { input: 'src/components/X.jsx' } } })`, stub `globalThis.window =
  { matchMedia: () => ({ matches: false }) }` (covers `prefersReducedMotion()`), then
  `renderToStaticMarkup` it from `react-dom/server` — effects don't run under SSR, so
  this exercises exactly the synchronous render-time bugs this class of issue lives
  in, without needing a real browser. Check any future component that adds
  close-on-back-button (or similar) history/event-listener plumbing against this.
- **A full-screen `AnimatePresence`/Framer Motion overlay stays fully interactive for
  its whole exit fade unless something explicitly disables it** — `opacity` animating
  to 0 doesn't touch `pointer-events`, and Framer's `exit` prop only applies
  non-animatable values (like `pointerEvents`) *after* the exit finishes, not at the
  start, so putting it there doesn't help. A live-browser verification pass caught
  this in FeaturedProjects.jsx: pressing the back button (or Escape, or a backdrop/×
  close) cleared state, but the outgoing `position: fixed`, full-viewport dialog sat
  in the DOM invisible-but-fully-clickable for the whole 0.25–0.3s fade, silently
  swallowing real clicks on the page underneath — confirmed via
  `document.elementFromPoint()` landing inside the "closed" dialog, not just a visual
  guess. Fix: set `pointerEvents: 'none'` synchronously via a direct DOM ref the
  instant any close is triggered (in FeaturedProjects.jsx's `disableTopLayerInteraction`,
  called from both `closeTopLayer` and the `popstate` handler), not through Framer's
  `exit`. **Two follow-on traps this creates, both required to close it fully:**
  (1) if the overlay is `AnimatePresence`-rendered without a value-specific `key` (a
  static string, or no `key` at all), a fast close-then-reopen before the exit
  animation finishes reuses the same DOM node instead of mounting a fresh one — the
  leftover inline `pointer-events: none` then silently disables the reopened overlay
  *permanently*, worse than the bug being fixed. The open path must
  `style.removeProperty('pointer-events')` on the same ref before setting state, not
  just the close path set it. (2) if two stacked overlays' close buttons share the
  exact same fixed screen position (as FeaturedProjects.jsx's project-detail and
  lightbox close buttons deliberately do, so the × doesn't visually jump between
  layers), a second tap in that same spot within the fade window now falls through
  the newly-non-interactive top layer onto the close button of the layer underneath —
  cascading one tap into closing two layers instead of one. Fixed with a short-lived
  guard ref (`closeGuardRef`, ~350ms, cleared on next open) checked at the top of the
  shared close handler, since both close buttons route through it regardless of which
  one physically catches the click. IdeaTimeline.jsx's floor-plan lightbox had the
  identical latent bug (same `AnimatePresence` + `exit={{opacity:0}}` + fixed-overlay
  shape, just without the stacked-button case since it's the only overlay in that
  component) and was fixed the same way. Check any future full-screen
  `AnimatePresence` overlay — new lightbox, new modal — against all three parts of
  this (disable on close, reset on open, guard against same-position click-through)
  rather than just the first.
- **When rewriting or narrowing a data adapter (`src/lib/content.js`), grep every
  consumer's reads (`project?.x`, `project.x`) against the new return shape.** v1
  Phase 1a's rewrite dropped `type`/`location` from the homepage shape; FocusImage's
  caption silently lost them. Screenshot, page-height and image-count comparisons all
  passed — they don't catch lost text inside an element that still renders.
- **(Closed by the Phase 0 image pipeline, kept as background.)** A `<picture>`'s
  `<source>` does not fall back to the `<img>` on a 404 — only on an unsupported
  `type`/`media`. The old `webp()` helper derived `.webp` sibling paths with no existence
  check, so an image added without its hand-made `.webp` showed broken for most
  visitors. `Img.jsx` now only points at files `build-content.mjs` verifiably produced.
  If anything ever reintroduces a path derived by string substitution, this comes back.

## Deploy

- Repo: `https://github.com/parthamarshah/nirmal-studio-website` (plain `git push`,
  no `gh` CLI/Homebrew on this machine).
- Cloudflare: Wrangler CLI is authenticated (`npx wrangler whoami`) against the
  "Gurjar" account (where `nirmalstudio.com`'s DNS actually lives — OAuth via
  `wrangler login` needs `dangerouslyDisableSandbox: true` on the Bash call, since the
  loopback callback server otherwise isn't reachable from the real browser).
- **Pages project**: `nirmal-studio` (live at `https://nirmal-studio.pages.dev`),
  **Git-connected** to this repo since 2026-09-13: every push to `main` builds and
  deploys automatically (`npm run build` → `dist`, Node version read from
  `.node-version` — deliberately *no* `NODE_VERSION` env var in the dashboard, so the
  repo file stays the single source of truth). Deploy = commit + push; confirm the
  new deployment in the dashboard (Workers & Pages → nirmal-studio → Deployments).
  The Cloudflare GitHub app has repo access granted via GitHub.
- **Old project `nirmal-studio-website`** (direct CLI upload, can't be converted to
  Git) now has no custom domains — kept briefly as a rollback, to be deleted later
  with Parth's OK. Don't deploy to it.
- **Both `nirmalstudio.com` AND `www.nirmalstudio.com` are custom domains on
  `nirmal-studio`**, each a proxied CNAME → `nirmal-studio.pages.dev`. **Apex and www
  are separate DNS records — any domain/DNS/project change must handle both.** The
  original go-live only moved the apex; `www` stayed a DNS-only CNAME to
  `sagarvora.github.io` (Parth's friend's GitHub Pages — the old "coming soon"
  placeholder, *not* Lovable as this file used to say) for ~2 months, so visitors
  typing `www` saw the old site. Fixed 2026-09-13.
- **After any DNS, custom-domain, or deploy change, run `npm run check:domains`** —
  it asserts both hostnames return 200, `server: cloudflare`, and the real page
  title. Checking only the apex is how the www bug went unnoticed.
- **Moving a custom domain between Pages projects**: remove it from the old project
  (this deletes its CNAME), then add it to the new one. For `www` the dashboard
  recreated the CNAME automatically; for the apex it did **not** — the site returned
  Cloudflare 522 until the apex CNAME was manually pointed at the new
  `*.pages.dev` target in DNS → Records. Expect that and have the DNS tab ready.
- **DNS records that must never be touched during site work**: MX
  `mx1/mx2.efwd.spaceship.net` + SPF TXT (live email forwarding for
  `tej@nirmalstudio.com`), and CNAME `erp` → `nirmal-erp.onrender.com` (a separate
  ERP app). Parth has a full zone export from 2026-09-13
  (`~/Downloads/nirmalstudio.com.txt`, pre-fix) if anything goes missing.
- Custom domains are managed via the dashboard (Workers & Pages → project → Custom
  domains); `wrangler pages domain add` doesn't exist in wrangler 4.114.0 — check
  `--help` before assuming a CLI path.
- **Cloudflare's own zone-level "AI Crawl Control" injects extra `robots.txt`
  rules on `nirmalstudio.com`** (not present on the `.pages.dev` URL, confirmed
  by comparing both — so it's an account/zone setting, not anything in this
  repo's `public/robots.txt`) blocking several AI crawlers by name (`GPTBot`,
  `ClaudeBot`, `Google-Extended`, others) plus a `Content-Signal: ai-train=no`.
  Regular Googlebot/classic search ranking is unaffected, but this does block
  the crawlers behind AI answer engines (Google AI Overviews, ChatGPT
  browsing, Claude browsing) from referencing the site — worth Parth's
  explicit call given his stated local-SEO/discoverability priority, not
  something to silently leave as Cloudflare's default. See progress.md's
  "Resume here" for the flag raised to him.

## Working style for this project

- Parth is an "advanced vibe coder" — curious, not a professional developer. Explain
  technical choices in plain language; avoid unexplained jargon. Prefer showing a
  visual comparison over describing visual choices in words when feasible (see the
  font-comparison task).
- Full planning history and rationale: `/Users/parth/.claude-personal/plans/elegant-frolicking-seal.md`
- Cross-session memory: `/Users/parth/.claude-personal/projects/-Users-parth-Documents-Projects-Nirmal-Studio-Website/memory/`
