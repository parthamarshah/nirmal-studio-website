// Shared auth for every /api/admin/* endpoint.
//
// Threat model, stated plainly so the choices below make sense: the secret is a SIX
// DIGIT PIN — one million possibilities. No hashing scheme makes that strong against an
// attacker who can guess freely. So the real defence is the server-side lockout, and the
// hash exists to stop a leaked secret store from revealing the PIN itself. Sessions are
// recorded in D1 (not just signed) so they can actually be revoked.

const encoder = new TextEncoder()

export const SESSION_COOKIE = 'nirmal_admin'
const SESSION_DAYS = 30
const MAX_FAILURES = 5
const LOCK_MINUTES = 15

// ---------------------------------------------------------------- PIN hashing

// Stored format: pbkdf2$sha256$<iterations>$<salt b64>$<hash b64>. Parameters travel
// with the hash, so iterations can be changed later without invalidating existing PINs
// — which matters here, because Workers' CPU budget may force them down (see the plan's
// risk #1) and we must be able to move that number without a migration.
export async function verifyPin(pin, stored) {
  const parts = String(stored || '').split('$')
  if (parts.length !== 5) return false
  const [scheme, algo, iterations, saltB64, hashB64] = parts
  if (scheme !== 'pbkdf2' || algo !== 'sha256') return false

  const expected = base64ToBytes(hashB64)
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: base64ToBytes(saltB64), iterations: Number(iterations) },
    key,
    expected.length * 8,
  )
  return timingSafeEqual(new Uint8Array(bits), expected)
}

// Constant-time compare. `===` on hex/base64 strings leaks how many leading characters
// matched, which over many attempts narrows the search — cheap to avoid, so avoid it.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

const base64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
const bytesToBase64 = (bytes) => btoa(String.fromCharCode(...bytes))
const bytesToHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')

// ---------------------------------------------------------------- cookie signing

// The cookie carries "<sessionId>.<hmac>". The id alone would be guessable-ish and
// unauthenticated; the HMAC means a forged id is rejected without a database round-trip.
// The session row is still checked, so revocation works.
async function hmac(secret, message) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))
}

export async function signSessionId(secret, id) {
  return `${id}.${bytesToBase64(await hmac(secret, id))}`
}

export async function readSignedCookie(secret, value) {
  if (!value || !value.includes('.')) return null
  const idx = value.lastIndexOf('.')
  const id = value.slice(0, idx)
  const sig = value.slice(idx + 1)
  let expected
  try {
    expected = base64ToBytes(sig)
  } catch {
    return null
  }
  return timingSafeEqual(await hmac(secret, id), expected) ? id : null
}

export const parseCookies = (header) =>
  Object.fromEntries(
    (header || '')
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const i = c.indexOf('=')
        return i === -1 ? [c, ''] : [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]
      }),
  )

// SameSite=Strict: the admin has no cross-site flows at all, so there is no reason to
// allow the cookie to ride along with any request originating elsewhere. HttpOnly keeps
// it away from JavaScript, so an XSS bug in the editor cannot steal the session.
export function sessionCookie(value, { maxAge = SESSION_DAYS * 86400 } = {}) {
  return [
    `${SESSION_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
  ].join('; ')
}

export const clearedCookieHeader = () => sessionCookie('', { maxAge: 0 })

// ---------------------------------------------------------------- sessions

export async function createSession(db, { userAgent }) {
  const id = bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
  const now = Date.now()
  await db
    .prepare('INSERT INTO sessions (id, created_at, expires_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?)')
    .bind(id, now, now + SESSION_DAYS * 86400_000, now, (userAgent || '').slice(0, 200))
    .run()
  return id
}

// Returns the session row if the cookie is valid, signed, unexpired and unrevoked.
export async function getSession(env, request) {
  const secret = env.SESSION_SECRET
  if (!secret) return null
  const raw = parseCookies(request.headers.get('Cookie'))[SESSION_COOKIE]
  const id = await readSignedCookie(secret, raw)
  if (!id) return null

  const row = await env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(id).first()
  if (!row || row.revoked_at || row.expires_at < Date.now()) return null

  // Touch last_seen_at at most hourly. Writing on every request would burn D1's free-tier
  // write budget on a value nothing needs to the second.
  if (Date.now() - row.last_seen_at > 3600_000) {
    await env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').bind(Date.now(), id).run()
  }
  return row
}

export const revokeSession = (db, id) =>
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').bind(Date.now(), id).run()

// Used when the PIN changes: every existing session dies, everywhere.
export const revokeAllSessions = (db) =>
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE revoked_at IS NULL').bind(Date.now()).run()

// ---------------------------------------------------------------- lockout

// Two buckets on purpose. Per-IP stops the obvious case; a global bucket means an
// attacker rotating through addresses still hits a wall, which per-IP alone would miss
// entirely.
export async function checkLock(db, ip) {
  const now = Date.now()
  const rows = await db
    .prepare('SELECT bucket, locked_until FROM login_attempts WHERE bucket IN (?, ?)')
    .bind(`ip:${ip}`, 'global')
    .all()
  const locked = (rows.results || []).find((r) => r.locked_until && r.locked_until > now)
  return locked ? { locked: true, until: locked.locked_until } : { locked: false }
}

export async function recordFailure(db, ip) {
  const now = Date.now()
  for (const bucket of [`ip:${ip}`, 'global']) {
    // The global bucket is more tolerant — it exists to stop distributed guessing, not
    // to let one person's typo lock out the other legitimate user.
    const limit = bucket === 'global' ? MAX_FAILURES * 4 : MAX_FAILURES
    const row = await db.prepare('SELECT * FROM login_attempts WHERE bucket = ?').bind(bucket).first()

    // A failure long after the last one starts a fresh count, so an honest typo today
    // doesn't combine with one from last week to trigger a lock.
    const stale = row && now - row.first_failed > LOCK_MINUTES * 60_000
    const failures = !row || stale ? 1 : row.failures + 1
    const firstFailed = !row || stale ? now : row.first_failed
    const lockedUntil = failures >= limit ? now + LOCK_MINUTES * 60_000 : null

    await db
      .prepare(
        `INSERT INTO login_attempts (bucket, failures, first_failed, locked_until) VALUES (?, ?, ?, ?)
         ON CONFLICT(bucket) DO UPDATE SET failures = ?, first_failed = ?, locked_until = ?`,
      )
      .bind(bucket, failures, firstFailed, lockedUntil, failures, firstFailed, lockedUntil)
      .run()
  }
}

export const clearFailures = (db, ip) =>
  db.prepare('DELETE FROM login_attempts WHERE bucket = ?').bind(`ip:${ip}`).run()

export const clientIp = (request) =>
  request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown'

// ---------------------------------------------------------------- responses

export const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Nothing from the admin API should ever be cached, by the browser or the edge.
      'Cache-Control': 'no-store',
      ...(init.headers || {}),
    },
  })

export const unauthorized = () => json({ error: 'Not signed in.' }, { status: 401 })

// Guard for every admin endpoint except login. Returns the session, or a Response to
// return immediately — callers must check which they got.
export async function requireSession(context) {
  const session = await getSession(context.env, context.request)
  return session || unauthorized()
}
