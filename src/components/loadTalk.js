// Shared lazy loader for the Talk panel.
//
// It lives in its own module so the nav and the Contact section's CTA fetch the SAME
// chunk once, rather than each holding a private cache and downloading it twice. Both
// open the same panel: Parth's decision (2026-09-21) is that "Book a Consultation" must
// not jump straight out to WhatsApp — it shows the same options as the nav button.
let talkModule = null

export const loadTalk = () =>
  (talkModule ??= import('./TalkToTej.jsx').catch((err) => {
    talkModule = null // allow a retry
    throw err
  }))
