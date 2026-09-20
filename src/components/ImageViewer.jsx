import { useEffect, useRef } from 'react'
import Img from './Img'
import LoadingHint from './LoadingHint'
import { panImageStyle } from '../lib/viewer'


// Full-screen image viewer for standalone project pages. Deliberately plain:
// no Framer Motion (keeps project pages light) and no exit fade — it unmounts
// the instant it closes, so the "invisible overlay still swallowing clicks
// during its exit fade" incident in CLAUDE.md can't happen here.
//
// `image` = { src: media object, alt, mode: 'fit' | 'pan', label? } — the same
// shape ProjectStory passes to onOpenImage. 'pan' (floor plans) shows the full-
// resolution file in a scrollable area; 'fit' shows it contained on screen.
//
// Back button / back swipe closes the viewer (instead of leaving the page): opening
// adds one history entry, and every close path goes back through it.
export default function ImageViewer({ image, onClose }) {
  const closeRef = useRef(null)
  // Kept in a ref so a parent re-render with a new onClose function never
  // re-runs the open/close effect below (which would re-push history).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  const isOpen = Boolean(image)

  // Closing goes back through our history entry when it's on top (its popstate
  // then closes the viewer), so × / Escape / backdrop and the back button all
  // leave history in the same state. If something else replaced that entry,
  // close directly rather than leaving the viewer stuck open.
  //
  // `history.back()` is async — popstate lands a tick later, and the viewer stays
  // mounted and interactive until it does. Without `closingRef`, a double-tapped ×
  // or a HELD Escape key (auto-repeat fires ~every 30ms) calls back() twice and pops
  // a second, real history entry, navigating the visitor off the site — on the public,
  // shareable project pages, where this is the only overlay. See CLAUDE.md's
  // "history.back() is async" incident; same fix as FeaturedProjects and TalkToTej.
  const closingRef = useRef(false)
  const requestClose = () => {
    if (closingRef.current) return
    if (window.history.state?.nirmalImageViewer) {
      closingRef.current = true
      window.history.back()
    } else onCloseRef.current()
  }

  useEffect(() => {
    if (!isOpen) return
    closingRef.current = false
    const opener = document.activeElement
    closeRef.current?.focus()
    window.history.pushState({ nirmalImageViewer: true }, '')
    const onPopState = () => {
      closingRef.current = false
      onCloseRef.current()
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !e.repeat) requestClose()
      if (e.key === 'Tab') {
        e.preventDefault()
        closeRef.current?.focus()
      }
    }
    const { overflow } = document.documentElement.style
    document.documentElement.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('popstate', onPopState)
      document.documentElement.style.overflow = overflow
      opener?.focus?.()
    }
  }, [isOpen])

  if (!image) return null
  const pan = image.mode === 'pan'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.label || image.alt}
      className={`image-viewer image-viewer-${pan ? 'pan' : 'fit'}`}
      // Only a click on the backdrop itself closes — not one bubbling up from
      // the image (a double-tap-to-zoom's first tap would otherwise close it).
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
      data-lenis-prevent={pan ? '' : undefined}
    >
      {image.label && <span className="image-viewer-label">{image.label}</span>}
      {pan && <span className="image-viewer-hint">Drag to explore</span>}
      <LoadingHint />
      {pan ? (
        <img src={image.src.src} alt={image.alt} style={panImageStyle(image.src)} />
      ) : (
        <Img
          media={image.src}
          sizes={`(max-width: ${image.src.width}px) 100vw, ${image.src.width}px`}
          intrinsic={false}
          placeholder={false}
          alt={image.alt}
          style={{ position: 'relative', zIndex: 1 }}
        />
      )}
      <button type="button" ref={closeRef} onClick={requestClose} aria-label="Close" className="image-viewer-close">
        &times;
      </button>
      <style>{`
        .image-viewer {
          position: fixed;
          inset: 0;
          z-index: calc(var(--z-overlay) + 1);
          background: #111111;
          overscroll-behavior: contain;
          animation: image-viewer-in 0.2s ease;
        }
        @keyframes image-viewer-in { from { opacity: 0; } to { opacity: 1; } }
        .image-viewer-fit {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-md);
        }
        .image-viewer-fit img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .image-viewer-pan {
          overflow: auto;
          padding: var(--space-md);
        }
        .image-viewer-hint {
          position: fixed;
          left: 50%;
          bottom: var(--space-sm);
          transform: translateX(-50%);
          z-index: 2;
          padding: 4px 12px;
          border-radius: 999px;
          background: rgba(17, 17, 17, 0.8);
          color: var(--color-warm-white);
          font-family: var(--font-body);
          font-size: 0.7rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          pointer-events: none;
        }
        .image-viewer-label {
          position: fixed;
          top: var(--space-sm);
          left: var(--space-sm);
          z-index: 2;
          padding: 4px 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.9);
          color: #111111;
          font-family: var(--font-body);
          font-size: 0.7rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .image-viewer-close {
          position: fixed;
          top: var(--space-sm);
          right: var(--space-sm);
          z-index: 2;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          border: 1px solid var(--color-warm-white);
          background: rgba(17, 17, 17, 0.85);
          color: var(--color-warm-white);
          font-size: 1.25rem;
          line-height: 1;
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}
