import { useEffect, useRef, useState } from 'react'
import { gsap, prefersReducedMotion } from '../lib/scroll'
import { site, social, tejShah, whatsappUrl, whatsappWebUrl } from '../lib/content'
import Boundary from './Boundary'
import { loadTalk } from './loadTalk'

// Section 11 of the brief, and — until Journal/Testimonials have real
// content — the last section on the page, so its ScrollTrigger uses
// clamp() from the outset (CLAUDE.md's known incident: a fixed 'top 75%'
// can be unreachable on a last-section trigger if there isn't enough scroll
// room below it).
//
// No contact form: nothing in this project authorizes a backend/form
// handler, and a form that goes nowhere is worse than a direct link. The
// brief's "Book Consultation" CTA is treated as copy on the WhatsApp link
// (per the original planning doc), not a real scheduling-tool integration.
//
// Address + map: Parth supplied the real address this session, so the
// block that was previously omitted (per the "no placeholder" precedent
// Journal/Testimonials also use) is now shown. No office photos exist yet,
// so this stays text + a lightweight embedded map, not a photo gallery.
//
// WhatsApp number confirmed directly with Parth: 9106998434 is the complete
// number, +91 (India) prepended for the wa.me link — not inferred from the
// "910 699 8434" formatting alone, since a wrong digit there would silently
// route a real enquiry to a stranger. Prefilled with a starter message —
// this is the site's one conversion action, and an empty compose box is a
// real point of hesitation ("what do I even say?") right before someone
// would otherwise reach out.
//
// All of these now come from content/site.json (editable in the backend).
//
// The CTA opens the SAME panel as the nav button (Parth, 2026-09-21): the options,
// the first-message helper and the desktop QR are the whole point of that panel, and
// this button — the site's single stated conversion action — used to skip all of it and
// drop a logged-out desktop visitor onto WhatsApp Web's bare QR-login screen with no
// context. It was the less helpful of the two paths to the same place.
//
// The anchors below stay, and stay gated by CSS, as the no-JavaScript fallback: if the
// panel's chunk fails to load the click still reaches WhatsApp. Deliberately not
// preventDefault() + window.open() — a blocked popup would make the site's one
// conversion action do nothing at all, the default having already been cancelled.
//
// The href itself is built by whatsappUrl() in lib/content, NOT by hand here: this
// file used to derive its own wa.me URL, which had already drifted from the nav's
// panel — same action, same page, two behaviours. It also silently dropped the ?text=
// greeting whenever whatsappGreeting was empty, where the panel falls back to a
// default.
const WHATSAPP_URL = whatsappUrl()
// wa.me on a computer stops at a "continue to chat" interstitial, so desktop goes to
// WhatsApp Web directly — the same call the Talk-to-Tej panel makes, and this uses the
// panel's exact pattern too: render BOTH links and let CSS pick one. Deliberately not
// preventDefault() + window.open(): if the popup were blocked the click would do nothing
// at all (the default having already been cancelled), and the site's single conversion
// action is the last place to risk that. Two plain anchors always work, need no JS, and
// stay correct with JavaScript off entirely.
const WHATSAPP_WEB_URL = whatsappWebUrl()
const PHONE_DISPLAY = site.contact.phoneDisplay
const PHONE_TEL = `tel:${site.contact.phone}`
const EMAIL = site.contact.email
const ADDRESS = site.contact.address
// Google's no-API-key embed form (maps.google.com/maps?q=...&output=embed) —
// deliberately not the Maps JavaScript SDK, which would need an API key and
// billing setup for a single static pin.
const MAP_EMBED_URL = `https://maps.google.com/maps?q=${encodeURIComponent(ADDRESS)}&output=embed`

const SOCIAL_ICONS = {
  instagram: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="8" y1="10.5" x2="8" y2="16.5" />
      <circle cx="8" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
      <path d="M12 16.5v-3.5c0-1.4 1-2.5 2.5-2.5s2.5 1.1 2.5 2.5v3.5" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="9" />
      <path d="M14 8.5h-1.5c-1 0-1.5.5-1.5 1.5v2h3l-.4 2.5H11V19h-2.5v-4.5H7v-2.5h1.5v-2c0-2 1.2-3.5 3.5-3.5H14z" />
    </svg>
  ),
}

export default function Contact() {
  const contentRef = useRef(null)
  // Click-to-load, not just loading="lazy": Contact is the last section, so
  // almost every visitor scrolls past it, and lazy only defers *when* the
  // iframe fetches, not *whether* — on a site already carrying real perf
  // debt (9.1MB of images, no code-splitting), a map most visitors never
  // interact with shouldn't cost bytes by default.
  const [mapLoaded, setMapLoaded] = useState(false)
  // The panel, once its chunk has loaded. Same pattern as Nav.jsx, deliberately: it is
  // a plain state toggle, not an AnimatePresence overlay, and the panel portals itself
  // to <body> so the nav's backdrop-filter (or anything else here) can't trap it.
  const [TalkPanel, setTalkPanel] = useState(null)
  const [talkLoading, setTalkLoading] = useState(false)

  // Declared above every effect and handler that names it — a const referenced before
  // its declaration in the same function body throws on every render, and there is no
  // error boundary above this component (CLAUDE.md's known-incident list).
  const openTalk = (e) => {
    e.preventDefault()
    // Keep the real href: if the chunk fails, this is where we send them instead.
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

  useEffect(() => {
    if (prefersReducedMotion() || !contentRef.current) return
    const tween = gsap.fromTo(
      contentRef.current,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 1.2,
        ease: 'power2.out',
        scrollTrigger: { trigger: contentRef.current, start: 'clamp(top 80%)' },
      },
    )
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [])

  return (
    <section
      id="contact"
      style={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-xl) var(--space-md)',
        textAlign: 'center',
        background: 'var(--color-bg)',
      }}
    >
      <div ref={contentRef} style={{ maxWidth: 560, margin: '0 auto' }}>
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)',
            marginBottom: 'var(--space-md)',
          }}
        >
          Contact
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(1rem, 2vw, 1.15rem)',
            lineHeight: 1.7,
            color: 'var(--color-text)',
            marginBottom: 'var(--space-lg)',
          }}
        >
          Have a project in mind? Let&rsquo;s talk.
        </p>

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`contact-cta is-phone${talkLoading ? ' is-loading' : ''}`}
          aria-haspopup="dialog"
          aria-busy={talkLoading || undefined}
          onClick={openTalk}
          onPointerEnter={() => loadTalk().catch(() => {})}
          onTouchStart={() => loadTalk().catch(() => {})}
          onFocus={() => loadTalk().catch(() => {})}
        >
          Book a Consultation
        </a>
        <a
          href={WHATSAPP_WEB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`contact-cta is-desktop${talkLoading ? ' is-loading' : ''}`}
          aria-haspopup="dialog"
          aria-busy={talkLoading || undefined}
          onClick={openTalk}
          onPointerEnter={() => loadTalk().catch(() => {})}
          onTouchStart={() => loadTalk().catch(() => {})}
          onFocus={() => loadTalk().catch(() => {})}
        >
          Book a Consultation
        </a>

        <div
          style={{
            marginTop: 'var(--space-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-sm)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.95rem',
              color: 'var(--color-stone-dark)',
            }}
          >
            {tejShah.name} — {tejShah.title}
          </p>
          <a href={PHONE_TEL} className="contact-link">
            {PHONE_DISPLAY}
          </a>
          <a href={`mailto:${EMAIL}`} className="contact-link">
            {EMAIL}
          </a>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.95rem',
              color: 'var(--color-stone-dark)',
              maxWidth: 320,
              margin: '0 auto',
            }}
          >
            {ADDRESS}
          </p>
        </div>

        {/* Filters out any future social.js key with no matching icon —
            without this, an unrecognized platform would silently render an
            empty circular link (truthy url, undefined icon) instead of
            either showing something or not rendering at all. */}
        {Object.entries(social).some(([platform, url]) => url && SOCIAL_ICONS[platform]) && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 'var(--space-sm)',
              marginTop: 'var(--space-md)',
            }}
          >
            {Object.entries(social).map(
              ([platform, url]) =>
                url &&
                SOCIAL_ICONS[platform] && (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Nirmal Studio on ${platform}`}
                    className="contact-social-link"
                  >
                    {SOCIAL_ICONS[platform]}
                  </a>
                ),
            )}
          </div>
        )}

        {mapLoaded ? (
          <iframe
            title="Nirmal Studio location"
            src={MAP_EMBED_URL}
            referrerPolicy="no-referrer-when-downgrade"
            className="contact-map"
          />
        ) : (
          <button type="button" className="contact-map contact-map-placeholder" onClick={() => setMapLoaded(true)}>
            View on map
          </button>
        )}
      </div>

      {/* Filled, not the border-only pill used for secondary controls
          elsewhere (FeaturedProjects.jsx's .project-detail-nav buttons) —
          this is the single conversion action on the whole site, and it
          needs to read as visually distinct from a secondary nav control,
          not equal to one. Hero's "Our Approach" underline style covers the
          secondary text links below it. */}
      <style>{`
        .contact-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: var(--space-sm) var(--space-lg);
          border: 1px solid var(--color-bronze-darker);
          border-radius: 999px;
          background: var(--color-bronze-darker);
          font-family: var(--font-body);
          font-size: 0.95rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-warm-white);
          text-decoration: none;
        }
        /* Which of the two CTAs shows. "Desktop" means wide AND a real pointer: a phone
           in landscape is ~930px wide, and web.whatsapp.com does not work on a phone.
           Must stay in step with TalkToTej.jsx's link-target @media block and with
           DESKTOP_POINTER in lib/content.js — change all three together. */
        .contact-cta.is-desktop {
          display: none;
        }
        @media (min-width: 768px) and (pointer: fine) {
          .contact-cta.is-phone {
            display: none;
          }
          .contact-cta.is-desktop {
            display: inline-flex;
          }
        }
        .contact-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          font-family: var(--font-body);
          font-size: 1rem;
          color: var(--color-text);
          text-decoration: underline;
          text-underline-offset: 4px;
        }
        .contact-social-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1px solid var(--color-bronze-darker);
          color: var(--color-bronze-darker);
        }
        .contact-map {
          width: 100%;
          max-width: 480px;
          height: 220px;
          margin-top: var(--space-lg);
          border: 1px solid var(--color-beige);
          border-radius: 4px;
        }
        .contact-map-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-beige);
          font-family: var(--font-body);
          font-size: 0.9rem;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: var(--color-bronze-darker);
          cursor: pointer;
        }
      `}</style>

      {/* Its own boundary, not the section's: this is lazily loaded code rendering
          inside Contact, so a throw in it would otherwise take the address, map and
          phone number down with it — and an error boundary never resets, so they
          would stay gone until a reload. */}
      {TalkPanel && (
        <Boundary name="Talk panel">
          <TalkPanel onClose={() => setTalkPanel(null)} />
        </Boundary>
      )}
    </section>
  )
}
