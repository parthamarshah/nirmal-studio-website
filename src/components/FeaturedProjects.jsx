import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { gsap, prefersReducedMotion } from '../lib/scroll'
import { projects } from '../data/projects'

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

  useEffect(() => {
    if (!activeProject) return
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return
      if (lightboxImage) setLightboxImage(null)
      else setActiveSlug(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeProject, lightboxImage])

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

  const closeProject = () => {
    setActiveSlug(null)
    setLightboxImage(null)
  }

  const goToProject = (dir) => {
    if (activeIndex < 0) return
    const next = (activeIndex + dir + projects.length) % projects.length
    setActiveSlug(projects[next].slug)
    setLightboxImage(null)
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

  const cardImage = (project) => project.heroImage || project.drawings
  const cardIsDrawing = (project) => !project.heroImage && Boolean(project.drawings)

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
          Nine commissions across Western and Central India.
        </p>
      </div>

      <div className="projects-grid">
        {projects.map((project, i) => (
          <button
            key={project.slug}
            type="button"
            ref={(el) => {
              cardRefs.current[i] = el
            }}
            className="project-card"
            onClick={(e) => {
              triggerRef.current = e.currentTarget
              setActiveSlug(project.slug)
            }}
          >
            {cardImage(project) && (
              <img
                src={cardImage(project)}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="project-card-image"
              />
            )}
            {cardIsDrawing(project) && <span className="project-card-tag">Floor plan</span>}
            <span className="project-card-scrim" aria-hidden="true" />
            <span className="project-card-info">
              <span className="project-card-meta">
                {project.type} — {project.location}
              </span>
              <span className="project-card-name">{project.name}</span>
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {activeProject && (
          <motion.div
            key="project-detail"
            role="dialog"
            aria-label={`${activeProject.name} project details`}
            initial={prefersReducedMotion() ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion() ? undefined : { opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeProject()
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
                onClick={closeProject}
                aria-label="Close"
                className="project-detail-close"
              >
                &times;
              </button>

              {activeProject.heroImage && (
                <div className="project-detail-hero">
                  <img src={activeProject.heroImage} alt={activeProject.name} loading="lazy" />
                </div>
              )}

              <div className="project-detail-body">
                <span className="project-detail-meta">
                  {activeProject.type} — {activeProject.location}
                </span>
                <h3 className="project-detail-name">{activeProject.name}</h3>

                {(activeProject.siteArea || activeProject.builtUpArea) && (
                  <dl className="project-detail-facts">
                    {activeProject.siteArea && (
                      <div>
                        <dt>Site Area</dt>
                        <dd>{activeProject.siteArea}</dd>
                      </div>
                    )}
                    {activeProject.builtUpArea && (
                      <div>
                        <dt>Built-up Area</dt>
                        <dd>{activeProject.builtUpArea}</dd>
                      </div>
                    )}
                  </dl>
                )}

                <p className="project-detail-copy">{activeProject.concept}</p>

                {activeProject.challenge && (
                  <div className="project-detail-block">
                    <h4>Challenge</h4>
                    <p className="project-detail-copy">{activeProject.challenge}</p>
                  </div>
                )}
                {activeProject.materials && (
                  <div className="project-detail-block">
                    <h4>Materials</h4>
                    <p className="project-detail-copy">{activeProject.materials}</p>
                  </div>
                )}
                {activeProject.construction && (
                  <div className="project-detail-block">
                    <h4>Construction</h4>
                    <p className="project-detail-copy">{activeProject.construction}</p>
                  </div>
                )}

                {activeProject.gallery?.length > 0 && (
                  <div className="project-detail-block">
                    <h4>Gallery</h4>
                    <div className="project-detail-gallery">
                      {activeProject.gallery.map((src) => (
                        <button
                          key={src}
                          type="button"
                          className="project-detail-thumb"
                          onClick={() => setLightboxImage({ src, alt: activeProject.name, mode: 'fit' })}
                        >
                          <img src={src} alt="" aria-hidden="true" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeProject.drawings && (
                  <div className="project-detail-block">
                    <h4>Drawings</h4>
                    <button
                      type="button"
                      className="project-detail-drawing"
                      onClick={() =>
                        setLightboxImage({
                          src: activeProject.drawings,
                          alt: `${activeProject.name}, ground floor plan`,
                          mode: 'pan',
                        })
                      }
                    >
                      <img src={activeProject.drawings} alt={`${activeProject.name}, ground floor plan`} loading="lazy" />
                      <span className="project-detail-drawing-hint">Tap to enlarge</span>
                    </button>
                  </div>
                )}

                {activeProject.conceptArt?.length > 0 && (
                  <div className="project-detail-block">
                    <h4>Concept Visualization</h4>
                    <p className="project-detail-concept-note">
                      AI-generated imagery to help visualize the space — not real photography or
                      final design output. This image set is shared illustratively across related
                      projects, not tied to specific rooms in this one.
                    </p>
                    <div className="project-detail-gallery">
                      {activeProject.conceptArt.map((src) => (
                        <button
                          key={src}
                          type="button"
                          className="project-detail-thumb is-concept"
                          onClick={() =>
                            setLightboxImage({
                              src,
                              alt: `${activeProject.name} concept visualization`,
                              mode: 'fit',
                              label: 'Concept visualization',
                            })
                          }
                        >
                          <img src={src} alt="" aria-hidden="true" loading="lazy" />
                          <span className="project-detail-thumb-label">Concept</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

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
              if (e.target === e.currentTarget) setLightboxImage(null)
            }}
            data-lenis-prevent
            className={`project-lightbox project-lightbox-${lightboxImage.mode}`}
          >
            {lightboxImage.label && (
              <span className="project-lightbox-label">{lightboxImage.label}</span>
            )}
            <img src={lightboxImage.src} alt={lightboxImage.alt} />
            <button
              type="button"
              ref={lightboxCloseRef}
              onClick={() => setLightboxImage(null)}
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
        .project-detail-hero {
          position: relative;
          margin: 0 0 var(--space-md);
          border-radius: 4px;
          overflow: hidden;
          /* Reserves space before the image loads (avoids a layout jump on
             first open) — every current heroImage is a landscape render, so
             16:9 is a reasonable default; object-fit:cover below means a
             slightly different source ratio crops rather than distorts. */
          aspect-ratio: 16 / 9;
          background: var(--color-beige);
        }
        .project-detail-hero img {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .project-detail-meta {
          display: block;
          font-family: var(--font-body);
          font-size: 0.75rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-bronze-darker);
          margin-bottom: var(--space-xs);
        }
        .project-detail-name {
          font-family: var(--font-heading);
          font-size: clamp(1.6rem, 4vw, 2.25rem);
          margin: 0 0 var(--space-sm);
        }
        .project-detail-facts {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-md);
          margin: 0 0 var(--space-md);
          padding-bottom: var(--space-md);
          border-bottom: 1px solid var(--color-beige);
        }
        .project-detail-facts dt {
          font-family: var(--font-body);
          font-size: 0.7rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-stone-dark);
        }
        .project-detail-facts dd {
          margin: 2px 0 0;
          font-family: var(--font-heading);
          font-size: 1.1rem;
        }
        .project-detail-copy {
          font-family: var(--font-body);
          font-size: 0.95rem;
          line-height: 1.7;
          color: var(--color-text);
          max-width: 60ch;
        }
        .project-detail-block {
          margin-top: var(--space-md);
        }
        .project-detail-block h4 {
          font-family: var(--font-body);
          font-size: 0.75rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-bronze-darker);
          margin: 0 0 var(--space-xs);
        }
        .project-detail-concept-note {
          font-family: var(--font-body);
          font-size: 0.8rem;
          line-height: 1.6;
          color: var(--color-stone-dark);
          max-width: 60ch;
          margin: 0 0 var(--space-sm);
        }
        .project-detail-gallery {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-xs);
        }
        .project-detail-thumb {
          position: relative;
          padding: 0;
          border: none;
          border-radius: 4px;
          overflow: hidden;
          cursor: zoom-in;
          aspect-ratio: 4 / 3;
        }
        .project-detail-thumb img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        /* Concept-art thumbnails read visually softer/desaturated against
           real gallery photography, on top of the "Concept" text badge —
           two cues, not just one, that this isn't real project imagery. */
        .project-detail-thumb.is-concept img {
          filter: saturate(0.7) brightness(0.96);
        }
        .project-detail-thumb.is-concept {
          border: 1px dashed var(--color-stone);
        }
        .project-detail-thumb-label {
          position: absolute;
          right: 6px;
          bottom: 6px;
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(17, 17, 17, 0.75);
          color: var(--color-warm-white);
          font-family: var(--font-body);
          font-size: 0.65rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .project-detail-drawing {
          position: relative;
          display: block;
          width: 100%;
          padding: 0;
          border: 1px solid var(--color-beige);
          background: none;
          cursor: zoom-in;
        }
        .project-detail-drawing img {
          display: block;
          width: 100%;
          height: auto;
        }
        .project-detail-drawing-hint {
          position: absolute;
          right: 8px;
          bottom: 8px;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(17, 17, 17, 0.7);
          color: var(--color-warm-white);
          font-family: var(--font-body);
          font-size: 0.7rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
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
