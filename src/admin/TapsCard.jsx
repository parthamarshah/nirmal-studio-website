import { useEffect, useState } from 'react'
import { api } from './api.js'

// How many times visitors tapped a way to get in touch, this week and last (from
// functions/api/admin/taps.js). Quiet when there's nothing to show yet.

const KINDS = [
  { key: 'talk', label: 'Talk with Us' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'call', label: 'Call' },
  { key: 'email', label: 'Email' },
  { key: 'map', label: 'Map' },
  { key: 'social', label: 'Social' },
]

export default function TapsCard() {
  const [weeks, setWeeks] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    api('taps').then(
      (r) => live && setWeeks(r.weeks),
      () => live && setFailed(true),
    )
    return () => {
      live = false
    }
  }, [])
  if (failed || !weeks) return null
  const [now, last] = weeks
  const any = weeks.some((w) => KINDS.some((k) => w.counts[k.key]))
  if (!any) {
    return <p className="admin-taps admin-taps--empty">No contact taps yet. Once visitors tap WhatsApp, Call, Email and so on, the weekly counts show here.</p>
  }
  // One line: compact on the screen opened most. These are taps on buttons and links — a
  // tap isn't a message sent, and opening Talk with Us then tapping WhatsApp counts twice.
  return (
    <p className="admin-taps" aria-label="Contact taps">
      <strong>Contact taps since Monday</strong>{' '}
      {KINDS.map((k, i) => (
        <span key={k.key} className="admin-taps-item">
          {i > 0 && ' · '}
          {k.label} <b>{now?.counts[k.key] ?? 0}</b>
          <span className="admin-taps-last"> (last week {last?.counts[k.key] ?? 0})</span>
        </span>
      ))}
      <span className="admin-field-hint"> — taps on the site’s buttons, not messages received.</span>
    </p>
  )
}
