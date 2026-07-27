import { useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '../lib/scroll'
import { journalPosts } from '../data/journal'

// Section 9 of the brief. Hides entirely while journalPosts is empty — no
// "coming soon" placeholder, per CLAUDE.md's content rules (a placeholder
// undercuts the confident tone the brief itself asks for). Expected data
// shape is documented in src/data/journal.js, not here — that's the file a
// content edit actually touches. No detail route/page yet — that's a later
// addition once real content exists to decide the shape of (per the
// original plan doc), so cards are static for now, not links.
export default function Journal() {
  const gridRef = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion() || !journalPosts.length || !gridRef.current) return
    const tween = gsap.fromTo(
      gridRef.current,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 1.2,
        ease: 'power2.out',
        scrollTrigger: { trigger: gridRef.current, start: 'clamp(top 80%)' },
      },
    )
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [])

  if (!journalPosts.length) return null

  return (
    <section
      id="journal"
      style={{
        background: 'var(--color-bg)',
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
          Journal
        </h2>
      </div>
      <div ref={gridRef} className="journal-grid">
        {journalPosts.map((post) => (
          <article key={post.slug} className="journal-card">
            {/* No dateTime attribute — post.date is a freeform display
                string ("March 2026", per journal.js's documented shape),
                not a machine-readable value, so asserting one here would
                be invalid rather than just imprecise. */}
            <time className="journal-card-date">{post.date}</time>
            <h3 className="journal-card-title">{post.title}</h3>
            <p className="journal-card-excerpt">{post.excerpt}</p>
          </article>
        ))}
      </div>

      <style>{`
        .journal-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--space-lg);
          max-width: 960px;
          margin: 0 auto;
        }
        .journal-card {
          display: block;
          padding: var(--space-md);
          border: 1px solid var(--color-beige);
        }
        .journal-card-date {
          display: block;
          font-family: var(--font-body);
          font-size: 0.75rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-bronze-darker);
          margin-bottom: var(--space-xs);
        }
        .journal-card-title {
          font-family: var(--font-heading);
          font-size: 1.35rem;
          margin-bottom: var(--space-xs);
        }
        .journal-card-excerpt {
          font-family: var(--font-body);
          font-size: 0.95rem;
          line-height: 1.7;
          color: var(--color-stone-dark);
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        @media (min-width: 768px) {
          .journal-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </section>
  )
}
