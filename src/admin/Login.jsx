import { useEffect, useRef, useState } from 'react'
import { login, ApiError } from './api.js'

// The 6-digit PIN screen. Two humans share one PIN (Parth and Tej), so there is no
// user field — see functions/api/admin/_lib/auth.js for why the lockout, not the hash,
// is what actually protects a six-digit secret.
export default function Login({ onSignedIn }) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function submit(e) {
    e.preventDefault()
    if (busy || pin.length !== 6) return
    setBusy(true)
    setError(null)
    try {
      await login(pin)
      onSignedIn()
    } catch (err) {
      // The backend's own message is shown verbatim for the cases where it knows
      // something useful: how many minutes a lockout has left, or exactly which piece
      // of configuration is missing. Replacing those with "something went wrong" is how
      // a misconfigured deployment turns into an afternoon of guessing.
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
      setPin('')
      inputRef.current?.focus()
      setBusy(false)
    }
  }

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
        <input
          id="admin-pin"
          ref={inputRef}
          className="admin-pin"
          // `inputMode` (not type=number) gives a phone the number pad without the
          // spinner, the scroll-to-change behaviour, or the silent dropping of a
          // leading zero that type=number does to "012345".
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="······"
          value={pin}
          disabled={busy}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
            if (error) setError(null)
          }}
        />

        <button className="admin-submit" type="submit" disabled={busy || pin.length !== 6}>
          {busy ? 'Checking…' : 'Sign in'}
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
