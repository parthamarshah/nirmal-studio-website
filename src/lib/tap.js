// Counts taps on the ways to get in touch, for the weekly numbers in /admin. One listener
// for the whole page (installed by main.jsx), so no component has to remember to report:
// it looks at what was tapped — a WhatsApp, phone, email, map or social link, or anything
// marked data-tap="talk" (the "Talk with Us" buttons).
//
// Sends a fire-and-forget beacon to /api/tap (functions/api/tap.js): nothing waits for it,
// nothing is stored in the browser, and it is never sent for the same tap twice.

const SOCIAL = /(^|\.)(instagram\.com|facebook\.com|linkedin\.com)$/i

function kindOf(el) {
  const marked = el.closest('[data-tap]')
  if (marked) return marked.getAttribute('data-tap')
  const a = el.closest('a[href]')
  if (!a) return null
  const href = a.getAttribute('href') || ''
  if (href.startsWith('tel:')) return 'call'
  if (href.startsWith('mailto:')) return 'email'
  let url
  try {
    url = new URL(href, window.location.href)
  } catch {
    return null
  }
  if (url.hostname === 'wa.me' || url.hostname.endsWith('whatsapp.com')) return 'whatsapp'
  if (url.hostname.includes('google.') && url.pathname.startsWith('/maps')) return 'map'
  if (SOCIAL.test(url.hostname)) return 'social'
  return null
}

export function installTapCounter() {
  if (typeof window === 'undefined' || !navigator.sendBeacon) return
  // Capture phase: counted even if a handler further down stops the click.
  document.addEventListener(
    'click',
    (e) => {
      const kind = e.target instanceof Element ? kindOf(e.target) : null
      if (!kind) return
      try {
        navigator.sendBeacon('/api/tap', new Blob([JSON.stringify({ kind })], { type: 'text/plain' }))
      } catch {
        // Counting must never get in the way of the tap itself.
      }
    },
    { capture: true },
  )
}
