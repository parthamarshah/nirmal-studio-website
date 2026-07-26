import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { prefersReducedMotion } from '../lib/scroll'

// Desktop-only micro-interaction (Framer Motion's job per the plan, not
// GSAP's). Mobile/touch devices never render this — a cursor dot makes no
// sense without a mouse, and this is exactly the kind of desktop-only
// enhancement that should NOT block the mobile-first experience.
export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false)
  const [hovering, setHovering] = useState(false)
  const cursorX = useMotionValue(-100)
  const cursorY = useMotionValue(-100)
  const springX = useSpring(cursorX, { damping: 30, stiffness: 300, mass: 0.5 })
  const springY = useSpring(cursorY, { damping: 30, stiffness: 300, mass: 0.5 })

  useEffect(() => {
    const mql = window.matchMedia('(hover: hover) and (pointer: fine)')
    const motionMql = window.matchMedia('(prefers-reduced-motion: reduce)')

    const canRunCustomCursor = () => mql.matches && !prefersReducedMotion()

    let cleanupListeners = () => {}

    const setup = () => {
      cleanupListeners()

      if (!canRunCustomCursor()) {
        setEnabled(false)
        document.body.classList.remove('has-custom-cursor')
        return
      }

      // Don't hide the native cursor until the dot has a real, on-screen
      // position — otherwise there's a window with no cursor visible at all,
      // between mount and the first mousemove event. Jump (not set) the
      // springs so the dot appears under the pointer instead of animating
      // in from its -100,-100 starting value.
      const handleFirstMove = (e) => {
        cursorX.set(e.clientX)
        cursorY.set(e.clientY)
        springX.jump(e.clientX)
        springY.jump(e.clientY)
        setEnabled(true)
        document.body.classList.add('has-custom-cursor')
      }
      const handleMove = (e) => {
        cursorX.set(e.clientX)
        cursorY.set(e.clientY)
      }
      const isInteractive = (el) =>
        el.closest('a, button, [data-cursor-hover]') !== null
      const handleOver = (e) => setHovering(isInteractive(e.target))
      const handleOut = (e) => {
        if (!e.relatedTarget || !isInteractive(e.relatedTarget)) setHovering(false)
      }

      window.addEventListener('mousemove', handleFirstMove, { once: true })
      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseover', handleOver)
      window.addEventListener('mouseout', handleOut)

      cleanupListeners = () => {
        window.removeEventListener('mousemove', handleFirstMove)
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseover', handleOver)
        window.removeEventListener('mouseout', handleOut)
        document.body.classList.remove('has-custom-cursor')
      }
    }

    setup()
    mql.addEventListener('change', setup)
    motionMql.addEventListener('change', setup)

    return () => {
      mql.removeEventListener('change', setup)
      motionMql.removeEventListener('change', setup)
      cleanupListeners()
    }
  }, [cursorX, cursorY, springX, springY])

  if (!enabled) return null

  return (
    <motion.div
      aria-hidden="true"
      animate={{ scale: hovering ? 2.2 : 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: 'var(--color-text)',
        pointerEvents: 'none',
        zIndex: 9999,
        x: springX,
        y: springY,
        translateX: '-50%',
        translateY: '-50%',
      }}
    />
  )
}
