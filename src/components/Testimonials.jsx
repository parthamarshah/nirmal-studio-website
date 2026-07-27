import { useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '../lib/scroll'
import { testimonials } from '../data/testimonials'

// Section 10 of the brief. Hides entirely while testimonials is empty — same
// "no coming soon placeholder" rule as Journal.jsx, per CLAUDE.md. Expected
// data shape is documented in src/data/testimonials.js, not here — that's
// the file a content edit actually touches.
export default function Testimonials() {
  const listRef = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion() || !testimonials.length || !listRef.current) return
    const tween = gsap.fromTo(
      listRef.current,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 1.2,
        ease: 'power2.out',
        scrollTrigger: { trigger: listRef.current, start: 'clamp(top 80%)' },
      },
    )
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [])

  if (!testimonials.length) return null

  return (
    <section
      id="testimonials"
      style={{
        background: 'var(--color-beige)',
        padding: 'var(--space-xl) var(--space-md)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)',
          }}
        >
          Testimonials
        </h2>
      </div>
      <div ref={listRef} className="testimonials-list">
        {testimonials.map((t) => (
          <figure key={`${t.name}-${t.project}`} className="testimonial-card">
            <blockquote className="testimonial-quote">&ldquo;{t.quote}&rdquo;</blockquote>
            <figcaption className="testimonial-author">
              {t.name}
              {t.project && <span className="testimonial-project"> — {t.project}</span>}
            </figcaption>
          </figure>
        ))}
      </div>

      <style>{`
        .testimonials-list {
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--space-lg);
          max-width: 800px;
          margin: 0 auto;
        }
        .testimonial-card {
          margin: 0;
          padding: var(--space-md);
          background: var(--color-bg);
        }
        .testimonial-quote {
          font-family: var(--font-heading);
          font-style: italic;
          font-size: clamp(1.1rem, 2.4vw, 1.4rem);
          line-height: 1.6;
          margin: 0 0 var(--space-sm);
        }
        .testimonial-author {
          font-family: var(--font-body);
          font-size: 0.85rem;
          letter-spacing: 0.04em;
          /* --color-stone-dark isn't used here even though it's the usual
             "secondary text" color elsewhere — it only clears AA contrast
             against --color-bg, not the --color-bg card fill sitting on
             this section's --color-beige background (same trap Studio.jsx
             hit with FOLD members' based-in text). --color-text carries the
             name at full contrast; .testimonial-project below gets the
             visual demotion instead, via color, not via a low-contrast
             tint. */
          color: var(--color-text);
        }
        .testimonial-project {
          color: var(--color-bronze-darker);
        }
        @media (min-width: 768px) {
          .testimonials-list {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </section>
  )
}
