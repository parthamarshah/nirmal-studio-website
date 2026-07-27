import { useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '../lib/scroll'
import { tejShah } from '../data/founders'

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
// No map/office-photos block: CLAUDE.md calls the address a "placeholder
// until supplied," but the Journal/Testimonials precedent is the actual
// house rule — a placeholder undercuts the site's confident tone, so the
// block is omitted entirely rather than shown empty. Add it back once
// Parth supplies an office address/photos.
//
// WhatsApp number confirmed directly with Parth: 9106998434 is the complete
// number, +91 (India) prepended for the wa.me link — not inferred from the
// "910 699 8434" formatting alone, since a wrong digit there would silently
// route a real enquiry to a stranger. Prefilled with a starter message —
// this is the site's one conversion action, and an empty compose box is a
// real point of hesitation ("what do I even say?") right before someone
// would otherwise reach out.
const WHATSAPP_URL = `https://wa.me/919106998434?text=${encodeURIComponent(
  "Hi Tej, I'd like to talk about a project.",
)}`
const PHONE_DISPLAY = '910 699 8434'
const PHONE_TEL = 'tel:+919106998434'
const EMAIL = 'tej@nirmalstudio.com'

export default function Contact() {
  const contentRef = useRef(null)

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
          className="contact-cta"
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
        </div>
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
      `}</style>
    </section>
  )
}
