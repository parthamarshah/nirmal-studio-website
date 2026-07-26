import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Single place where Lenis (smooth scroll) and GSAP ScrollTrigger (all
// scroll-driven animation: pinning, scrub, parallax, reveals) are wired
// together. Nothing else in the app should touch scroll directly — see
// the plan's "motion library roles are split, not stacked" decision.
let lenis = null

export function initScroll() {
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches

  if (prefersReducedMotion) {
    // No smooth-scroll hijacking, no scrub/pin animation for users who've
    // asked for reduced motion. ScrollTrigger-based components should check
    // this flag themselves before registering scrub/pin animations.
    return { lenis: null, prefersReducedMotion }
  }

  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
    smoothWheel: true,
  })

  lenis.on('scroll', ScrollTrigger.update)

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000)
  })
  gsap.ticker.lagSmoothing(0)

  return { lenis, prefersReducedMotion }
}

export function destroyScroll() {
  lenis?.destroy()
  lenis = null
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill())
}

export { gsap, ScrollTrigger }
