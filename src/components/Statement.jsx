import { useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '../lib/scroll'

// Section 2 of the brief: one sentence, full screen, large type, slow fade
// as it scrolls into view.
export default function Statement() {
  const textRef = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion() || !textRef.current) return

    const tween = gsap.fromTo(
      textRef.current,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 1.2,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: textRef.current,
          start: 'top 75%',
        },
      },
    )
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
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
        Architecture begins long before the first wall is built.
      </p>
    </section>
  )
}
