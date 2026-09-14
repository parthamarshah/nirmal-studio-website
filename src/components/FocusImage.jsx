import { useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '../lib/scroll'
import Img from './Img'

// Section 3 of the brief: a quiet, full-bleed photography beat between the
// Statement and Philosophy sections — minimal text, a slow scroll-scrubbed
// parallax (not Ken Burns, which Hero already owns) so the two full-bleed
// image moments read differently. Uses the Terra Row Houses render (not
// Citadel Tower, already spent in Hero) so the first three sections don't
// repeat the same photograph. Caption is a plain project credit (name/type/
// location), not another line about people or process — Hero and Philosophy
// already cover that ground, so this beat stays a clean photograph instead
// of a fourth restatement of the same idea.
export default function FocusImage({ project }) {
  const imageRef = useRef(null)
  const sectionRef = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion() || !imageRef.current || !sectionRef.current) return

    const tween = gsap.fromTo(
      imageRef.current,
      { y: -40 },
      {
        y: 40,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      },
    )
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [])

  // Same guard pattern as Hero — a missing/renamed slug must not white-screen
  // the app, it should just render an empty dark section.
  const hasImage = Boolean(project?.heroImage)

  return (
    <section
      ref={sectionRef}
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
            loading="lazy"
            style={{
              position: 'absolute',
              top: -40,
              left: 0,
              width: '100%',
              height: 'calc(100% + 80px)',
              objectFit: 'cover',
              objectPosition: 'center',
              willChange: 'transform',
            }}
          />
      )}

      {/* Same strength/stops as Hero's scrim, not the lighter one this
          started with — checked against the actual mobile portrait crop
          (light concrete/pale paving at the bottom) and a thinner gradient
          left the caption below AA contrast there. A "clean photograph"
          only works if the caption is legible on every crop it ships with. */}
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
          maxWidth: 560,
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.1rem, 3vw, 1.5rem)',
            marginBottom: 'var(--space-xs)',
            textShadow: '0 1px 16px rgba(0,0,0,0.6)',
          }}
        >
          {project?.name}
        </p>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.8rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            opacity: 0.85,
            textShadow: '0 1px 16px rgba(0,0,0,0.6)',
          }}
        >
          {/* Status comes from the project's own facts — never assumed (CLAUDE.md). */}
          {[project?.type, project?.location, project?.status].filter(Boolean).join(' · ')}
        </p>
      </div>
    </section>
  )
}
