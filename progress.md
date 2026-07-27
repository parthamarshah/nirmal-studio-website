# Build progress

Section-by-section log. Update this after each phase lands. Full context/decisions
live in `CLAUDE.md` — read that first if you're picking this up cold.

## Resume here

Next up: **Journal + Testimonials / Contact section** (both still "Not started yet"
below) — Studio (Task #10) landed this session, so it's off this list now.

Also fixed this session, before Task #10: the Loader's "nirmal" wordmark briefly
showed in two different fonts on first load (Google Fonts' `display=swap` let the
fallback sans-serif paint first, then swapped to Syne mid-animation). **This took two
attempts** — the first (`index.html` requesting Syne with `display=block`, plus a
`document.fonts.load()`-gated fade-in with an 800ms max-wait in `Loader.jsx`) was
actually verified live by Parth (DevTools → Network → Slow 4G → disable cache →
hard-reload, screen-recorded) and the flash still happened. Root cause: `block` has
an *infinite* swap period — if the font arrives after the block window, the browser
shows fallback first and swaps to Syne whenever it finishes, no matter how late; no
JS timing constant can out-guess an arbitrarily slow network against a display mode
that always eventually swaps. Fixed properly by switching Syne to
`display=optional` — the browser decides in ~100ms whether the font's ready, and if
not, uses the fallback for that whole visit and **never swaps in later**, so no
flash is possible under any network condition. Trade-off: on a slow/cold-cache first
load, the wordmark may render in the fallback font that one time instead of Syne.
The JS gating in `Loader.jsx` (fontReady state, document.fonts.load race) was removed
along with it — it was solving a problem `optional` no longer has, so it was just
unnecessary complexity once the CSS-level fix was correct; back to a plain
opacity-fade-on-mount. **This version was verified live by Parth** — same Slow 4G +
disable-cache + hard-reload test, screen-recorded again: "nirmal" rendered in the
fallback font (not Syne, since it didn't arrive within `optional`'s ~100ms decision
window on that throttled connection) but stayed that way for the entire loader with
no swap, confirming the fix. This is the one item this session that got genuinely
verified rather than left as a build/lint-only guess — worth remembering that a real
Slow-4G test is what actually caught the first fix's flaw; build/lint alone had
passed on both attempts. Parth was asked whether to prioritize this check, the
Studio section check, or a deploy-then-check-both approach, and said he'd rather
finish fixing things one at a time than deploy yet — so nothing's been pushed to
Cloudflare this session, just committed locally once done.

Task #9 (Featured Projects) landed last session — see its "Done" entry below — but,
like Task #8 before it, **wasn't visually verified in a real browser**: the
Claude-in-Chrome extension wasn't connected that session either, so only `npm run
build` + `npm run lint` + three review-agent passes (ux-reviewer, impact-tracker,
edge-case-checker, each run once and again after fixes) confirmed it. The extension
was unavailable *this* session too (third session running) — flagging again that
it's worth checking the connection before the next one starts, rather than
discovering it's down mid-session yet again. Parth should
check `https://nirmal-studio-website.pages.dev` himself: (1) the new Featured Projects
grid between Idea-to-Home and Process — 9 cards, tap one to open the full-screen story
takeover (hero image, facts, concept/challenge/materials/construction copy, photo
gallery); (2) gallery thumbnails open a fit-to-screen lightbox; Shimla/Nishee's floor
plan opens the same pan/zoom lightbox IdeaTimeline uses, and their AI concept-art grid
opens fit-to-screen with a visible "Concept visualization" label; (3) Prev/Next at the
bottom of the takeover cycles between all 9 projects — confirm it actually lands
scrolled to the top of the new project, not wherever the previous one was scrolled to;
(4) on both desktop and mobile, confirm Escape and the backdrop both close things as
expected, and tapping into a card, then Tab-ing on desktop, doesn't reach anything
hidden behind the takeover.

Task #8 (Process) also still needs its own from-scratch browser check — the "Resume
here" checklist that described it got overwritten by the paragraph above, but the
underlying ask hasn't been done yet: (1) desktop >=1024px — scroll into Process,
confirm vertical scroll converts to horizontal card motion smoothly (pinned, no jank),
progress dots + bar track correctly, clicking a dot jumps to that stage — this section
now sits after Featured Projects instead of directly after Idea-to-Home, which changes
how much scroll room is above it, so it's worth a fresh look rather than assuming the
math still works the same way; (2) resize the browser across the 1024px breakpoint
mid-scroll — confirm no leftover card/progress-bar jump when it falls back to mobile
layout; (3) mobile/narrow width — confirm horizontal swipe-snap carousel, dots still
work; (4) with OS-level "reduce motion" on — confirm it's the same swipe-snap fallback
as mobile, not a broken pinned attempt.

Also still needs Parth to re-verify the two phone fixes from an earlier session
(floor-plan lightbox pan/zoom + close button, Philosophy's border-only pill badges) —
see the "Lightbox + Philosophy chip fixes" entry below for exactly what changed. Three
things still waiting on him, unrelated to code: Tej's sign-off on the Philosophy
paragraph + IdeaTimeline stage copy + Process's stage copy + now Featured Projects'
per-project challenge/materials/construction copy too (all generic "studio voice," not
confirmed facts — see projects.js's header comment); confirming the Nishee House client
is fine with their full floor-plan layout being public (now also used as that project's
Featured Projects card art, which is more visible than its one appearance in
Idea-to-Home was); and — new this session — whether showing Shimla House's floor plan
at all is fine, since re-cropping it to match Nishee's (see below) means it's now used
the same way.

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
  single-sentence Statement was. Later in the session, after Parth reviewed on his
  phone: replaced the theme-tag row's plain "Guided by" label + inline text list (felt
  like an afterthought, his words) with bordered pill badges above a divider line —
  more deliberate/designed presentation. Added `--color-bronze-darker` to
  `tokens.css` since the original `--color-bronze-dark` only hits ~4.1:1 against the
  chips' beige fill (a darker background than the page bg it was originally checked
  against), below AA for that size text.
- **Two new confirmed projects: Shimla House + Nishee House** — Parth confirmed these
  as genuine current Nirmal Studio work, sourced directly from him (not the PDF): a
  real floor-plan drawing for each (`public/images/shimla-house/` and
  `nishee-house/drawings-ground-floor.jpg` — Shimla's original sheet had "Architect:
  Nirmal Studio" on its title block, since cropped off, see Task #9's entry below)
  plus 11 AI-generated concept-visualization images he shared, which are
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
  title block so the plan itself fills the frame. Parth confirmed on a real phone:
  room names (BEDROOM-1, LOUNGE, etc.) read fine inline, but the small dimension
  numbers under each label don't. Fixed with a tap-to-enlarge lightbox (tap the image
  → full-screen pan/scroll view at the drawing's natural pixel size, not fit-to-screen
  — fit-to-screen renders at the same size as inline on a phone, since inline is
  already width-constrained to the viewport). At the time this section landed, only
  Nishee House's drawing was cropped this way — Shimla House's still had its title
  block, and would have looked inconsistent next to it. Reconciled in Task #9 below
  (Shimla's file re-cropped to match). A bronze line grows
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
- **Lightbox + Philosophy chip fixes, from Parth's phone review** — two rounds of
  review-agent findings (ux-reviewer, impact-tracker, edge-case-checker) surfaced real
  bugs beyond what Parth could see visually:
  - Lenis (global smooth-scroll) was hijacking desktop mouse-wheel input over the
    lightbox, scrolling the page behind it instead of panning the drawing — fixed with
    `data-lenis-prevent` on the overlay. Documented as a new CLAUDE.md known-incident
    pattern (any future `overflow: auto` overlay needs this, and it's easy to miss
    testing only on a phone since Lenis only intercepts wheel, not touch).
  - The lightbox's backdrop `onClick` was also firing when the click bubbled up from
    the drawing image itself — a double-tap-to-zoom gesture closed the lightbox on its
    first tap, before the zoom ever registered, defeating the whole feature. Fixed by
    gating the close handler on `e.target === e.currentTarget` (only a direct backdrop
    click closes it now).
  - The lightbox close button was `rgba(17,17,17,0.6)`, which nearly disappeared over
    the light/white areas that make up most of an architectural drawing. Bumped to
    0.85.
  - Philosophy's "bordered" pill badges had no actual border — just a `--color-beige`
    fill, which sits at ~1.2:1 contrast against `--color-bg` (near-identical
    lightness), so the redesign meant to fix "just left there" would have still read
    as barely-there on a real phone. Changed to border-only chips (`--color-bronze-darker`
    border, transparent fill) — this also fixes a second issue: a *filled* pill
    already means "tap this" elsewhere in the app (the lightbox trigger), so a filled
    static label was borrowing the wrong visual language. Restored a small "Guided by"
    eyebrow label above the row (removed in the first redesign pass) since bare
    uppercase words with no framing failed the first-time-user test — kept it visually
    distinct (smaller, letter-spaced, `--color-stone-dark`) from the original plain-text
    version Parth rejected, so it doesn't regress back to "afterthought."
  - Not yet fixed (non-blocking, flagged by review, worth remembering): no
    `role="dialog"`/focus-management on the lightbox (screen-reader/keyboard users get
    no modal cue), and no "drag to pan / pinch to zoom" affordance on lightbox open (a
    user landing on a zoomed-in corner of a 1584px-wide image with no cue that there's
    more to pan to could briefly read it as broken). Both are real but lower-severity —
    revisit in the polish pass, not blocking Task #8.
- **Process horizontal-scroll journey** (`Process.jsx`) — Section 8, a genuinely
  different narrative from IdeaTimeline (Task #7's per-project physical build sequence):
  6 typographic stages telling the studio's own working method (Listen → Read the Site
  → Shape the Idea → Resolve the Detail → Build Together → Hand It Over), generic
  studio-voice copy pending Tej's sign-off, same flag as Philosophy's and IdeaTimeline's.
  On desktop (>=1024px, `gsap.matchMedia`, only when motion isn't reduced): a real GSAP
  ScrollTrigger pin — vertical scroll drives horizontal translateX of the card track,
  with a bronze progress bar + clickable stage dots, a persistent small "Process" label
  (since the real `<h2>` scrolls out of view once pinned), and a "Keep scrolling ↓" hint
  on the first card only that fades once the visitor advances past it. On mobile and for
  any reduced-motion user (regardless of viewport width): a native CSS horizontal
  scroll-snap carousel instead, sharing the same dot/progress-bar row and activeIndex
  state — gated on a `pinned` boolean class, not just the media query, so a
  reduced-motion desktop user still gets the working snap-scroll fallback rather than a
  clipped, un-scrollable track. Three review-agent passes (ux-reviewer, impact-tracker,
  edge-case-checker) caught real bugs before commit, all fixed: `data-lenis-prevent` was
  applied unconditionally to the track even though it's only a real scroll container in
  the non-pinned case (silenced Lenis's wheel smoothing over the whole pinned section);
  the dot-click fallback used `scrollIntoView()` instead of the track's own `scrollLeft`
  (bypasses Lenis, CLAUDE.md's `scrollTo()` rule); `.kill()`-ing the scrub tween on a
  desktop→mobile resize left a stale inline `transform`/`width` that the mobile CSS
  could never override (new CLAUDE.md known-incident entry); a dot clicked in the
  one-paint window where `pinned` is true but the ScrollTrigger hasn't been created yet
  could silently fall through to the wrong scroll mechanism (now an explicit no-op);
  the mobile scroll-listener's index could go out of bounds on iOS rubber-band
  overscroll (now clamped, matching the desktop path); progress-bar contrast (2.7:1,
  swapped to `--color-bronze-dark`) and panel-border contrast (1.2:1 beige, swapped to
  `--color-stone`) both failed the 3:1 UI-component floor; dot tap targets were 9×9px
  (expanded to a 44×44px hit area via a transparent `::before`, visual dot unchanged).
  **Not visually verified in a real browser this session** — Claude-in-Chrome wasn't
  connected, so only build/lint + manual code re-read + the three agent passes confirm
  it. Parth should check `nirmal-studio-website.pages.dev` himself — see "Resume here"
  above for exactly what to look at.
- **Featured Projects immersive storytelling** (`FeaturedProjects.jsx`) — Section 6,
  inserted between Idea-to-Home and Process (not appended after Process, which is
  Section 8 — page order follows the brief's section numbers, not the order sections
  happened to get built in). A responsive grid of all 9 projects (card = heroImage for
  the 7 PDF projects, the floor-plan drawing for Shimla/Nishee since neither has gallery
  photography, tagged "Floor plan" so it doesn't read as a photo) opens into a
  full-screen story takeover per project: hero image, site/built-up area, concept copy,
  and — the 7 PDF projects only — challenge/materials/construction copy (generic
  studio-voice language, same "pending Tej's sign-off" flag as Philosophy/IdeaTimeline/
  Process; left null on Shimla/Nishee since their construction status isn't confirmed,
  see `projects.js`'s header comment), a photo gallery (fit-to-screen lightbox), and for
  Shimla/Nishee the floor plan (reuses IdeaTimeline's pan/zoom lightbox rationale — same
  small-dimension-text problem) plus the shared AI concept-art set, always shown with a
  visible "Concept visualization" label carried through into the lightbox too, not just
  the thumbnail grid (CLAUDE.md's `conceptArt` rule is explicit that there are no
  exceptions to this). Prev/Next cycles between all 9 projects within the takeover.
  Picked hero images for the 3 projects that had `heroImage: null` (Agrawal's Office,
  Jewelry Store, Law Office); swapped jewelry-store's initial pick away from the shot
  with the client's "KOHIRAA" signage legible, since this data file otherwise doesn't
  name the client — kept that shot in the gallery, just not promoted to card art. Also
  re-cropped `shimla-house/drawings-ground-floor.jpg` (dropped its title block) to match
  how `nishee-house`'s equivalent was already cropped, per the note IdeaTimeline's entry
  left for this task — see the flag in "Resume here" above about whether showing
  Shimla's floor plan this way needs the same client-permission check Nishee's does.
  Three review-agent passes (ux-reviewer, impact-tracker, edge-case-checker) caught real
  bugs before commit, all fixed: the section subhead originally asserted all 9 projects
  are "in progress," which misrepresents Shimla/Nishee's unconfirmed status (both
  agents caught this independently); Prev/Next swapped `activeSlug` but never reset the
  detail panel's scroll position, so browsing landed on the new project scrolled to
  wherever the previous one was; the facts `<dl>` rendered as an empty box with a stray
  divider line for Shimla/Nishee (both fields null) instead of not rendering at all; the
  full-screen takeover had no focus trap or focus restoration, so Tab could reach grid
  cards hidden behind it and closing dropped focus to `<body>` (fixed: focus moves to
  the close button on open/navigate, restores to the trigger card on close, Tab wraps
  within the panel); both close buttons (× glyph) weren't reliably centered (no
  `display:flex` centering on a fixed-size circle); Prev/Next buttons were under the
  44px tap-target floor. **Not visually verified in a real browser this session either**
  — same Claude-in-Chrome connection issue as Task #8 above, two sessions running now.
- **Studio (Tej Shah) + Network (FOLD)** (`Studio.jsx`) — Section 7, inserted between
  Featured Projects and Process (page order follows the brief's section numbers, same
  reasoning as Task #9's placement). Tej gets a full ~100svh block (name, title,
  based-in, and a first-person bio); FOLD gets a secondary block (~75svh floor) — an
  intro paragraph explaining it's an informal, non-legal network (not co-founders of
  Nirmal Studio), then a 1-column (mobile) / 3-column (desktop) card grid for the other
  three architects, using `founders.js`'s facts as-is. Tej's `bio` field in
  `founders.js` was null pending this task; filled it in now, constrained to only the
  facts already confirmed elsewhere in that file (Ahmedabad, R+R Architects, the three
  expertise areas) plus the philosophy language Philosophy.jsx already established —
  no invented years, mentors, or awards. Flagged pending Tej's sign-off, same bar as
  the other studio-voice copy in this codebase. **Note on the "~3/4 the space" ratio**:
  `100svh`/`75svh` are floors, not rendered heights — on mobile, FOLD's 3 stacked
  member cards (each with name/title/basedIn/background/expertise) push its actual
  height well past the floor, while Tej's shorter content mostly just fills his floor.
  A first pass caught this inverted (FOLD taller than Tej on mobile, the opposite of
  the brand-structure intent) and tightened FOLD's mobile-only padding and card gap to
  reduce the excess whitespace inflating it — but with real content this dense for 3
  people vs. one person's bio, an exact 3/4 pixel ratio on every device isn't something
  static CSS can strictly guarantee; the achievable target was "reads as clearly
  secondary" (lighter beige panel, smaller heading scale, tighter spacing), not a
  precise enforced ratio. Worth Parth's eyes once verified in a browser. Three
  review-agent passes (ux-reviewer, impact-tracker, edge-case-checker) also caught:
  FOLD members' based-in text used `--color-stone-dark` on the beige panel background,
  ~3.94:1 — below the 4.5:1 AA floor (swapped to `--color-bronze-darker`, already used
  one line above it for the same background); the two ScrollTrigger reveals used a bare
  `'top 75%'` instead of `'clamp(top 75%)'` — the exact unreachable-trigger incident
  IdeaTimeline hit twice and FeaturedProjects already guards against, reverted here by
  oversight, now fixed; Tej's new `bio` and the separate background/expertise paragraph
  right below it said the same two facts twice with drifted wording ("interiors" vs
  "detailing") — dropped the second paragraph now that `bio` covers the same ground;
  the FOLD intro read as a legal disclaimer ("not co-founders," defined by negation)
  rather than confident brand copy — reworded to state the same fact positively; the
  FOLD grid had no visual separator between cards, risking three people's info blurring
  into one paragraph — added a hairline `border-top` per card (both mobile and desktop,
  mirrors Philosophy.jsx's existing use of the same device on the desktop breakpoint).
  **Not visually verified in a real browser this session** — third session in a row the
  Claude-in-Chrome extension wasn't connected; only `npm run build` + `npm run lint` +
  the three agent passes confirm it.

## Not started yet

- Journal + Testimonials (hidden until real content exists)
- Contact section
- Polish pass (perf/accessibility/SEO) + final comparison against the Lovable baseline video

## How to preview

```
npm run dev
```
