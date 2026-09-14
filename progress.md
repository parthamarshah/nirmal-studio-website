# Build progress

Section-by-section log. Update this after each phase lands. Full context/decisions
live in `CLAUDE.md` — read that first if you're picking this up cold.

## Resume here

**v1 build started (2026-09-13, later session).** The full, Parth-approved v1 plan is in
`/Users/parth/.claude-personal/plans/let-s-start-working-on-jolly-fern.md` (phases 0–4:
content foundation → public site v1 → `/admin` backend foundation → backend editors →
launch), with clickable mockups at
https://claude.ai/code/artifact/a55baa12-f794-4828-81ba-b1febcf47009. Decisions made there
override older CLAUDE.md rules where they conflict (founders layout, AI concept images) —
CLAUDE.md is being updated phase by phase.

**Phase 1a (shareable project pages) — done (2026-09-14):** every visible project has a
pre-rendered page at `/projects/<slug>/` (own title, description, canonical, WhatsApp/
social preview image — cover, or the floor plan letterboxed for Shimla/Nishee) that
hydrates in the browser; homepage takeover kept (Parth chose option a) and now renders
the same `ProjectStory` (sections from content, Status fact, "Share" button). Project
pages load ~78KB gzip JS vs ~178KB for the homepage (separate chunks; no GSAP/Lenis/
Framer on project pages). `Nav` split into presentational `Nav` + `HomeNav`. Sitemap is
generated (10 URLs). Review fixes applied: FocusImage caption regression (adapter dropped
type/city), "Concept" label ambiguity ("AI visualization" tag, "In design" status), back
gesture closes the project-page image viewer, pannable floor plans on phones, trailing-
slash URLs, heading outline, share feedback. AI concept images stay takeover-only (not on
public project pages) until Parth assigns them in the Phase 3 backend — **ask him if he'd
rather remove them from the takeover too.** Edge-case agent stalled; equivalent checks run
by hand (escaping, `javascript:` links, hidden images, rotated/cropped cover, redirects).

**Phase 0 (content foundation) — done:** content moved to `content/` JSON + original
images in `content/media/`; `scripts/build-content.mjs` validates content and generates
all image sizes (sharp) before every dev/build; `src/lib/content.js` adapter +
`Img.jsx` + per-section `SectionBoundary`; share image/JSON-LD `sameAs` injected from
content. Site intended to look identical — verified by side-by-side headless-Chrome
screenshots of old vs new builds at 390px and 1440px (same heights, 13/13 images OK, no
console errors, overlays close cleanly) and a deliberately broken content file failing
the build. This closes the old "`sharp` WebP script" open thread below. Leftovers from Phase 0
are handled in 1a except the concept-art shim (now takeover-only, see above). Local-network note: this machine's npm downloads were
~2.5KB/s this session — sharp's libvips binary was fetched by hand and verified against
the lockfile's sha512.

**Previous session status (2026-09-13, earlier — www/Git-deploy session):** that
session was infra-only (no site code changed) and ended at `b28beb0`; the www/Git-deploy
fix is logged in full as the last "Done" entry below. Its `progress.md` handoff notes
were committed together with v1 Phase 0.

**How deploys work now (changed this session):** push to `main` → Cloudflare Pages
project **`nirmal-studio`** builds and deploys automatically (verified end-to-end
with commit `b28beb0`). No wrangler step. Both `nirmalstudio.com` and
`www.nirmalstudio.com` are attached to it. Run `npm run check:domains` after any
DNS/domain/deploy change. Older entries below that mention `wrangler pages deploy`
or the `nirmal-studio-website` project describe the previous setup.

**Open follow-ups from this session (none urgent, all need Parth):**
1. Delete the old `nirmal-studio-website` Pages project (no domains attached any
   more, kept only as rollback) — around 2026-09-20 to 09-27, **ask Parth first**.
2. Optionally narrow the Cloudflare Pages GitHub app's repo access on GitHub —
   `nirmal-erp` appeared in Cloudflare's repo picker, which suggests "All
   repositories" may have been selected. Unconfirmed.
3. Optionally ask Sagar (Parth's friend, built the old placeholder) to remove
   `www.nirmalstudio.com` from his GitHub Pages repo settings — harmless now.

**Still-open thread carried forward from earlier sessions — don't assume it's
resolved:** the AI-crawler block question (detailed just below). (The `sharp`
WebP-generation offer is done — delivered by v1 Phase 0.)

**Earlier session status (pre-2026-09-13): everything committed and pushed to
`main` (latest: `5846abc`). One open question
Parth hasn't answered yet** (asked directly in chat at the end of that
session, not yet responded to): does he want Cloudflare's AI-crawler block on
`nirmalstudio.com` (GPTBot/ClaudeBot/Google-Extended/etc.) turned off, given
his stated discoverability goal? See the dedicated entry just below for the
full context — check with him before doing anything about it, don't assume
either direction.

**The 2026-08-04 session was discussion-only — no code changed**, working tree
still clean at `5846abc`. Parth shared an Instagram reel (@realkushdesai) promoting
two Claude Code add-ons and asked whether to install them: the `ui-ux-pro-max-skill`
GitHub skill (a local database of UI styles/palettes/font pairings meant to give
Claude "taste") and 21st.dev's Magic MCP (pulls from a 10,000+-component shadcn/
Tailwind catalog via a hosted API). Verified both are real, legitimate open-source
projects, not scam links — but recommended **skipping both for this repo
specifically**: the "generic AI output" problem they solve was already solved
manually for this site through the multi-session design process now baked into this
file and `CLAUDE.md` (Fraunces/Syne, bronze/cream, the GSAP/Lenis/Framer split), and
Magic MCP's shadcn/Tailwind output doesn't match this project's plain-CSS/
data-driven component stack — installing either risks Claude drifting back toward
generic defaults on future work instead of staying consistent with what's already
locked in. Suggested UI-UX Pro Max only be installed at Parth's **user** level
(`~/.claude/skills`), not this project's `.claude/`, if he wants it available for
other/future projects. Proposed a more concretely useful next step instead: a small
`sharp`-based script to auto-generate missing `.webp` siblings from `public/images/`
during `npm run build`, directly targeting the recurring "`<picture>` doesn't fall
back on a 404" incident already in `CLAUDE.md`'s known-incident list. **Parth hasn't
said yet whether to build it — that's the open thread for next session, nothing
started.**

**`nirmalstudio.com` is now live** (same session, after the WebP/SEO work below).
Parth explicitly confirmed the go-ahead in chat first, per CLAUDE.md's one
mandatory-confirmation step. The `wrangler pages domain add` CLI command
documented earlier in this file **no longer exists** in the installed wrangler
(4.114.0 — `wrangler pages --help` confirms no `domain` subcommand). Done
instead via the Cloudflare dashboard directly (Claude-in-Chrome was already
logged into the Gurjar account, so this was self-serve, not handed to Parth as
manual steps): Workers & Pages → nirmal-studio-website → Custom domains → Set
up a custom domain → entered `nirmalstudio.com` → confirmed the DNS swap
(4 old `A` records pointing at GitHub Pages IPs → 1 `CNAME` to
`nirmal-studio-website.pages.dev`) → Activate. SSL provisioned fast (already
on Cloudflare DNS, same account). Verified live via `curl`: `https://
nirmalstudio.com` and `www.nirmalstudio.com` both 200 [**correction, 2026-09-13:
the www 200 was the old GitHub Pages placeholder, not this site — www was never
moved; see the last Done entry**], correct `<title>`,
correct canonical tag, favicon and a `.webp` image both serving correctly.
**This CLAUDE.md instruction is now stale and should be updated**: "the
`nirmalstudio.com` custom domain is intentionally NOT yet attached" is no
longer true, and the documented `wrangler pages domain add` command should be
corrected to "use the Cloudflare dashboard" for whoever reads this next.

**New discovery from attaching the domain, not something this session
configured — needs Parth's call**: `nirmalstudio.com`'s robots.txt now serves
a Cloudflare-injected block (visible via `curl https://nirmalstudio.com/
robots.txt`, confirmed absent on the `.pages.dev` URL, so it's a per-zone
Cloudflare account setting, not anything in this repo) that disallows several
AI crawlers by name — `GPTBot`, `ClaudeBot`, `Google-Extended`,
`Applebot-Extended`, `Amazonbot`, `Bytespider`, `CCBot`,
`meta-externalagent`, `CloudflareBrowserRenderingCrawler` — plus a
`Content-Signal: ai-train=no` header. This doesn't affect classic Google
search ranking (regular Googlebot is unaffected, still `Allow: /`), but it
does block the crawlers behind AI answer engines (Google's AI Overviews,
ChatGPT's browsing/citations, Claude's browsing) from referencing the site.
Given Parth's stated goal is being found when people search for architects,
worth explicitly asking him whether he wants these AI crawlers allowed —
this is a Cloudflare dashboard zone setting (likely under Bots / AI Crawl
Control for the nirmalstudio.com zone), not a code change.

**Client permission for the Shimla/Nishee floor plans is now confirmed
secured** (see the dedicated entry further down for the full history) — no
longer a blocker.

**Live Slow-4G re-test — partially done, with a real caveat.** The
Claude-in-Chrome `document.hidden`-stuck-true environment bug that blocked
earlier sessions was NOT present this time (confirmed via
`document.hidden === false`, `hasFocus() === true`) — full live scroll-through
of the entire page worked, screenshots were real (not stale), and this
produced the **first actual live visual confirmation** of several things only
previously verified via DOM inspection or code review: Nav's text-shadow
contrast over Hero reads correctly against a bright building facade, Process's
desktop pin/scrub genuinely advances its progress dots on real scroll (01→05
watched live), IdeaTimeline's floor-plan "Tap to enlarge" hint renders
correctly, Contact's "View on map" click-to-load placeholder correctly does
NOT auto-load the iframe, and all 13 images rendered during a full scroll
correctly resolved to `.webp` except the two floor-plan drawings (`.jpg`,
confirmed via `img.currentSrc`) — the WebP wiring works in a real browser, not
just in code review. **However**, no actual network-throttling tool is
exposed to this session (no DevTools-protocol network-conditions control), so
the specific "Slow 4G, cold cache" numbers Parth verified manually before
couldn't be reproduced exactly. What was measured instead: a real (but
warm-cache-assisted) page load came to ~1.4MB total encoded content across 17
requests — not directly comparable to the old ~7.1MB/~40s Slow-4G figure, but
directionally consistent with the WebP conversion's measured 8.6MB→4.6MB
savings on the image set specifically. **A true cold-cache Slow-4G number
still needs Parth to run it himself** (Chrome DevTools → Network → Slow 4G →
disable cache → hard reload) if he wants the exact before/after comparison —
2 minutes, matches his own established, more rigorous test method from an
earlier session.

**WebP image-optimization pass landed** (same session, after the SEO/brand work
below). 44 of 46 files under `public/images/` now have a `.webp` sibling
(Pillow, quality=80, generated on disk — `public/` isn't part of Vite's import
graph, so this can't be a build-time plugin, see `src/lib/images.js`'s comment).
Every `<img>` referencing a converted JPEG is now wrapped in
`<picture><source type="image/webp" srcSet={webp(path)} /><img src={path} .../></picture>`
across `Hero.jsx`, `FocusImage.jsx`, `Philosophy.jsx`, and 5 spots in
`FeaturedProjects.jsx` (card thumbnail, detail hero, gallery thumbnails,
conceptArt thumbnails, shared lightbox). **The two floor-plan drawings
(`nishee-house`/`shimla-house` `drawings-ground-floor.jpg`) were deliberately
excluded and have no `.webp` sibling** — Parth confirmed on a real phone that
the fine dimension text under each room label is already barely legible;
lossy compression would make that worse. `IdeaTimeline.jsx` wasn't touched at
all (both its image spots are always a drawing). `FeaturedProjects.jsx`'s
mixed card-image case (`cardImage()` returns either a photo or, for
Shimla/Nishee, a drawing) and its shared lightbox (`mode: 'pan'` = drawing,
`mode: 'fit'` = photo) both gate the new `<source>` on the existing
`cardIsDrawing()`/`mode` checks, verified by edge-case-checker to be
unreachable-wrong given current and plausible future `projects.js` data.
Byte savings on the converted set: 8.6MB → 4.6MB (~47%) for any WebP-capable
browser; the two drawings stay full-size JPEG. `og:image`/JSON-LD `image` in
`index.html` deliberately left pointed at the original JPEG (social-media
scrapers are unreliable with WebP). Also fixed in the same pass: the grid
card's `alt` text (added last session for image-search SEO) was giving
screen-reader users an inaccurate description for Shimla/Nishee's floor-plan
cards — described a drawing as if it were project photography, contradicting
the visible "Floor plan" tag. New `cardAlt()` helper in `FeaturedProjects.jsx`
says "floor plan" for those two, keeps the descriptive name/type/location alt
for the other 7. **New CLAUDE.md known-incident entry**: a `<picture>`'s
`<source>` does NOT fall back to `<img>` on a 404, only on a genuinely
unsupported type/media — so a future project image added to `projects.js`
without a matching `.webp` sibling would silently show broken in modern
browsers, not just skip the optimization. Three review-agent passes
(impact-tracker, ux-reviewer, edge-case-checker) ran against this before
commit; impact-tracker went further than usual and actually rendered the
production build in headless Chromium to confirm no `<picture>`-wrapper CSS
regression (image rects pixel-identical to before, `.webp` sources actually
selected) rather than reasoning from code alone. Perf items intentionally
**not** done this pass, per explicit advisor guidance: font self-hosting
(would put the twice-verified `display=optional` font-flash fix at risk with
no way to re-test it this session) and JS code-splitting (166KB gzipped
against ~9MB of images — the real problem was always images, not the bundle
warning). **Not measured live** (no Slow-4G re-test this session, same
Claude-in-Chrome environment blocker) — the byte-count math above is real,
but the "~40s to finish on Slow 4G" figure from the original perf audit
hasn't been re-run to confirm the actual felt improvement.

**Local-SEO + site-essentials pass landed this session** (nav, favicon, OG/meta
tags, robots.txt/sitemap, JSON-LD structured data, social-links plumbing, Contact's
real address + map) — full detail in the matching "Done" entry below. Two things
Parth needs to see, not just discover:

- **Brand-identity mismatch — raised and resolved this session, keep this
  reasoning for later.** Parth shared the real Nirmal Studio logo
  (`Nirmal Studio Logo.png` / `Business Card - Front.psd`) mid-session. Pulling
  the PSD's actual text-layer metadata (via `psd-tools`, not just eyeballing
  pixels) showed the real font is **"Stinger Wide Trial"** (Bold for "nirmal",
  Light for "studio") — the exact same unlicensed trial font CLAUDE.md already
  documents as deliberately replaced by Syne in an earlier session, specifically
  because a trial/demo font isn't licensed for finished commercial work. So the
  business card itself was apparently built with the trial version and never
  updated. Told Parth this directly rather than implementing the trial font;
  he chose to **keep Syne** (already the deliberate licensed stand-in for this
  exact Bold/Light pairing) rather than buy a license or find a closer free
  alternative. Also asked separately about the logo's actual colors (olive
  `#6C705D` / rust `#A94424`) vs. the site's bronze/cream palette (wordmark-only
  swap vs. sitewide vs. no change) — Parth chose **no change, keep bronze/cream**
  everywhere. Net result: no font/color changes needed anywhere in the codebase.
  One exception left as-is, not reverted: the new favicon (see the matching
  "Done" entry) uses the real logo's actual "n" glyph and olive color, cropped
  from the real artwork — built *before* the color question was asked, in
  direct response to Parth sharing the file specifically for the favicon. Small
  and self-contained enough (a 16–32px browser-tab icon) that reverting it to
  a fake bronze-colored placeholder would be a real-asset-to-fake-asset
  downgrade for a marginal consistency gain — flagged here rather than silently
  decided, but not undone. **If Parth ever wants a byte-identical Stinger Wide
  license purchased, or wants to revisit this later, that's the one open
  thread — otherwise this is now closed, don't re-ask.**
- **Google Business Profile**: Parth said he can create one now (he has a real
  address: `201, Second Floor, Tilakraj Complex, Panchavati 1st Lane, Ambavadi,
  Ahmedabad, Gujarat 380006`, now live on the Contact section and in the JSON-LD).
  This is flagged as the single highest-leverage action for his stated goal
  (ranking for "architect in Ahmedabad" etc.) — bigger than anything code-side —
  but it's a self-serve external action on his Google account, not something done
  in this repo. Walk him through it next session if he hasn't already.
- **Nav's mobile layout and the smooth-scroll-on-click behavior are unverified
  live** — Claude-in-Chrome hit the exact same environment bug already documented
  below (`document.hidden` stuck `true`, `resize_window` silently no-opping,
  screenshots showing stale frames) that blocked Process.jsx's mobile check in an
  earlier session. Verified everything possible via direct DOM/computed-style
  JS calls instead (z-index stacking against FeaturedProjects' takeover, the
  takeover's Tab-trap not leaking to nav links, mobile menu open/close/Escape/
  click-outside state logic) — real interactive/visual confirmation on an actual
  narrow viewport is still owed once that environment issue clears.
- Domain: `nirmalstudio.com` is still not attached to the Pages project (unchanged
  this session) — all new SEO tags (canonical, OG, sitemap, robots.txt) already
  point at `https://nirmalstudio.com` on the assumption it goes live within a day
  or two, per Parth. Attaching it is still the one step requiring his explicit
  go-ahead immediately before running it, per CLAUDE.md.

---

**The deferred verification pass (see below) has now happened.** Claude-in-Chrome
connected successfully this session (fourth attempt — needed a full Chrome quit/
restart after install, not just a reload) and drove the live site directly. Findings:

- **Pushed + redeployed first.** The live site had been 2 commits stale (missing
  Studio/FOLD, Contact/Journal/Testimonials, and the back-button fix entirely) —
  pushed `2efa57d`/`d66080f` and redeployed before testing anything, since testing a
  stale build would have been pointless.
- **Found and fixed a real bug via live DOM inspection, not just visual check**: closing
  the Featured Projects takeover or its lightbox (Escape, backdrop, ×, or the browser/
  mobile back button) cleared React state correctly, but the outgoing Framer Motion
  overlay stayed `position: fixed`, full-viewport, and fully `pointer-events: auto`
  for its whole 0.25–0.3s exit fade — invisible but still swallowing real clicks on the
  page underneath. Caught with `document.elementFromPoint()` landing inside the
  "closed" dialog, confirmed reproducible, not a one-off. Fixed in
  `FeaturedProjects.jsx` (`disableTopLayerInteraction`, called from `closeTopLayer` and
  the `popstate` handler) by setting `pointer-events: none` synchronously via a direct
  DOM ref the instant any close begins, rather than waiting on Framer's `exit` (which
  only applies non-animatable values *after* the animation finishes — doesn't help
  here). Review agents (impact-tracker, ux-reviewer, edge-case-checker, run against
  this specific fix) caught two follow-on bugs the fix itself introduced, both fixed
  and re-verified live before commit:
  - A fast close-then-reopen (before the exit fade finishes) reuses the same DOM node
    (AnimatePresence isn't keyed by slug/image), so the leftover `pointer-events: none`
    would otherwise silently and *permanently* disable the reopened overlay. Fixed by
    resetting it (`removeProperty`) at the top of `openProject`/`openLightbox`.
  - `.project-detail-close` and `.project-lightbox-close` sit at the exact same fixed
    screen position by design (so the × doesn't jump between layers) — once the
    lightbox stops intercepting clicks, a fast second tap in that same spot falls
    through onto the detail panel's close button underneath, cascading one tap into
    closing both layers. Fixed with a short-lived guard ref (`closeGuardRef`, ~350ms,
    cleared on next open) at the top of the shared `closeTopLayer`, since both close
    buttons route through it. Reproduced the exact click-through with
    `elementFromPoint` before the fix, confirmed it lands on `project-detail-close`,
    confirmed the panel now stays open after the fix.
  - `IdeaTimeline.jsx`'s floor-plan lightbox had the identical latent pointer-events
    bug (same `AnimatePresence` + `exit={{opacity:0}}` + fixed-overlay shape) — fixed
    the same way pre-emptively, not yet reported by a user. Full writeup, and the
    general "disable on close / reset on open / guard same-position click-through"
    pattern, added to CLAUDE.md's known-incident list so the next new overlay gets
    checked against all three, not just the first.
- **Back-button checklist items 1–4 (single close, nested back-twice, double-tap race,
  Tab-trap) all verified live and pass**, including after the fixes above.
- **Studio/FOLD mobile sizing (item 6): measured, not just eyeballed** — at a 555px-wide
  viewport, Tej's block rendered 958px tall, FOLD's rendered 1250px tall. FOLD is
  ~30% *taller* than Tej's section, not ~75% of it — the brand-structure ratio is
  inverted on mobile, not just "over the floor" as previously suspected. Confirmed via
  `getBoundingClientRect()`, not a screenshot guess. Root cause: 3 stacked member
  cards' worth of real text vs. Tej's one bio paragraph — the spacing trim already
  applied (see the "Studio (Tej Shah) + Network (FOLD)" entry below) only accounts for
  ~240px of the ~530px gap; the rest is genuinely the text itself, which CSS spacing
  changes can't close. Worth noting for whoever reads this next: visually, Tej's block
  is mostly centered whitespace around a short paragraph (spacious/editorial, reads as
  primary) while FOLD is a dense information block (reads as reference/secondary) —
  the *felt* hierarchy may still be correct even though the raw pixel ratio is
  inverted, but this wasn't confirmed with Parth directly and is called out to him
  separately rather than assumed. Not changed this session — the real fix (shortening
  member bios) touches factual copy about three named people, which is his call per
  CLAUDE.md, not something to unilaterally trim.
- **Process's own dedicated browser check finally happened this session** (three-plus
  sessions deferred). Desktop pin/scrub, the progress bar, and dot-click navigation
  were verified correct via live DOM/ScrollTrigger state inspection (programmatically
  scrolled to the pin's midpoint and read back the track's actual transform, the active
  dot, and the fill width — all consistent with scroll progress). Reduced-motion was
  verified by code read rather than by toggling the OS setting live: `prefersReducedMotion()`
  gates `pinned` before `gsap.matchMedia` ever registers, so a reduced-motion desktop
  user never gets the pin and falls back to the exact same native scroll-snap code path
  mobile uses — confirmed this is one shared code path, not two to separately maintain.
  **Found and fixed a real bug**: resizing down from desktop to mobile mid-scroll (say,
  stage 4 of 6) correctly cleared the leftover inline transform/width (the known-incident
  pattern already documented in CLAUDE.md), but never reset the `activeIndex` React
  state — so the progress dots and label kept showing "04 — Resolve the Detail" while
  the carousel itself visually reset to panel 1 (its native `scrollLeft` starts at 0
  on the mobile layout). Fixed in `Process.jsx` by resetting `activeIndex` to 0 in the
  same cleanup that already clears the stale inline styles. Review agents (impact-tracker,
  ux-reviewer, edge-case-checker, run against this specific fix) independently caught two
  more real gaps in the same class, both fixed and re-verified via lint/build before commit:
  - The fix only covered desktop→mobile; the mirror direction (resizing mobile→desktop
    mid-carousel, e.g. a tablet rotating past 1024px) had no equivalent correction — the
    dots/label could keep showing wherever the mobile scroll listener last left them,
    relying on ScrollTrigger's `onUpdate` happening to fire at the right moment rather
    than guaranteeing it. Fixed by explicitly deriving `activeIndex` from the new
    ScrollTrigger's actual `.progress` right after the existing rAF-deferred
    `ScrollTrigger.refresh()` call, instead of assuming `onUpdate` fires on creation.
  - Independently of this fix: `.process-progress-fill` (the bronze progress bar) was
    only ever updated inside the desktop-pinned effect — on mobile/reduced-motion it sat
    frozen at its CSS default (0%) through an entire 6-stage swipe, even though the dots
    and label beside it correctly advanced. Pre-existing, not introduced by this session's
    fix, but exposed by contrast with it. Fixed by updating the fill width inside the same
    mobile `handleScroll` listener that already derives `activeIndex` from `scrollLeft`.
  **Not fully closed out**: partway through this session the automated Chrome window
  lost OS-level screen focus
  (`document.hidden` stayed `true` even after `hasFocus()` returned `true`), which
  blanked every screenshot and silently no-opped `resize_window` (the tab never
  received the resize — `window.innerWidth` stayed stuck at its pre-loss value even
  though the OS-level window itself resized). This blocked a real visual/interactive
  check of the resize-across-breakpoint case and the mobile swipe-snap carousel on an
  actual narrow viewport — those were verified by code review only (the mobile carousel
  runs the identical fallback logic just exercised via the reduced-motion path above,
  so confidence is reasonably high, but a quick live visual pass is still worth doing
  once Claude-in-Chrome's window is back in focus). A general aesthetic/visual read of
  the Featured Projects grid and galleries, and Contact's WhatsApp link opening a real
  wa.me conversation, remain open too. The font-flash fix (item 5) and Contact's content
  calls (item 7) were already verified in a prior session and are unchanged.

Landed this session, in order: the Loader font-flash fix (below), Studio/FOLD
(Task #10), a back-button fix for Featured Projects' full-screen takeover, and
Journal/Testimonials/Contact (Tasks #9 already had its own entry; this closes out
#11 and the two hidden-until-content sections).

**Featured Projects back-button fix**: neither the project-detail takeover nor its
nested lightbox previously handled the browser back button or mobile back-gesture at
all — this is a single-page app with no router, so pressing back while either was
open navigated away from the site entirely instead of closing it. Fixed with
`history.pushState`/`popstate` in `FeaturedProjects.jsx`: each open pushes one entry,
every close path (Escape, both × buttons, both backdrop clicks) routes through one
`closeTopLayer()` function that pops history instead of clearing state directly, so
a real back-button press and an in-app close button now go through the exact same
code path. Two real bugs surfaced and got fixed only because they were checked, not
assumed clean from build/lint:
- **A double-tap-to-close race** — `history.back()` is async, so two fast taps on a
  close button (nothing disables pointer events during the 0.3s/0.25s exit
  animation) could both fire before the first pop landed, popping one entry too many
  and leaving the site. Fixed with a `closingRef` flag set synchronously before the
  first `back()` call and cleared only once `popstate` actually lands.
- **A genuine crash-on-every-render bug** (not caught by `npm run build` or
  `npm run lint` — only actually rendering the component catches it): the new
  `closeTopLayer` function was referenced in an earlier `useEffect`'s dependency
  array before its own `const`/`useCallback` declaration later in the same function
  body. `const` isn't hoisted, so this threw "Cannot access 'closeTopLayer' before
  initialization" on every single render — meaning `FeaturedProjects` (which mounts
  unconditionally, no error boundary anywhere in this app) would have white-screened
  the entire site the moment this shipped. Caught by an agent doing an actual SSR
  render of the component (`react-dom/server` + a minimal `window.matchMedia` stub),
  independently re-verified the same way after the fix. Fixed by reordering the
  declarations above the effect that closes over them. **Added to CLAUDE.md's
  known-incident list** — this exact shape (an earlier effect's deps array
  referencing a later `const`/`useCallback`) is worth checking on any future
  component that adds similar close-on-back-button plumbing, since build/lint will
  stay green the whole time regardless.
- Also fixed: `aria-modal` was on the lightbox but not the project-detail dialog
  (should be on both); the lightbox had no Tab-trap, so keyboard focus could escape
  to the project-detail panel sitting behind it; `data-lenis-prevent` was applied
  unconditionally to the lightbox even though only its `pan` mode (the floor-plan
  drawing) is a real scroll container — `fit` mode (every gallery/concept-art
  thumbnail, the majority of opens) isn't, so a desktop mouse wheel over it was
  scrolling the real document invisibly behind the full-screen overlay. This is the
  exact "inverse" incident CLAUDE.md already documents from Process.jsx, and the one
  it explicitly predicted this component would hit.

**Journal/Testimonials/Contact** (`Journal.jsx`, `Testimonials.jsx`, `Contact.jsx`,
all new): Journal/Testimonials both hide entirely while their data arrays are empty
(still true right now) — their expected data shape is documented directly in
`src/data/journal.js`/`testimonials.js` (a commented example entry), not just in the
component, so adding real content later is a data edit with no guessing. Verified
both actually render correctly once populated, not just their empty-return branch,
via an SSR render with a temporary mock data file. Contact has no form (nothing in
this project authorizes a backend/form handler), no map/office block (omitted
entirely rather than shown as a placeholder — same precedent as Journal/Testimonials
hiding rather than showing "coming soon," add it back once Parth supplies an office
address/photos), and a "Book a Consultation" CTA that's copy on a WhatsApp link
(`wa.me`), not a real scheduling-tool integration, per the original planning doc.
Two content/design calls made this session that Parth should see deliberately, not
discover:
- The WhatsApp number (`9106998434`) was confirmed directly with him before writing
  the `wa.me` link — not inferred from the "910 699 8434" formatting, since a wrong
  digit there would silently route a real enquiry to a stranger. The link is now
  prefilled with a starter message ("Hi Tej, I'd like to talk about a project.") so
  the first thing a visitor sees isn't a blank compose box.
- The CTA is a **filled** bronze pill, not the border-only pill style used for
  secondary controls elsewhere (e.g. Featured Projects' Prev/Next) — it's the one
  conversion action on the whole site and should read as visually distinct from a
  secondary nav control.
- Also repointed Hero's CTA from `#philosophy`/"Our Approach" to `#projects`/
  "Explore Our Work" — a stale code comment had been flagging this exact repoint
  since Featured Projects (Task #9) landed two sessions ago and it never happened;
  the old comment also named a `#featured-projects` anchor that was never real
  (FeaturedProjects.jsx's actual id is `projects`). This is the site's only in-page
  jump link and user-visible copy, so flagging it explicitly rather than letting it
  slide into "just another commit."
- **There is still no nav anywhere on this site** — Contact is reachable only by
  scrolling the entire page from the top. Worth deciding whether that's fine for
  launch or whether a persistent nav/jump-to-contact affordance belongs in the polish
  pass.

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

Task #9 (Featured Projects) landed two sessions ago — see its "Done" entry below.
Its interaction logic (open/close, back-button, nested lightbox, Tab-trap, the
pointer-events bug and its two follow-ons) is now verified live — see "Resume here"
above. **Not yet done**: a general aesthetic/visual read of the grid and galleries
themselves (card layout, image quality, gallery browsing feel) beyond the
interaction-logic checks — worth a look, though lower risk than the interaction bugs
already found and fixed.

Task #8 (Process) got its first real QA pass this session — see "Resume here" above
for what was checked (desktop pin/scrub/dots/progress-bar, verified live via DOM/
ScrollTrigger state), the three real bugs found and fixed (the `activeIndex` desync on
resize-down-mid-scroll, its mirror on resize-up-mid-scroll, and the mobile progress-fill
bar being permanently frozen at 0%), and what's still only code-reviewed rather than
live-verified on an actual narrow viewport (resize-across-breakpoint visuals, mobile
swipe-snap) — blocked mid-session by the automation browser losing screen focus, not by
anything in the component itself. Worth a quick live visual confirmation once that's
resolved, but not urgent. All three fixes are committed (`48e90b2`, `df6fd7d`), pushed,
and deployed — see the commit-status line below.

Also still needs Parth to re-verify the two phone fixes from an earlier session
(floor-plan lightbox pan/zoom + close button, Philosophy's border-only pill badges) —
see the "Lightbox + Philosophy chip fixes" entry below for exactly what changed.

**Client permission for the Shimla/Nishee floor plans (public display on both
projects' Featured Projects card art and the pan-zoom lightbox) is confirmed
secured as of a later session — no longer a blocker.** One thing still waiting
on Parth, unrelated to code: Tej's sign-off on the Philosophy paragraph +
IdeaTimeline stage copy + Process's stage copy + Featured Projects' per-project
challenge/materials/construction copy (all generic "studio voice," not
confirmed facts — see `projects.js`'s header comment).

Everything below is committed, pushed to `main`
(`github.com/parthamarshah/nirmal-studio-website`), and deployed at
`nirmal-studio-website.pages.dev` as of this session (pushed `2efa57d`/`d66080f` and
redeployed at the start of this session — the live site had been 2 commits stale,
missing Studio/FOLD, Contact/Journal/Testimonials, and the back-button fix entirely).
The Claude-in-Chrome extension connected successfully this session (fourth attempt —
needed a full Chrome restart after install) and was used to run the deferred
verification pass — see "Resume here" above for what it found. **Two more commits
landed later in the same session**, after the browser lost screen focus (see "Resume
here"): `48e90b2` (the resize-down `activeIndex` fix) and `df6fd7d` (the resize-up
mirror fix + mobile progress-fill fix, both caught by review agents run against the
first fix). Both pushed and redeployed — live at
`https://f4591a3b.nirmal-studio-website.pages.dev` (and propagating to
`nirmal-studio-website.pages.dev`). Working tree is clean, nothing uncommitted.

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
  deploy dist --project-name nirmal-studio-website` after each build phase —
  **superseded 2026-09-13**: now Git-connected project `nirmal-studio`, push = deploy).
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
  left for this task — client permission for showing both Shimla's and Nishee's floor
  plans publicly this way is now confirmed secured (see the "Resume here" entry above).
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
- **Featured Projects back-button fix** (`FeaturedProjects.jsx`) — full detail,
  including the crash-on-every-render bug this caught and fixed, is in "Resume here"
  above rather than duplicated here. Short version: browser back / mobile back-gesture
  now closes the project-detail takeover and its lightbox instead of navigating away
  from the site; caught and fixed a double-tap-to-close race and a real TDZ crash
  along the way, both only via review-agent passes that actually rendered the
  component (SSR), not build/lint alone.
- **Journal, Testimonials, Contact** (`Journal.jsx`, `Testimonials.jsx`,
  `Contact.jsx`) — Sections 9–11, closing out the original section plan. Full detail
  in "Resume here" above. Short version: Journal/Testimonials hide entirely until
  real content exists (data shape now documented in their own data files, not just
  the component); Contact has no form and no map/office block (both intentional
  omissions, not gaps), a WhatsApp CTA confirmed directly with Parth before writing
  the link, and a repointed Hero CTA (`#projects`/"Explore Our Work") that closes out
  a two-session-old stale TODO comment. **Not visually verified in a real browser
  this session** — see the explicit checklist in "Resume here" for what the deferred
  verification session needs to look at.
- **Local-SEO + site-essentials pass** (`Nav.jsx` new; `index.html`, `Contact.jsx`,
  `Hero.jsx`, `tokens.css` edited; `social.js`, `robots.txt`, `sitemap.xml`,
  `public/icons/*` new) — driven by Parth's stated priority: rank for "architect"
  searches in Ahmedabad/Indore/Udaipur/Surat/Gandhinagar and the three states.
  **Nav** (`Nav.jsx`): persistent fixed bar, transparent/white text over Hero,
  swaps to solid cream + dark text once Hero scrolls out of view via a
  `ScrollTrigger` boundary on `#hero` (new id added to Hero.jsx) — a discrete
  onEnter/onLeaveBack toggle, not a scrub, so intentionally not gated behind
  `prefersReducedMotion()` the way this codebase's other ScrollTrigger effects
  are (hiding it would leave nav text illegible over light body content for
  reduced-motion users). Links route through `scrollTo()`, Journal's link uses
  the same emptiness check as `App.jsx`. Mobile menu is a plain CSS class toggle
  (opacity/max-height transition, `pointer-events` set directly not animated),
  deliberately not Framer/AnimatePresence — sidesteps the pointer-events-during-
  exit-fade bug class this codebase already hit twice (FeaturedProjects,
  IdeaTimeline). `--z-nav: 80` added to `tokens.css`, below `--z-overlay: 90` so
  FeaturedProjects' takeover still visually covers the nav — confirmed via
  `document.elementFromPoint()`, not just code reading. SSR-rendered `Nav.jsx`
  (react-dom/server + a `window.matchMedia` stub) to catch the TDZ-declaration-
  order bug class that hit FeaturedProjects before; rendered clean. Three
  review-agent passes (impact-tracker, ux-reviewer, edge-case-checker) caught
  real issues, all fixed: nav text/hamburger bars had no `text-shadow`/
  `drop-shadow` contrast floor over Hero (same fix class as Hero's own H1/CTA);
  `SOCIAL_ICONS[platform]` could silently render an empty icon slot for a
  future unmatched `social.js` key (now filtered); a stale doc comment in
  `social.js` claimed `Nav.jsx` consumed it when only `Contact.jsx` does.
  **Favicon** (`public/icons/*`): started as a hand-drawn geometric "N" (no
  logo file was available yet), then Parth shared the real logo mid-session
  (`Nirmal Studio Logo.png`) — replaced with the actual "n" glyph cropped from
  that file, real color (`#6C705D` olive) on the site's cream background;
  `favicon.svg` embeds the same raster crop (no vector source exists) so all
  favicon delivery paths show the same real mark, not a mismatched invented one.
  **This surfaced a real brand-identity question — see "Resume here" above,
  not resolved this session.**
  **Meta/OG/structured data** (`index.html`): canonical + OG + Twitter tags,
  title/description honestly scoped (names Ahmedabad/Indore/Udaipur, where
  real projects/address exist; "serving Gujarat, Rajasthan & Madhya Pradesh"
  service-area language for the rest — no visible claim of built work in
  Surat/Gandhinagar, which have zero projects in `projects.js`). JSON-LD
  `schema.org/Architect` block with the real address, `areaServed` listing
  all 8 target cities/states (the legitimate place for the full list, since
  it's a service-area claim not a portfolio claim), and `sameAs` deliberately
  hardcoded (not read from `social.js` at runtime) so it's guaranteed present
  in the raw HTML for crawlers.
  **Contact.jsx**: added the real address (Parth supplied it mid-session:
  `201, Second Floor, Tilakraj Complex, Panchavati 1st Lane, Ambavadi,
  Ahmedabad, Gujarat 380006`) and a Google Maps embed — converted to
  click-to-load after ux-reviewer flagged an always-loaded iframe on the
  page's last section as needless weight on an already perf-heavy site, not
  left as `loading="lazy"` alone (which only defers *when*, not *whether*).
  Social-icon row wired to new `social.js` (all null right now, same
  hide-until-real-content pattern as Journal/Testimonials).
  **`robots.txt`/`sitemap.xml`**: added, single-URL sitemap since this is a
  one-page app with in-page anchors, not separate indexable routes. A
  Cloudflare Pages `_headers`-based noindex for per-deploy preview URLs was
  considered and dropped — Pages' `_headers` matches by path only, not
  hostname, so it can't distinguish the real domain from `*.pages.dev` on a
  single static deploy; the canonical tag is the actual mitigation here.
  **Not visually verified live** — see "Resume here" for the exact
  environment blocker (same `document.hidden`-stuck-true bug as before).
- **www domain fix + Git-connected auto-deploy (2026-09-13, `b28beb0`)** — Parth
  noticed `www.nirmalstudio.com` showed the old dark "coming soon" page while the
  bare domain showed the real site. `dig`/`curl` showed why: `www` was a DNS-only
  CNAME to `sagarvora.github.io` (his friend Sagar's GitHub Pages — the old
  placeholder, last-modified Dec 2024; *not* Lovable, as earlier notes said). The
  go-live had only swapped the apex; www was never moved, and the go-live `curl`
  check mistook GitHub's 200 for success. Also meant an outside GitHub account
  controlled what www showed. Chrome extension wasn't connected and wrangler's OAuth
  token has no DNS-edit scope, so Parth did the dashboard clicks himself, one step
  per screenshot (his preference — faster than Claude-in-Chrome). Sequence: exported
  the zone (6 records; `~/Downloads/nirmalstudio.com.txt`) → deleted the www CNAME →
  attached www to the old project (instant fix) → confirmed the old direct-upload
  project can't be Git-connected, so created new Pages project **`nirmal-studio`**
  via "Continue to Pages" (legacy Pages flow, not Workers — kept identical to what
  already worked), granted the Cloudflare Pages GitHub app access to this repo,
  preset React (Vite) / `npm run build` / `dist`. Parth questioned hardcoding a
  `NODE_VERSION` env var — agreed and dropped it, so `.node-version` (24) in the repo
  is the single source of truth. Verified the new build matched live (identical
  index.html + asset hashes, no untracked files in `public/`) → moved www (dashboard
  recreated its CNAME automatically) → moved apex (it did **not**: ~2–3 min of
  Cloudflare 522 until Parth repointed the apex CNAME to `nirmal-studio.pages.dev`
  by hand). Caught two near-misses from screenshots: a leftover "1 selected / Delete
  1 record" bulk selection on the DNS page, and the apex's Remove dialog opened
  instead of www's. MX/SPF (Spaceship email forwarding) and `erp` CNAME untouched,
  confirmed after. Parth chose to serve the site on both hostnames rather than
  redirect www → apex (canonical tag already points at the apex, so fine for SEO).
  Added `scripts/check-domains.sh` / `npm run check:domains` (both hosts must return
  200 + `server: cloudflare` + real title; negative-tested against the GitHub host),
  rewrote CLAUDE.md's Deploy section. Pushed; auto-deploy of `b28beb0` confirmed in
  the dashboard. Skipped impact-tracker/ux-reviewer/edge-case-checker for the commit
  — docs + one shell script + one `package.json` script line, no site code.

## Not started yet

- Polish pass (accessibility/final Lovable-baseline comparison) + a Slow-4G
  re-test now that WebP conversion has landed (see "Resume here" above) — the
  original ~7.1MB/~40s Slow-4G numbers predate that work and haven't been
  re-measured live. Deliberately still not done: responsive `srcset` (multiple
  resolutions per image, not just format), JS code-splitting (505KB+ bundle —
  a real advisor call this session was that images were always the actual
  problem, not the bundle warning), and self-hosting fonts (would risk the
  twice-verified `display=optional` font-flash fix with no way to re-test it
  this session).
- Setting up a Google Business Profile for local search (Parth has a real
  address now and said he can do this) — deliberately deferred a few days,
  not urgent, see "Resume here" above.
- Journal/Testimonials sections exist (`Journal.jsx`/`Testimonials.jsx`) but stay
  hidden until real content is added to their data files — this is the deliberate
  "hide entirely, no coming-soon placeholder" behavior per CLAUDE.md, not
  unfinished work.

## How to preview

```
npm run dev
```
