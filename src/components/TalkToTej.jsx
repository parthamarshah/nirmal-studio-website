import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Img from './Img'
import { site, tejShah, whatsappGreeting, whatsappUrl, whatsappWebUrl, mapsUrl, composeMessage, DESKTOP_POINTER } from '../lib/content'

// "Talk to Tej" panel, opened from the nav on every page. Loaded only when the
// visitor taps the button (Nav.jsx imports this file on demand), so neither the
// homepage nor the pre-rendered project pages carry it up front.
//
// Deliberately plain, like ImageViewer.jsx and Nav's dropdown: no Framer Motion
// and no exit fade — it unmounts the instant it closes, so the "invisible
// overlay still swallowing clicks" incident in CLAUDE.md can't happen here.
// Phone = bottom sheet; desktop (≥768px, pure CSS) = centred dialog with a
// WhatsApp QR code beside the options.
//
// Every detail comes from content/site.json. Lines with no content (reply time,
// hours) are left out rather than making a promise the studio hasn't made.

const ICONS = {
  whatsapp: (
    <>
      <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" />
      <path
        d="M9.2 8.6c.2-.5.6-.5.9-.5l.6.1.8 1.8-.6.8c.5 1 1.3 1.8 2.3 2.3l.8-.6 1.8.8v.6c0 .4-.2.8-.6 1-1.9.7-5.8-2.8-6.3-5.1 0-.5.1-.9.3-1.2z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  phone: <path d="M5 4h3l1.5 4-2 1.2a11 11 0 0 0 5.3 5.3L14 12.5l4 1.5v3a2 2 0 0 1-2 2A13 13 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15 12 21 12 21z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
}
const Icon = ({ name }) => (
  <span className="talk-option-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      {ICONS[name]}
    </svg>
  </span>
)

// Shared with Contact.jsx via lib/content so the two can't drift (the whole reason
// Contact stopped building its own wa.me URL in the first place).
const DESKTOP = DESKTOP_POINTER

// Desktop only: the QR library is fetched the first time a desktop visitor
// opens the panel (phones never download it). Encodes the current message.
function WhatsAppQr({ text }) {
  const [svgPath, setSvgPath] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!window.matchMedia(DESKTOP).matches) return
    let cancelled = false
    setFailed(false)
    import('qrcode-generator')
      .then(({ default: qrcode }) => {
        if (cancelled) return
        const qr = qrcode(0, 'M')
        qr.addData(whatsappUrl(text)) // the URL is ASCII (percent-encoded), so byte mode is safe
        qr.make()
        const n = qr.getModuleCount()
        let d = ''
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`
        setSvgPath({ n, d })
      })
      .catch(() => {
        // Offline: the "Open WhatsApp Web" button still works, so the panel stays usable —
        // the QR just hides. `failed` is cleared on the next attempt (above) rather than
        // latched, so a visitor who regains connectivity gets the code back instead of
        // being stuck without it for the rest of the session.
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [text])

  if (failed) return null
  return (
    <aside className="talk-qr">
      <div className={`talk-qr-code${svgPath ? '' : ' is-loading'}`}>
        {svgPath && (
          <svg viewBox={`-2 -2 ${svgPath.n + 4} ${svgPath.n + 4}`} role="img" aria-label="QR code that opens this chat in WhatsApp" shapeRendering="crispEdges">
            <rect x="-2" y="-2" width={svgPath.n + 4} height={svgPath.n + 4} fill="#fff" />
            <path d={svgPath.d} fill="#111" />
          </svg>
        )}
      </div>
      <p className="talk-qr-title">Scan to chat on WhatsApp</p>
      <p className="talk-qr-note">Opens on your phone with the message ready</p>
    </aside>
  )
}

function ChipGroup({ label, options, value, onChange }) {
  const id = useId()
  if (!options.length) return null
  return (
    <div className="talk-question" role="group" aria-labelledby={id}>
      <p id={id} className="talk-question-label">
        {label}
      </p>
      <div className="talk-chips">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            className="talk-chip"
            aria-pressed={value === o}
            onClick={() => onChange(value === o ? null : o)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function TalkToTej({ onClose }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  const titleId = useId()
  const cityId = useId()
  const [step, setStep] = useState('choose')
  const [what, setWhat] = useState(null)
  const [stage, setStage] = useState(null)
  const [city, setCity] = useState('')
  const [copied, setCopied] = useState(false)

  const helper = site.talk?.helper || {}
  const whatOptions = helper.what || []
  const stageOptions = helper.stage || []
  const hasHelper = whatOptions.length > 0 || stageOptions.length > 0
  const message = useMemo(() => composeMessage({ what, city, stage }), [what, city, stage])
  const { contact } = site
  const firstName = tejShah.name.split(' ')[0]

  // Back button closes the panel instead of leaving the page (same pattern as
  // ImageViewer): opening adds one history entry and every close goes back through it.
  //
  // `history.back()` is ASYNC — popstate lands a tick later, and until it does the
  // panel is still mounted and still interactive. Without a guard, anything that
  // re-enters inside that window (a double-tapped ×, or simply HOLDING Escape, whose
  // auto-repeat fires every ~30ms) calls back() again and pops a second, real history
  // entry — navigating the visitor clean off the site. This is the same incident
  // FeaturedProjects.jsx already carries `closingRef` for, and it was reproduced here
  // in headless Chrome before this guard existed. `closingRef` is set synchronously,
  // before back() is called, and cleared only once popstate actually lands.
  const closingRef = useRef(false)
  const requestClose = () => {
    if (closingRef.current) return
    if (window.history.state?.nirmalTalk) {
      closingRef.current = true
      window.history.back()
    } else onCloseRef.current()
  }
  const requestCloseRef = useRef(requestClose)
  requestCloseRef.current = requestClose

  useEffect(() => {
    const opener = document.activeElement
    closeRef.current?.focus()
    window.history.pushState({ nirmalTalk: true }, '')
    const onPopState = () => {
      closingRef.current = false
      onCloseRef.current()
    }
    const onKeyDown = (e) => {
      // `e.repeat` filters out keyboard auto-repeat: holding Escape must count as one
      // close request, not thirty (see the closingRef comment above).
      if (e.key === 'Escape' && !e.repeat) requestCloseRef.current()
      if (e.key !== 'Tab' || !dialogRef.current) return
      // Keep keyboard focus inside the panel.
      const items = [...dialogRef.current.querySelectorAll('a[href], button, input')].filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
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
  }, [])

  // Moving between steps: put focus somewhere sensible inside the new step.
  const stepRef = useRef(null)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    stepRef.current?.querySelector('button, a[href]')?.focus()
  }, [step])

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(contact.email)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the address is on screen and the mailto link still works.
    }
  }

  // Portalled to <body>: the scrolled nav's backdrop-filter would otherwise make
  // this position: fixed overlay size itself to the nav bar instead of the screen.
  return createPortal(
    <div
      className="talk-scrim"
      // Only a click on the backdrop itself closes, not one bubbling up from the panel.
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
      data-lenis-prevent=""
    >
      <div ref={dialogRef} className="talk-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="talk-head">
          {tejShah.photo?.media && (
            <span className="talk-avatar">
              <Img media={tejShah.photo.media} sizes="56px" alt="" />
            </span>
          )}
          <div>
            <h2 id={titleId} className="talk-title">
              Talk to {firstName}
            </h2>
            <p className="talk-sub">
              You’ll speak directly with {firstName}
              {contact.replyTime?.trim() ? ` · ${contact.replyTime.trim()}` : ''}
            </p>
          </div>
          <button ref={closeRef} type="button" className="talk-close" aria-label="Close" onClick={requestClose}>
            &times;
          </button>
        </header>

        <div className="talk-body">
          <div className="talk-main" ref={stepRef}>
            {step === 'choose' ? (
              <ul className="talk-options">
                <li>
                  {hasHelper ? (
                    <button type="button" className="talk-option" onClick={() => setStep('helper')}>
                      <Icon name="whatsapp" />
                      <span>
                        <b>WhatsApp</b>
                        <small>Chat, with help writing a first message</small>
                      </span>
                    </button>
                  ) : (
                    <a className="talk-option" href={whatsappUrl()} target="_blank" rel="noopener noreferrer">
                      <Icon name="whatsapp" />
                      <span>
                        <b>WhatsApp</b>
                        <small>Opens a chat with {firstName}</small>
                      </span>
                    </a>
                  )}
                </li>
                <li>
                  <a className="talk-option" href={`tel:${contact.phone}`}>
                    <Icon name="phone" />
                    <span>
                      <b>Call</b>
                      <small>{contact.phoneDisplay}</small>
                    </span>
                  </a>
                </li>
                <li className="talk-option-row">
                  <a className="talk-option" href={`mailto:${contact.email}`}>
                    <Icon name="email" />
                    <span>
                      <b>Email</b>
                      <small>{contact.email}</small>
                    </span>
                  </a>
                  <button type="button" className="talk-copy" onClick={copyEmail} aria-live="polite">
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </li>
                <li>
                  <a className="talk-option" href={mapsUrl()} target="_blank" rel="noopener noreferrer">
                    <Icon name="pin" />
                    <span>
                      <b>Visit the studio</b>
                      <small>
                        {contact.addressShort?.trim() || contact.address}
                        {contact.hours?.trim() ? ` · ${contact.hours.trim()}` : ''}
                      </small>
                    </span>
                  </a>
                </li>
              </ul>
            ) : (
              <div className="talk-helper">
                <div className="talk-helper-top">
                  <button type="button" className="talk-link talk-back" onClick={() => setStep('choose')}>
                    ← All options
                  </button>
                  <span className="talk-fine">Every question is optional</span>
                </div>
                <ChipGroup label="What are you planning?" options={whatOptions} value={what} onChange={setWhat} />
                <div className="talk-question">
                  <label htmlFor={cityId} className="talk-question-label">
                    Which city?
                  </label>
                  <input
                    id={cityId}
                    className="talk-input"
                    value={city}
                    maxLength={40}
                    autoComplete="address-level2"
                    placeholder="e.g. Ahmedabad, Udaipur, Pune"
                    enterKeyHint="done"
                    onChange={(e) => setCity(e.target.value)}
                    // Not a form: Return/Go just puts the keyboard away so the message shows.
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
                  />
                </div>
                <ChipGroup label="How far along are you?" options={stageOptions} value={stage} onChange={setStage} />
                <div className="talk-question">
                  <p className="talk-question-label">Your first message</p>
                  <p className="talk-message">{message}</p>
                  <p className="talk-fine">You can still edit it in WhatsApp before sending.</p>
                </div>
                <div className="talk-actions">
                  {/* wa.me on a computer stops at a "continue to chat" page, so desktop goes to WhatsApp Web directly. */}
                  <a className="talk-button is-phone" href={whatsappUrl(message)} target="_blank" rel="noopener noreferrer">
                    Open WhatsApp
                  </a>
                  <a className="talk-button is-desktop" href={whatsappWebUrl(message)} target="_blank" rel="noopener noreferrer">
                    Open WhatsApp Web
                  </a>
                  <a className="talk-button is-quiet is-phone" href={whatsappUrl(whatsappGreeting())} target="_blank" rel="noopener noreferrer">
                    Skip, just say hi
                  </a>
                  <a className="talk-button is-quiet is-desktop" href={whatsappWebUrl(whatsappGreeting())} target="_blank" rel="noopener noreferrer">
                    Skip, just say hi
                  </a>
                </div>
              </div>
            )}
          </div>
          <WhatsAppQr text={step === 'helper' ? message : whatsappGreeting()} />
        </div>
      </div>

      <style>{`
        .talk-scrim {
          position: fixed;
          inset: 0;
          z-index: calc(var(--z-overlay) + 2);
          background: rgba(17, 17, 17, 0.45);
          display: flex;
          align-items: flex-end;
          animation: talk-fade 0.2s ease;
          overscroll-behavior: contain;
        }
        .talk-panel {
          width: 100%;
          max-height: 90svh;
          overflow-y: auto;
          overscroll-behavior: contain;
          background: var(--color-warm-white);
          border-radius: 18px 18px 0 0;
          padding: var(--space-sm) 1.25rem calc(1.25rem + env(safe-area-inset-bottom));
          animation: talk-rise 0.32s var(--ease-luxury);
          color: var(--color-text);
        }
        @keyframes talk-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes talk-rise { from { transform: translateY(40px); opacity: 0.4; } to { transform: none; opacity: 1; } }
        .talk-head {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: var(--space-sm);
        }
        .talk-avatar {
          width: 3.25rem;
          height: 3.25rem;
          flex: 0 0 auto;
          border-radius: 50%;
          overflow: hidden;
          background: var(--color-beige);
        }
        .talk-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .talk-title {
          font-family: var(--font-heading);
          font-weight: 400;
          font-size: 1.5rem;
          line-height: 1.1;
        }
        .talk-sub {
          font-family: var(--font-body);
          font-size: 0.82rem;
          color: var(--color-stone-dark);
          margin-top: 0.15rem;
        }
        .talk-close {
          margin-left: auto;
          align-self: flex-start;
          flex: 0 0 auto;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1px solid var(--color-beige);
          background: var(--color-warm-white);
          color: var(--color-text);
          font-size: 1.4rem;
          line-height: 1;
          cursor: pointer;
        }
        .talk-options { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
        .talk-option {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          min-height: 56px;
          padding: 0.7rem 0.9rem;
          border: 1px solid var(--color-beige);
          border-radius: 12px;
          background: #fff;
          font: inherit;
          text-align: left;
          color: var(--color-text);
          text-decoration: none;
          cursor: pointer;
          transition: border-color 0.2s ease;
        }
        .talk-option:hover { border-color: var(--color-bronze); }
        .talk-option::after { content: '→'; margin-left: auto; padding-left: 0.5rem; color: var(--color-stone); }
        .talk-option > span:not(.talk-option-icon) { min-width: 0; }
        .talk-option b { display: block; font-family: var(--font-body); font-weight: 600; font-size: 0.95rem; }
        .talk-option small {
          display: block;
          font-family: var(--font-body);
          font-size: 0.8rem;
          color: var(--color-stone-dark);
          overflow-wrap: anywhere;
        }
        .talk-option-icon {
          width: 2.25rem;
          height: 2.25rem;
          flex: 0 0 auto;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: var(--color-bg);
        }
        .talk-option-icon svg { width: 1.1rem; height: 1.1rem; }
        .talk-option-row { display: flex; gap: 0.5rem; }
        .talk-option-row .talk-option { flex: 1; min-width: 0; }
        .talk-copy {
          flex: 0 0 auto;
          min-width: 4.5rem;
          border: 1px solid var(--color-beige);
          border-radius: 12px;
          background: #fff;
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--color-bronze-darker);
          cursor: pointer;
        }
        .talk-helper { display: grid; gap: 1rem; }
        .talk-link {
          border: 0;
          background: none;
          padding: 0;
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          font-family: var(--font-body);
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--color-bronze-darker);
          text-decoration: underline;
          text-underline-offset: 3px;
          cursor: pointer;
        }
        .talk-helper-top { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: -0.5rem; }
        .talk-question { display: grid; gap: 0.45rem; }
        .talk-question-label { font-family: var(--font-body); font-size: 0.82rem; font-weight: 600; color: var(--color-text); }
        .talk-question-label small { font-weight: 400; color: var(--color-stone-dark); }
        .talk-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
        .talk-chip {
          min-height: 44px;
          padding: 0.4rem 0.85rem;
          border: 1px solid var(--color-beige);
          border-radius: 999px;
          background: #fff;
          font-family: var(--font-body);
          font-size: 0.85rem;
          color: var(--color-text);
          cursor: pointer;
        }
        .talk-chip[aria-pressed='true'] { background: var(--color-text); border-color: var(--color-text); color: var(--color-warm-white); }
        .talk-input {
          width: 100%;
          min-height: 44px;
          padding: 0.55rem 0.75rem;
          border: 1px solid var(--color-beige);
          border-radius: 10px;
          background: #fff;
          font-family: var(--font-body);
          font-size: 16px; /* 16px+ stops iPhones zooming into the field */
          color: var(--color-text);
        }
        .talk-message {
          background: #e7f0e1;
          border-radius: 12px 12px 12px 3px;
          padding: 0.7rem 0.85rem;
          font-family: var(--font-body);
          font-size: 0.88rem;
          line-height: 1.5;
          color: #1f2b1c;
        }
        .talk-fine { font-family: var(--font-body); font-size: 0.75rem; color: var(--color-stone-dark); }
        /* Pinned to the bottom of the sheet, so the main button is never below the fold on short phones. */
        .talk-actions {
          position: sticky;
          bottom: calc(-1.25rem - env(safe-area-inset-bottom));
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin: 0 -1.25rem calc(-1.25rem - env(safe-area-inset-bottom));
          padding: 0.75rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom));
          background: var(--color-warm-white);
          border-top: 1px solid var(--color-beige);
        }
        .talk-button.is-desktop { display: none; }
        .talk-button {
          flex: 1 1 auto;
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.6rem 1.1rem;
          border-radius: 999px;
          border: 1px solid var(--color-bronze-darker);
          background: var(--color-bronze-darker);
          color: var(--color-warm-white);
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 600;
          text-decoration: none;
        }
        .talk-button.is-quiet { background: #fff; border-color: var(--color-beige); color: var(--color-text); }
        .talk-panel a:focus-visible, .talk-panel button:focus-visible, .talk-input:focus-visible {
          outline: 2px solid var(--color-bronze-darker);
          outline-offset: 2px;
        }
        .talk-qr { display: none; }
        .talk-qr-code.is-loading { background: var(--color-beige); }

        /* LAYOUT: width only. A tablet (iPad included, which reports a COARSE pointer
           even with a Magic Keyboard) should still get the centred dialog rather than a
           phone bottom sheet stretched across 1024px. */
        @media (min-width: 768px) {
          .talk-scrim { align-items: center; justify-content: center; padding: var(--space-md); }
          .talk-panel {
            width: min(46rem, 100%);
            max-height: min(52rem, 94vh);
            border-radius: 16px;
            padding: 1.5rem;
            animation: talk-fade 0.2s ease;
            box-shadow: 0 30px 70px rgba(0, 0, 0, 0.3);
          }
          .talk-actions { bottom: -1.5rem; margin: 0 0 -1.5rem; padding: 0.75rem 0 1.5rem; }
        }

        /* LINK TARGET + QR: needs a real pointer, not just width. A phone in landscape
           is ~930px wide — it must keep the wa.me deep link (web.whatsapp.com does not
           work on a phone) and must not be shown a "scan this with your phone" QR.
           Kept as a separate query from the layout block above on purpose; if you change
           one breakpoint, check the other. The JS half of this pair is the DESKTOP
           constant (from lib/content), which gates fetching the QR library at all.
           NB: no backticks in this block — it lives inside a JS template literal. */
        @media (min-width: 768px) and (pointer: fine) {
          .talk-body { display: grid; grid-template-columns: minmax(0, 1fr) 14rem; gap: 1.5rem; align-items: start; }
          .talk-qr {
            display: grid;
            justify-items: center;
            gap: 0.35rem;
            text-align: center;
            padding: 1.25rem 1rem;
            border-radius: 12px;
            background: var(--color-bg);
            border: 1px solid var(--color-beige);
            position: sticky;
            top: 0;
          }
          .talk-qr-code {
            width: 10rem;
            height: 10rem;
            padding: 0.4rem;
            background: #fff;
            border: 1px solid var(--color-beige);
            border-radius: 8px;
            margin-bottom: 0.4rem;
          }
          .talk-qr-code svg { display: block; width: 100%; height: 100%; }
          .talk-qr-title { font-family: var(--font-body); font-weight: 600; font-size: 0.88rem; }
          .talk-qr-note { font-family: var(--font-body); font-size: 0.78rem; color: var(--color-stone-dark); }
          .talk-button.is-phone { display: none; }
          .talk-button.is-desktop { display: inline-flex; }
        }
      `}</style>
    </div>,
    document.body,
  )
}
