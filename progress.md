# Build progress

Section-by-section log. Update this after each phase lands. Full context/decisions
live in `CLAUDE.md` — read that first if you're picking this up cold.

## Resume here

### ▶ START HERE (updated 2026-09-24, step 7 all but the review gate)

**Where things stand:** Phase 1 is live. **Phase 2 (the `/admin` backend) is on step 7 of 7**,
on the `admin-test` branch, deployed to the preview at
**https://admin-test.nirmal-studio.pages.dev/admin/**. Step 6 is closed: on 2026-09-22 Parth
published a Settings change from the preview with his real PIN, watched it reach **Live ✓**,
and undid it (`d2a1b23` then `22821bb`, `/_version.json` confirming each). That proves the
whole deployed chain — publish → GitHub → rebuild → status → undo — on a real deployment.

**Do these first, in this order:**
1. **`git checkout admin-test`**, then **`git pull`**. A Publish from the preview is a real
   commit on `admin-test`, so the branch moves without anyone pushing. `main` deliberately
   has no `functions/` (see the ⚠ BRANCH LAYOUT note below).
2. **Finish step 7: the review gate over the whole branch** — impact-tracker,
   edge-case-checker, ux-reviewer across everything since `main`, not just the last commit.
   Each piece was reviewed as it landed (and the reviews found real bugs both times — see
   STEP 7 below), but the branch as a whole hasn't been.
3. **Then the launch decision**, which is Parth's: merging `admin-test` into `main` is what
   puts `/admin` on `nirmalstudio.com`. The checklist for it is immediately below.

**What is NOT in step 7, deliberately:** referential safety in the editor ("don't delete an
image that's still a cover") and upload staging (size/type limits, HEIC). Parth moved both to
Phase 3 on 2026-09-22, to be built with the project and founder editors they attach to —
there is nothing to attach them to yet, since Settings is the only editor.

**Before any admin-test → main merge (the launch):** run
`git diff main admin-test -- content/` (preview publishes are real commits and would carry
test values to the live site), check `SELECT COUNT(*) FROM drafts` on the remote **production**
D1 (`nirmal-studio-admin-production`; should be 0), and give production its own secrets
(`ADMIN_PIN_HASH` ≤100k iterations, `GITHUB_TOKEN`, and a **new** `SESSION_SECRET`, different
from the preview's). **Merge the whole branch** — never cherry-pick `functions/` onto `main`
without the new `wrangler.toml`, because `main`'s copy still points production at the
preview's database. After launch: `npm run check:domains`, sign in on nirmalstudio.com/admin,
then `npx wrangler d1 execute DB --remote --env production --command "SELECT COUNT(*) FROM
sessions"` should be 1 (proves production uses its own database).

**STEP 7 (2026-09-22/23): hardening.** Everything below is done, committed and pushed to
`admin-test`; only the branch-wide review gate is left. Done: the production D1/KV split, the
pane-switch edit-loss fix, and **changing the PIN from Settings** (migration `0003_admin_settings.sql`, applied
`--remote` to both databases). The stored hash outranks `ADMIN_PIN_HASH`, so that secret is
now a break-glass PIN — the recovery runbook is in CLAUDE.md, and rotating it is part of the
launch checklist if the PIN is ever changed because the old one leaked. Two review rounds on
this one: the endpoint's write tail is now guarded (a failure after the hash was stored used
to surface as "the backend isn't running", so the person retried with the old PIN and locked
themselves out of the PIN they had just set), the store is a compare-and-set, and a retry of
a change that already went through is recognised instead of counted as a wrong PIN.
Parth's two calls on the deferred login/session findings, both implemented the same day:
the lockout now **fails closed** (if a failed attempt can't be recorded, nobody is let in —
D1's free-tier write budget is how that happens), and **a session in use renews** to 30 days
from the last visit, with the same hourly write pruning expired and long-revoked rows. A
numeric `{"pin": 123456}` is read as that PIN rather than counted as a wrong one, and
`clearFailures` now clears the `global` bucket its own typos filled.

**Test suites as of 2026-09-24:** `npm run test:auth` 40 checks (plus 12 hash unit tests),
`npm run test:panes` 53 checks in real headless Chrome, `npm run test:publish` unchanged.
All three run against the **local** D1 — they never touch the preview's or production's data,
so a test run does not sign anyone out of the preview. `npm run admin:migrate:remote -- <file>`
is the one way to apply a migration to both remote databases.

**STEP 6 DONE (2026-09-22): Publish, Undo, "is it live yet?"** It's on `admin-test` and
still needs Parth's live check (START HERE item 2).

- **Publish** (`functions/api/admin/publish.js`) turns every pending draft into **one**
  commit on `PUBLISH_BRANCH`, using the Git Data API (tree on `base_tree` → commit → ref
  with `force: false`, up to 3 retries on a non-fast-forward). The request names the
  `{id, updatedAt}` it means, so a double-click or the other person's save can't widen it.
  Every path it writes passes `isContentPath` (only `content/site.json`,
  `founders.json`, `projects/<slug>.json`). Founders and project drafts are refused until
  their editors, and their checks, exist.
- **Validation on publish** covers only the contact block. Every other part of `site.json`
  must be identical to what's published, because those parts point into other documents
  that only the build can check. **The contact rules now live in three places**
  (`build-content.mjs`, `SettingsEditor.jsx` FIELDS, `_lib/documents.js`). Each copy
  names the other two in a comment. Change one, change all three.
- **Stale drafts.** With no draft, the editor starts from the published file **read from
  GitHub**, not from the admin bundle. The bundle is a build behind right after a publish
  or Undo. The draft stores that file's blob sha as `base_sha`.
  - At publish time, a draft whose bytes already equal the file is a no-op, whatever its
    base. That is how a publish whose commit landed but whose clean-up failed recovers
    itself.
  - Otherwise, if the base doesn't match the file, the publish is refused ("changed on
    the site after this draft was started"). This includes a NULL base on an existing file.
  - If GitHub can't be read, the editor refuses to load. It does not fall back to the
    bundle.
- **Undo** (`undo.js`) is a new commit. It sets exactly the files that publish touched back
  to their pre-publish blob shas, and never rewinds the branch. It only works on the
  newest publish, and only if each file still holds what that publish wrote. `publishes`
  now has `kind` (migration 0002, **applied to the remote D1 on 2026-09-22**), and `files`
  holds `{path, before, after}` per file.
- **Status is read from the site, not from Cloudflare's API.** Each build writes
  `/_version.json` (the commit sha; `scripts/prerender.mjs`, and `no-store` in `_headers`).
  `status.js` fetches it from the branch's own URL and checks containment through GitHub's
  compare API.
  - So the `nirmal-studio-build-status` Cloudflare token is **unused**. Parth can keep it
    for later or revoke it; his call.
  - The editor can't tell "building" from "failed". It says so after 5 minutes and stops
    after 20 minutes, rather than guessing.
- **Tests:**
  - `npm run test:publish`: **36/36** against real GitHub, on a throwaway branch
    `admin-publish-test`. It covers one commit touching only `content/site.json`, byte
    equality, a double-fire producing a single commit, the stale-after-Undo refusal, the
    recovery case, the baseless-draft refusal, and Undo restoring the original bytes.
  - Headless Chrome **30/30** at 1440 and 390.
  - `test:auth` 23/23 + 12/12.
  - Public `dist` is byte-identical to before, apart from `_headers` and the new
    `_version.json`.
- **Review gate ran** (impact, edge-case, UX, production-safety). Fixed:
  - The strip took the panes' `1fr` grid row.
  - The recovery path was unreachable: the stale check came first.
  - A bookkeeping failure gave a false "Undo isn't available".
  - A timed-out ref update gave a false "Nothing was published". It now re-reads the head.
  - A silent fallback to the bundle created a baseless draft.
  - Keystrokes were lost when the editor remounted mid-publish. Fields now lock while
    confirming or sending, and Publish refuses if a save is in flight.
  - The confirmation named the document but not the values. It now lists old → new.
  - An unmount mid-debounce dropped the last edit. It now flushes.
  - No stopped state after 20 minutes.
  - Undo was styled like Cancel.
  - Phone tap targets were too small.
  - A session-id prefix appeared in public commit messages.
  - The WhatsApp check trimmed in the editor but not in the build.
  - Found in the UI run, not by the reviews: out-of-order overview responses made the
    confirmation list an already-corrected typo. Each response now carries a sequence
    number, and "Publish now" waits for the fresh list.
- **Not fixed, noted:**
  - A pane switch mid-debounce whose flush-save then hits a 409 loses that edit silently,
    because the conflict lands in the unmounted editor. It's a narrow window.
  - Undo shows on the Projects/Founders panes too; its summary names what it undoes.
  - Branch aliases longer than ~28 characters would break `siteFor()`. Current names
    are fine.
- **The throwaway branch `admin-publish-test` was deleted** after the tests; recreate it
  as shown in `scripts/test-admin-publish.sh` to re-run them.

**Preview secrets are SET (2026-09-22)** — `ADMIN_PIN_HASH` (Parth's, 100k iterations),
a **preview-only** `SESSION_SECRET` (freshly generated, deliberately different from the
local one — nobody needs to know it), and `GITHUB_TOKEN`, all as encrypted secrets in
Pages → nirmal-studio → Settings → **Preview**. `PUBLISH_BRANCH=admin-test` comes from
`wrangler.toml`. **Production has no admin secrets, on purpose** — `main` has no
`functions/`, and production gets its own secrets as part of the launch decision.

**Two traps from setting them, worth keeping:**
- **With a `wrangler.toml` present, the dashboard only accepts *secrets***, not plain
  variables — its own orange note says so. Plain vars come from `wrangler.toml`.
- **Secrets attach only to deployments created after them, and the branch alias lags.**
  After the redeploy, the new deployment's own URL (`f2fbc2be.…`) already answered
  correctly while `admin-test.nirmal-studio.pages.dev` still answered 503 for a short
  while. Check the deployment's hash URL before concluding a secret is missing.
- **How to test that config arrived WITHOUT spending a lockout attempt:** POST
  `/api/admin/login` with a malformed body (`--data 'not json'`). `503` = something is
  missing; `400 Expected JSON.` = secrets *and* the D1 binding are both present, because
  that branch runs after the config check and before any failure is recorded.

**Waiting on Parth:**
- **The launch decision itself** (merge `admin-test` → `main`), once the branch-wide review
  gate has run. Everything else in Phase 2 is done.
- **If the PIN is ever changed because the old one leaked**, say so: the deployment's
  `ADMIN_PIN_HASH` secret stays valid as a break-glass PIN until it is rotated in the
  Cloudflare dashboard too (see CLAUDE.md's runbook).
- Keep or revoke the now-unused `nirmal-studio-build-status` Cloudflare token (step 6 reads
  status from `/_version.json` instead).
- Keep the PIN **masked by default** (with Show), or show digits as typed? Masked is live.
- He approved renaming the nav **button** to "Talk with Us"; the panel **heading** was
  renamed to match on my judgment — confirm or revert.
- **Founder photos + bios for all four** — the longest-lead item for launch; the founders
  section cannot appear until every person has both.
- Older open questions are listed further down ("Open questions for Parth").

**Cosmetic, noted not fixed:** at Parth's laptop window width the grey detail text on the
admin Projects rows wraps onto a second line ("5 sections · 6 / images"). Those rows are
replaced by the Phase 3 editors, so it wasn't worth churning now.

---

*Everything below is the running log, newest phases first. Earlier "next up" notes are
kept for their reasoning, but the block above is the current state.*

**Session status (2026-09-20 — Phase 1 of the v1 plan is COMPLETE).**
Plan file for this session: `/Users/parth/.claude-personal/plans/moonlit-wobbling-kurzweil.md`.

**What landed: 1c (Talk to Tej) + 1d (Lighter), committed and pushed together as
`376881a` — deployed and verified live.** Both hostnames OK (`npm run check:domains`),
the live JS hash matches the local build exactly, all seven `/fonts/*.woff2` serve 200
with the one-year immutable cache header, and the font/overlay checks were re-run
against `https://nirmalstudio.com` itself, not just the local preview. (The one "failed
request" those checks report on the live site is Cloudflare's own auto-injected
`static.cloudflareinsights.com/beacon.min.js`, refused by this sandbox's egress rules —
not site code. Incidentally that confirms **Cloudflare Web Analytics is already enabled**
on the zone, which Phase 3 item 4 wanted.)

**Pushing needs SSH now — this bit Phase 1d and will bite again.** `origin` is an HTTPS
remote but the stored github.com keychain credential is gone, so `git push` fails with
"could not read Username". `ssh -T git@github.com` authenticates fine, so push with
`git push git@github.com:parthamarshah/nirmal-studio-website.git main` (and
`dangerouslyDisableSandbox: true`, since the keychain isn't reachable from the sandbox).
CLAUDE.md's Deploy section is corrected. **Worth asking Parth once** whether to switch the
remote to SSH permanently — not done unilaterally, since it changes his repo config.

**Phase 1c — shipped.** The two review passes that never reported back last session
(impact-tracker, edge-case-checker) were re-run and **found two must-fix bugs**, both
reproduced in a real browser before fixing and re-verified after:
1. **Closing the panel could navigate the visitor clean off the site.**
   `history.back()` is async, so the panel stayed mounted and interactive until popstate
   landed. Anything re-entering in that window — a double-tapped ×, or simply *holding*
   Escape (auto-repeat fires every ~30ms) — called `back()` again and popped a second,
   real history entry. Reproduced in headless Chrome: two Escape events destroyed the
   page ("Inspected target navigated or closed"). This is the exact incident
   `FeaturedProjects.jsx` already carries `closingRef` for. Fixed the same way
   (`closingRef` set synchronously before `back()`, cleared in the popstate handler) plus
   `&& !e.repeat` on the Escape branch. The same two-Escape test now passes cleanly.
   **`ImageViewer.jsx` had the identical unguarded shape** — pre-existing, not introduced
   here, but fixed in the same session rather than left as a TODO: it is the *only*
   overlay on the public, shareable project pages, so the bug was worse there. Verified
   the same way (open the floor plan on `/projects/shimla-house/` at 390px, two Escapes
   25ms apart, no filler history — stays on the page, lock released).
2. **A phone in landscape got the desktop treatment.** `DESKTOP` was width-only
   (`min-width: 768px`), and an iPhone in landscape is ~930px CSS wide — so it hid the
   working `wa.me` deep link, handed the visitor a `web.whatsapp.com` URL that does not
   work on a phone (**the primary CTA, dead**), showed a "scan this QR with your phone"
   panel to someone holding their phone, and downloaded the QR library it was supposed
   to skip. Now `(min-width: 768px) and (pointer: fine)` in both the JS constant and the
   media query.

Also fixed from the same reviews: `Contact.jsx` had drifted from the panel (it built its
own `wa.me` URL by hand and still sent desktop users through the "continue to chat"
interstitial) — it now uses the shared `whatsappUrl()`/`whatsappWebUrl()` and copies the
panel's **two-anchors-gated-by-CSS** pattern. A first attempt used `preventDefault()` +
`window.open()` instead; that was rewritten because a blocked popup would have made the
site's single conversion action do *nothing at all* (the default already cancelled), and
because `(pointer: fine)` matches an iPad with a keyboard, which would then have been
handed a WhatsApp Web link. Two plain anchors need no JS and can't fail that way; a
surrogate-pair split in `composeMessage()`'s `.slice(0, 40)` that could throw `URIError`
at render time (reproduced, then fixed with a character-wise slice); the QR's `failed`
state was latched for the whole session and now recovers; `build-content.mjs` now rejects
duplicate helper labels (they're React keys — verified it fails the build); and
`ProjectPage.jsx`'s bare `<Nav />` is wrapped in a boundary so a nav throw hides the nav
instead of white-screening a public, indexed URL. That boundary is deliberately **not**
`SectionBoundary` — that one imports `ScrollTrigger`, which would have dragged GSAP+Lenis
into the project-page bundle.

**Phase 1d (Lighter) — done, measured.**
- **Homepage initial JS: 191.7 KB gz → 180.4 KB gz (−11.3 KB).** `Founders.jsx` (and
  therefore Embla) is now `React.lazy` behind the existing `foundersReady` gate, which is
  false until Phase 4 — so every visitor was downloading a carousel none of them could
  reach. Vite also split GSAP/Lenis into its own `scroll-*.js` chunk as a side effect.
  Project pages: 79.9 → 80.0 KB gz (the new nav boundary), still no GSAP/Lenis/Framer —
  re-verified by scanning the built chunks.
  **Font bytes were cut further after the UX review.** Syne is now subset to the wordmark
  glyphs via Google's own `&text=` subsetter — **34.5KB → 6.5KB** — and is the *only*
  preload. The full Syne latin/latin-ext faces are still declared (so any character ever
  set in Syne still renders in Syne) but the subset is declared **last**, so it wins font
  matching for space + a-z and the big file is never fetched; verified in the browser.
  Fraunces' preload was dropped: it is `display: swap` (text is never invisible, it just
  restyles), it was never preloaded before either, and at 67KB it competed at top
  priority with the hero render — the LCP image. Cold Slow-4G hero-visible went
  **7508/7049ms → 5636/5132ms** across the session.
  **The extra chunk was checked, not assumed harmless.** Splitting GSAP out means one more
  serialized request, which matters on the real target device (mid-range Android, variable
  Indian mobile data). Measured cold-cache at 390px under CDP's Slow 4G emulation
  (400 Kbps, 400ms RTT): **before** 3 JS files, hero visible 7508 / 7049 ms, 309 / 288 KB;
  **after** 4 JS files, hero visible 7342 / 6863 ms, 299 / 277 KB. The split is slightly
  *faster* — the chunks fetch in parallel — so no `modulepreload` hint was added.
  Incidentally this **corrects an older note in this file** claiming no network throttling
  was available to these sessions: the Chrome extension doesn't expose it, but CDP's
  `Network.emulateNetworkConditions` does, so real Slow-4G numbers are reproducible now.
- **Fonts are self-hosted** (`public/fonts/*.woff2` + inline `@font-face`, Syne and roman
  Fraunces preloaded). This was not just a byte/latency win — **it fixed a live bug**.
  Measuring *applied* rendering rather than load state showed that on the old setup the
  "nirmal" wordmark rendered in the generic fallback sans on **two of three** cold loads:
  `display=optional` gives ~100ms to decide, and Syne couldn't win that after a DNS+TLS
  handshake to gstatic plus a stylesheet round-trip. After self-hosting + preload it
  applies on all three. See the new CLAUDE.md incident entry — `document.fonts.check()`
  reports LOAD state, not whether a font was APPLIED, and it returned true on runs where
  the wordmark was visibly the fallback.
- **Body font token made honest.** `--font-body` named `'Open Sans'`, which was **never
  loaded anywhere** (no `@font-face`, no link, nothing in git history) — all body copy has
  always rendered in the system sans. Parth was shown this and chose (2026-09-20) to keep
  the system stack and drop the dead name rather than add a third family. Don't restore it.
- **Framer Motion deliberately NOT removed.** ~40KB gz and the biggest remaining win, but
  it powers `FeaturedProjects`' takeover and `IdeaTimeline`'s lightbox — the most
  bug-hardened code in the repo. Parth's call (2026-09-20): defer to its own session with
  a full live verification pass. Rewriting `Loader.jsx` alone saves nothing, since the
  other two still import the library — it is all-or-nothing.

**Cloudflare's AI-crawler block is GONE — that long-standing open question is closed.**
Verified this session on a cache MISS, with real `GPTBot` and `ClaudeBot` user-agents, on
both `nirmalstudio.com` and `www.` : robots.txt is a plain `User-agent: * / Allow: /` with
the sitemap line, identical to the `.pages.dev` copy, and there is no `Content-Signal`
header. Nothing was changed to achieve this — either Cloudflare altered its default or it
was switched off externally. **Stop carrying this as an open item**, but re-check with
`curl` if AI answer engines still aren't citing the site in a few months.

**Verification tooling (scratchpad, not committed — recreate if needed).** Headless Chrome
over the DevTools protocol, driven by a small dependency-free Node CDP driver
(`cdp.mjs`, `checkfonts.mjs`, `checkhistory.mjs`, `checklock.mjs`, `measure.mjs`). Two
things worth remembering:
- Launch **without** `--hide-scrollbars` when testing a scroll lock, or the flag masks the
  very layout shift you're looking for.
- To prove a webfont is applied, measure text width with the font vs the fallback alone.
  `document.fonts.check()` will lie to you about this.
Results on the final build: fonts PASS at 1440/390 on homepage and project page; panel
history PASS for Escape / backdrop / browser-Back (exactly one entry popped each time);
scroll lock PASS — **0px** horizontal shift when the scrollbar disappears (so no
`scrollbar-gutter` needed), lock released on every path, scroll position preserved, and
Lenis scrolls normally afterwards. Both of the edge-case review's "unverified" items are
therefore answered.

**⚠ BRANCH LAYOUT — CHECK THIS FIRST IF PICKING UP COLD.** `main` has **no**
`functions/` directory and must keep it that way for now; the `/admin` backend lives on
**`admin-test`**. Cloudflare Pages auto-deploys `functions/` from whatever branch it
builds, so committing backend code to `main` publishes the admin API on the live domain.
That happened on 2026-09-20 (live ~4 minutes, nothing exposed beyond the endpoints
existing, since production has no PIN/session secrets) and was undone in `857ea5b`. See
CLAUDE.md's "Branches right now" section. **Work on `admin-test`:**
`git checkout admin-test`.

**Second trap, same family, hit minutes later:** `git merge main` into `admin-test`
fast-forwarded and carried main's *deletion* of `functions/` across, silently leaving
`admin-test` without the backend it exists to hold (restored in `992911c`). The two
branches deliberately **diverge** on `functions/`, so never merge main into admin-test —
cherry-pick the docs commit, or merge admin-test into main when it is time to launch.

**Local setup a cold session needs to know about:** `.dev.vars` exists on this machine
(gitignored, 0600) holding Parth's real PIN hash, his GitHub token, a generated
`SESSION_SECRET` and `PUBLISH_BRANCH=admin-test`. Nobody knows the PIN, including Claude
— `npm run test:auth` swaps in a throwaway one and restores the real file via a trap.
Commands: `npm run admin:secrets` (re-enter secrets), `npm run admin:dev` (local server
on :8788), `npm run admin:migrate` (apply schema locally: 0001 then 0002; 0002 is an
ADD COLUMN, so a second run fails harmlessly with "duplicate column"), `npm run test:auth`,
`npm run test:publish` (real commits, against a throwaway branch; see STEP 6).

**PHASE 2 IN PROGRESS (2026-09-20, later session).** Build plan:
`~/.claude-personal/plans/nirmal-studio-phase-2-admin.md` — read it before continuing,
it has the locked decisions, the build order and the named risks.

**Done so far (steps 1-2 of 7), all committed:**
- **Storage:** D1 `nirmal-studio-admin` (APAC) + KV `UPLOADS`, bound per environment in
  `wrangler.toml`; `migrations/0001_initial.sql` applied local **and** remote.
- **Secrets:** `npm run admin:secrets` writes a 0600, gitignored `.dev.vars`
  (`ADMIN_PIN_HASH`, `GITHUB_TOKEN`, `SESSION_SECRET`, `PUBLISH_BRANCH`). Parth has set
  his real PIN and token. **`.dev.vars` and `.wrangler` were NOT gitignored — fixed
  before anything could write a secret there.**
- **Auth:** `functions/api/admin/{login,logout,me}.js` + `_lib/auth.js`. PBKDF2 verify,
  5-failure lockout (per-IP **and** a global bucket), revocable D1-backed sessions,
  HttpOnly/Secure/SameSite=Strict signed cookie. **`npm run test:auth` — 17 tests,
  all passing**, weighted to failure paths (forged signatures, unsigned ids, lockout,
  correct-PIN-refused-while-locked, logout revoking server-side).

**Three traps found the hard way — don't rediscover these:**
1. `wrangler pages dev` **always** loads `.dev.vars`, and `--env-file` does **not**
   override it (verified by having the worker report the salt prefix it received). Since
   nobody but Parth knows the real PIN, testing the success path means swapping the file
   and restoring it on any exit — `scripts/test-admin-auth.sh` does this with a trap.
2. Passing `--d1 NAME=...` to `pages dev` binds a **different** local SQLite file than
   `wrangler d1 execute --local` writes to. Symptom is a 500 with "no such table".
   Let `wrangler.toml` supply the bindings; don't pass the flags.
3. A Cyrillic character was typo'd into an identifier (`clearedСookieHeader`) and lint
   did not catch it. Worth a glance when a name "looks right" but doesn't resolve.

**RESOLVED — the CPU risk was the wrong worry. The real one is a hard platform
ceiling.** Step 3 is done. Measured on a real preview deployment (2026-09-20) with a
throwaway endpoint that ran the same derivation the login does, reading `cpuTime`
straight out of `wrangler pages deployment tail`:

| PBKDF2 iterations | result | CPU |
|---|---|---|
| 1,000 | ok | 1 ms |
| 10,000 | ok | 5 ms |
| 25,000 | ok | 13 ms |
| 50,000 | ok | 18 ms |
| 75,000 | ok | 18 ms |
| 100,000 | ok | 23-38 ms |
| 100,001 | **HTTP 500** | — |
| 210,000 | **HTTP 500** | — |

- **CPU was never the problem.** 100k iterations burns 23-38ms and Workers ran it
  happily, well past the ~10ms figure the plan hedged against. Stop treating the free
  tier's CPU budget as the constraint on this.
- **Cloudflare Workers refuses any iteration count above 100,000.** `deriveBits` throws
  `Pbkdf2 failed: iteration counts above 100000 are not supported`. The boundary is
  exact: 100000 passes, 100001 fails. This is a platform limit, not a tuning knob.
- **So Parth's stored hash could never have worked.** `npm run admin:secrets` hashed at
  210k, so his `ADMIN_PIN_HASH` would have made *every* login 500 — on a deployment, in a
  way local dev could never reproduce, with nothing in the error pointing at the cause.
  **He must re-run `npm run admin:secrets`** (the constant is now 100k) before /admin can
  work anywhere. Nothing else can fix it: the iteration count travels inside the hash.
  The 100k constant is on **both `main` and `admin-test`** — the script is deliberately
  identical on the two branches, unlike `functions/`, so it does not matter which one is
  checked out when he runs it.
- `verifyPin` now refuses an out-of-range hash with a plain-English 503 naming the
  problem, instead of throwing an uncaught exception.

**Review gate run early (the previous session's own advice), and it was worth it.**
edge-case-checker and impact-tracker both ran against the auth code before any more was
built on it. Four must-fix findings, all fixed and all now covered by tests:

1. **Total auth bypass if `ADMIN_PIN_HASH` were ever truncated.** The derived length was
   read *from the stored hash*, so a hash whose final segment was empty made
   `deriveBits(…, 0)` return an empty buffer and the constant-time compare answer `true`
   for **every** PIN. A one-byte hash let ~1 in 256 PINs through. Nothing in the repo
   produces such a value — but hand-pasting the hash into the Cloudflare dashboard is the
   documented workflow, and that is exactly when truncation happens. The length is now
   pinned at 32 bytes and anything else is a 503.
2. **The lockout could be outrun by guessing in parallel.** `recordFailure` read the row,
   added one in JavaScript and wrote the literal back across two round-trips, so fifty
   simultaneous attempts all read the same count and all wrote the same count+1 — the
   counter advanced by **one**. Since CLAUDE.md and the file's own header both name the
   lockout as the real defence for a 6-digit PIN, this defeated the actual security
   model. The increment now happens inside one SQL statement, so SQLite serialises it.
   Regression test fires 10 parallel wrong PINs and asserts the stored count is 10.
3. **One malformed cookie anywhere on the domain 500'd every session check, forever.**
   `decodeURIComponent` throws on a bare `%`, and the offending cookie need not be ours —
   any third-party cookie would do. That browser then got a 500 from `/me` *and* from
   `/logout`, so it could not even clear the cookie that was breaking it. Now caught.
4. **The session cookie is `__Host-`-prefixed.** Without it a sibling subdomain can set a
   `Domain=.nirmalstudio.com` cookie of the same name and shadow the real session — and
   there is one: `erp.` is a CNAME to a separate third-party-hosted app. Duplicate names
   also now resolve first-wins rather than last-wins.

Also fixed from the same reviews: `getSession` checks the D1 binding as well as the
secret (otherwise a half-configured deployment 500s where it should 401); the hourly
`last_seen_at` touch can no longer kill a valid session if the write fails; a 401 now
clears the dead cookie instead of leaving it to fail for 30 days; and `admin:dev` /
`admin:migrate` in package.json were **both broken** — `wrangler` is not installed
locally or on PATH, so they need `npx` (only `test:auth` worked, because it already used
`npx`). **`npm run test:auth` is now 35 tests** (12 new `scripts/test-pin-hash.mjs` unit
tests for malformed hashes, which need no server, plus 23 integration tests).

**Not fixed, deliberately — decide these before production:**
- ~~Preview and production share one D1~~ — **fixed 2026-09-22 (step 7)**: production has
  its own D1 and KV, so a scanner on the preview login can no longer lock out the live
  /admin. **Still open:** production's `SESSION_SECRET` must be a *new* value, not the
  preview's, so a preview cookie can never be valid on production.
- ~~The lockout fails open if D1 runs out of writes~~ — **decided by Parth 2026-09-23:
  fail CLOSED.** If a failed attempt can't be read or recorded, `/login` and `/api/admin/pin`
  answer 503 and accept nobody, rather than letting guessing proceed unmetered. The public
  site is static and unaffected; the cost is that a D1 outage takes /admin offline. The
  recovery is the runbook in CLAUDE.md.
- ~~Nothing is pruned; sessions never renew; a numeric `pin` burns attempts~~ — **all three
  fixed 2026-09-23.** A session in use renews to 30 days from the last visit (Parth's call)
  and the same hourly write prunes expired and long-revoked sessions; `clearFailures` now
  clears the `global` bucket its own typos filled; `{"pin": 123456}` as a JSON number is
  read as that PIN instead of counting as a wrong one.

**A trap for the admin frontend (step 4), found by the impact review:** unmatched paths
return **200 with the homepage HTML**, not 404 — there is no `404.html`, so Pages falls
back to `index.html`. So `fetch('/api/admin/me')` against a deployment where the function
isn't routed gives `res.ok === true` and then `res.json()` throws
`SyntaxError: Unexpected token '<'`. **Treat a non-JSON content-type as signed-out**, and
never test "is the admin API live?" with the status code alone — `200 + text/html` means
NOT deployed, `401 + application/json` means deployed. (That is exactly the check the
four-minute main-exposure incident needed.) It is also a soft-404 SEO problem on a site
whose stated priority is local search; a `public/404.html` is worth doing.

**One production build failed mid-session, then the pipeline recovered on its own.**
`128347b9` (production, `cc3750f`) came back **Failure**, leaving `nirmalstudio.com`
served by `e1f6b342` (`857ea5b`) for about an hour. Several preview builds were
**Skipped** in the same window. Nothing in the repo caused it: `npm run build` was clean
throughout, and the next pushes all built and deployed normally — `d8c5b513` (`a5d3dd7`)
and `ef168b2b` (`5ea1c6a`) on preview, and `7b7946e2` (`b1ba6ae`) on production, which is
what the live site now serves. **Treat it as transient**, but if a build ever "succeeds"
and the site doesn't change, this is the shape it takes.

**Read deployment status by fetching the URL, never from `wrangler pages deployment
list`.** That is the lasting lesson here. Its "Status" column called `128347b9` **Active**
for half an hour before admitting **Failure**, and a failed or skipped deployment's URL
returns 404 while the listing still presents it as current. On `/api/admin/me`,
`200 + text/html` means the Functions are NOT deployed; `401 + application/json` means
they are — status code alone cannot tell the two apart, because an unmatched path falls
back to `index.html` with a 200.

**Direct upload is the escape hatch, and it is preview-only:**
`npx wrangler pages deploy dist --project-name nirmal-studio --branch admin-test`. That
is how the preview under test was deployed while Git builds were failing. **Never run it
with `--branch main`.** Every direct upload prints "Uploading Functions bundle" — from an
`admin-test` tree that would push the whole admin API onto `nirmalstudio.com`, with no Git
commit to notice it in: the four-minute-exposure incident again, but invisible. A
production deploy goes through Git from a `main` checkout, and is `curl`-verified after.

**~~Preview secrets are still not set~~ — RESOLVED 2026-09-22, Parth set them in the
dashboard (see START HERE).** Original note, kept for why it took a dashboard trip: `wrangler pages secret put` has no `--env` flag in 4.135, and both the
sandbox's credential classifier denials (reading the OAuth token, running the secret
command) blocked the API route. So `/api/admin/login` on the preview still answers
503 "not configured" — which is why step 3 was settled with a probe that needed no
secrets at all. Setting `ADMIN_PIN_HASH` + a *preview-specific* `SESSION_SECRET` via
Pages → Settings → Environment variables (as **encrypted secrets**, not plaintext vars)
is the first thing step 4 needs.

**~~One thing to verify in a real browser at step 4~~ — VERIFIED**, first in headless
Chrome over http://localhost (step 4) and then by Parth signing in on the real preview
(2026-09-22). Original note: the 35 tests exercise the
`__Host-` cookie through curl, and **curl does not enforce cookie-prefix rules at all** —
it echoes back whatever header it is handed. Browsers do enforce them, and
`wrangler pages dev` serves plain `http://localhost:8788`. Check in a real browser that
the cookie is stored and sent back as soon as the login screen exists, before anything is
built on top of the session. (Not a reason to drop the prefix — it is the right call
given the `erp.` sibling subdomain.)

**STEP 4 DONE — the /admin shell is built and deployed to the preview.**
`https://admin-test.nirmal-studio.pages.dev/admin/` (Parth: you can open the login screen,
but you cannot get in yet — see the secrets note above).

- **Built by its own Vite pass**, not as a second entry of the site build
  (`vite.admin.config.js`, run from `npm run build` between `vite build` and the
  prerender). A shared build let Rollup split React into a chunk both entries import,
  which re-shaped the **public** site's bundle — and Phase 1d tuned that graph on
  measured cold Slow-4G numbers. Separate passes keep every public chunk byte-identical
  (`index-BqS-LPLx.js` and friends are unchanged), at the cost of the admin shipping its
  own React (71 KB gz, one internal page, two users — the right trade).
- **"No admin code in the public bundle" is verified, not assumed.** No public file
  contains `/api/admin/`, `admin-root`, `ApiError`, `Inspector` or `signedIn`; the admin
  bundle contains no GSAP, Lenis, Framer or Embla.
- **noindex is declared in all three places it has to be:** the page's own meta tag,
  `Disallow: /admin` in `public/robots.txt`, and an `X-Robots-Tag` (+ `no-store`,
  `X-Frame-Options: DENY`) on `/admin/*` in `public/_headers`. The admin's JS and CSS are
  emitted under **`/admin/assets/`** precisely so that one header rule covers them —
  parked at the root they would have fallen outside it, and a meta tag cannot speak for a
  `.js` file. Verified on the deployment: both the HTML and the JS carry the header, and
  `/admin` 308-redirects to `/admin/`.
- **`src/admin/api.js` classifies every response by content type, never `res.ok`** — the
  soft-404 trap above, closed at the one place it would have bitten first.
- **The three panes show the real published content, read-only** (9 projects, 4 founders,
  the actual contact settings). Deliberate: a shell full of placeholder rows says nothing
  about whether the layout survives real density and real name lengths, which is the
  entire point of showing it to Parth before the editors go in. **Step 5 swaps the source
  from published content to the D1 draft** — the layout is what's being judged now.
- **Driven in headless Chrome, 20 checks** across the login screen and the shell at 1440
  and 390: PIN field autofocus, non-digits stripped, submit gated at 6 digits, all three
  panes, the publish branch shown (`admin-test`, never `main`), no horizontal overflow at
  390, inspector stacking, keyboard reachability, clean console. **The `__Host-` cookie is
  stored and returned correctly over plain-http localhost** — that needed a real browser,
  since curl does not enforce cookie-prefix rules at all.
- **The 210k hash was confirmed end-to-end from the UI**: typing a PIN against the real
  `.dev.vars` renders *"ADMIN_PIN_HASH asks for 210000 PBKDF2 iterations; Cloudflare
  Workers supports at most 100000. Re-run npm run admin:secrets and set the new hash."*
  That is the whole bug, visible, in one sentence, on the screen where it matters.

**The ux-reviewer pass ran on the shell and found two dead ends worth the trip.** Both
were reproduced in a browser before and after, not reasoned about:
1. **A correct PIN could freeze the screen on "Checking…" forever.** `setBusy(false)` lived
   only in the catch, so when `login()` succeeded but the session didn't stick (cookies
   blocked, a stripped `Set-Cookie`, clock skew) `Admin` re-rendered the same `<Login>` at
   the same position, React kept its local state, and the form stayed disabled with no
   error and no way out but a manual reload. `refresh()` now returns whether a session was
   actually confirmed. Verified by intercepting `/api/admin/me` over CDP and forcing a 401
   after a real login.
2. **The "couldn't reach the server" card said try again and offered nothing to try again
   with** — and a one-second network blip lands there too, not just an absent backend.

Also fixed from that review: the top bar said **"No unpublished changes"**, which asserts
that a draft system checked and found nothing — there is no draft system yet. It now reads
"Read-only preview. Editing and publishing arrive in the next phase.", which also carries
the reason the Publish button is disabled (that reason previously existed **only** in a
`title` tooltip — invisible on touch, to a keyboard, and usually suppressed on a disabled
element). A retry that cannot work is no longer offered: on a 503 the typed PIN is kept and
submit is disabled; on a lockout the button shows the minutes left and re-enables itself.
`ApiError` now carries `lockedUntil`, which was being dropped. **The 503 text itself leads
with its meaning rather than with `ADMIN_PIN_HASH`** — on an unconfigured deployment it is
the only thing any PIN ever returns.

**Two structural changes made now because they get expensive after Phase 3:**
- **The open pane lives in the URL** (`#/projects`), so Back goes back a pane instead of
  leaving the admin, and a reload lands where you were. Three of CLAUDE.md's incidents are
  back-button bugs that came from grafting history onto components that already had their
  own state; Phase 3 adds a selected project and a selected image on top of this.
- **A 401 arriving mid-session is handled in one place** (`setSessionEndedHandler`), not
  re-invented by every future editor call. Sessions last 30 days, so this will fire
  mid-edit eventually.

**Measured accessibility fixes** (the review composited the alpha values rather than
eyeballing them): the PIN field's border was **1.87:1** and its fill **1.13:1** against the
login background — the only control on the only screen Tej sees cold, at well under the 3:1
a component boundary needs; now **4.09:1**, measured in the browser. The sign-out border was
1.73:1. Phone rail controls were 30–35px tall, now 44. Status pills went 11px uppercase →
12px sentence case (they carry multi-word values like "Under construction"), body text 14px
→ 15px. The focus ring no longer sets its own `border-radius`, which was reshaping the
elements it highlighted. `site.sections` keys now render through a label map, so nobody
ever reads `ideaTimeline` on the screen aimed at the studio's owner.

**The PIN is masked with a Show toggle and `autoComplete="current-password"`** — it was
`one-time-code`, which tells password managers *not* to offer to save it. Both of this
project's other secrets already live in Apple Passwords, and two people using a 6-digit PIN
occasionally will forget it. **Parth: say if you'd rather see the digits by default.**

**Still open from that review, deliberately:** `me.js` returns `since`/`expiresAt` and
nothing renders them (a quiet "signed in until…" would make expiry legible before it
surprises someone); and iOS Safari auto-zooms any focused input under 16px, so Phase 3's
form controls need 16px at phone widths.

**STEP 5 DONE — drafts with autosave.** Both of the plan's "done when" conditions are
verified in a real browser (23 checks), not argued:

- **An edit survives a reload.** Type, and the top bar goes *Unsaved changes… → Saving… →
  Saved as a draft*. Reload: the value is still there and the pane says plainly that these
  are unpublished changes, with a Discard link back to the published version.
- **Two tabs do not silently overwrite each other.** Every save carries the `updated_at`
  of the row it is building on, and the server writes only if that still matches — one
  guarded SQL statement, so SQLite decides rather than a read-then-write in JavaScript
  (the same lesson as the login lockout counter). On a mismatch the save is **refused**
  and the editor stops and asks, with two explicit choices: *Use the other version* or
  *Keep mine and overwrite it*. **No automatic merge, deliberately** — two people editing
  one studio's details is a case where guessing is worse than asking. The test asserts the
  other writer's work is still intact on the server at the moment the conflict appears,
  then exercises both resolutions.

Details worth not rediscovering:
- **`updated_at` doubles as the concurrency token, so it is written as
  `MAX(now, previous + 1)`.** Two saves inside the same millisecond would otherwise share
  a token and a stale write could slip through.
- **Discard requires the version too.** An unguarded `DELETE` would throw away whatever
  arrived after the caller last looked; a caller with no draft has nothing to discard, so
  there is no legitimate null case.
- **(Superseded in step 6.)** `base_sha` was NULL during step 5. Since step 6 it is filled
  when a draft is created, from the blob sha of the published file read from GitHub.

**The Settings pane is now a real editor** (studio contact details), because step 5 needed
something editable to exercise any of this and that is the smallest honest slice. It
validates against the same rules as `scripts/build-content.mjs` — a bad WhatsApp number or
email is flagged as it is typed, so the build stays the backstop rather than the first
place an error appears. **Projects and Founders remain read-only and say so**; their
editors are Phase 3 and will use the same `useDraft` hook.

Also closed here: inputs are 16px at phone widths. Below that iOS Safari zooms the page on
focus and does not zoom back — the UX review flagged it for whenever the first form landed.

**Next (steps 6-7):** publish (validate → GitHub Git Data API, `content/` paths only → a
`publishes` row) → status polling → undo → the remaining hardening. Step 6 is the first
step that needs `GITHUB_TOKEN` on a deployment — **it is now set on preview** (2026-09-22).


**DONE (2026-09-21), and it closes the last open Phase 1 item.** Parth asked for both:
the button is now **"Talk with Us"** (nav and panel heading; the panel's subtitle still
says "You'll speak directly with Tej" on purpose — the button invites, the line under it
reassures), and **"Book a Consultation" opens the same panel** instead of jumping
straight to WhatsApp. That closes the UX-review finding open since 2026-09-20: the site's
single stated conversion action was the *less* helpful of the two paths to the same
place, and on desktop it dropped a logged-out visitor onto WhatsApp Web's bare QR-login
screen with no context.

The loader moved to `src/components/loadTalk.js` so the nav and the CTA share one cached
chunk. Contact renders its own panel instance behind its **own** `Boundary` — not the
section's, since lazily loaded code throwing there would otherwise take the address, map
and phone number with it. Both anchors stay, still gated by CSS, as the no-JS fallback.
**The component file is still `TalkToTej.jsx` and `site.json`'s greeting still opens
"Hi Tej"** — internal and recipient names, not the label; neither was renamed.
Verified on the LIVE site at 1440 and 390, homepage and a project page: 31 checks.

**(Historical) Phase 2 prerequisites — all done.** Both API tokens were created
2026-09-20 (see CLAUDE.md's "Phase 2 credentials" for scopes and where they're stored),
and Parth set his PIN via `npm run admin:secrets` — re-run on 2026-09-22 so it is hashed
at 100k iterations, the Cloudflare Workers ceiling.

Worth knowing for next session:
- GitHub's default for a new fine-grained token is **no repository access and no
  permissions**, and it fails as a **404, not a 403** — so always verify the scope on the
  token's own page rather than assuming creation worked. The first attempt here was
  created that way and would have failed confusingly much later.
- The GitHub token **expires Sat 19 Dec 2026** (Parth confirmed he kept the 90-day
  default). **Check that first if publishing from `/admin` ever breaks** — the failure
  is a 404, which doesn't look like an auth problem. Renew it on
  github.com/settings/personal-access-tokens and update the Passwords entry.
- **Wrangler is re-authenticated** (2026-09-20) against Gurjar, verified with
  `wrangler whoami` and `wrangler pages project list`, with `d1:write` /
  `workers_kv:write` / `pages:write` — so Phase 2 can create its D1 database and KV
  namespace immediately. Getting there took three attempts: see CLAUDE.md's Deploy
  section for the `localhost:8976` / CSRF trap, which presents as an account-permission
  error but is really just two concurrent `wrangler login` runs.
- Cloudflare **Web Analytics is already on**, so Phase 3 item 4 is partly done.

**Two UX-review findings — BOTH NOW DECIDED BY PARTH (2026-09-21), see the "DONE
(2026-09-21)" entry above.** He routed "Book a Consultation" through the panel (finding 1)
and chose to rename the nav button to "Talk with Us" rather than rename the CTA (his
answer to finding 2 — the CTA wording stays "Book a Consultation", and it now opens a
panel of ways to get in touch). Don't re-raise either. Original notes:
1. **The Contact section's "Book a Consultation" CTA bypasses the Talk-to-Tej helper.**
   The nav pill opens the panel (what / city / stage → a pre-written first message, plus
   the desktop QR); the Contact CTA jumps straight out to WhatsApp with only the generic
   greeting. So the site's single stated conversion action is the *less* helpful of the
   two paths, and on desktop it drops a logged-out visitor onto WhatsApp Web's bare
   QR-login screen with no context. The fix is to route the CTA through the same panel
   (reusing `Nav.jsx`'s `loadTalk()` pattern, keeping both anchors as the no-JS
   fallback). Not done because it changes the behaviour of his primary conversion action
   and moves panel ownership out of `Nav` — a real product decision, and not something to
   slip in at the end of a session.
2. **"Book a Consultation" doesn't say what the button does.** It promises a booking
   (calendar, slot, confirmation) and opens a WhatsApp message; the same action is called
   "Talk to Tej" a few centimetres away in the nav. Suggested: "Talk to Tej on WhatsApp".
   That is brand copy, so it's his to approve.

**Also flagged, smaller:** the nav pill's loading state is `opacity: 0.6` only, which
reads as "disabled" rather than "loading" on a slow connection; and the pill's 44px tap
target is built from a `::after` overlay on a 38px-tall pill, so the primary CTA has 38px
of *visible* affordance.

**Open questions for Parth (unchanged, still unanswered):**
- Founder role wording "Ar. — Founding Partner, FOLD" → "Founding Partner, FOLD"? And an
  optional small "FOLD network" label before person 2?
- Real founder photos + bios for all four (gates the Phase 1b section going live).
- AI concept images: keep them in the homepage takeover for Shimla/Nishee, or remove until
  he assigns each to one house in the Phase 3 backend?
- Hero render (Citadel `exterior-landscape.jpg`) is only 1024px wide — soft on big screens.
- Delete the old `nirmal-studio-website` Pages project? (The agreed window opened 2026-09-20.)
- **Google Business Profile** — still the highest-leverage action for his local-SEO goal,
  bigger than anything code-side.

**Deferred UX ideas from reviews (not decided, not built):** next/prev inside the image
viewer; soft 404 for unknown `/projects/<slug>/` (currently homepage shell + "isn't
available" message, HTTP 200); unify takeover vs page prev/next style; enlarge hint on
single photos. A project-page "Talk to Tej" CTA was suggested but conflicts with Parth's
decision (nav button only) — don't add. (Note: the nav pill *does* appear on project pages
via the shared `<Nav />`; that is the decided design, not a violation of that rule.)

**Phase 1b (founders section) — built 2026-09-14, switched OFF on the live site by design.**
`src/components/Founders.jsx`: desktop bands (Tej's photo/name ~18% larger, photos
alternate sides), phone Embla carousel of 4 equal cards with dots, "1 / 4" and a swipe
hint, reduced-motion = native scroll-snap (`data-lenis-prevent` only then). `Studio.jsx`
renders it only when `foundersReady` (all four have photo + bio); otherwise the old layout
(`LegacyStudio`). Build now validates `previously`, intros, word limits (fail above max,
warn below min), photo `filter` (applied at build: warm/bw) and `zoom`. Founder photos go
in `content/media/founders/<file>` + `photo: {file, crop, filter}`. Verified in headless
Chrome with temporary test photos/filler bios (reverted, not committed): 390/820/1440px,
dots, touch swipe, desktop↔phone resize, reduced motion, validation errors; production
build still shows the old section. Intro text falls back to built-in wording while
`founders.json` `intro` is empty. **To go live it needs:** 4 photos + bios for Bhumika,
Rachit, Hardik (Tej's existing 81-word bio fits; it's first-person — the others should
match voice). Reviews (impact, edge-case, UX) run and fixes applied: WhatsApp/email
contact validation, blank-bio warning + "section stays off until…" warning, snap↔carousel
switch keeps the card, controls above the phone cards, 44px dots/icons, focus outlines,
desktop intro top-aligned. **Not applied, for Parth:** roles read "Ar. — Founding Partner,
FOLD" (UX review suggests "Founding Partner, FOLD" — content wording, his call); optional
small "FOLD network" divider before person 2 so skimmers don't read all four as studio team.

**Phase 1c (Talk to Tej) — built 2026-09-14.** Nav pill on every page (a real wa.me
link; tapping loads `TalkToTej.jsx` on demand) → panel: WhatsApp (first-message helper:
chips from `site.json` `talk.helper` + free-text city, composed after the studio's
`whatsappGreeting`), Call, Email (+ Copy), Visit (Google Maps; `contact.addressShort`).
Phone = bottom sheet, desktop = dialog with a QR code that encodes the current message
(QR library fetched on desktop only — changed from the plan's build-time QR so the code
can carry the written message). Reply-time/hours lines only appear once set in
`site.json` (both null now). Verified headless at 320/390/1440 on homepage + project page:
every close path, history, focus, scroll lock with Lenis, no hydration warnings. New
CLAUDE.md incident: overlays opened from inside the nav must be portalled to `<body>`
(the scrolled nav's `backdrop-filter` traps `position: fixed`). Things to show Parth when
reporting 1c: helper chip wording + message template are first drafts (editable in
`site.json`); `replyTime`/`hours` are empty so the panel makes no reply-time promise.

**Next up — rest of Phase 1 (Parth already said "go" for all of Stage 1):**
1. ~~**1c Talk to Tej**~~ done (above). Original notes: — nav button on every page (Nav is shared by homepage + project pages),
   choice panel, first-message helper, desktop QR; `content/site.json` needs `replyTime`,
   helper options. Project pages must stay free of Framer/GSAP (use a plain overlay like
   `ImageViewer.jsx`) and render-time-browser-API-free (hydration).
2. **1d Lighter** — self-host fonts, review Framer usage, measure before/after (Embla now ships in the homepage chunk even while 1b is gated off — consider lazy-loading it).
Then Phase 2 (backend foundation) — needs Parth to create a GitHub fine-grained token and a
Cloudflare API token (walk him through one step at a time; he prefers doing dashboard clicks
himself).

**Open questions waiting on Parth (asked in chat, not yet answered):**
- AI concept images: currently still shown (labelled) in the homepage takeover for
  Shimla/Nishee, deliberately NOT on the public project pages. Remove from the takeover too
  now, or keep until he assigns each to one house in the Phase 3 backend?
- Real founder photos + bios for all four (needed before 1b can go live, not before it's built).
- Founder role wording "Ar. — Founding Partner, FOLD" → "Founding Partner, FOLD"? And an
  optional small "FOLD network" label before person 2? (both raised after 1b, unanswered)
- Hero render (Citadel `exterior-landscape.jpg`) is only 1024px wide — soft on big screens; a
  larger export from the renders would fix it.
- Still open from earlier: Cloudflare AI-crawler block; deleting old `nirmal-studio-website`
  Pages project (~2026-09-20+, ask first).

**Deferred UX ideas from reviews (not decided, not built):** next/prev inside the image
viewer; soft 404 for unknown `/projects/<slug>/` (currently homepage shell + "isn't
available" message, HTTP 200); unify takeover vs page prev/next style; enlarge hint on single
photos. A project-page "Talk to Tej" CTA was suggested but conflicts with Parth's decision
(nav button only) — don't add.

**Verification tooling note:** Claude-in-Chrome was not connected this session; browser checks
were done by driving the installed Chrome headlessly over the DevTools protocol (Node script,
lived in the session scratchpad — not in the repo; recreate if needed: launch Chrome with
`--headless=new --remote-debugging-port`, use Node's built-in WebSocket). Pre-rendered pages
must be tested at the trailing-slash URL with `vite preview` (it serves the SPA shell without
the slash). Local network was very slow (~2.5KB/s npm) — big downloads need resumable curl.
Review agents hit a monthly spend limit once mid-session; re-run if a hook requires them.

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
