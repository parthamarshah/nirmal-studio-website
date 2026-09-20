// The one place the admin talks to /api/admin/*.
//
// Why this exists rather than bare fetch() calls: **an unmatched path on Cloudflare
// Pages answers 200 with the site's HTML, not 404.** There is no 404.html, so Pages
// falls back to index.html. That means `res.ok` is true and `res.json()` then throws
// `SyntaxError: Unexpected token '<'` whenever an endpoint isn't routed — which is the
// permanent state on nirmalstudio.com (no functions/ there on purpose) and the state of
// any deployment where the Functions failed to build. Trusting res.ok would turn "the
// backend isn't deployed" into an unexplained crash on first load.
//
// So: every response is classified by CONTENT TYPE first, and anything that isn't JSON
// is treated as "the backend isn't there", never as data.

export class ApiError extends Error {
  constructor(message, { status, kind, data }) {
    super(message)
    this.status = status
    this.kind = kind
    // The whole error body, so a caller can act on what the server sent back — a 409
    // from the draft endpoint carries the version that is actually stored.
    this.data = data ?? null
    // The backend returns `lockedUntil` with a 429 so the UI can say how long is left
    // and stop accepting attempts that cannot succeed. Dropping it here would force the
    // login screen to keep offering a button that is guaranteed to fail.
    this.lockedUntil = data?.lockedUntil ?? null
  }
}

// A session can end at any moment — it lasts 30 days, so in Phase 3 it will expire
// mid-edit. Handling that in one place means every future editor call gets the same
// answer instead of each one inventing its own.
//
// This is process-global and SINGLE-OWNER: Admin sets it on mount and clears it on
// unmount. Don't add a second subscriber — the later one silently wins, and the first
// one's cleanup then clears the handler out from under it.
let onSessionEnded = null
export const setSessionEndedHandler = (fn) => {
  onSessionEnded = fn
}

const NOT_DEPLOYED =
  'The admin backend isn’t running on this deployment. (The public site is unaffected — it’s static files.)'
const OFFLINE = 'Couldn’t reach the server. Check your connection and try again.'

export async function api(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`/api/admin/${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      // Same-origin only; the cookie is SameSite=Strict anyway.
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError(OFFLINE, { status: 0, kind: 'offline' })
  }

  // Content type, not status. A 200 of text/html here means no such route.
  const type = res.headers.get('Content-Type') || ''
  if (!type.includes('application/json')) {
    throw new ApiError(NOT_DEPLOYED, { status: res.status, kind: 'not-deployed' })
  }

  let data
  try {
    data = await res.json()
  } catch {
    throw new ApiError(NOT_DEPLOYED, { status: res.status, kind: 'not-deployed' })
  }

  if (res.status === 401) onSessionEnded?.()

  if (res.ok) return data

  // 503 is the backend saying it is misconfigured — no PIN hash, no session secret, no
  // database binding, or a stored hash Cloudflare Workers cannot run. Its message names
  // the actual problem, so it is shown verbatim rather than replaced with something
  // vaguer. Everything else carries its own message too.
  throw new ApiError(data?.error || `Request failed (${res.status}).`, {
    status: res.status,
    kind: res.status === 503 ? 'misconfigured' : res.status === 429 ? 'locked' : 'error',
    data,
  })
}

export const getSession = () =>
  api('me').catch((err) => {
    // A 401 here is not an error condition — it is the ordinary "show the login screen"
    // answer, and the endpoint returns it on every first visit.
    if (err instanceof ApiError && err.status === 401) return { signedIn: false }
    throw err
  })

export const login = (pin) => api('login', { method: 'POST', body: { pin } })
export const logout = () => api('logout', { method: 'POST' })
