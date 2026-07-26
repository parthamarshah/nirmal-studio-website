import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { prefersReducedMotion } from '../lib/scroll'

// Mounts once with App (no routing yet, so this never remounts mid-session —
// no need for a "seen this already" flag). Section 1 of the brief: black
// screen, animated logo, fade into the Hero underneath.
export default function Loader() {
  // Checked once at mount, not per-render — reduced motion means skipping
  // this decorative overlay entirely, not just shortening its animations
  // (both Framer transitions below run via inline transforms, so the CSS
  // reduced-motion block in index.css has no effect on them either way).
  const [skip] = useState(prefersReducedMotion)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (skip) return
    const timer = setTimeout(() => setVisible(false), 1400)
    return () => clearTimeout(timer)
  }, [skip])

  if (skip) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed',
            inset: 0,
            background: '#111111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 'var(--z-loader)',
            // Without this, the overlay still hit-tests full-screen during
            // its 0.8s fade-out — a click on Hero's CTA underneath in that
            // window gets silently swallowed with no feedback.
            pointerEvents: 'none',
          }}
        >
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontFamily: 'var(--font-wordmark)',
              fontWeight: 800,
              fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
              color: 'var(--color-warm-white)',
              letterSpacing: '0.02em',
            }}
          >
            nirmal
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
