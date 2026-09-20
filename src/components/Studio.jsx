import { Suspense, lazy, useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '../lib/scroll'
import { tejShah, foldNetwork, foundersReady } from '../lib/content'

// Founders.jsx pulls in Embla (the phone carousel). `foundersReady` is false today
// and stays false until all four people have a real photo and bio, so nobody visiting
// the site can currently reach that carousel — yet a static import put Embla in the
// homepage bundle for every visitor anyway (the flag is computed from content at
// runtime, so the bundler can't tree-shake it away). Loading it on demand keeps those
// bytes off the homepage until the section actually switches on.
const Founders = lazy(() => import('./Founders'))

// v1 (plan Phase 1b): the new founders section (Founders.jsx) replaces this one
// only once all four people have a real photo and bio in content/founders.json —
// the live site never shows placeholder portraits or empty bios. Until then the
// pre-v1 layout below stays.
//
// Suspense sits INSIDE the gate, not around it: the legacy layout is the branch that
// actually renders today, and wrapping the whole section would give it a fallback
// flash / layout shift for no benefit.
//
// The fallback RESERVES the section's height rather than rendering null. Founders is a
// full-height section in the middle of the page: on a slow connection the chunk can take
// seconds, and collapsing to nothing then expanding would shove everything below it down
// under the reader's thumb mid-scroll. Scroll anchoring can't be relied on here — Lenis
// drives the scroll.
export default function Studio() {
  return foundersReady ? (
    <Suspense fallback={<div style={{ minHeight: '100svh' }} aria-hidden="true" />}>
      <Founders />
    </Suspense>
  ) : (
    <LegacyStudio />
  )
}

// Pre-v1 section: Studio (Tej Shah) + Network (FOLD). Nirmal Studio
// is Tej's personal practice, not a multi-founder firm — FOLD is a separate,
// informal, non-legal network of four architects (Tej among them) who
// collaborate project-by-project for added scale/expertise/geography. Tej
// gets primary billing (a full 100svh block); FOLD gets a real, substantial
// secondary block sized to ~3/4 that height (75svh) — present and detailed,
// but never framed as co-founders of Nirmal Studio itself.
function LegacyStudio() {
  const tejRef = useRef(null)
  const foldRef = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const tweens = []
    ;[tejRef, foldRef].forEach((ref) => {
      if (!ref.current) return
      tweens.push(
        gsap.fromTo(
          ref.current,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 1.2,
            ease: 'power2.out',
            // clamp() — same CLAUDE.md incident IdeaTimeline hit twice and
            // FeaturedProjects already guards against: a fixed 'top 75%'
            // can be unreachable if there isn't enough scroll room above
            // this trigger on a given viewport.
            scrollTrigger: { trigger: ref.current, start: 'clamp(top 75%)' },
          },
        ),
      )
    })
    return () => {
      tweens.forEach((tween) => {
        tween.scrollTrigger?.kill()
        tween.kill()
      })
    }
  }, [])

  return (
    <section id="studio">
      <div
        ref={tejRef}
        className="studio-section-tej"
        style={{
          minHeight: '100svh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 'var(--space-xl) var(--space-md)',
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.75rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--color-bronze-darker)',
              marginBottom: 'var(--space-sm)',
            }}
          >
            Studio
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(2rem, 5.5vw, 3.25rem)',
              marginBottom: 'var(--space-xs)',
            }}
          >
            {tejShah.name}
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.85rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-stone-dark)',
              marginBottom: 'var(--space-lg)',
            }}
          >
            {tejShah.title} — {tejShah.basedIn}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-heading)',
              fontStyle: 'italic',
              fontSize: 'clamp(1.15rem, 2.6vw, 1.5rem)',
              lineHeight: 1.6,
              color: 'var(--color-text)',
            }}
          >
            {tejShah.bio}
          </p>
        </div>
      </div>

      <div
        ref={foldRef}
        className="studio-section-fold"
        style={{
          minHeight: '75svh',
          background: 'var(--color-beige)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.75rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--color-bronze-darker)',
              marginBottom: 'var(--space-sm)',
            }}
          >
            Network
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(1.75rem, 4.5vw, 2.5rem)',
              marginBottom: 'var(--space-md)',
            }}
          >
            FOLD
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'clamp(0.95rem, 2vw, 1.05rem)',
              lineHeight: 1.7,
              color: 'var(--color-text)',
              maxWidth: 640,
              marginBottom: 'var(--space-md)',
            }}
          >
            FOLD is an informal, non-legal network of four independent
            architects — Bhumika Tak, Rachit Sinvhal, Tej Shah, and Hardik
            Maheshwari — who collaborate project-by-project for added scale,
            expertise, and geography. Tej is a member of both Nirmal Studio
            and FOLD; the other three run their own independent practices and
            collaborate with Nirmal Studio through FOLD.
          </p>
          <ul className="studio-section-fold-grid">
            {foldNetwork.map((member) => (
              <li key={member.name}>
                <h3
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.25rem',
                    marginBottom: '0.2em',
                  }}
                >
                  {member.name}
                </h3>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.75rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--color-bronze-darker)',
                    marginBottom: 'var(--space-xs)',
                  }}
                >
                  {member.title}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.85rem',
                    color: 'var(--color-bronze-darker)',
                    marginBottom: '0.4em',
                  }}
                >
                  {member.basedIn}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                    color: 'var(--color-text)',
                  }}
                >
                  {/* `previously` is what the backend edits; same wording as the older `background` field. */}
                  {member.previously ? `Worked at ${member.previously}.` : member.background} {member.expertise}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Scoped with a `studio-section-` prefix, same collision-avoidance
          reasoning as Philosophy.jsx — every section's markup is mounted at
          once in this single-page app. Grid column count and the FOLD
          block's own padding both change at the breakpoint, so both live
          entirely here (base case included) rather than partly inline — the
          exact failure Philosophy.jsx's split-screen hit (see CLAUDE.md
          known incidents). FOLD's mobile padding is deliberately tighter
          than Tej's (space-lg vs. space-xl): on mobile the three stacked
          member cards already add real height on top of it, and letting the
          padding be as generous as Tej's block pushed FOLD's rendered
          height past Tej's — the opposite of the pre-v1 rule that FOLD gets ~3/4
          the space of the Tej section. min-height alone can't guarantee that ratio once
          content exceeds the floor, so the fix is trimming what's actually
          inflating it. Desktop doesn't have this problem — 3 columns
          collapses the card stack — so it keeps the fuller padding. */}
      <style>{`
        .studio-section-fold {
          padding: var(--space-lg) var(--space-md);
        }
        .studio-section-fold-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--space-md);
          list-style: none;
          margin: 0;
          padding: 0;
        }
        /* Without a boundary, three similar-length text blocks blur into one
           continuous paragraph rather than reading as three distinct people
           — true in both the stacked mobile list and the 3-column desktop
           row, so this isn't gated to the desktop media query. */
        .studio-section-fold-grid > li {
          padding-top: var(--space-sm);
          border-top: 1px solid var(--color-stone-dark);
        }
        @media (min-width: 768px) {
          .studio-section-fold {
            padding: var(--space-xl) var(--space-md);
          }
          .studio-section-fold-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </section>
  )
}
