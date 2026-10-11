import { useEffect, useRef, useState } from 'react'
import { gsap, prefersReducedMotion } from '../lib/scroll'

// A thin bronze line along the top edge that fills as you read down the
// homepage. Homepage only (App.jsx); project pages don't load GSAP.
// Reduced motion: not rendered at all — a bar that moves with every scroll is
// exactly the kind of motion that setting asks us to drop.
export default function ScrollProgress() {
  const barRef = useRef(null)
  const [skip] = useState(prefersReducedMotion)

  useEffect(() => {
    if (skip || !barRef.current) return
    const tween = gsap.fromTo(
      barRef.current,
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: 'none',
        // 0 → 'max' is the whole scrollable page, and 'max' is re-measured on
        // every refresh, so Process's pin spacing is included.
        scrollTrigger: { start: 0, end: 'max', scrub: 0.3, invalidateOnRefresh: true },
      },
    )
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [skip])

  if (skip) return null

  return (
    <div
      ref={barRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: 'var(--color-bronze)',
        transform: 'scaleX(0)',
        transformOrigin: 'left center',
        // Above the nav so it isn't hidden behind it, below every overlay
        // (project takeover, lightbox, Talk panel) so it never draws on them.
        zIndex: 'calc(var(--z-nav) + 1)',
        pointerEvents: 'none',
      }}
    />
  )
}
