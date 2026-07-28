import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { gsap, prefersReducedMotion, ScrollTrigger } from '../lib/scroll'

// Section 5 of the brief: Idea→Sketch→Model→Drawings→Construction→Finished
// Home. Per Parth (no real sketch/model photography exists, same situation
// as Philosophy's image half): typographic/abstract stages, not fabricated
// process photography. The one exception is Drawings, which gets a real
// floor plan — the caption/image path come from the `project` prop
// (project.drawings), same content-as-data pattern as every other section,
// rather than a hardcoded path here. Deliberately a vertical scroll reveal,
// not a pinned/horizontal-scroll sequence — Section 8 (Process) is the
// section that owns horizontal-scroll per the build plan, so this stays a
// plain top-to-bottom timeline instead of competing with that interaction.
//
// Stage copy is generic process language, not a claim about how this
// specific practice works — needs Tej's sign-off, same as Philosophy's copy.
const STAGES = [
  {
    number: '01',
    name: 'Idea',
    copy: 'Every project starts as a conversation — what the site needs, what the family needs, what the budget allows.',
  },
  {
    number: '02',
    name: 'Sketch',
    copy: 'Rough lines on paper, testing how the pieces might fit before anything is fixed.',
  },
  {
    number: '03',
    name: 'Model',
    copy: 'A three-dimensional check on the idea — does it actually work in space, not just on a page.',
  },
  {
    number: '04',
    name: 'Drawings',
    copy: 'Every dimension, every wall, made precise enough to build from.',
  },
  {
    number: '05',
    name: 'Construction',
    copy: 'The design meets the site — steel, concrete, and a crew turning drawings into a structure.',
  },
  {
    number: '06',
    name: 'Finished Home',
    copy: 'Not handover — the day someone actually moves in and starts living there.',
  },
]

export default function IdeaTimeline({ project }) {
  const wrapperRef = useRef(null)
  const trackRef = useRef(null)
  const lineFillRef = useRef(null)
  const stageRefs = useRef([])
  const lastMarkerRef = useRef(null)
  // The drawing is dense enough that its dimension text is unreadable at
  // the inline display size on a phone (Parth confirmed on a real device) —
  // holds { src, alt } for whichever stage's image is open, or null.
  const [lightboxImage, setLightboxImage] = useState(null)
  // Framer's exit animation keeps this overlay mounted (and, by default,
  // fully interactive) for its whole 0.25s fade after closing — without
  // disabling pointer-events the instant it closes, a click landing in that
  // window falls on the still-fading, now-invisible overlay instead of the
  // page underneath. Same fix, and the same reason it must be reset again
  // on open (AnimatePresence reuses this DOM node on a fast close-then-
  // reopen since it isn't keyed by which stage/image is showing), as
  // FeaturedProjects.jsx's project-detail/lightbox overlays — see CLAUDE.md's
  // known-incident list.
  const lightboxRef = useRef(null)
  const closeLightbox = () => {
    lightboxRef.current?.style.setProperty('pointer-events', 'none')
    setLightboxImage(null)
  }
  const openLightbox = (image) => {
    lightboxRef.current?.style.removeProperty('pointer-events')
    setLightboxImage(image)
  }

  const stages = STAGES.map((stage) =>
    stage.name === 'Drawings' && project?.drawings
      ? { ...stage, image: project.drawings, imageCaption: `${project.name}, ground floor plan` }
      : stage,
  )

  // The bronze fill's height is a % of the track div, and the track's own
  // length needs to stop at the last marker's center, not run past it into
  // that stage's text — otherwise a full (100%) fill visually overshoots
  // "Finished Home" into empty space below it. Re-measured on the drawing
  // image's load too, since that image sits above the last marker and its
  // late (lazy) load reflows everything below it.
  const positionTrack = () => {
    if (!trackRef.current || !lastMarkerRef.current) return
    const trackTop = trackRef.current.getBoundingClientRect().top
    const markerBox = lastMarkerRef.current.getBoundingClientRect()
    const height = markerBox.top + markerBox.height / 2 - trackTop
    trackRef.current.style.height = `${height}px`
  }

  useEffect(() => {
    // Measure the track length regardless of reduced motion — the
    // reduced-motion path draws the fill at its full (unmeasured) length by
    // default, which is exactly the case where an overshoot past the last
    // marker would be most visible.
    positionTrack()

    // Re-measure whenever ScrollTrigger recalculates — which already
    // happens on window resize (built in) and once Fraunces/Syne swap in
    // (scroll.js's `document.fonts.ready` hook). Without this, the
    // mount-time measurement is taken against the fallback serif and goes
    // stale the moment the real heading font reflows the six stage blocks.
    // Stored so it can actually be removed — an anonymous listener here
    // would leak on every mount, the same bug class as scroll.js's ticker
    // callback.
    ScrollTrigger.addEventListener('refreshInit', positionTrack)

    if (prefersReducedMotion() || !wrapperRef.current) {
      // scroll.js's document.fonts.ready → ScrollTrigger.refresh() hook
      // lives inside initScroll(), after its own reduced-motion early
      // return — so it never runs for these users, and 'refreshInit' above
      // never fires either. This is the path where the fill renders at full
      // length by default, so a stale (pre-font-swap) measurement is at its
      // most visible here of all four paths. Re-measure directly.
      document.fonts?.ready?.then(positionTrack)
      return () => ScrollTrigger.removeEventListener('refreshInit', positionTrack)
    }

    const tweens = []

    if (lineFillRef.current) {
      tweens.push(
        gsap.fromTo(
          lineFillRef.current,
          { height: '0%' },
          {
            height: '100%',
            ease: 'none',
            scrollTrigger: {
              // The wrapper (not the section) — the fill % is measured
              // against the track, which is sized off the wrapper. Using
              // the section (which has extra heading/padding above the
              // wrapper) desynced scroll progress from fill progress, so
              // the line visibly ran ahead of the stage reveals it's meant
              // to track.
              trigger: wrapperRef.current,
              // clamp(...) keeps both ends inside the actual achievable
              // scroll range. This is the last section on the page, so a
              // fixed percentage like 'bottom 60%' can be mathematically
              // unreachable at max scroll (there's nothing below to keep
              // scrolling into) — that left the fill permanently stuck
              // ~15-20% short. clamp() self-heals if a later task adds
              // sections below this one, so it's not something to remember
              // to revisit.
              start: 'clamp(top 80%)',
              end: 'clamp(bottom bottom)',
              scrub: true,
            },
          },
        ),
      )
    }

    stageRefs.current.forEach((el) => {
      if (!el) return
      tweens.push(
        gsap.fromTo(
          el,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: 'power2.out',
            // clamp() — on a tall/maximized desktop viewport, the last
            // stage's fixed 'top 80%' point can fall below the document's
            // actual max scroll, which left "Finished Home" stuck invisible
            // at opacity:0 forever. clamp() keeps it inside range.
            scrollTrigger: { trigger: el, start: 'clamp(top 80%)' },
          },
        ),
      )
    })

    return () => {
      ScrollTrigger.removeEventListener('refreshInit', positionTrack)
      tweens.forEach((tween) => {
        tween.scrollTrigger?.kill()
        tween.kill()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ScrollTrigger.refresh() fires the 'refreshInit' event, which the effect
  // above already listens for — that re-runs positionTrack() too, so this
  // one call re-measures the track and corrects any stale trigger positions
  // caused by the lazy-loaded drawing reflowing the layout below it.
  const handleDrawingLoad = () => ScrollTrigger.refresh()

  useEffect(() => {
    if (!lightboxImage) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeLightbox()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxImage])

  return (
    <section
      style={{
        position: 'relative',
        background: 'var(--color-bg)',
        padding: 'var(--space-xl) var(--space-md)',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)',
          textAlign: 'center',
          marginBottom: 'var(--space-xl)',
        }}
      >
        From Idea to Home
      </h2>

      <div ref={wrapperRef} style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
        {/* Connecting line, behind the marker circles. Background track is
            static; the bronze fill grows with scroll (or sits at 100% when
            motion is reduced, so the timeline still reads as complete). */}
        <div
          ref={trackRef}
          style={{
            position: 'absolute',
            left: 19,
            top: 8,
            // Fallback before positionTrack() measures the real length on
            // mount (and reduced-motion users' baseline, though that effect
            // also calls positionTrack() to correct it immediately).
            height: 'calc(100% - 16px)',
            width: 2,
            background: 'var(--color-beige)',
          }}
        >
          <div
            ref={lineFillRef}
            style={{
              width: '100%',
              height: prefersReducedMotion() ? '100%' : 0,
              background: 'var(--color-bronze)',
            }}
          />
        </div>

        {stages.map((stage, i) => (
          <div
            key={stage.name}
            ref={(el) => {
              stageRefs.current[i] = el
            }}
            style={{
              position: 'relative',
              marginBottom: i < stages.length - 1 ? 'var(--space-lg)' : 0,
            }}
          >
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <div
                ref={i === stages.length - 1 ? lastMarkerRef : undefined}
                style={{
                  position: 'relative',
                  flexShrink: 0,
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-bronze)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-heading)',
                  fontSize: '0.85rem',
                  color: 'var(--color-bronze-dark)',
                }}
              >
                {stage.number}
              </div>

              <div style={{ flex: 1, paddingTop: 4 }}>
                <h3
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'clamp(1.15rem, 2.5vw, 1.5rem)',
                    marginBottom: 'var(--space-xs)',
                  }}
                >
                  {stage.name}
                </h3>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.95rem',
                    lineHeight: 1.6,
                    color: 'var(--color-text)',
                    maxWidth: 520,
                  }}
                >
                  {stage.copy}
                </p>
              </div>
            </div>

            {/* Deliberately outside the marker + 520px-text row above,
                spanning the section's full 720px container instead — a
                dense architectural drawing loses its dimension text almost
                entirely if it's squeezed into the text column's width on a
                mobile viewport. */}
            {stage.image && (
              <figure style={{ margin: 'var(--space-sm) 0 0' }}>
                <button
                  type="button"
                  onClick={() => openLightbox({ src: stage.image, alt: stage.imageCaption })}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'zoom-in',
                    position: 'relative',
                  }}
                >
                  <img
                    src={stage.image}
                    alt={stage.imageCaption}
                    loading="lazy"
                    onLoad={handleDrawingLoad}
                    // width/height are the Nishee crop's own pixel
                    // dimensions — only a CLS-reservation hint (browsers
                    // derive an intrinsic ratio from these before load, then
                    // the real image ratio takes over once decoded).
                    // Deliberately NOT also set as a CSS aspect-ratio, which
                    // would force this exact ratio permanently — this
                    // component is data-driven (project.drawings), and
                    // Shimla House's own drawing is a different shape; a
                    // hardcoded CSS ratio would distort it.
                    width={1584}
                    height={1548}
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                      border: '1px solid var(--color-beige)',
                    }}
                  />
                  {/* Small tap-to-enlarge affordance — dense dimension text
                      on this drawing is unreadable at inline mobile size
                      (confirmed on a real device), so this isn't optional
                      decoration. */}
                  <span
                    style={{
                      position: 'absolute',
                      right: 8,
                      bottom: 8,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'rgba(17,17,17,0.7)',
                      color: 'var(--color-warm-white)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.7rem',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Tap to enlarge
                  </span>
                </button>
                <figcaption
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.75rem',
                    letterSpacing: '0.05em',
                    color: 'var(--color-stone-dark)',
                    marginTop: 'var(--space-xs)',
                  }}
                >
                  {stage.imageCaption}
                </figcaption>
              </figure>
            )}
          </div>
        ))}
      </div>

      {/* Full-screen preview so the drawing's dimension text is actually
          readable on a phone — the inline image is too small for that on
          its own. Explicit solid background on the overlay itself (per
          CLAUDE.md's known-incident note on full-screen overlays), not just
          a transparent scrim. */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={prefersReducedMotion() ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion() ? undefined : { opacity: 0 }}
            transition={{ duration: 0.25 }}
            // Only close on a direct backdrop click, not a click that
            // bubbled up from the image — without this guard, a double-tap-
            // to-zoom gesture on the drawing fires a click on its first tap
            // and closes the lightbox before the zoom ever registers,
            // defeating the one thing this overlay exists to let you do.
            onClick={(e) => {
              if (e.target === e.currentTarget) closeLightbox()
            }}
            ref={lightboxRef}
            // Lenis (src/lib/scroll.js) installs a global wheel handler
            // that has no concept of nested scrollable elements — without
            // this attribute, a desktop mouse wheel over the overlay would
            // scroll the PAGE BEHIND it instead of panning the drawing
            // (Lenis checks the event target's ancestor chain for this
            // attribute and skips it). Touch panning is unaffected — Lenis
            // only smooths wheel input, not touch — so this is a
            // desktop-only fix, easy to miss testing on a phone.
            data-lenis-prevent
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 'var(--z-overlay)',
              background: '#111111',
              // Deliberately NOT centered/fit-to-screen — the whole point is
              // to render the drawing at (or beyond, via native pinch-zoom;
              // the site's viewport meta tag doesn't block it) its natural
              // size so dimension text is actually bigger than the inline
              // version, not the same size again. overflow:auto + the
              // image's natural width makes this a pan/scroll view.
              overflow: 'auto',
              overscrollBehavior: 'contain',
              // Padding on the container (not margin on the image) so the
              // trailing space survives scrolling to the image's right/
              // bottom edge — an image wider than its scroll container
              // drops a trailing margin once scrolled past it.
              padding: 'var(--space-md)',
            }}
          >
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              // No width/height/maxWidth here, deliberately — an
              // unconstrained <img> renders at its own intrinsic pixel
              // size, which works correctly regardless of which project's
              // drawing this data-driven src points to. A hardcoded pixel
              // width (even one matching Nishee's own crop) would misrender
              // a differently-sized drawing.
              style={{ display: 'block', margin: '0 auto' }}
            />
            <button
              type="button"
              onClick={closeLightbox}
              aria-label="Close"
              style={{
                // fixed, not absolute — this overlay scrolls (that's the
                // point), an absolutely-positioned button would scroll away
                // with the image instead of staying reachable.
                position: 'fixed',
                top: 'var(--space-sm)',
                right: 'var(--space-sm)',
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '1px solid var(--color-warm-white)',
                // 0.85, not 0.6 — most of a floor plan is light/white, and
                // at 0.6 the button's edge disappeared against that area,
                // leaving only the glyph and no visible tap-target boundary.
                background: 'rgba(17,17,17,0.85)',
                color: 'var(--color-warm-white)',
                fontSize: '1.25rem',
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              &times;
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
