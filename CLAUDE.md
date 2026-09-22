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

- **GitHub**: this repo is pushed to `github.com/parthamarshah/nirmal-studio-website`,
  no `gh` CLI needed. **The `origin` remote is HTTPS but the stored keychain credential
  for github.com is gone** (as of 2026-09-20 `git push` fails with "could not read
  Username for 'https://github.com'", and `git credential-osxkeychain get` returns
  nothing). **SSH works** — `ssh -T git@github.com` authenticates as `parthamarshah` —
  so push with
  `git push git@github.com:parthamarshah/nirmal-studio-website.git main`.
  Either that, or switch the remote to SSH permanently
  (`git remote set-url origin git@github.com:parthamarshah/nirmal-studio-website.git`)
  — not done unilaterally, since it changes Parth's repo config; worth asking him once.
  Git commands that touch the keychain also need `dangerouslyDisableSandbox: true`.
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

On this site: Tej/Nirmal Studio gets primary billing — the other three FOLD members
must **never** be framed as co-founders of Nirmal Studio itself. That would
misrepresent the actual legal/brand structure. **v1 founders layout (decided
2026-09-13, built in `Founders.jsx`):** Tej first; desktop = one band per person with
Tej's ~18% larger; phone = one carousel of four equal cards (Embla; native scroll-snap
under reduced motion). It is **gated**: `Studio.jsx` shows it only when every person in
`content/founders.json` has a photo and a bio (`foundersReady`) — until then the pre-v1
layout (Tej block + FOLD block at ~3/4 its height, `LegacyStudio`) stays live. Don't
add placeholder portraits/bios to switch it on.

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
- **Founder bios**: Parth (or Tej) writes all four bios — never Claude. Until they exist,
  the three FOLD members show only the PDF facts (`previously` + `expertise`; both layouts read
  `previously`, the legacy one falls back to the older `background` field). Word limits are
  enforced by the build: Tej ≤100 (warns under 70), others ≤80 (warns under 50). Never
  invent bios, years of experience, favourite material, or favourite architect for any
  of the four — not real facts we have, and these are real named people. Photo filters
  (`original`/`warm`/`bw`) are applied at build by `build-content.mjs`, not CSS.
- **Journal & Testimonials**: no real content yet. Sections **hide entirely** from the
  site/nav when their data array is empty (`src/data/journal.js`,
  `src/data/testimonials.js`) — no "coming soon" placeholder. This was a deliberate
  choice: a placeholder undercuts the confident, non-marketing tone the brief itself
  asks for. The moment real entries are added to those data files, the sections should
  reappear with no component changes needed.
- **Button label (decided 2026-09-21)**: the nav button and the panel heading read
  **"Talk with Us"**, not "Talk to Tej" — Parth's call. The panel's subtitle still says
  "You'll speak directly with Tej" on purpose: the button invites, the line under it
  reassures you are not writing to a mailbox. **The component is still `TalkToTej.jsx`**
  and the greeting in `site.json` still opens "Hi Tej" — those are internal/recipient
  names, not the label, and neither was renamed. Don't "restore" the old button text.
  The Contact section's **"Book a Consultation" CTA opens the same panel** (same
  decision) rather than jumping straight to WhatsApp; both it and the nav button share
  `src/components/loadTalk.js` so the chunk is fetched once. Both keep a real wa.me href
  as the no-JS fallback — see the two-anchors-gated-by-CSS pattern below.
- **Contact**: Tej Shah, WhatsApp/phone `910 699 8434`, email `tej@nirmalstudio.com`.
  The studio address **is confirmed and real** — it lives in `content/site.json`
  (`contact.address`, plus `contact.addressShort` for the Talk-to-Tej "Visit" link) and
  Contact.jsx renders it with a click-to-load map embed. (This line used to say "no
  office address yet — placeholder until supplied"; that was stale and is exactly the
  kind of drift that gets real data deleted as if it were filler.) Still missing:
  office photos.
- **Hero media**: no real video exists (all projects are under construction). Use a
  slow Ken Burns-style pan/zoom on a strong still render (e.g. Citadel Tower exterior)
  until/unless Parth supplies real generated video — media is a swappable asset, not
  something to rebuild the section around.
- **Fonts (decided)**: heading serif is **Fraunces** (`--font-heading`), wordmark is
  **Syne** (`--font-wordmark`, bold 800 for "nirmal" + regular 400 for "studio",
  replacing the unlicensed Stinger Wide trial). Chosen by Parth via a live visual
  comparison, not from font names — don't re-ask or re-litigate this.
  **Body text is the system sans** (`--font-body`), not a downloaded font. It used to
  name Open Sans, but Open Sans was never actually loaded anywhere — not in
  `index.html`, nothing in git history — so every paragraph has always rendered in
  `-apple-system`/`system-ui`. Parth reviewed that repeatedly and approved it; on
  2026-09-20 he chose to make it official rather than introduce a third family. Don't
  "restore" Open Sans.
  **Both families are self-hosted** since v1 Phase 1d: `public/fonts/*.woff2` +
  `@font-face` rules inline in `index.html`, with Syne and the roman Fraunces
  preloaded. No Google Fonts requests remain. The rules are a faithful copy of the CSS
  Google served for the same request (Fraunces v38, Syne v24) including the
  `unicode-range` split, minus the unused vietnamese/greek slices; the version number
  is in each file name so `public/_headers`' one-year immutable cache is safe.
  **Keep `font-display` per family** — Syne `optional`, Fraunces `swap` — and don't
  unify them: see the loader font-flash incident in the known-incident list below.

## Tech stack & architecture

- **Vite + React, plain JavaScript** (not TypeScript) — Parth is an "advanced vibe
  coder," not a professional dev; keep tooling friction low. Two kinds of page (`src/main.jsx` picks one per URL, each its own code
  chunk): the homepage (`App.jsx`, all sections, rendered in the browser) and
  `/projects/<slug>/` (`ProjectPage.jsx`, **pre-rendered at build** by
  `scripts/prerender.mjs` and hydrated). Anything rendered on project pages —
  `ProjectStory`, `Nav`, `Img`, `RichText`, `ImageViewer` — must not read browser APIs
  (window, matchMedia, `prefersReducedMotion()`) during render, or hydration fails.
  Project pages don't load GSAP/Lenis/Framer/Embla (Embla = the homepage founders carousel only); keep it that way. The nav's "Talk to Tej" panel (`TalkToTej.jsx`) is shared by both pages but loaded only on tap (plus the QR library, desktop only) — keep it out of the initial bundles. Always link to project
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
  `content/site.json` (contact, socials, the `talk` first-message helper — now
  build-required, homepage image spots, section on/off),
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
- **A `position: fixed` overlay rendered inside the nav is sized to the nav bar, not the
  screen, once the nav is scrolled** — `.site-nav--scrolled` has `backdrop-filter`, which
  (like `transform`/`filter`) makes the element the containing block for fixed
  descendants. `TalkToTej.jsx` avoids it with `createPortal(…, document.body)`. Any future
  overlay opened from inside the nav (or any filtered/transformed ancestor) needs the same.
- **When rewriting or narrowing a data adapter (`src/lib/content.js`), grep every
  consumer's reads (`project?.x`, `project.x`) against the new return shape.** v1
  Phase 1a's rewrite dropped `type`/`location` from the homepage shape; FocusImage's
  caption silently lost them. Screenshot, page-height and image-count comparisons all
  passed — they don't catch lost text inside an element that still renders.
- **`history.back()` is async, so any overlay that closes through it needs a guard, or a
  fast second close request pops a second real history entry and navigates the visitor
  off the site.** Between the `back()` call and `popstate` landing, the overlay is still
  mounted, visible and interactive. Two things reach that window in practice: a
  double-tapped close button on a slow phone, and — easier to hit and easy to forget —
  simply **holding the Escape key**, whose auto-repeat fires roughly every 30ms. This
  first appeared in `FeaturedProjects.jsx` (fixed with `closingRef`) and then recurred
  verbatim in new code in `TalkToTej.jsx` on 2026-09-20, which is why it is written down
  here rather than left in one component's comments. The fix is two parts, both needed:
  a `closingRef` set **synchronously** immediately before `window.history.back()` and
  cleared only inside the `popstate` handler, plus `&& !e.repeat` on the Escape branch.
  Reproduce it in headless Chrome by dispatching two `keydown`/`Escape` events ~25ms
  apart with no filler history entries — the tab leaves the page and CDP reports
  "Inspected target navigated or closed". Careful constructing that test: if you push
  filler entries at the *same URL* first, popping two still leaves `location.href`
  unchanged and the test passes while the bug is present. **`ImageViewer.jsx` (its
  `onClose`/history integration) still has the identical unguarded shape** — pre-existing
  and not yet fixed; do it next time that file is open.
- **`font-display: optional` on a third-party font host silently loses its race far more
  often than it looks, and `document.fonts.check()` will not tell you.** Measured in
  headless Chrome on 2026-09-20, before fonts were self-hosted: the "nirmal" wordmark
  rendered in the generic fallback sans — not Syne — on **two of three** cold page loads
  (both 1440px runs; the 390px run only passed because the previous run had warmed
  Chrome's HTTP cache). `optional` gives the browser a ~100ms decision window, and a
  font that must wait for a DNS+TLS handshake to `fonts.gstatic.com` *and* a stylesheet
  round-trip before it is even discovered routinely misses it. The fix was self-hosting
  plus `<link rel="preload">`, after which it applied on all three loads. Two lessons
  worth keeping: (1) `document.fonts.check('800 1em Syne')` reports LOAD state, not
  whether the font was APPLIED — it returned true on runs where the wordmark was visibly
  the fallback. To prove a webfont is actually in use, measure: render the same string in
  `'<Font>, <fallback>'` and in the fallback alone and compare widths (see the session
  scratchpad's `checkfonts.mjs` recipe). (2) `display: optional` deliberately never swaps,
  so the fallback render is permanent for that visit — it is the right choice for the
  wordmark (it is what killed the two-font flash) but it makes discovery latency the
  whole ballgame. Don't "fix" a fallback render by changing the display mode; make the
  file arrive sooner.
- **(Closed by the Phase 0 image pipeline, kept as background.)** A `<picture>`'s
  `<source>` does not fall back to the `<img>` on a 404 — only on an unsupported
  `type`/`media`. The old `webp()` helper derived `.webp` sibling paths with no existence
  check, so an image added without its hand-made `.webp` showed broken for most
  visitors. `Img.jsx` now only points at files `build-content.mjs` verifiably produced.
  If anything ever reintroduces a path derived by string substitution, this comes back.

## Branches right now — read this before pushing anything

**`main` deliberately has NO `functions/` directory. Do not put it back yet.**

Cloudflare Pages **auto-deploys anything in `functions/`** on the branch it builds. There
is no switch for this and nothing in the dashboard to opt out of. So a commit of backend
code to `main` publishes those endpoints on `nirmalstudio.com` immediately — which is
exactly what happened on 2026-09-20: `/api/admin/me` and `/api/admin/login` were live on
the real domain for about four minutes before being removed. Nothing was exposed beyond
the endpoints' existence (production has no `ADMIN_PIN_HASH`/`SESSION_SECRET`, so login
answered "not configured" and `/me` answered 401), but it was the opposite of the agreed
"preview branch only" and it was caught by checking, not by design.

- **`main`** — the live site. Contains `wrangler.toml`, `migrations/` and the admin
  scripts, all of which are inert without `functions/`.
- **`admin-test`** — the `/admin` backend lives here and deploys to its own preview URL.
  All Phase 2 work goes here until Parth has reviewed it and the review agents have run.

Merging `admin-test` into `main` is therefore a **launch decision**, not a routine merge.

## Phase 2 credentials (created 2026-09-20, stored in Parth's Apple Passwords)

Never in the repo, never in chat. Both are saved in the **Passwords** app.

**Where they are set (2026-09-22):** the **Preview** environment of the `nirmal-studio`
Pages project has `ADMIN_PIN_HASH`, `GITHUB_TOKEN` and a preview-only `SESSION_SECRET`,
all as encrypted secrets (`PUBLISH_BRANCH` comes from `wrangler.toml`). **Production has
none of them, deliberately** — `main` has no `functions/`, and giving production its own
secrets is part of the launch decision. With `wrangler.toml` present the dashboard
accepts only secrets, not plain variables, and `wrangler pages secret put` (4.135) has
no `--env` flag — so setting a *preview* secret is a dashboard step.

**The PIN hash must be ≤ 100,000 PBKDF2 iterations.** Cloudflare Workers refuses
anything higher (`deriveBits` throws; measured: 100000 → 200, 100001 → 500), and
`wrangler pages dev` does not enforce it, so a too-strong hash works locally and fails on
every real login. `npm run admin:secrets` hashes at exactly 100k; Parth re-ran it on
2026-09-22 after the original 210k constant was found. `verifyPin` now rejects an
out-of-range hash with a plain-English 503 instead of an uncaught throw.

| what | where it's saved | scope |
|---|---|---|
| GitHub fine-grained PAT | `github.com` / user name `nirmal-studio-backend-token` | **only** `parthamarshah/nirmal-studio-website`; Contents: Read and write; Metadata: Read (auto) |
| Cloudflare API token | `cloudflare.com` / user name `nirmal-studio-build-status` | Gurjar account only; **Cloudflare Pages: Read** — build status only, no edit rights anywhere |

- The GitHub token is named `nirmal-studio-backen` in GitHub's UI (the trailing "d" was
  truncated at creation) — cosmetic, don't be confused by it.
- **The GitHub token expires on Saturday 19 December 2026** (90 days; Parth confirmed
  on 2026-09-20 that he kept the default rather than extending it). When it lapses,
  publishing from `/admin` stops with an unhelpful error, so check this first if
  publishing breaks. Editing a fine-grained token's scope regenerates its value; editing
  it does NOT require deleting and recreating the token entry.
- Neither token existed before this date, and the first attempt was created with
  GitHub's defaults — **no repository access and no permissions at all**. A fine-grained
  PAT with no permissions fails as a 404, not a 403, so verify scope on the token's page
  rather than trusting that creation succeeded.
- Cloudflare **Web Analytics is already enabled** on the zone (its `beacon.min.js` is
  auto-injected into the live site) — Phase 3 item 4 doesn't need to turn it on.
- Client IP filtering was deliberately left empty on the Cloudflare token: it is called
  from Cloudflare's servers, not from Parth's laptop.

## Deploy

- Repo: `https://github.com/parthamarshah/nirmal-studio-website` (plain `git push`,
  no `gh` CLI/Homebrew on this machine).
- Cloudflare: Wrangler CLI is authenticated (re-authorised 2026-09-20 after its OAuth
  token expired) against the **"Gurjar"** account (`77c1fca7ffa3f3bf2ed702db856050fd`,
  email `3shah.parth@gmail.com`), with `d1:write`, `workers_kv:write` and `pages:write`
  among its scopes — everything the Phase 2 backend needs to create its bindings.
  **Re-login gotcha, hit twice on 2026-09-20:** `wrangler login` binds an OAuth callback
  server to `localhost:8976`. If an earlier attempt is still hanging it keeps that port,
  and a second attempt then fails either with "port is already in use" or — worse,
  because it looks like an account problem — a browser page reading
  `request_forbidden / The CSRF value from the token does not match`. That CSRF error
  just means two concurrent logins: the browser approved attempt B's `state` while
  attempt A's server is the one listening. Fix: `pkill -f "wrangler.*login"`, confirm
  port 8976 is free, then run **exactly one** login. Never run a second one because the
  first looks stuck. The account it was authenticated against (where `nirmalstudio.com`'s DNS actually lives — OAuth via
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
