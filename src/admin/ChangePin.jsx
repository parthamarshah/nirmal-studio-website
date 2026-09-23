import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from './api.js'

// Changing the PIN signs everyone out — including the person doing it. Everything here is
// shaped around making that expected rather than alarming: it is stated before the form
// is opened, restated on the button, and the sign-out that follows is presented as the
// change having worked.
export default function ChangePin({ onSignedOut, busyElsewhere, locked = false }) {
  const [open, setOpen] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [warning, setWarning] = useState(null)
  const [done, setDone] = useState(false)
  // The sign-out is on a timer so the confirmation can be read. If this pane is left
  // first, that timer must not fire a sign-out from a screen that never mentioned the
  // PIN — and on this pane, leaving means the component is gone.
  const signOutTimer = useRef(null)
  useEffect(() => () => clearTimeout(signOutTimer.current), [])

  const digitsOnly = (v) => v.replace(/\D/g, '').slice(0, 6)
  const ready = currentPin.length === 6 && newPin.length === 6 && confirmPin.length === 6

  function close() {
    setOpen(false)
    setCurrentPin('')
    setNewPin('')
    setConfirmPin('')
    setError(null)
  }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    // Checked here as well as on the server: mistyping the confirmation is the common
    // case, and it should not cost a lockout attempt or a round trip.
    if (newPin !== confirmPin) {
      setError('The two new PINs don’t match.')
      return
    }
    // Changing the PIN signs everyone out immediately, so it must not happen on top of
    // work that hasn't reached the server — the same rule the Sign out button follows.
    const blocked = busyElsewhere?.()
    if (blocked) {
      setError(blocked)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await api('pin', { method: 'POST', body: { currentPin, newPin } })
      // The server reports a PIN that changed but whose cleanup didn't finish; saying so
      // beats a bare success the person can't act on.
      if (res?.warning) setWarning(res.warning)
      setDone(true)
      // The session this page is holding was just revoked, so the app has to go back to
      // the login screen. Long enough to read what happened, short enough not to invite
      // clicking anything else first.
      signOutTimer.current = setTimeout(() => onSignedOut(), 2500)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the PIN.')
      setBusy(false)
    }
  }

  if (done) {
    return (
      <section className="admin-pin" aria-live="polite">
        <h2>PIN changed</h2>
        <p className="admin-hint">
          {warning || 'Everyone signed in has been signed out, here and on any other device.'} Signing
          you back in now — use the new PIN.
        </p>
      </section>
    )
  }

  return (
    <section className="admin-pin">
      <h2>PIN</h2>
      {locked ? (
        <p className="admin-hint">
          The PIN can’t be changed while a publish is going out. This will come back in a moment.
        </p>
      ) : !open ? (
        <>
          <p className="admin-hint">
            The 6-digit PIN you and Tej use to open this admin. Changing it signs everyone out, on
            every device.
          </p>
          <button type="button" className="admin-btn admin-btn--quiet" onClick={() => setOpen(true)}>
            Change PIN
          </button>
        </>
      ) : (
        <form onSubmit={submit}>
          <fieldset className="admin-fields" disabled={busy}>
            <div className="admin-field">
              <label htmlFor="pin-current">Current PIN</label>
              <input
                id="pin-current"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={currentPin}
                onChange={(e) => setCurrentPin(digitsOnly(e.target.value))}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="pin-new">New PIN</label>
              <input
                id="pin-new"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={newPin}
                onChange={(e) => setNewPin(digitsOnly(e.target.value))}
              />
              <p className="admin-field-hint">6 digits. Not all the same, and not a run like 123456.</p>
            </div>
            <div className="admin-field">
              <label htmlFor="pin-confirm">New PIN again</label>
              <input
                id="pin-confirm"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(digitsOnly(e.target.value))}
              />
            </div>
          </fieldset>

          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}

          <div className="admin-pin-actions">
            <button type="submit" className="admin-btn" disabled={!ready || busy}>
              {busy ? 'Changing…' : 'Change PIN and sign everyone out'}
            </button>
            <button type="button" className="admin-btn admin-btn--quiet" onClick={close} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
