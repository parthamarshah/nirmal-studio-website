import { useEffect, useRef, useState } from 'react'
import { gsap, prefersReducedMotion, scrollTo, ScrollTrigger } from '../lib/scroll'

// Section 8 of the brief: Process horizontal-scroll journey. Deliberately a
// different narrative from IdeaTimeline (Task #7, Idea→Sketch→Model→
// Drawings→Construction→Finished Home) — that section is one specific
// project's physical build sequence, told through real Nishee House
// drawings. This section is the studio's working method, told from Nirmal
// Studio's side of the table (how we work with you), typographic only — no
// dedicated process photography exists yet, same situation IdeaTimeline was
// in before the Drawings stage got a real image.
//
// Stage copy is generic studio-voice language, not a confirmed claim about
// how this specific practice works — needs Tej's sign-off, same flag as
// Philosophy's copy and IdeaTimeline's stage text.
const STAGES = [
  {
    number: '01',
    name: 'Listen',
    copy: 'Every project starts as a conversation — your site, your family, how you live, what the budget allows.',
  },
  {
    number: '02',
    name: 'Read the Site',
    copy: 'Light, orientation, climate, neighbours — we study what the land is already telling us before we draw a single line.',
  },
  {
    number: '03',
    name: 'Shape the Idea',
    copy: 'Concepts tested in plan and section until they hold up in three dimensions, not just on paper.',
  },
  {
    number: '04',
    name: 'Resolve the Detail',
    copy: 'Materials, junctions, thresholds — worked out to a level a contractor can actually build from.',
  },
  {
    number: '05',
    name: 'Build Together',
    copy: 'On-site through construction, working alongside masons and craftsmen — not just handing over drawings and walking away.',
  },
  {
    number: '06',
    name: 'Hand It Over',
    copy: "The keys, and everything that comes after — a space ready for the life you'll actually live in it.",
  },
]

export default function Process() {
  const wrapperRef = useRef(null)
  const trackRef = useRef(null)
  const progressFillRef = useRef(null)
  const stRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)
  // Toggled only inside the desktop matchMedia context below — a reduced-
  // motion desktop user never gets this true, so the CSS rules gated on it
  // (see the <style> block) never clip/pin the track, leaving the same
  // native horizontal-scroll-snap fallback mobile gets. Width alone can't
  // gate this in CSS, since the JS pin genuinely doesn't run for that user.
  const [pinned, setPinned] = useState(false)

  // Only toggles `pinned` — the actual ScrollTrigger setup lives in the
  // effect below, keyed off that state instead of running inline here. The
  // .is-pinned class swaps each panel from 82vw to 60vw (see the <style>
  // block), and gsap.matchMedia's callback fires before React has committed
  // that class change to the DOM — measuring track.scrollWidth in this same
  // callback would read the stale (mobile-width) layout. Splitting the
  // effect lets the second one measure only after the class-driven re-render
  // has actually landed.
  useEffect(() => {
    if (prefersReducedMotion() || !wrapperRef.current || !trackRef.current) return

    // gsap.matchMedia handles resize/breakpoint-cross cleanup automatically
    // (revert + re-run), which a manual resize listener would have to
    // reimplement — same responsive pattern GSAP's own docs recommend for
    // "different ScrollTrigger setup above/below a breakpoint."
    const mm = gsap.matchMedia()
    mm.add('(min-width: 1024px)', () => {
      setPinned(true)
      return () => setPinned(false)
    })

    return () => mm.revert()
  }, [])

  useEffect(() => {
    if (!pinned) return
    const track = trackRef.current
    const wrapper = wrapperRef.current
    if (!track || !wrapper) return

    // Function-based values (not a captured number) so `invalidateOnRefresh`
    // re-measures on every refresh — e.g. scroll.js's fonts.ready hook, or a
    // later window resize — rather than animating toward a distance that was
    // only ever correct at this specific mount.
    const getDistance = () => track.scrollWidth - wrapper.clientWidth

    const tween = gsap.to(track, {
      x: () => -getDistance(),
      ease: 'none',
      scrollTrigger: {
        trigger: wrapper,
        start: 'top top',
        end: () => `+=${getDistance()}`,
        scrub: true,
        pin: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const raw = Math.round(self.progress * (STAGES.length - 1))
          setActiveIndex(Math.min(STAGES.length - 1, Math.max(0, raw)))
        },
      },
    })
    stRef.current = tween.scrollTrigger

    // Captured once here (not read via progressFillRef.current inside the
    // cleanup below) — this component never conditionally unmounts the fill
    // element, so the ref is stable, but capturing it keeps the cleanup from
    // depending on the ref's value at a later, unrelated point in time.
    const fillEl = progressFillRef.current
    let fillTween
    if (fillEl) {
      gsap.set(fillEl, { width: '0%' })
      fillTween = gsap.to(fillEl, {
        width: '100%',
        ease: 'none',
        scrollTrigger: {
          trigger: wrapper,
          start: 'top top',
          end: () => `+=${getDistance()}`,
          scrub: true,
        },
      })
    }

    // This effect runs right after React commits the .is-pinned class, so
    // track.scrollWidth above is already correct — but ScrollTrigger's own
    // pin setup can still shift layout (it inserts a pin-spacer). One
    // rAF-deferred refresh re-settles start/end against the final DOM, same
    // defensive pattern as scroll.js's fonts.ready → refresh() hook.
    // Also derives activeIndex from the just-settled progress here, rather
    // than assuming onUpdate fires the instant the trigger is (re)created —
    // this is the mobile-to-desktop mirror of the resize-down fix below: on
    // a resize-up mid-carousel (e.g. a tablet rotating past 1024px), this is
    // what corrects the dots/label from whatever the mobile scroll listener
    // last set to what the new pin's actual scroll position implies.
    const raf = requestAnimationFrame(() => {
      ScrollTrigger.refresh()
      const st = tween.scrollTrigger
      if (st) {
        const raw = Math.round(st.progress * (STAGES.length - 1))
        setActiveIndex(Math.min(STAGES.length - 1, Math.max(0, raw)))
      }
    })

    return () => {
      cancelAnimationFrame(raf)
      stRef.current = null
      tween.scrollTrigger?.kill()
      tween.kill()
      fillTween?.scrollTrigger?.kill()
      fillTween?.kill()
      // .kill() stops the tween but leaves whatever inline transform/width it
      // last applied — the next render swaps this same track/fill element
      // over to the mobile scroll-snap CSS, which would otherwise inherit a
      // stale translateX (cards rendering shifted/cut off) or a stale fill
      // width (progress bar frozen mid-way) from the exact scroll position
      // the pin was killed at. Same root-cause class as CLAUDE.md's
      // documented "inline style beats stylesheet" incident — clear it
      // explicitly rather than relying on the fallback CSS to win.
      gsap.set(track, { clearProps: 'transform' })
      if (fillEl) {
        gsap.set(fillEl, { clearProps: 'width' })
      }
      // The mobile/reduced-motion fallback's own scroll listener only fires
      // on a native 'scroll' event — resizing down mid-pin (e.g. at stage 4)
      // never fires one, so without this the dots/progress label would keep
      // showing the pinned scroll's last stage while the carousel itself
      // visually resets to panel 1 (its native scrollLeft starts at 0).
      setActiveIndex(0)
    }
  }, [pinned])

  // Mobile / reduced-motion fallback: native horizontal scroll-snap drives
  // the same activeIndex + dot row the desktop pin uses, since the GSAP
  // tween above never registers below 1024px (or at all, under reduced
  // motion). Harmless to keep attached at desktop widths too — the track
  // has no native overflow-scroll there (JS moves it via transform
  // instead), so it just never fires.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const handleScroll = () => {
      const panel = track.firstElementChild
      if (!panel) return
      const gap = parseFloat(getComputedStyle(track).columnGap || '0')
      const step = panel.getBoundingClientRect().width + gap
      if (!step) return
      // iOS Safari's rubber-band overscroll can push scrollLeft slightly
      // past the last panel's offset, which would round to an out-of-range
      // index — STAGES[6] is undefined, and .name on it white-screens the
      // whole app (no error boundary anywhere in this codebase).
      const raw = Math.round(track.scrollLeft / step)
      setActiveIndex(Math.min(STAGES.length - 1, Math.max(0, raw)))

      // The desktop pin drives progressFillRef itself (see the pinned
      // effect above), but that effect is entirely skipped on mobile/
      // reduced-motion — without updating it here too, the fill bar would
      // stay frozen at its CSS default (0%) through a full swipe of all 6
      // stages while the dots/label beside it correctly advance.
      const fillEl = progressFillRef.current
      if (fillEl) {
        const maxScroll = track.scrollWidth - track.clientWidth
        const progress = maxScroll > 0 ? Math.min(1, Math.max(0, track.scrollLeft / maxScroll)) : 0
        fillEl.style.width = `${progress * 100}%`
      }
    }

    track.addEventListener('scroll', handleScroll, { passive: true })
    return () => track.removeEventListener('scroll', handleScroll)
  }, [])

  const goToStage = (i) => {
    if (pinned) {
      // `pinned` flips true (and commits the .is-pinned DOM class) a render
      // before the sibling effect actually creates the ScrollTrigger and
      // populates stRef — a dot clicked in that one-paint window would
      // otherwise silently fall through to the scrollIntoView branch below
      // while the track is already in pinned (overflow:visible, transform-
      // driven) layout, producing a scroll jump through the wrong mechanism
      // entirely. Deliberate no-op instead: the pin effect's own rAF-deferred
      // refresh settles things a frame later regardless.
      if (!stRef.current) return
      const st = stRef.current
      scrollTo(st.start + (i / (STAGES.length - 1)) * (st.end - st.start))
      return
    }
    // Scroll the track's own scrollLeft, not scrollIntoView() — CLAUDE.md's
    // known-incident list is explicit that in-page navigation must never
    // bypass Lenis via a native scrollIntoView()/scrollTo(), since it can
    // also move the page's vertical scroll (whatever amount keeps the panel
    // in view) outside Lenis's sync, not just the track's horizontal one.
    const track = trackRef.current
    const panel = track?.children[i]
    if (!track || !panel) return
    track.scrollTo({
      left: panel.offsetLeft - track.offsetLeft,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }

  return (
    <section
      id="process"
      style={{
        position: 'relative',
        background: 'var(--color-bg)',
      }}
    >
      <div
        style={{
          padding: 'var(--space-xl) var(--space-md) var(--space-lg)',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)',
            marginBottom: 'var(--space-sm)',
          }}
        >
          Process
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(0.95rem, 2vw, 1.05rem)',
            color: 'var(--color-stone-dark)',
            maxWidth: 480,
            margin: '0 auto',
          }}
        >
          From first conversation to the day you move in.
        </p>
      </div>

      <div
        ref={wrapperRef}
        className={`process-wrapper${pinned ? ' is-pinned' : ''}`}
        style={{ position: 'relative' }}
      >
        <div
          ref={trackRef}
          className={`process-track${pinned ? ' is-pinned' : ''}`}
          // Only a real scroll container in the non-pinned (mobile/reduced-
          // motion) case — when pinned, the track is transform-driven and
          // overflow:visible (see the .is-pinned CSS below), so it isn't
          // scrollable itself; the horizontal motion comes from the
          // ScrollTrigger scrub of the PAGE's vertical scroll. Leaving this
          // attribute on unconditionally would tell Lenis to stop smoothing/
          // syncing wheel input over this whole section even while pinned —
          // `undefined`, not `false`, since React still renders
          // data-lenis-prevent="false" for a literal false, and Lenis only
          // checks for the attribute's presence, not its value.
          data-lenis-prevent={pinned ? undefined : ''}
          role="region"
          aria-label="Our design process, six stages"
        >
          {STAGES.map((stage, i) => (
            <article
              key={stage.name}
              className="process-panel"
              role="group"
              aria-label={`Stage ${i + 1} of ${STAGES.length}: ${stage.name}`}
              style={{
                opacity: !pinned || i === activeIndex ? 1 : 0.4,
                transform: pinned && i === activeIndex ? 'scale(1)' : pinned ? 'scale(0.96)' : 'none',
              }}
            >
              <span className="process-panel-ghost" aria-hidden="true">
                {stage.number}
              </span>
              <span className="process-panel-number">{stage.number}</span>
              <h3 className="process-panel-name">{stage.name}</h3>
              <p className="process-panel-copy">{stage.copy}</p>
              {/* Desktop-pinned only, first card only — the moment vertical
                  scroll starts converting into horizontal card motion is the
                  one point in the whole site a visitor could plausibly read
                  as "stuck." Mobile doesn't need this: the peeking next card
                  already reads as a swipeable carousel there, a much more
                  familiar pattern than a scroll-hijack. Fades out the moment
                  the user actually advances, so it never nags. */}
              {i === 0 && (
                <span
                  className="process-hint"
                  aria-hidden="true"
                  style={{ opacity: pinned && activeIndex === 0 ? 1 : 0 }}
                >
                  Keep scrolling ↓
                </span>
              )}
            </article>
          ))}
        </div>

        {/* Decorative only (aria-hidden) — the real "Process" heading is a
            real <h2> above the pinned wrapper, but it scrolls out of view for
            the entire pinned sequence once the section engages. Screen
            readers already have the h2; this is purely so a sighted visitor
            doesn't lose the section's identity mid-scroll. Desktop-pinned
            only (see CSS) — mobile never scrolls the heading out of view. */}
        <span className="process-pinned-label" aria-hidden="true">
          Process
        </span>

        <div className="process-progress">
          <div className="process-progress-track">
            <div ref={progressFillRef} className="process-progress-fill" />
          </div>
          <div className="process-dots">
            {STAGES.map((stage, i) => (
              <button
                key={stage.name}
                type="button"
                className={`process-dot${i === activeIndex ? ' is-active' : ''}`}
                aria-label={`Go to stage ${i + 1}: ${stage.name}`}
                aria-current={i === activeIndex ? 'true' : undefined}
                onClick={() => goToStage(i)}
              />
            ))}
          </div>
          <span className="process-progress-label">
            {String(activeIndex + 1).padStart(2, '0')} — {STAGES[activeIndex].name}
          </span>
        </div>
      </div>

      {/* Scoped with a `process-` prefix, same collision-avoidance reason as
          Philosophy's scoped block (single-page app, every section mounted
          at once). Base rules are the mobile/reduced-motion fallback: a
          plain horizontal-scroll-snap strip, no JS required for it to work.
          The `.is-pinned` rules (only ever applied by JS, see the `pinned`
          state above) are what turn it into the desktop pinned/scrubbed
          journey — gating on the class rather than only the media query
          means a reduced-motion desktop user still gets the working
          snap-scroll fallback instead of a clipped, un-scrollable track. */}
      <style>{`
        .process-track {
          display: flex;
          gap: var(--space-md);
          overflow-x: auto;
          overflow-y: hidden;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          padding: var(--space-xs) var(--space-md) var(--space-lg);
          scroll-padding-left: var(--space-md);
        }
        .process-panel {
          position: relative;
          flex: 0 0 82vw;
          scroll-snap-align: start;
          background: var(--color-warm-white);
          /* --color-stone, not --color-beige — the peeking next card is the
             whole "there's more to scroll to" affordance, and beige against
             --color-bg sits at ~1.2:1 (functionally invisible); stone clears
             3:1 so the card edge actually reads as a boundary. */
          border: 1px solid var(--color-stone);
          border-radius: 4px;
          padding: var(--space-lg) var(--space-md) var(--space-md);
          overflow: hidden;
          transition: opacity var(--duration-medium) var(--ease-luxury),
            transform var(--duration-medium) var(--ease-luxury);
        }
        .process-panel-ghost {
          position: absolute;
          top: -0.4em;
          right: 0.1em;
          font-family: var(--font-heading);
          font-size: 7rem;
          color: var(--color-beige);
          line-height: 1;
          pointer-events: none;
          user-select: none;
        }
        .process-panel-number {
          display: block;
          position: relative;
          font-family: var(--font-body);
          font-size: 0.75rem;
          letter-spacing: 0.12em;
          color: var(--color-bronze-darker);
          margin-bottom: var(--space-sm);
        }
        .process-panel-name {
          position: relative;
          font-family: var(--font-heading);
          font-size: clamp(1.35rem, 3vw, 1.75rem);
          margin: 0 0 var(--space-sm);
        }
        .process-panel-copy {
          position: relative;
          font-family: var(--font-body);
          font-size: 0.95rem;
          line-height: 1.6;
          color: var(--color-text);
          max-width: 34ch;
        }
        .process-progress {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          padding: 0 var(--space-md) var(--space-md);
          flex-wrap: wrap;
        }
        .process-progress-track {
          flex: 1 1 auto;
          min-width: 60px;
          height: 2px;
          background: var(--color-beige);
        }
        .process-progress-fill {
          width: 0%;
          height: 100%;
          /* --color-bronze-dark, not the base --color-bronze — the base
             token only hits ~2.7:1 against the beige track, below the 3:1
             floor for non-text UI, and this bar is the primary "how far
             through 6 stages am I" cue. Same swap already made for chips
             elsewhere in this codebase for the equivalent reason. */
          background: var(--color-bronze-dark);
        }
        .process-dots {
          display: flex;
          gap: 8px;
        }
        .process-dot {
          /* Visual dot stays 9px, but the actual hit area is 44x44 via a
             transparent ::before — this is the primary alternate-navigation
             control on mobile alongside swipe, so it needs a real tap
             target, not just a decorative one. */
          position: relative;
          width: 9px;
          height: 9px;
          border-radius: 50%;
          border: 1px solid var(--color-bronze-darker);
          background: transparent;
          padding: 0;
          cursor: pointer;
        }
        .process-dot::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 44px;
          height: 44px;
          transform: translate(-50%, -50%);
        }
        .process-dot.is-active {
          background: var(--color-bronze-darker);
        }
        .process-progress-label {
          font-family: var(--font-body);
          font-size: 0.75rem;
          letter-spacing: 0.06em;
          color: var(--color-stone-dark);
          white-space: nowrap;
        }
        .process-hint {
          display: none;
        }
        .process-pinned-label {
          display: none;
        }

        @media (min-width: 1024px) {
          .process-panel {
            flex: 0 0 60vw;
            padding: var(--space-xl) var(--space-lg) var(--space-lg);
          }
          .process-panel-ghost {
            font-size: 11rem;
          }

          .process-wrapper.is-pinned {
            height: 100svh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .process-track.is-pinned {
            overflow: visible;
            scroll-snap-type: none;
            padding: 0 var(--space-xl);
            width: max-content;
          }
          .process-wrapper.is-pinned .process-progress {
            position: absolute;
            left: 0;
            right: 0;
            bottom: var(--space-lg);
            max-width: 720px;
            margin: 0 auto;
            padding: 0 var(--space-xl);
          }
          .process-wrapper.is-pinned .process-pinned-label {
            display: block;
            position: absolute;
            top: var(--space-md);
            left: var(--space-xl);
            font-family: var(--font-body);
            font-size: 0.75rem;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: var(--color-stone-dark);
          }
          .process-wrapper.is-pinned .process-hint {
            display: block;
            position: absolute;
            bottom: var(--space-md);
            right: var(--space-lg);
            font-family: var(--font-body);
            font-size: 0.75rem;
            letter-spacing: 0.06em;
            color: var(--color-bronze-darker);
            transition: opacity var(--duration-slow) var(--ease-luxury);
          }
        }
      `}</style>
    </section>
  )
}
