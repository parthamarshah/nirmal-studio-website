import { useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion, scrollTo } from '../lib/scroll'
import Img from './Img'
import { isSectionOn } from '../lib/content'

// Section 1 (cinematic hero) of the brief. No real project video exists yet
// (all 7 confirmed projects are under construction) — uses a slow Ken
// Burns-style pan/zoom on the Citadel Tower render instead, per plan. Media
// is a data-driven asset (content/site.json homepage.hero), so swapping in real
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
      id="hero"
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
        <Img
            media={project.heroImage}
            mobile={project.heroImageMobile}
            imgRef={imageRef}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
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
        {/* Repointed to #projects (Featured Projects, Task #9) now that it
            exists — the previous #philosophy target was Task #6's interim
            placeholder, flagged in this same comment to be repointed once
            Featured Projects landed. #featured-projects (the id the old
            comment named) was never real; FeaturedProjects.jsx's actual id
            is "projects". href is a real in-page anchor so it still works
            if JS fails; the click handler routes through Lenis so scroll
            state doesn't desync. */}
        {isSectionOn('featuredProjects') && (
          <a
            href="#projects"
            onClick={(e) => {
              e.preventDefault()
              scrollTo('#projects')
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
              Explore Our Work
            </span>
          </a>
        )}
      </div>
    </section>
  )
}
