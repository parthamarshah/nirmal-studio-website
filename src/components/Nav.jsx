import { useEffect, useRef, useState } from 'react'
import Boundary from './Boundary'
import { journalPosts } from '../data/journal'
import { isSectionOn, whatsappUrl } from '../lib/content'

// The "Talk to Tej" panel's code is fetched on first use (and warmed up when a
// pointer or keyboard focus reaches the button), never during page load or hydration.
let talkModule = null
const loadTalk = () => (talkModule ??= import('./TalkToTej.jsx').catch((err) => {
  talkModule = null // allow a retry
  throw err
}))

// Persistent nav, used on every page. Transparent/light-text over the Hero
// image until `scrolled` (driven by HomeNav.jsx's #hero ScrollTrigger on the
// homepage; always true on other pages), then a solid cream bar.
//
// Journal's link is the same emptiness check App.jsx already uses to decide
// whether to render <Journal /> at all — a hardcoded link here would point
// at a section that never renders.
//
// The mobile dropdown is deliberately NOT an AnimatePresence/Framer overlay:
// this codebase has hit the "invisible but still clickable during exit
// fade" pointer-events bug twice already (FeaturedProjects' takeover,
// IdeaTimeline's lightbox — see CLAUDE.md's known-incident list) because
// pointer-events only applies post-animation on an `exit` prop. Using a
// CSS class toggle instead means pointer-events is set directly (not
// transitioned) and takes effect the instant the class changes, with no
// unmount/remount cycle to create the "reused DOM node keeps stale
// pointer-events" or same-position click-through follow-on bugs either.
const NAV_LINKS = [
  { label: 'Work', href: '#projects', section: 'featuredProjects' },
  { label: 'Studio', href: '#studio', section: 'studio' },
  { label: 'Process', href: '#process', section: 'process' },
  { label: 'Journal', href: '#journal', requiresJournal: true },
  { label: 'Contact', href: '#contact', section: 'contact' },
]

// Presentational + menu behaviour only, so project pages can use it without
// pulling in GSAP/Lenis. On the homepage, HomeNav.jsx supplies `scrolled` (from
// a ScrollTrigger on #hero) and `onNavigate` (smooth in-page scroll via Lenis).
// On other pages (`onNavigate` omitted) links are plain navigations to "/#…"
// and the bar is always solid.
//
// No render-time browser reads (e.g. prefersReducedMotion()) — project pages
// are pre-rendered and hydrated. Reduced motion is handled by index.css's
// global transition override.
export default function Nav({ scrolled = true, onNavigate }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [TalkPanel, setTalkPanel] = useState(null) // the loaded component while open, else null
  const [talkLoading, setTalkLoading] = useState(false) // instant feedback on slow connections
  const navRef = useRef(null)
  const menuRef = useRef(null)
  const toggleRef = useRef(null)

  const closeMenu = () => {
    setMenuOpen(false)
    toggleRef.current?.focus()
  }

  useEffect(() => {
    if (!menuOpen) return

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeMenu()
        return
      }
      if (e.key !== 'Tab') return
      const focusables = menuRef.current?.querySelectorAll('a')
      if (!focusables?.length) return
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
    const onPointerDown = (e) => {
      if (!navRef.current?.contains(e.target)) closeMenu()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen])

  // A link only shows if its section is switched on in content/site.json —
  // otherwise it would scroll to nothing.
  const links = NAV_LINKS.filter(
    (link) => (!link.requiresJournal || journalPosts.length > 0) && (!link.section || isSectionOn(link.section)),
  )

  const onHome = Boolean(onNavigate)
  const linkHref = (href) => (onHome ? href : `/${href}`)

  const handleLinkClick = (e, href) => {
    setMenuOpen(false)
    if (!onHome) return
    e.preventDefault()
    onNavigate(href)
  }

  // The button is a real WhatsApp link, so it still works if JavaScript or the
  // panel's code fails to load; normally it opens the panel instead.
  const openTalk = (e) => {
    e.preventDefault()
    setMenuOpen(false)
    const href = e.currentTarget.href
    setTalkLoading(true)
    loadTalk().then(
      (m) => {
        setTalkLoading(false)
        setTalkPanel(() => m.default)
      },
      () => {
        window.location.href = href
      },
    )
  }

  const handleWordmarkClick = (e) => {
    setMenuOpen(false)
    if (!onHome) return
    e.preventDefault()
    onNavigate(0)
  }

  return (
    <nav ref={navRef} className={`site-nav${scrolled ? ' site-nav--scrolled' : ''}`} aria-label="Primary">
      <a href={onHome ? '#hero' : '/'} className="site-nav-wordmark" onClick={handleWordmarkClick}>
        <span style={{ fontFamily: 'var(--font-wordmark)', fontWeight: 800 }}>nirmal</span>
        <span style={{ fontFamily: 'var(--font-wordmark)', fontWeight: 400 }}> studio</span>
      </a>

      <div className="site-nav-right">
        <div className="site-nav-links">
          {links.map((link) => (
            <a key={link.href} href={linkHref(link.href)} className="site-nav-link" onClick={(e) => handleLinkClick(e, link.href)}>
              {link.label}
            </a>
          ))}
        </div>

        <a
          href={whatsappUrl()}
          className={`site-nav-talk${talkLoading ? ' is-loading' : ''}`}
          aria-haspopup="dialog"
          aria-busy={talkLoading || undefined}
          onClick={openTalk}
          onPointerEnter={() => loadTalk().catch(() => {})}
          onTouchStart={() => loadTalk().catch(() => {})}
          onFocus={() => loadTalk().catch(() => {})}
        >
          Talk to Tej
        </a>

        <button
          ref={toggleRef}
          type="button"
          className="site-nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="site-nav-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="site-nav-toggle-bar" />
          <span className="site-nav-toggle-bar" />
        </button>
      </div>

      <div
        id="site-nav-menu"
        ref={menuRef}
        className={`site-nav-menu${menuOpen ? ' site-nav-menu--open' : ''}`}
      >
        {links.map((link) => (
          <a
            key={link.href}
            href={linkHref(link.href)}
            className="site-nav-menu-link"
            onClick={(e) => handleLinkClick(e, link.href)}
          >
            {link.label}
          </a>
        ))}
      </div>

      {/* The panel gets its OWN boundary, not the nav's: it is the newest, lazily
          loaded code here and it renders inside this tree, so a throw in it would
          otherwise take the wordmark, menu and contact button down with it — and an
          error boundary never resets, so they would stay gone until a reload.
          createPortal does not escape a boundary: boundaries follow the React tree,
          not the DOM. */}
      {TalkPanel && (
        <Boundary name="Talk to Tej panel">
          <TalkPanel onClose={() => setTalkPanel(null)} />
        </Boundary>
      )}

      <style>{`
        .site-nav-right {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }
        .site-nav-talk {
          display: inline-flex;
          align-items: center;
          min-height: 38px;
          padding: 0 0.9rem;
          border: 1px solid rgba(251, 250, 246, 0.85);
          border-radius: 999px;
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          white-space: nowrap;
          text-decoration: none;
          color: var(--color-warm-white);
          text-shadow: 0 1px 12px rgba(0, 0, 0, 0.5);
          transition: color 0.3s ease, border-color 0.3s ease, background-color 0.3s ease;
          /* 38px visible pill, 44px tap target */
          position: relative;
        }
        .site-nav-talk::after { content: ''; position: absolute; inset: -3px 0; }
        .site-nav--scrolled .site-nav-talk {
          color: var(--color-text);
          border-color: var(--color-text);
          text-shadow: none;
        }
        .site-nav-talk:hover { background: rgba(169, 126, 94, 0.18); }
        .site-nav-talk.is-loading { opacity: 0.6; }
        .site-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: var(--z-nav);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-sm) var(--space-md);
          background: transparent;
          transition: background 0.3s ease, backdrop-filter 0.3s ease;
        }
        .site-nav--scrolled {
          background: rgba(246, 244, 239, 0.92);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-bottom: 1px solid var(--color-beige);
        }
        .site-nav-wordmark {
          font-size: clamp(1rem, 2.5vw, 1.25rem);
          letter-spacing: 0.02em;
          color: var(--color-warm-white);
          text-decoration: none;
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          /* Hero's own H1/CTA carry this same shadow because the top of the
             hero image sits past the darkening gradient's fade-out — the
             nav sits in that same unprotected zone, so it needs the same
             contrast floor independent of whatever hero image is in play. */
          text-shadow: 0 1px 12px rgba(0, 0, 0, 0.5);
          transition: color 0.3s ease;
        }
        .site-nav--scrolled .site-nav-wordmark {
          color: var(--color-text);
          text-shadow: none;
        }
        .site-nav-links {
          display: none;
        }
        .site-nav-link {
          font-family: var(--font-body);
          font-size: 0.9rem;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          text-decoration: none;
          color: var(--color-warm-white);
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          text-shadow: 0 1px 12px rgba(0, 0, 0, 0.5);
          transition: color 0.3s ease;
        }
        .site-nav--scrolled .site-nav-link {
          color: var(--color-text);
          text-shadow: none;
        }
        .site-nav-toggle {
          display: inline-flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 5px;
          width: 44px;
          height: 44px;
          background: none;
          border: none;
          cursor: pointer;
        }
        .site-nav-toggle-bar {
          display: block;
          width: 20px;
          height: 1.5px;
          background: var(--color-warm-white);
          filter: drop-shadow(0 1px 6px rgba(0, 0, 0, 0.5));
          transition: background 0.3s ease;
        }
        .site-nav--scrolled .site-nav-toggle-bar {
          background: var(--color-text);
          filter: none;
        }
        .site-nav-menu {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          display: flex;
          flex-direction: column;
          background: var(--color-bg);
          border-bottom: 1px solid var(--color-beige);
          max-height: 0;
          overflow: hidden;
          opacity: 0;
          pointer-events: none;
          transition: max-height 0.3s ease, opacity 0.2s ease;
        }
        .site-nav-menu--open {
          max-height: 320px;
          opacity: 1;
          pointer-events: auto;
        }
        .site-nav-menu-link {
          font-family: var(--font-body);
          font-size: 1rem;
          text-decoration: none;
          color: var(--color-text);
          padding: var(--space-sm) var(--space-md);
          min-height: 44px;
          display: flex;
          align-items: center;
          border-top: 1px solid var(--color-beige);
        }

        @media (min-width: 768px) {
          .site-nav-links {
            display: flex;
            gap: var(--space-md);
          }
          .site-nav-right { gap: var(--space-md); }
          .site-nav-toggle,
          .site-nav-menu {
            display: none;
          }
        }
      `}</style>
    </nav>
  )
}
