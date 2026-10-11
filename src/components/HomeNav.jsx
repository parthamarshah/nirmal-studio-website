import { useEffect, useState } from 'react'
import { ScrollTrigger, scrollTo } from '../lib/scroll'
import Nav from './Nav'
import { NAV_LINKS } from './navLinks'

// The homepage's nav: transparent over the Hero image, solid cream once the
// Hero scrolls out of view (a ScrollTrigger boundary on #hero, not a scrub/pin,
// so it isn't gated behind prefersReducedMotion() — hiding it from
// reduced-motion users would leave nav text illegible against light content).
// Links scroll smoothly through Lenis (see CLAUDE.md on scrollTo()).
export default function HomeNav() {
  const [scrolled, setScrolled] = useState(false)
  const [activeHref, setActiveHref] = useState(null)

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

  // Which nav section is in view: whichever one crosses a thin band across the
  // middle of the screen. An IntersectionObserver rather than ScrollTrigger on
  // purpose — this is state, not animation, and it reads real layout, so
  // Process's pin (which ScrollTrigger only accounts for when triggers are
  // created in page order, and this one runs before Process mounts its pin)
  // can't throw it off. Sections switched off in site.json simply aren't found.
  // Not gated on reduced motion: it's a "you are here" marker, not motion.
  // A section that renders lazily marks an always-present wrapper with
  // data-nav-target (see Studio.jsx), since targets are looked up once, here.
  useEffect(() => {
    const find = (href) => document.querySelector(`[data-nav-target="${href}"]`) || document.querySelector(href)
    const hrefOf = new Map()
    const targets = NAV_LINKS.map((link) => {
      const el = find(link.href)
      if (el) hrefOf.set(el, link.href)
      return el
    }).filter(Boolean)
    if (!targets.length || typeof IntersectionObserver === 'undefined') return
    const inView = new Set()
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) inView.add(entry.target)
          else inView.delete(entry.target)
        })
        // Normally at most one; if two touch the band, the later one wins.
        const current = targets.filter((el) => inView.has(el)).pop()
        setActiveHref(current ? hrefOf.get(current) : null)
      },
      { rootMargin: '-45% 0px -54% 0px' },
    )
    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return <Nav scrolled={scrolled} onNavigate={scrollTo} activeHref={activeHref} />
}
