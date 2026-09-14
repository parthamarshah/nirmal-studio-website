import { useCallback, useEffect, useRef, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { gsap, prefersReducedMotion } from '../lib/scroll'
import { people, foundersIntro, personContacts } from '../lib/content'
import Img from './Img'

// The v1 founders section. Only rendered once every person has a real photo and
// bio (`foundersReady`, see Studio.jsx) — never with placeholders.
//
// Brand structure (CLAUDE.md): Nirmal Studio is Tej Shah's own practice; FOLD
// is a separate, informal network of four architects, Tej among them. Tej comes
// first and his desktop band is ~18% larger; the other three are FOLD's
// founding partners and are never framed as Nirmal Studio co-founders.
//
// Three layouts, one markup:
//   bands    — desktop (≥768px): one full-width band per person, photo alternating sides
//   carousel — phone: Embla swipe row of four equal cards, next card peeking
//   snap     — phone + reduced motion: the same row as a plain native scroll-snap strip
// Studio.jsx is homepage-only (never pre-rendered), so reading matchMedia here is safe.

// Used only while the backend's intro fields are still empty.
const FALLBACK_INTRO = {
  nirmal: 'The architecture, interior and landscape design practice of Tej Shah, based in Ahmedabad.',
  fold: 'An informal network of four independent architects, Tej among them, who collaborate project by project for added scale, expertise and geography. The other three run their own practices and work with Nirmal Studio through FOLD.',
}

const DESKTOP = '(min-width: 768px)'
const GUTTER = 24 // px — the phone carousel's first card lines up with the section text
const alignToGutter = () => GUTTER // module-level: a stable function, so Embla doesn't re-init on every render

const currentMode = () => (window.matchMedia(DESKTOP).matches ? 'bands' : prefersReducedMotion() ? 'snap' : 'carousel')

const ICONS = {
  whatsapp: (
    <>
      <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" />
      <path
        d="M9.2 8.6c.2-.5.6-.5.9-.5l.6.1.8 1.8-.6.8c.5 1 1.3 1.8 2.3 2.3l.8-.6 1.8.8v.6c0 .4-.2.8-.6 1-1.9.7-5.8-2.8-6.3-5.1 0-.5.1-.9.3-1.2z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </>
  ),
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 10.5v6" />
      <circle cx="8" cy="7" r=".9" fill="currentColor" />
      <path d="M12 16.5V13c0-1.4 1-2.5 2.5-2.5S17 11.6 17 13v3.5M12 10.5v6" />
    </>
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
    </>
  ),
}

function Person({ person, index, total, inRow }) {
  const contacts = personContacts(person)
  const role = person.role?.trim()
  const basedIn = person.basedIn?.trim()
  const previously = person.previously?.trim()
  return (
    <li
      className={`founders-person${index === 0 ? ' is-lead' : ''}${index % 2 ? ' is-flip' : ''}`}
      data-reveal=""
      role={inRow ? 'group' : undefined}
      aria-roledescription={inRow ? 'slide' : undefined}
      aria-label={inRow ? `${person.name}, ${index + 1} of ${total}` : undefined}
    >
      <div className="founders-photo">
        <Img
          media={person.photo.media}
          sizes={index === 0 ? '(min-width: 768px) 22rem, 80vw' : '(min-width: 768px) 18rem, 80vw'}
          alt={`Portrait of ${person.name}`}
          loading="lazy"
        />
      </div>
      <div className="founders-text">
        {role && <p className="founders-role">{role}</p>}
        <h3 className="founders-name">{person.name}</h3>
        {(basedIn || previously) && (
          <p className="founders-meta">
            {basedIn && <span>Based in {basedIn}</span>}
            {previously && <span>Previously at {previously}</span>}
          </p>
        )}
        <p className="founders-bio">{person.bio}</p>
        {contacts.length > 0 && (
          <ul className="founders-contacts">
            {contacts.map((c) => (
              <li key={c.key}>
                <a
                  href={c.href}
                  aria-label={`${c.label} — ${person.name}`}
                  {...(c.key === 'email' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    {ICONS[c.key]}
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

export default function Founders() {
  const sectionRef = useRef(null)
  const snapRef = useRef(null)
  const [mode, setMode] = useState(currentMode)
  const [selected, setSelected] = useState(0)
  const [swiped, setSwiped] = useState(false)
  const inRow = mode !== 'bands'

  // Embla only runs in carousel mode; `active: false` destroys it, which also
  // clears the transform it put on the track, so bands/snap CSS take over cleanly.
  const [emblaRef, emblaApi] = useEmblaCarousel({
    active: mode === 'carousel',
    align: alignToGutter,
    // false: keep every card at the gutter offset (any containScroll mode clamps the first card to the edge).
    containScroll: false,
    skipSnaps: false,
  })

  // One element, two refs: Embla needs its viewport, snap mode scrolls it natively.
  const viewportRef = useCallback(
    (node) => {
      snapRef.current = node
      emblaRef(node)
    },
    [emblaRef],
  )

  const goTo = useCallback(
    (i) => {
      if (mode === 'carousel') emblaApi?.scrollTo(i)
      else if (mode === 'snap') {
        const slide = snapRef.current?.querySelectorAll(':scope > ul > li')[i]
        if (slide) snapRef.current.scrollTo({ left: slide.offsetLeft - GUTTER, behavior: 'auto' })
      }
    },
    [mode, emblaApi],
  )

  const onSnapScroll = useCallback(() => {
    const el = snapRef.current
    if (!el) return
    const slides = [...el.querySelectorAll(':scope > ul > li')]
    let best = 0
    slides.forEach((s, i) => {
      if (Math.abs(s.offsetLeft - GUTTER - el.scrollLeft) < Math.abs(slides[best].offsetLeft - GUTTER - el.scrollLeft)) best = i
    })
    setSelected(best)
    if (best > 0) setSwiped(true)
  }, [])

  // Layout follows screen width and the reduced-motion setting, live.
  useEffect(() => {
    const queries = [window.matchMedia(DESKTOP), window.matchMedia('(prefers-reduced-motion: reduce)')]
    const update = () => setMode(currentMode())
    queries.forEach((q) => q.addEventListener('change', update))
    return () => queries.forEach((q) => q.removeEventListener('change', update))
  }, [])

  // Counter/dots follow Embla; the swipe hint goes away after the first move.
  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap())
    const onDrag = () => setSwiped(true)
    onSelect()
    emblaApi.on('select', onSelect).on('reInit', onSelect).on('pointerDown', onDrag)
    return () => {
      emblaApi.off('select', onSelect).off('reInit', onSelect).off('pointerDown', onDrag)
    }
  }, [emblaApi])

  // Switching layouts keeps the card that was showing (read through a ref: this
  // should run on mode changes, not every scroll). Into carousel, first drop any
  // native scroll offset left over from snap mode, or it would add to Embla's transform.
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  useEffect(() => {
    if (mode === 'snap') goTo(selectedRef.current)
    else if (mode === 'carousel' && snapRef.current) {
      snapRef.current.scrollLeft = 0
      emblaApi?.scrollTo(selectedRef.current, true)
    }
  }, [mode, goTo, emblaApi])

  useEffect(() => {
    if (prefersReducedMotion() || !sectionRef.current) return
    const tweens = [...sectionRef.current.querySelectorAll('[data-reveal]')].map((el) =>
      gsap.fromTo(
        el,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 1.2,
          ease: 'power2.out',
          // The same element later becomes a carousel slide; leave no inline transform behind.
          clearProps: 'transform',
          // clamp(): a fixed start can be unreachable near the end of the page (CLAUDE.md).
          scrollTrigger: { trigger: el, start: 'clamp(top 80%)' },
        },
      ),
    )
    return () => {
      tweens.forEach((tween) => {
        tween.scrollTrigger?.kill()
        tween.kill()
        gsap.set(tween.targets(), { clearProps: 'opacity,transform' })
      })
    }
  }, [])

  const intro = {
    nirmal: foundersIntro?.nirmal?.trim() || FALLBACK_INTRO.nirmal,
    fold: foundersIntro?.fold?.trim() || FALLBACK_INTRO.fold,
  }

  return (
    <section id="studio" ref={sectionRef} className={`founders is-${mode}`} aria-labelledby="founders-heading">
      <header className="founders-intro" data-reveal="">
        <div>
          <p className="founders-eyebrow">Studio &amp; network</p>
          <h2 id="founders-heading" className="founders-heading">
            The people <em>behind</em> the work
          </h2>
        </div>
        <p>
          <strong>Nirmal Studio</strong>
          {intro.nirmal}
        </p>
        <p>
          <strong>FOLD</strong>
          {intro.fold}
        </p>
      </header>

      {/* Above the cards, not below: a phone card can be taller than the screen. */}
      {inRow && people.length > 1 && (
        <div className="founders-controls">
          <div className="founders-dots">
            {people.map((p, i) => (
              <button
                key={p.id}
                type="button"
                aria-label={`Show ${p.name}`}
                aria-current={i === selected ? 'true' : undefined}
                onClick={() => {
                  setSwiped(true)
                  goTo(i)
                }}
              />
            ))}
          </div>
          <span className="founders-count">
            {selected + 1} / {people.length}
          </span>
          <span className="founders-hint" aria-hidden="true" style={{ visibility: swiped ? 'hidden' : 'visible' }}>
            Swipe <i>→</i>
          </span>
        </div>
      )}

      <div
        ref={viewportRef}
        className="founders-viewport"
        role={inRow ? 'region' : undefined}
        aria-roledescription={inRow ? 'carousel' : undefined}
        aria-label={inRow ? 'Tej Shah and the FOLD network' : undefined}
        // Only the snap strip is a real scroll container (CLAUDE.md's Process.jsx rule).
        data-lenis-prevent={mode === 'snap' ? '' : undefined}
        onScroll={mode === 'snap' ? onSnapScroll : undefined}
      >
        <ul className="founders-track">
          {people.map((p, i) => (
            <Person key={p.id} person={p} index={i} total={people.length} inRow={inRow} />
          ))}
        </ul>
      </div>


      {/* `founders-` prefix: every homepage section is mounted at once. Layout
          properties that change at the breakpoint live only here, never inline
          (CLAUDE.md's Philosophy.jsx incident). */}
      <style>{`
        .founders {
          padding-block: var(--space-lg) var(--space-md);
          overflow: hidden;
        }
        .founders-intro {
          display: grid;
          gap: var(--space-sm);
          padding-inline: ${GUTTER}px;
          margin-bottom: var(--space-md);
        }
        .founders-eyebrow, .founders-role {
          font-family: var(--font-body);
          font-size: 0.72rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-weight: 600;
          color: var(--color-bronze-darker);
        }
        .founders-eyebrow { margin-bottom: var(--space-xs); }
        /* Roles can be several words — readable size, less tracking than the eyebrow. */
        .founders-role { font-size: 0.8rem; letter-spacing: 0.08em; }
        .founders a:focus-visible, .founders button:focus-visible {
          outline: 2px solid var(--color-bronze-darker);
          outline-offset: 3px;
        }
        .founders-heading {
          font-family: var(--font-heading);
          font-weight: 300;
          font-size: clamp(2rem, 7vw, 3rem);
          line-height: 1.04;
        }
        .founders-heading em { color: var(--color-bronze-dark); }
        .founders-intro > p {
          font-family: var(--font-body);
          font-size: 0.92rem;
          line-height: 1.7;
          color: var(--color-stone-dark);
          max-width: 36rem;
        }
        .founders-intro strong {
          display: block;
          font-family: var(--font-heading);
          font-weight: 500;
          font-size: 1.05rem;
          color: var(--color-text);
          margin-bottom: 0.2rem;
        }
        .founders-viewport { position: relative; } /* offsetParent for snap-mode slide positions */
        .founders-track { list-style: none; margin: 0; padding: 0; }
        .founders-photo {
          aspect-ratio: 4 / 5;
          overflow: hidden;
          background: var(--color-beige);
          border-radius: 2px;
        }
        .founders-photo img { display: block; width: 100%; height: 100%; object-fit: cover; }
        .founders-text { display: grid; gap: 0.6rem; align-content: start; }
        .founders-name {
          overflow-wrap: anywhere;
          font-family: var(--font-heading);
          font-weight: 400;
          line-height: 1.05;
          font-size: 1.6rem;
        }
        .founders-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.15rem 1rem;
          font-family: var(--font-body);
          font-size: 0.8rem;
          color: var(--color-stone-dark);
        }
        .founders-bio {
          font-family: var(--font-body);
          font-size: 0.9rem;
          line-height: 1.7;
          color: var(--color-text);
        }
        .founders-contacts { display: flex; gap: 0.5rem; list-style: none; margin: 0.2rem 0 0; padding: 0; }
        .founders-contacts a {
          width: 2.75rem;
          height: 2.75rem;
          border-radius: 50%;
          border: 1px solid var(--color-beige);
          background: var(--color-warm-white);
          color: var(--color-text);
          display: grid;
          place-items: center;
          transition: border-color 0.3s var(--ease-luxury), background-color 0.3s var(--ease-luxury);
        }
        .founders-contacts a:hover { border-color: var(--color-bronze); }
        .founders-contacts svg { width: 1.05rem; height: 1.05rem; }

        /* ---- phone row (carousel + snap) ---- */
        .founders.is-carousel .founders-viewport { overflow: hidden; touch-action: pan-y pinch-zoom; }
        .founders.is-snap .founders-viewport {
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          scroll-padding-inline: ${GUTTER}px;
          scrollbar-width: none;
        }
        .founders.is-snap .founders-viewport::-webkit-scrollbar { display: none; }
        .founders.is-carousel .founders-track,
        .founders.is-snap .founders-track { display: flex; align-items: stretch; }
        .founders.is-snap .founders-track { padding-inline: ${GUTTER}px; }
        .founders.is-carousel .founders-person,
        .founders.is-snap .founders-person {
          flex: 0 0 min(80vw, 22rem); /* vw, not %: the snap track has padding, the Embla track does not */
          min-width: 0;
          margin-right: 0.75rem;
          display: grid;
          grid-template-rows: auto 1fr;
          gap: 0.9rem;
          padding: 0.6rem 0.6rem 1.1rem;
          background: var(--color-warm-white);
          border: 1px solid var(--color-beige);
          border-radius: 3px;
        }
        .founders.is-snap .founders-person { scroll-snap-align: start; }
        /* A trailing margin doesn't count toward scroll width; a spacer does. */
        .founders.is-snap .founders-person:last-child { margin-right: 0; }
        .founders.is-snap .founders-track::after { content: ''; flex: 0 0 ${GUTTER}px; }
        .founders.is-carousel .founders-text,
        .founders.is-snap .founders-text { padding-inline: 0.3rem; gap: 0.5rem; }
        .founders.is-carousel .founders-bio,
        .founders.is-snap .founders-bio { font-size: 0.86rem; line-height: 1.65; }
        .founders-controls {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0 ${GUTTER}px var(--space-xs);
          margin-left: -0.45rem; /* line the first bar up with the text, not its tap area */
        }
        .founders-dots { display: flex; }
        .founders-dots button {
          width: 2.75rem;
          height: 2.75rem;
          border: 0;
          padding: 0;
          background: none;
          cursor: pointer;
          position: relative;
        }
        .founders-dots button::after {
          content: '';
          position: absolute;
          left: 0.45rem;
          right: 0.45rem;
          top: 50%;
          height: 3px;
          margin-top: -1.5px;
          border-radius: 2px;
          background: #bdb3a0; /* beige alone all but disappears on the page background */
          transition: background-color 0.3s var(--ease-luxury);
        }
        .founders-dots button[aria-current='true']::after { background: var(--color-text); }
        .founders-count {
          font-family: var(--font-body);
          font-size: 0.78rem;
          color: var(--color-stone-dark);
          font-variant-numeric: tabular-nums;
        }
        .founders-hint {
          margin-left: auto;
          font-family: var(--font-body);
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--color-bronze-darker);
        }
        .founders-hint i { display: inline-block; font-style: normal; animation: founders-nudge 1.6s ease-in-out infinite; }
        @keyframes founders-nudge { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(5px); } }

        /* ---- desktop bands ---- */
        @media (min-width: 768px) {
          .founders { padding-block: var(--space-xl); }
          .founders-intro,
          .founders-viewport {
            max-width: 72rem;
            margin-inline: auto;
            padding-inline: var(--space-md);
          }
          .founders-intro {
            grid-template-columns: 1.1fr 1fr 1fr;
            gap: var(--space-md);
            /* start, not end: FOLD's longer text would otherwise push its label above Nirmal Studio's. */
            align-items: start;
            margin-bottom: var(--space-md);
          }
          .founders-heading { font-size: clamp(2.5rem, 4.4vw, 3.4rem); }
          .founders-person {
            display: grid;
            grid-template-columns: clamp(12rem, 24vw, 18rem) minmax(0, 1fr);
            gap: clamp(2rem, 5vw, 3.5rem);
            align-items: center;
            padding-block: var(--space-md);
            border-top: 1px solid var(--color-beige);
          }
          .founders-person.is-flip { grid-template-columns: minmax(0, 1fr) clamp(12rem, 24vw, 18rem); }
          .founders-person.is-flip .founders-photo { order: 2; }
          .founders-person.is-flip .founders-text { justify-self: end; }
          .founders-text { max-width: 34rem; gap: 0.75rem; }
          .founders-name { font-size: clamp(1.9rem, 3vw, 2.25rem); }
          .founders-bio { font-size: 0.95rem; line-height: 1.75; }
          /* Tej: ~18% larger photo, name and type; more air around the band. */
          .founders-person.is-lead {
            grid-template-columns: clamp(14.2rem, 28.3vw, 21.25rem) minmax(0, 1fr);
            padding-block: calc(var(--space-md) * 1.4);
            border-top: 0;
          }
          .founders-person.is-lead .founders-text { max-width: 38rem; }
          .founders-person.is-lead .founders-name { font-size: clamp(2.25rem, 3.55vw, 2.65rem); }
          .founders-person.is-lead .founders-bio { font-size: 1.1rem; }
        }
      `}</style>
    </section>
  )
}
