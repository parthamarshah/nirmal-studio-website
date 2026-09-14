import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { gsap, prefersReducedMotion } from '../lib/scroll'
import { visibleProjects as projects, cardImage as cardImageOf } from '../lib/content'
import Img from './Img'
import ProjectStory from './ProjectStory'
import { panImageStyle } from '../lib/viewer'
import LoadingHint from './LoadingHint'

// Section 6 of the brief: Featured Projects, immersive per-project
// storytelling. A grid index (each card self-identifies with what kind of
// image it's showing — real project photography/renders for the 7 PDF
// projects, a floor plan for Shimla/Nishee, since neither has gallery
// photography yet) opens into a full-screen story takeover per project:
// concept, challenge/materials/construction (the 7 only — see projects.js's
// header comment on why Shimla/Nishee stay null there), a photo gallery, and
// — Shimla/Nishee only — the floor plan drawing and the shared AI concept-art
// set, kept visually secondary and always labeled per CLAUDE.md's
// `conceptArt` rule.
//
// Deliberately a grid+takeover, not another scroll-hijack pattern —
// IdeaTimeline already owns vertical scroll-reveal and Process owns
// horizontal pin/scrub; a third distinct scroll mechanic here would compete
// rather than add. The takeover itself is a Framer Motion mount/exit only
// (never scroll-linked, per the motion-library split in CLAUDE.md).
const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve']
const countWord = (n) => NUMBER_WORDS[n] ?? String(n)

export default function FeaturedProjects() {
  const cardRefs = useRef([])
  const [activeSlug, setActiveSlug] = useState(null)
  // { src, alt, mode: 'pan' | 'fit', label? } — label is only set for
  // conceptArt, so the lightbox can carry the "Concept visualization" flag
  // through to the full-screen view, not just the thumbnail grid above it.
  const [lightboxImage, setLightboxImage] = useState(null)
  // The scrollable overlay itself (not the inner panel) — reset on every
  // project switch below, so Prev/Next doesn't land the next project
  // scrolled to wherever the previous one happened to be (AnimatePresence
  // keeps one persistent DOM node across switches, so scrollTop otherwise
  // carries over untouched).
  const detailScrollRef = useRef(null)
  const detailCloseRef = useRef(null)
  const lightboxRef = useRef(null)
  const lightboxCloseRef = useRef(null)
  // The card button that opened the dialog, so focus can return to it on
  // close instead of resetting to <body> and losing a keyboard user's place.
  const triggerRef = useRef(null)

  const activeIndex = projects.findIndex((p) => p.slug === activeSlug)
  const activeProject = activeIndex >= 0 ? projects[activeIndex] : null

  useEffect(() => {
    if (prefersReducedMotion()) return
    const tweens = cardRefs.current.filter(Boolean).map((el) =>
      gsap.fromTo(
        el,
        { opacity: 0, y: 32 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: 'power2.out',
          // clamp() — same CLAUDE.md incident IdeaTimeline hit twice: a fixed
          // 'top 85%' trigger can fall past max scroll on a short/tall
          // viewport with few rows, leaving the last cards stuck invisible.
          scrollTrigger: { trigger: el, start: 'clamp(top 85%)' },
        },
      ),
    )
    return () => {
      tweens.forEach((tween) => {
        tween.scrollTrigger?.kill()
        tween.kill()
      })
    }
  }, [])

  // Neither takeover pushes a client-side route — this is a single-page app
  // with no router — so without this, the mobile back gesture/browser back
  // button doesn't close the lightbox or the project detail overlay, it
  // navigates away from the site entirely. Each open (openProject,
  // openLightbox below) pushes one history entry and increments
  // pushedLevelsRef; every close path (Escape below, the × buttons, both
  // backdrop clicks, and goToProject when it implicitly closes an
  // open lightbox) calls closeTopLayer(), which only pops history when
  // pushedLevelsRef says one of *our* entries is actually outstanding —
  // otherwise it clears state directly. Without that guard, a real
  // back-button press followed by a stray click on the still-live × would
  // call history.back() with nothing of ours left to pop, navigating away
  // from the site — the exact bug this whole effect exists to prevent.
  //
  // closingRef adds a second guard for the double-tap case specifically:
  // history.back() is async (popstate lands a tick later), and nothing
  // disables pointer events during the 0.3s/0.25s Framer exit animation
  // (unlike Loader.jsx), so two fast taps on a close button can both fire
  // before pushedLevelsRef has been decremented. closingRef is set
  // synchronously the instant the first back() call goes out and only
  // cleared once popstate actually lands, so a second tap in that window is
  // a no-op instead of a second back() call.
  //
  // Both refs, and closeTopLayer itself, must be declared before any effect
  // that references closeTopLayer in its dependency array — a const isn't
  // hoisted, so an earlier effect closing over a later-declared const
  // throws "Cannot access before initialization" the moment this component
  // renders, not just a lint warning.
  const pushedLevelsRef = useRef(0)
  const closingRef = useRef(false)
  // .project-detail-close and .project-lightbox-close sit at the exact same
  // fixed screen position (top-right, same offset) — intentional, so the ×
  // doesn't visually jump as you go a layer deeper. Once
  // disableTopLayerInteraction makes the just-closed layer's close button
  // stop intercepting clicks, a second tap landing in that same spot within
  // the fade window falls straight through onto whichever close button is
  // now exposed underneath, closing that layer too — cascading a single tap
  // into closing both the lightbox and the whole project takeover. Both
  // close buttons (and Escape, and both backdrops) route through this one
  // closeTopLayer function, so a short guard here, cleared after slightly
  // longer than the longest fade (0.3s), absorbs that accidental
  // click-through as a no-op regardless of which element physically caught it.
  const closeGuardRef = useRef(false)
  const armCloseGuard = () => {
    closeGuardRef.current = true
    window.setTimeout(() => {
      closeGuardRef.current = false
    }, 350)
  }

  // Framer's exit animation keeps the outgoing dialog mounted (and, by
  // default, fully interactive) for its whole 0.25s/0.3s fade — without
  // this, a click landing in that window right after any close lands on
  // the still-fading, now-invisible overlay instead of the page
  // underneath, since opacity animating to 0 doesn't touch pointer-events.
  // Setting it synchronously the instant state clears (rather than via
  // Framer's exit prop, which only applies non-animatable values once the
  // exit finishes) closes that gap immediately.
  const disableTopLayerInteraction = useCallback(() => {
    if (lightboxImage) lightboxRef.current?.style.setProperty('pointer-events', 'none')
    else if (activeProject) detailScrollRef.current?.style.setProperty('pointer-events', 'none')
    armCloseGuard()
  }, [lightboxImage, activeProject])

  const closeTopLayer = useCallback(() => {
    if (closeGuardRef.current) return
    if (pushedLevelsRef.current > 0) {
      if (closingRef.current) return
      closingRef.current = true
      window.history.back()
    } else if (lightboxImage) {
      disableTopLayerInteraction()
      setLightboxImage(null)
    } else {
      disableTopLayerInteraction()
      setActiveSlug(null)
    }
  }, [lightboxImage, disableTopLayerInteraction])

  useEffect(() => {
    const handlePopState = () => {
      closingRef.current = false
      pushedLevelsRef.current = Math.max(0, pushedLevelsRef.current - 1)
      disableTopLayerInteraction()
      if (lightboxImage) setLightboxImage(null)
      else setActiveSlug(null)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [lightboxImage, disableTopLayerInteraction])

  useEffect(() => {
    if (!activeProject) return
    const handleKeyDown = (e) => {
      // Routed through closeTopLayer(), not a direct state clear — see the
      // popstate effect above for why every close path goes through it.
      if (e.key === 'Escape') closeTopLayer()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeProject, lightboxImage, closeTopLayer])

  // Runs on every activeSlug change, including Prev/Next (not just the
  // initial open) — resets scroll to the top of the new project's content
  // and moves focus to a known element inside the dialog, both of which
  // double as the "where did I land" cue a keyboard/scroll-position jump
  // would otherwise erase.
  useEffect(() => {
    if (!activeProject) return
    detailScrollRef.current?.scrollTo(0, 0)
    detailCloseRef.current?.focus()
    // activeProject is derived from activeSlug in the same render (via
    // projects.findIndex above), so re-running this only on activeSlug is
    // correct — including activeProject would re-run it whenever the
    // computed value's reference changes, which is every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlug])

  // Restores focus to the card that opened the dialog once it's fully
  // closed — without this, closing (Escape or the × button) drops keyboard
  // focus to <body>, losing the user's place in the page.
  useEffect(() => {
    if (activeProject) return
    triggerRef.current?.focus()
    triggerRef.current = null
  }, [activeProject])

  useEffect(() => {
    if (lightboxImage) lightboxCloseRef.current?.focus()
    else if (activeProject) detailCloseRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxImage])

  // openProject/openLightbox both push one history entry per open and
  // increment pushedLevelsRef — see the popstate effect above. goToProject
  // deliberately does neither: it's not opening a new layer, just changing
  // which project the already-open layer shows, so the back button should
  // still close the whole overlay in one press regardless of how many times
  // Prev/Next was clicked. It does still route through closeTopLayer() if a
  // lightbox happens to be open — defensive only now that the lightbox
  // traps Tab to its own close button (see its onKeyDown below), but the
  // Prev/Next buttons still sit in the DOM underneath the lightbox's
  // sibling overlay, so this stays as a safety net against any future
  // change to that trap rather than something currently reachable.
  const openProject = (project, triggerEl) => {
    triggerRef.current = triggerEl
    pushedLevelsRef.current += 1
    window.history.pushState({ nirmalOverlay: 'project' }, '')
    // AnimatePresence keys this dialog by a static string ("project-detail"),
    // not by slug — closing and reopening fast enough that the previous
    // exit fade hadn't finished yet reuses the same DOM node rather than
    // mounting a fresh one, so disableTopLayerInteraction's leftover
    // `pointer-events: none` from that close would otherwise survive onto
    // the reopened dialog and leave it permanently click-dead.
    detailScrollRef.current?.style.removeProperty('pointer-events')
    closeGuardRef.current = false
    setActiveSlug(project.slug)
  }

  const openLightbox = (image) => {
    pushedLevelsRef.current += 1
    window.history.pushState({ nirmalOverlay: 'lightbox' }, '')
    // Same static-key reuse risk as openProject above, for the lightbox's
    // own "project-lightbox" key.
    lightboxRef.current?.style.removeProperty('pointer-events')
    closeGuardRef.current = false
    setLightboxImage(image)
  }

  const goToProject = (dir) => {
    if (activeIndex < 0) return
    const next = (activeIndex + dir + projects.length) % projects.length
    setActiveSlug(projects[next].slug)
    if (lightboxImage) closeTopLayer()
  }

  // Minimal Tab-trap on the detail dialog — without it, Tab from the close
  // button (or any focusable element inside the panel) reaches the grid
  // cards sitting behind this fixed overlay: invisible but still focusable/
  // activatable, which could silently swap activeSlug out from under the
  // visible panel.
  const handleDialogKeyDown = (e) => {
    if (e.key !== 'Tab') return
    const panel = e.currentTarget.querySelector('.project-detail-panel')
    if (!panel) return
    const focusables = panel.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    if (!focusables.length) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  // Drawing cards must say so — the visible "Floor plan" tag already tells a
  // sighted user this isn't project photography; an alt describing it as a
  // photo of the building would give a screen-reader user a materially
  // different, inaccurate picture of the same card.
  const cardAlt = (project, isDrawing) =>
    isDrawing
      ? `${project.name}, floor plan`
      : [project.name, [project.facts.type, project.facts.city].filter(Boolean).join(' in ')].filter(Boolean).join(', ')

  return (
    <section
      id="projects"
      style={{
        position: 'relative',
        background: 'var(--color-bg)',
        padding: 'var(--space-xl) var(--space-md)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)',
            marginBottom: 'var(--space-sm)',
          }}
        >
          Featured Projects
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(0.95rem, 2vw, 1.05rem)',
            color: 'var(--color-stone-dark)',
            maxWidth: 480,
            margin: '0 auto',
          }}
        >
          {countWord(projects.length)} commissions across Western and Central India.
        </p>
      </div>

      <div className="projects-grid">
        {projects.map((project, i) => {
          const card = cardImageOf(project)
          return (
          <button
            key={project.slug}
            type="button"
            ref={(el) => {
              cardRefs.current[i] = el
            }}
            className="project-card"
            onClick={(e) => openProject(project, e.currentTarget)}
          >
            {card && (
              <Img
                media={card.media}
                sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
                placeholder={!card.isDrawing}
                alt={cardAlt(project, card.isDrawing)}
                loading="lazy"
                className="project-card-image"
              />
            )}
            {card?.isDrawing && <span className="project-card-tag">Floor plan</span>}
            <span className="project-card-scrim" aria-hidden="true" />
            <span className="project-card-info">
              <span className="project-card-meta">
                {[project.facts.type, project.facts.city].filter(Boolean).join(' — ')}
              </span>
              <span className="project-card-name">{project.name}</span>
            </span>
          </button>
          )
        })}
      </div>

      <AnimatePresence>
        {activeProject && (
          <motion.div
            key="project-detail"
            role="dialog"
            aria-modal="true"
            aria-label={`${activeProject.name} project details`}
            initial={prefersReducedMotion() ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion() ? undefined : { opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeTopLayer()
            }}
            onKeyDown={handleDialogKeyDown}
            data-lenis-prevent
            className="project-detail"
            ref={detailScrollRef}
          >
            <div className="project-detail-panel">
              <button
                type="button"
                ref={detailCloseRef}
                onClick={closeTopLayer}
                aria-label="Close"
                className="project-detail-close"
              >
                &times;
              </button>

              <ProjectStory project={activeProject} onOpenImage={openLightbox} showLegacyConceptArt />

              <div className="project-detail-nav">
                <button type="button" onClick={() => goToProject(-1)}>
                  ← Previous
                </button>
                <span className="project-detail-nav-count">
                  {activeIndex + 1} / {projects.length}
                </span>
                <button type="button" onClick={() => goToProject(1)}>
                  Next →
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            key="project-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={lightboxImage.label || lightboxImage.alt}
            initial={prefersReducedMotion() ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion() ? undefined : { opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeTopLayer()
            }}
            onKeyDown={(e) => {
              // The close button is the lightbox's only focusable element,
              // so trapping Tab here just means it always refocuses that
              // one button — without this, Tab escapes to whatever's
              // focusable in the project-detail panel sitting behind it
              // (invisible but still reachable, the same class of bug
              // handleDialogKeyDown above already guards the other dialog
              // against — see goToProject's comment on why that panel's
              // Prev/Next buttons are keyboard- but not pointer-reachable
              // while this lightbox is open).
              if (e.key === 'Tab') {
                e.preventDefault()
                lightboxCloseRef.current?.focus()
              }
            }}
            // Only 'pan' mode (the floor-plan drawing) is a real overflow:
            // auto scroll container — 'fit' mode (every gallery/concept-art
            // thumbnail, the overwhelming majority of opens) isn't, so
            // applying this unconditionally silenced Lenis's wheel handling
            // over a region that isn't actually a scroll container, letting
            // a desktop mouse wheel scroll the real document invisibly
            // behind this full-screen overlay — the exact inverse of the
            // Process.jsx incident CLAUDE.md documents, and the one it
            // explicitly predicted this component would hit. `undefined`,
            // not `false` — Lenis only checks the attribute's presence, and
            // React renders a literal `false` as the string "false".
            data-lenis-prevent={lightboxImage.mode === 'pan' ? '' : undefined}
            className={`project-lightbox project-lightbox-${lightboxImage.mode}`}
            ref={lightboxRef}
          >
            {lightboxImage.label && (
              <span className="project-lightbox-label">{lightboxImage.label}</span>
            )}
            {/* 'pan' mode is always a floor-plan drawing: shown at its own full
                pixel size (full resolution, quality-95 JPEG) so dimension text stays
                legible while panning. 'fit' mode lets the browser pick a size;
                no width/height attributes, which would fight max-width/max-height. */}
            <LoadingHint />
            {lightboxImage.mode === 'pan' ? (
              <img src={lightboxImage.src.src} alt={lightboxImage.alt} style={panImageStyle(lightboxImage.src)} />
            ) : (
              <Img
                media={lightboxImage.src}
                // Never wider than the image's own pixels — small renders show at
                // their real size instead of being stretched to fill the screen.
                sizes={`(max-width: ${lightboxImage.src.width}px) 100vw, ${lightboxImage.src.width}px`}
                intrinsic={false}
                placeholder={false}
                alt={lightboxImage.alt}
                style={{ position: 'relative', zIndex: 1 }}
              />
            )}
            <button
              type="button"
              ref={lightboxCloseRef}
              onClick={closeTopLayer}
              aria-label="Close"
              className="project-lightbox-close"
            >
              &times;
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scoped `project-`/`projects-` prefix — single-page app, every
          section mounts at once, so an unprefixed `.card`/`.grid` would risk
          colliding with a later section. */}
      <style>{`
        .projects-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--space-sm);
          max-width: 1200px;
          margin: 0 auto;
        }
        .project-card {
          position: relative;
          display: block;
          width: 100%;
          aspect-ratio: 4 / 3;
          padding: 0;
          border: none;
          border-radius: 4px;
          overflow: hidden;
          cursor: pointer;
          background: var(--color-beige);
        }
        .project-card-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform var(--duration-slow) var(--ease-luxury);
        }
        .project-card:hover .project-card-image,
        .project-card:focus-visible .project-card-image {
          transform: scale(1.04);
        }
        .project-card-tag {
          position: absolute;
          top: var(--space-xs);
          left: var(--space-xs);
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(17, 17, 17, 0.7);
          color: var(--color-warm-white);
          font-family: var(--font-body);
          font-size: 0.7rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .project-card-scrim {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(17, 17, 17, 0.75), rgba(17, 17, 17, 0) 55%);
        }
        .project-card-info {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          padding: var(--space-sm);
          text-align: left;
        }
        .project-card-meta {
          display: block;
          font-family: var(--font-body);
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-warm-white);
          opacity: 0.85;
          margin-bottom: 4px;
        }
        .project-card-name {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
          font-family: var(--font-heading);
          font-size: clamp(1.15rem, 2.5vw, 1.4rem);
          line-height: 1.15;
          color: var(--color-warm-white);
        }

        .project-detail {
          position: fixed;
          inset: 0;
          z-index: var(--z-overlay);
          background: var(--color-bg);
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        .project-detail-panel {
          position: relative;
          max-width: 760px;
          margin: 0 auto;
          padding: var(--space-xl) var(--space-md) var(--space-lg);
        }
        .project-detail-close {
          position: fixed;
          top: var(--space-sm);
          right: var(--space-sm);
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          border: 1px solid var(--color-text);
          background: var(--color-warm-white);
          color: var(--color-text);
          font-size: 1.25rem;
          line-height: 1;
          cursor: pointer;
          z-index: 1;
        }
        .project-detail-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-sm);
          margin-top: var(--space-lg);
          padding-top: var(--space-md);
          border-top: 1px solid var(--color-beige);
        }
        .project-detail-nav button {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          padding: var(--space-xs) var(--space-sm);
          border: 1px solid var(--color-bronze-darker);
          border-radius: 999px;
          background: none;
          color: var(--color-bronze-darker);
          font-family: var(--font-body);
          font-size: 0.85rem;
          cursor: pointer;
        }
        .project-detail-nav-count {
          font-family: var(--font-body);
          font-size: 0.75rem;
          letter-spacing: 0.06em;
          color: var(--color-stone-dark);
          white-space: nowrap;
        }

        .project-lightbox {
          position: fixed;
          inset: 0;
          z-index: calc(var(--z-overlay) + 1);
          background: #111111;
          overscroll-behavior: contain;
        }
        .project-lightbox-fit {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-md);
        }
        .project-lightbox-fit img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .project-lightbox-pan {
          overflow: auto;
          padding: var(--space-md);
        }
        .project-lightbox-pan img {
          display: block;
          margin: 0 auto;
        }
        .project-lightbox-label {
          position: fixed;
          top: var(--space-sm);
          left: var(--space-sm);
          padding: 4px 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.9);
          color: #111111;
          font-family: var(--font-body);
          font-size: 0.7rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .project-lightbox-close {
          position: fixed;
          top: var(--space-sm);
          right: var(--space-sm);
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
          z-index: 1;
        }

        @media (min-width: 640px) {
          .projects-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (min-width: 1024px) {
          .projects-grid {
            grid-template-columns: repeat(3, 1fr);
          }
          .project-detail-gallery {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </section>
  )
}
