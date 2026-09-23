// Shared auth for every /api/admin/* endpoint.
//
// Threat model, stated plainly so the choices below make sense: the secret is a SIX
// DIGIT PIN — one million possibilities. No hashing scheme makes that strong against an
// attacker who can guess freely. So the real defence is the server-side lockout, and the
// hash exists to stop a leaked secret store from revealing the PIN itself. Sessions are
// recorded in D1 (not just signed) so they can actually be revoked.

const encoder = new TextEncoder()

// The `__Host-` prefix is not decoration: it makes the browser refuse to accept this
// cookie from any host other than the exact one that set it, and refuse it unless it is
// Secure with Path=/ and no Domain. Without it, a sibling subdomain could set a
// `Domain=.nirmalstudio.com` cookie of the same name — and there IS one: `erp.` is a
// CNAME to a separate third-party-hosted app (see CLAUDE.md's DNS notes). A cookie it
// set would be sent alongside the real one and could shadow it.
export const SESSION_COOKIE = '__Host-nirmal_admin'
const SESSION_DAYS = 30
const MAX_FAILURES = 5
const LOCK_MINUTES = 15

// ---------------------------------------------------------------- PIN hashing

// Cloudflare Workers refuses any PBKDF2 iteration count above 100,000 — deriveBits
// throws "Pbkdf2 failed: iteration counts above 100000 are not supported". Measured on a
// real preview deployment 2026-09-20: 100000 → 200, 100001 → 500. This is a platform
// ceiling, not a tuning knob, so a stored hash above it can never verify anywhere.
export const MAX_PBKDF2_ITERATIONS = 100_000

// The derived length is read from the stored hash, so the stored hash's own length IS a
// security parameter. A truncated or empty one would weaken (or with zero bytes,
// entirely defeat) the comparison below, so it is pinned rather than trusted.
const PIN_HASH_BYTES = 32

// Thrown when ADMIN_PIN_HASH itself is unusable. Deliberately NOT a `return false`: a
// misconfigured deployment answering exactly like a wrong PIN is the kind of thing that
// gets debugged for hours. Callers turn this into a plain 503 that says what to fix.
export class PinHashUnusable extends Error {}

// Where to look when the stored hash is unusable. Since the PIN can now be changed from
// /admin, the hash in force may be the D1 row rather than the deployment's secret — and
// the row outranks the secret, so "re-run admin:secrets" on its own is an instruction
// that cannot fix it. Every PinHashUnusable message ends with this.
const FIX_HINT =
  'Fix it by removing the stored PIN (DELETE FROM settings WHERE key = \'pin_hash\' on that environment\'s D1), which puts the deployment\'s own ADMIN_PIN_HASH secret back in force; if that secret is missing or also unusable, run "npm run admin:secrets" and set it.'

// Stored format: pbkdf2$sha256$<iterations>$<salt b64>$<hash b64>. Parameters travel
// with the hash, so iterations can be changed later without invalidating existing PINs
// — which matters if the platform ceiling above ever moves.
export async function verifyPin(pin, stored) {
  const parts = String(stored || '').split('$')
  if (parts.length !== 5) throw new PinHashUnusable(`The stored PIN is not in the expected pbkdf2$sha256$<iterations>$<salt>$<hash> format. ${FIX_HINT}`)
  const [scheme, algo, iterations, saltB64, hashB64] = parts
  if (scheme !== 'pbkdf2' || algo !== 'sha256') throw new PinHashUnusable(`The stored PIN uses an unsupported scheme (${scheme}/${algo}); expected pbkdf2/sha256. ${FIX_HINT}`)

  const rounds = Number(iterations)
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > MAX_PBKDF2_ITERATIONS) {
    throw new PinHashUnusable(`The stored PIN asks for ${iterations} PBKDF2 iterations; Cloudflare Workers supports at most ${MAX_PBKDF2_ITERATIONS}. ${FIX_HINT}`)
  }

  let expected
  try {
    expected = base64ToBytes(hashB64)
  } catch {
    throw new PinHashUnusable(`The stored PIN ends in something that is not valid base64. ${FIX_HINT}`)
  }
  if (expected.length !== PIN_HASH_BYTES) {
    throw new PinHashUnusable(`The stored PIN holds a ${expected.length}-byte hash; ${PIN_HASH_BYTES} bytes are required — it was probably truncated when it was copied. ${FIX_HINT}`)
  }

  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: base64ToBytes(saltB64), iterations: rounds },
    key,
    expected.length * 8,
  )
  return timingSafeEqual(new Uint8Array(bits), expected)
}

// The iteration count NEW hashes are written with. Reading uses whatever count travels
// with the stored hash, so this can move later without invalidating anyone's PIN — but it
// can never exceed the platform ceiling above.
const HASH_ITERATIONS = MAX_PBKDF2_ITERATIONS

// Produces the same `pbkdf2$sha256$<iterations>$<salt>$<hash>` string as
// `npm run admin:secrets`, so a PIN changed from inside /admin and one set from the
// command line are indistinguishable afterwards.
export async function hashPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: HASH_ITERATIONS },
    key,
    PIN_HASH_BYTES * 8,
  )
  return ['pbkdf2', 'sha256', HASH_ITERATIONS, bytesToBase64(salt), bytesToBase64(new Uint8Array(bits))].join('$')
}

// ---------------------------------------------------------------- where the PIN lives

const PIN_KEY = 'pin_hash'

// The PIN in force right now: the stored one if the PIN has ever been changed from
// /admin, otherwise the deployment's secret. A database that is unreachable must NOT
// silently fall back to a PIN that was deliberately replaced, so the read is not
// swallowed — a failure here surfaces as a 503, not as "the old PIN works again".
export async function currentPinHash(env) {
  if (env.DB) {
    const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(PIN_KEY).first()
    if (row?.value) return row.value
  }
  return env.ADMIN_PIN_HASH || null
}

// Compare-and-set against the hash the caller verified against, so two people changing
// the PIN at the same moment don't both get told it worked while only the second one's
// PIN exists. `expected` is null when no row existed (the env secret was in force).
// Returns false if someone got there first.
export async function storePinHash(db, hash, expected) {
  const now = Date.now()
  if (expected == null) {
    const r = await db
      .prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING')
      .bind(PIN_KEY, hash, now)
      .run()
    return !!r.meta?.changes
  }
  const r = await db
    .prepare('UPDATE settings SET value = ?, updated_at = ? WHERE key = ? AND value = ?')
    .bind(hash, now, PIN_KEY, expected)
    .run()
  return !!r.meta?.changes
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

// Two things here are defensive rather than stylistic:
//
// 1. `decodeURIComponent` throws URIError on a bare `%` or a truncated escape, and the
//    offending cookie need not be ours — any stray cookie on the domain would do it.
//    Unguarded, that turns every session check into a 500 for that browser until the
//    visitor clears their cookies, which also means /logout can never clear it.
// 2. First match wins, not last. A duplicate name can only reach us from a header a
//    browser was tricked into sending; taking the first keeps a shadowing copy appended
//    later from silently replacing the real session.
export const parseCookies = (header) => {
  const out = {}
  for (const part of (header || '').split(';')) {
    const c = part.trim()
    if (!c) continue
    const i = c.indexOf('=')
    const name = i === -1 ? c : c.slice(0, i)
    if (Object.hasOwn(out, name)) continue
    const raw = i === -1 ? '' : c.slice(i + 1)
    try {
      out[name] = decodeURIComponent(raw)
    } catch {
      out[name] = raw
    }
  }
  return out
}

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
  // Both are checked: with a secret but no database binding, the query below would throw
  // a TypeError and answer 500 where it should answer "not signed in".
  if (!secret || !env.DB) return null
  const raw = parseCookies(request.headers.get('Cookie'))[SESSION_COOKIE]
  const id = await readSignedCookie(secret, raw)
  if (!id) return null

  const row = await env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(id).first()
  if (!row || row.revoked_at || row.expires_at < Date.now()) return null

  // Touch last_seen_at at most hourly, and extend the expiry with it: a session that is
  // in use renews (Parth's call, 2026-09-23), so the 30 days run from the last visit
  // rather than from the first — being signed out mid-edit because you started editing 30
  // days ago is the failure this removes. Writing on every request would burn D1's
  // free-tier write budget on a value nothing needs to the second. Nothing here is load-
  // bearing for THIS request, so a failure must never cost someone a valid session.
  if (Date.now() - row.last_seen_at > 3600_000) {
    const now = Date.now()
    try {
      await env.DB.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?')
        .bind(now, now + SESSION_DAYS * 86400_000, id)
        .run()
      // Cheap enough to ride along with a write that already happens at most hourly, and
      // it is the only thing that stops `sessions` growing for the life of the project.
      await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)')
        .bind(now, now - 7 * 86400_000)
        .run()
    } catch {
      // bookkeeping only
    }
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

// The counter is incremented BY SQLITE, not in JavaScript. Reading the row, adding one
// in JS and writing the literal back is a read-modify-write across two round-trips: fire
// fifty logins in parallel and all fifty read the same value and write the same value+1,
// so the count advances by one and the lockout — which CLAUDE.md and the header of this
// file both name as the actual defence for a 6-digit PIN — never trips. Doing the
// arithmetic inside a single statement makes SQLite serialise it.
//
// `stale` below is the same rule as before: a failure long after the last one starts a
// fresh count, so an honest typo today doesn't combine with one from last week.
export async function recordFailure(db, ip) {
  const now = Date.now()
  const window = LOCK_MINUTES * 60_000
  for (const bucket of [`ip:${ip}`, 'global']) {
    // The global bucket is more tolerant — it exists to stop distributed guessing, not
    // to let one person's typo lock out the other legitimate user.
    const limit = bucket === 'global' ? MAX_FAILURES * 4 : MAX_FAILURES
    await db
      .prepare(
        `INSERT INTO login_attempts (bucket, failures, first_failed, locked_until)
         VALUES (?1, 1, ?2, CASE WHEN 1 >= ?4 THEN ?2 + ?3 ELSE NULL END)
         ON CONFLICT(bucket) DO UPDATE SET
           failures = CASE WHEN ?2 - login_attempts.first_failed > ?3
                           THEN 1 ELSE login_attempts.failures + 1 END,
           first_failed = CASE WHEN ?2 - login_attempts.first_failed > ?3
                               THEN ?2 ELSE login_attempts.first_failed END,
           locked_until = CASE WHEN (CASE WHEN ?2 - login_attempts.first_failed > ?3
                                          THEN 1 ELSE login_attempts.failures + 1 END) >= ?4
                               THEN ?2 + ?3 ELSE NULL END`,
      )
      .bind(bucket, now, window, limit)
      .run()
  }
}

// The global bucket is cleared too. Without that, failures from one person's typos
// accumulate there forever — a successful sign-in proves the person knows the PIN, and
// leaving their own contribution behind eventually locks everyone out for no reason.
export const clearFailures = (db, ip) =>
  db.prepare('DELETE FROM login_attempts WHERE bucket IN (?, ?)').bind(`ip:${ip}`, 'global').run()

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

// Clears the cookie on the way out. Without this, a revoked or expired session sits in
// the browser for the rest of its 30-day Max-Age, failing on every single request.
export const unauthorized = () =>
  json({ error: 'Not signed in.' }, { status: 401, headers: { 'Set-Cookie': clearedCookieHeader() } })

// Guard for every admin endpoint except login. Returns the session, or a Response to
// return immediately — callers must check which they got.
export async function requireSession(context) {
  const session = await getSession(context.env, context.request)
  return session || unauthorized()
}
