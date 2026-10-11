import { useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '../lib/scroll'

const SENTENCE = 'Architecture begins long before the first wall is built.'
const WORDS = SENTENCE.split(' ')

// Section 2 of the brief: one sentence, full screen, large type. Each word
// darkens from a faint trace to full ink as you scroll through it, so the
// sentence is read at the pace you scroll. Reduced motion: full ink, static.
export default function Statement() {
  const textRef = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion() || !textRef.current) return
    const words = textRef.current.querySelectorAll('[data-word]')
    const tween = gsap.fromTo(
      words,
      { opacity: 0.2 },
      {
        opacity: 1,
        ease: 'none',
        stagger: 0.1,
        // clamp(): both ends stay inside the reachable scroll range on any
        // viewport (CLAUDE.md, IdeaTimeline's unreachable-trigger incident).
        scrollTrigger: {
          trigger: textRef.current,
          start: 'clamp(top 80%)',
          // Full ink by the time the sentence is centred, where a reader
          // naturally stops (ending at 'bottom 40%' left "built." at ~0.3).
          end: 'clamp(center 55%)',
          scrub: 0.5,
        },
      },
    )
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
      gsap.set(words, { clearProps: 'opacity' })
    }
  }, [])

  return (
    <section
      id="statement"
      style={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-lg) var(--space-md)',
        textAlign: 'center',
      }}
    >
      <p
        ref={textRef}
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(1.5rem, 5vw, 3rem)',
          lineHeight: 1.3,
          maxWidth: 800,
        }}
      >
        {/* Screen readers get the sentence whole; the per-word spans below are
            for the eye only (some readers announce each span separately). */}
        <span
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
            // Not selectable, so drag-copying the sentence doesn't copy it twice.
            userSelect: 'none',
          }}
        >
          {SENTENCE}
        </span>
        <span aria-hidden="true">
          {WORDS.map((word, i) => (
            <span key={i} data-word>
              {word}
              {i < WORDS.length - 1 ? ' ' : ''}
            </span>
          ))}
        </span>
      </p>
    </section>
  )
}
