import { useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '../lib/scroll'
import Img from './Img'

// Section 4 of the brief: Philosophy split-screen. Stacked image-over-text on
// mobile (a 50/50 side-by-side is unreadable below tablet width), side-by-side
// from the `md` breakpoint up. No sketch/tracing-paper photography exists yet
// for the image half — using the Dolomite/Calcite Factory Office interior
// render instead (real project imagery, not a fabricated placeholder), picked
// because its stone/wood materiality actually matches the "materials that age
// honestly" line in the copy below, until real sketch scans are supplied.
// It's a single data-driven path (`project.heroImage`), so swapping it later
// is a one-line change, same pattern as Hero's media.
const THEMES = ['Light', 'Movement', 'Context', 'Materials', 'Climate', 'Vastu', 'Lifestyle']

export default function Philosophy({ project }) {
  const textRef = useRef(null)
  const imageRef = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion()) return

    const tweens = []
    if (textRef.current) {
      tweens.push(
        gsap.fromTo(
          textRef.current,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 1.2,
            ease: 'power2.out',
            scrollTrigger: { trigger: textRef.current, start: 'top 75%' },
          },
        ),
      )
    }
    if (imageRef.current) {
      tweens.push(
        gsap.fromTo(
          imageRef.current,
          { opacity: 0, scale: 1.08 },
          {
            opacity: 1,
            scale: 1,
            duration: 1.4,
            ease: 'power2.out',
            scrollTrigger: { trigger: imageRef.current, start: 'top 80%' },
          },
        ),
      )
    }
    return () => {
      tweens.forEach((tween) => {
        tween.scrollTrigger?.kill()
        tween.kill()
      })
    }
  }, [])

  const hasImage = Boolean(project?.heroImage)

  return (
    <section
      id="philosophy"
      style={{
        display: 'grid',
        minHeight: '100svh',
      }}
    >
      <div
        className="philosophy-section-image"
        style={{
          position: 'relative',
          background: 'var(--color-beige)',
          overflow: 'hidden',
        }}
      >
        {/* No heroImageMobile portrait crop for this project yet (unlike
            Hero/FocusImage) — this panel is at most 50svh tall even on
            mobile, so a center-cropped landscape render still reads fine;
            add a mobile crop here if that stops being true. */}
        {hasImage && (
          <Img
              media={project.heroImage}
              // A landscape render scaled to fill a tall panel (object-fit: cover), so it
              // needs a file much wider than the panel itself.
              sizes="(min-width: 768px) 100vw, 180vw"
              imgRef={imageRef}
              alt=""
              aria-hidden="true"
              loading="lazy"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
              }}
            />
        )}
      </div>

      <div
        ref={textRef}
        className="philosophy-section-text"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 'var(--space-xl) var(--space-md)',
          background: 'var(--color-bg)',
        }}
      >
        <div style={{ maxWidth: 560 }}>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)',
              marginBottom: 'var(--space-md)',
            }}
          >
            Philosophy
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'clamp(1rem, 2vw, 1.15rem)',
              lineHeight: 1.7,
              marginBottom: 'var(--space-md)',
              color: 'var(--color-text)',
            }}
          >
            Every space we design starts before drawings do — with how light
            moves through a room across a day, how a family actually moves
            through their home, and what the site itself is already trying to
            tell us. We work with context, not against it: the climate, the
            orientation, the traditions a family carries — vastu among them —
            and materials that age honestly in an Indian city, not just look
            good on handover day. The result isn&rsquo;t a style. It&rsquo;s a
            home that fits the life already being lived in it.
          </p>
          {/* Pill badges, not a bare label + inline list — the earlier
              "Guided by" text row read as an afterthought rather than a
              designed element (Parth's review feedback). Border-only chips
              (not filled) for two reasons: --color-beige as a fill sits at
              ~1.2:1 against --color-bg, near-invisible on a phone outdoors,
              and a filled pill in this app already means "tap this" (the
              IdeaTimeline lightbox trigger) — reusing that language on a
              static label would read as broken interactivity. */}
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.7rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--color-stone-dark)',
              margin: '0 0 var(--space-sm)',
              paddingTop: 'var(--space-md)',
              borderTop: '1px solid var(--color-stone-dark)',
            }}
          >
            Guided by
          </p>
          <ul
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-xs)',
              listStyle: 'none',
              margin: 0,
              padding: 0,
            }}
          >
            {THEMES.map((theme) => (
              <li key={theme}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '6px 15px',
                    borderRadius: 999,
                    border: '1px solid var(--color-bronze-darker)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.75rem',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--color-bronze-darker)',
                  }}
                >
                  {theme}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Scoped with a `philosophy-section-` prefix (not just `.philosophy-*`)
          since this is a single-page app where every section's markup is
          mounted at once — an unprefixed name is a collision risk for a
          later component reusing a generic class like `.image`/`.text`. */}
      <style>{`
        .philosophy-section-image {
          min-height: 50svh;
        }
        @media (min-width: 768px) {
          #philosophy {
            grid-template-columns: 1fr 1fr;
          }
          .philosophy-section-image,
          .philosophy-section-text {
            min-height: 100svh;
          }
        }
      `}</style>
    </section>
  )
}
