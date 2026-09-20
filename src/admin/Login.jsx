import { useEffect, useRef, useState } from 'react'
import { login, ApiError } from './api.js'

// The 6-digit PIN screen. Two humans share one PIN (Parth and Tej), so there is no user
// field — see functions/api/admin/_lib/auth.js for why the lockout, not the hash, is what
// actually protects a six-digit secret.

const minutesLeft = (until) => Math.max(1, Math.ceil((until - Date.now()) / 60_000))

export default function Login({ onSignedIn }) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // Set when retrying cannot possibly work: the backend is misconfigured or not deployed
  // here, or this IP is locked out. Leaving the form live in those states invites
  // somebody to type the right PIN over and over and conclude they have forgotten it.
  const [blocked, setBlocked] = useState(null)
  const [reveal, setReveal] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // A lockout ends by itself, so the form un-blocks by itself rather than making someone
  // guess when to reload.
  useEffect(() => {
    if (blocked?.kind !== 'locked' || !blocked.until) return
    const ms = blocked.until - Date.now()
    if (ms <= 0) {
      setBlocked(null)
      return
    }
    const t = setTimeout(() => {
      setBlocked(null)
      setError(null)
    }, ms + 500)
    return () => clearTimeout(t)
  }, [blocked])

  async function submit(e) {
    e.preventDefault()
    if (busy || blocked || pin.length !== 6) return
    setBusy(true)
    setError(null)

    try {
      await login(pin)
    } catch (err) {
      // The backend's own message is shown verbatim wherever it knows something useful:
      // how many minutes a lockout has left, or exactly which piece of configuration is
      // missing. Replacing those with "something went wrong" is how a misconfigured
      // deployment turns into an afternoon of guessing.
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
      if (err instanceof ApiError && (err.kind === 'misconfigured' || err.kind === 'not-deployed')) {
        // Keep what was typed: it may well be correct, and it isn't the problem.
        setBlocked({ kind: err.kind })
      } else if (err instanceof ApiError && err.kind === 'locked') {
        setBlocked({ kind: 'locked', until: err.lockedUntil })
        setPin('')
      } else {
        setPin('')
        inputRef.current?.focus()
      }
      setBusy(false)
      return
    }

    // The PIN was right — but that is not the same as being signed in. If the cookie
    // didn't stick (cookies blocked, a stripped Set-Cookie, clock skew), Admin re-renders
    // this same component at the same position, React keeps its local state, and without
    // the branch below the screen would sit on "Checking…" forever with no way out.
    let confirmed = false
    try {
      confirmed = await onSignedIn()
    } catch {
      confirmed = false
    }
    if (!confirmed) {
      setError('That PIN was right, but your browser didn’t keep the session. Check that cookies are allowed for this site, then try again.')
      setBusy(false)
    }
  }

  const lockNote = blocked?.kind === 'locked' && blocked.until ? `Locked — try again in ${minutesLeft(blocked.until)} min` : null

  return (
    <div className="admin-login">
      <form className="admin-login-card" onSubmit={submit}>
        <h1>
          <span className="admin-wordmark">
            <b>nirmal</b> <span>studio</span>
          </span>
        </h1>
        <p>Sign in to edit the site.</p>

        <label htmlFor="admin-pin">Your 6-digit PIN</label>
        <div className="admin-pin-wrap">
          <input
            id="admin-pin"
            ref={inputRef}
            className="admin-pin"
            // Masked by default so the PIN isn't readable over a shoulder or in a shared
            // screen, with a reveal toggle because six blind digits are easy to fumble.
            type={reveal ? 'text' : 'password'}
            // `inputMode` (not type=number) asks for a number pad without the spinner,
            // the scroll-to-change behaviour, or the silent dropping of a leading zero
            // that type=number does to "012345".
            inputMode="numeric"
            // current-password, NOT one-time-code: this is a standing credential, and
            // one-time-code tells password managers not to offer to save it. Both of
            // this project's other secrets already live in Apple Passwords.
            autoComplete="current-password"
            maxLength={6}
            placeholder="······"
            value={pin}
            disabled={busy || !!blocked}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
              if (error && !blocked) setError(null)
            }}
          />
          <button
            type="button"
            className="admin-reveal"
            onClick={() => setReveal((v) => !v)}
            aria-pressed={reveal}
          >
            {reveal ? 'Hide' : 'Show'}
          </button>
        </div>

        <button className="admin-submit" type="submit" disabled={busy || !!blocked || pin.length !== 6}>
          {lockNote || (busy ? 'Checking…' : 'Sign in')}
        </button>

        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}
