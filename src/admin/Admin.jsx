import { useCallback, useEffect, useState } from 'react'
import { getSession, setSessionEndedHandler, ApiError } from './api.js'
import Login from './Login.jsx'
import Shell from './Shell.jsx'

// Decides between the login screen and the shell, and owns the one piece of state both
// care about: whether there is a session.
export default function Admin() {
  const [state, setState] = useState({ status: 'loading' })

  // Returns whether a session was actually confirmed. Login needs that answer: a correct
  // PIN whose cookie doesn't stick would otherwise leave it waiting forever.
  const refresh = useCallback(async () => {
    try {
      const session = await getSession()
      setState(session.signedIn ? { status: 'in', session } : { status: 'out' })
      return session.signedIn
    } catch (err) {
      // Reaching here means the backend isn't answering as JSON at all — most often
      // because the Functions aren't deployed on this host. Saying so plainly beats a
      // login form that can only ever fail.
      setState({
        status: 'broken',
        message: err instanceof ApiError ? err.message : 'Could not reach the admin backend.',
      })
      return false
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // One place decides what an expired or revoked session means, so no future editor call
  // has to. Sessions last 30 days, so this will fire mid-edit eventually.
  useEffect(() => {
    setSessionEndedHandler(() => setState((s) => (s.status === 'in' ? { status: 'out' } : s)))
    return () => setSessionEndedHandler(null)
  }, [])

  if (state.status === 'loading') return <p className="admin-boot">Checking your session…</p>

  if (state.status === 'broken') {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <h1>
            <span className="admin-wordmark">
              <b>nirmal</b> <span>studio</span>
            </span>
          </h1>
          <p className="admin-error" role="alert">
            {state.message}
          </p>
          {/* Without this the only way out is knowing to reload the page — and a one
              second network blip lands here too, not just a genuinely absent backend. */}
          <button
            className="admin-submit"
            type="button"
            onClick={() => {
              setState({ status: 'loading' })
              refresh()
            }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (state.status === 'out') return <Login onSignedIn={refresh} />

  return <Shell session={state.session} onSignedOut={() => setState({ status: 'out' })} />
}
