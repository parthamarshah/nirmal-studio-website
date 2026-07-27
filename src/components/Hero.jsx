import { useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion, scrollTo } from '../lib/scroll'

// Section 1 (cinematic hero) of the brief. No real project video exists yet
// (all 7 confirmed projects are under construction) — uses a slow Ken
// Burns-style pan/zoom on the Citadel Tower render instead, per plan. Media
// is a data-driven asset (see src/data/projects.js), so swapping in real
// video later is a prop change, not a rebuild.
export default function Hero({ project }) {
  const imageRef = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion() || !imageRef.current) return

    const tween = gsap.fromTo(
      imageRef.current,
      { scale: 1 },
      { scale: 1.12, duration: 20, ease: 'none' },
    )
    return () => tween.kill()
  }, [])

  // Guard against a bad/missing data lookup (e.g. a renamed slug in
  // projects.js) — there's no error boundary anywhere in this app, so an
  // unguarded project.heroImage read here would white-screen the entire site
  // over a data typo. Fall back to a plain dark background instead of
  // crashing; the missing image is visible/obvious rather than silent.
  const hasImage = Boolean(project?.heroImage)

  return (
    <section
      style={{
        position: 'relative',
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'flex-end',
        overflow: 'hidden',
        color: 'var(--color-warm-white)',
        background: '#111111',
      }}
    >
      {hasImage && (
        <picture>
          {project.heroImageMobile && (
            <source media="(max-width: 640px)" srcSet={project.heroImageMobile} />
          )}
          <img
            ref={imageRef}
            src={project.heroImage}
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              willChange: 'transform',
            }}
          />
        </picture>
      )}

      {/* Legibility gradient — text sits in the bottom third over the darkest part */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to top, rgba(17,17,17,0.75) 0%, rgba(17,17,17,0.25) 45%, rgba(17,17,17,0) 70%)',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: 'var(--space-md) var(--space-md) var(--space-xl)',
          maxWidth: 900,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.75rem, 6vw, 3.75rem)',
            lineHeight: 1.15,
            marginBottom: 'var(--space-sm)',
            // Contrast floor independent of the gradient — a bright region in
            // whatever photo Hero renders (this one has lit signage low in
            // frame) can otherwise push text contrast below WCAG AA.
            textShadow: '0 1px 16px rgba(0,0,0,0.6)',
          }}
        >
          Most houses look beautiful. Few truly feel like home.
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(0.95rem, 2vw, 1.25rem)',
            maxWidth: 560,
            marginBottom: 'var(--space-md)',
            opacity: 0.9,
            textShadow: '0 1px 16px rgba(0,0,0,0.6)',
          }}
        >
          We design architecture around people, light, and the way life unfolds.
        </p>
        {/* Points at #statement for now — repoint to #featured-projects once
            Task #9 (Featured Projects) exists. Copy says "Our Approach" (not
            "Explore Our Work") because it currently lands on the Philosophy
            statement, not a projects grid — repoint copy alongside the href
            when Task #9 lands. href is a real in-page anchor (Statement has
            that id) so it still works if JS fails; the click handler routes
            through Lenis so scroll state doesn't desync. */}
        <a
          href="#statement"
          onClick={(e) => {
            e.preventDefault()
            scrollTo('#statement')
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 44,
            fontFamily: 'var(--font-body)',
            fontSize: '0.95rem',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            textShadow: '0 1px 16px rgba(0,0,0,0.6)',
          }}
        >
          <span style={{ borderBottom: '1px solid var(--color-warm-white)', paddingBottom: 4 }}>
            Our Approach
          </span>
        </a>
      </div>
    </section>
  )
}
