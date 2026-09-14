import { useEffect, useState } from 'react'
import { ScrollTrigger, scrollTo } from '../lib/scroll'
import Nav from './Nav'

// The homepage's nav: transparent over the Hero image, solid cream once the
// Hero scrolls out of view (a ScrollTrigger boundary on #hero, not a scrub/pin,
// so it isn't gated behind prefersReducedMotion() — hiding it from
// reduced-motion users would leave nav text illegible against light content).
// Links scroll smoothly through Lenis (see CLAUDE.md on scrollTo()).
export default function HomeNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    // Depends on Hero.jsx rendering <section id="hero"> unconditionally
    // (App.jsx mounts the nav before Hero, so it exists by the time this effect
    // runs) — if #hero is ever removed, ScrollTrigger no-ops quietly and the
    // nav just never swaps to its solid state.
    const trigger = ScrollTrigger.create({
      trigger: '#hero',
      start: 'bottom top',
      onEnter: () => setScrolled(true),
      onLeaveBack: () => setScrolled(false),
    })
    return () => trigger.kill()
  }, [])

  return <Nav scrolled={scrolled} onNavigate={scrollTo} />
}
