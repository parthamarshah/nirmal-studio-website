import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

// Desktop-only micro-interaction (Framer Motion's job per the plan, not
// GSAP's). Mobile/touch devices never render this — a cursor dot makes no
// sense without a mouse, and this is exactly the kind of desktop-only
// enhancement that should NOT block the mobile-first experience.
export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false)
  const cursorX = useMotionValue(-100)
  const cursorY = useMotionValue(-100)
  const springX = useSpring(cursorX, { damping: 30, stiffness: 300, mass: 0.5 })
  const springY = useSpring(cursorY, { damping: 30, stiffness: 300, mass: 0.5 })

  useEffect(() => {
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (!canHover) return

    setEnabled(true)
    document.body.classList.add('has-custom-cursor')

    const handleMove = (e) => {
      cursorX.set(e.clientX)
      cursorY.set(e.clientY)
    }
    window.addEventListener('mousemove', handleMove)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      document.body.classList.remove('has-custom-cursor')
    }
  }, [cursorX, cursorY])

  if (!enabled) return null

  return (
    <motion.div
      aria-hidden="true"
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
