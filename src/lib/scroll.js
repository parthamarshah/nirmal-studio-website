import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Single place where Lenis (smooth scroll) and GSAP ScrollTrigger (all
// scroll-driven animation: pinning, scrub, parallax, reveals) are wired
// together. Nothing else in the app should touch scroll directly — see
// the plan's "motion library roles are split, not stacked" decision.
let lenis = null
let tickerFn = null

// GSAP and Framer Motion both animate via inline transforms, not CSS
// animations/transitions — the reduced-motion block in index.css has no
// effect on either. Any component doing its own GSAP/Framer animation must
// call this itself before registering that animation.
export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function initScroll() {
  // Tear down THIS module's own prior Lenis/ticker (not other components'
  // ScrollTriggers — see destroyScroll below) before creating a new one, so
  // a repeat call (StrictMode's mount→cleanup→mount, or HMR) can't leak a
  // second ticker callback.
  if (tickerFn) {
    gsap.ticker.remove(tickerFn)
    tickerFn = null
  }
  lenis?.destroy()
  lenis = null

  const reducedMotion = prefersReducedMotion()

  if (reducedMotion) {
    // No smooth-scroll hijacking, no scrub/pin animation for users who've
    // asked for reduced motion. ScrollTrigger-based components should check
    // this flag themselves before registering scrub/pin animations.
    return { lenis: null, reducedMotion }
  }

  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
    smoothWheel: true,
  })

  lenis.on('scroll', ScrollTrigger.update)

  // Keep a handle on this callback so destroyScroll() can actually remove
  // it — an anonymous callback here would leak/duplicate on every re-init.
  tickerFn = (time) => {
    lenis?.raf(time * 1000)
  }
  gsap.ticker.add(tickerFn)
  gsap.ticker.lagSmoothing(0)

  return { lenis, reducedMotion }
}

// Only tears down what THIS module owns (the Lenis instance + its ticker
// callback) — NOT other components' ScrollTriggers. Each section that
// registers its own ScrollTrigger is responsible for killing it in its own
// effect cleanup. A blanket ScrollTrigger.getAll().forEach(kill) here would
// wipe out sections that mounted (and registered triggers) before this
// module's own effect ran — React fires child effects before parent effects,
// so App's cleanup would otherwise kill Hero/Projects/etc.'s live triggers.
export function destroyScroll() {
  if (tickerFn) {
    gsap.ticker.remove(tickerFn)
    tickerFn = null
  }
  lenis?.destroy()
  lenis = null
}

export { gsap, ScrollTrigger }
