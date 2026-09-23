import {
  currentPinHash,
  verifyPin,
  PinHashUnusable,
  createSession,
  signSessionId,
  sessionCookie,
  checkLock,
  recordFailure,
  clearFailures,
  clientIp,
  json,
} from './_lib/auth.js'

// POST /api/admin/login  { pin: "123456" }
//
// Deliberately gives the same answer for "wrong PIN" and "no PIN configured": an
// attacker learning that the backend has no PIN set would know to keep trying elsewhere.
// The one thing it DOES say plainly is that you are locked out and for how long, because
// hiding that from the real user just produces a confusing dead end.
export async function onRequestPost(context) {
  const { request, env } = context
  const ip = clientIp(request)

  // The PIN in force may be a stored one (changed from /admin) rather than the secret,
  // so ask for it before deciding this deployment has no PIN at all.
  let pinHash = null
  if (env.DB) {
    try {
      pinHash = await currentPinHash(env)
    } catch {
      return json({ error: 'The admin database isn’t reachable right now, so signing in can’t be checked. Try again in a minute.' }, { status: 503 })
    }
  }

  if (!pinHash || !env.SESSION_SECRET || !env.DB) {
    // A misconfigured deployment must not silently behave like a wrong PIN — that would
    // be debugged for hours. Say so clearly; it leaks nothing an attacker can use.
    //
    // The human sentence leads and the variable names follow in brackets. Both readers
    // matter: the person who has to fix this needs the names, but the person staring at
    // the screen is an architect who has never heard of an environment variable, and on
    // an unconfigured preview this is the ONLY thing any PIN ever returns.
    return json(
      {
        error:
          'This admin isn’t set up on this deployment yet, so no PIN will work here. (Missing: ADMIN_PIN_HASH, SESSION_SECRET or the database binding.)',
      },
      { status: 503 },
    )
  }

  // Fail CLOSED when the lockout can't be read or written (Parth's call, 2026-09-23).
  // The lockout is the whole defence for a six-digit PIN; if D1 can't count failures —
  // the free tier's daily write budget is how that happens — refusing everyone for a
  // while is the lesser harm against unmetered guessing. The public site is static and
  // completely unaffected either way.
  const UNAVAILABLE = 'Signing in isn’t available for a moment — the admin database isn’t answering. The site itself is unaffected. Try again shortly.'
  let lock
  try {
    lock = await checkLock(env.DB, ip)
  } catch {
    return json({ error: UNAVAILABLE }, { status: 503 })
  }
  if (lock.locked) {
    const minutes = Math.max(1, Math.ceil((lock.until - Date.now()) / 60_000))
    return json(
      { error: `Too many incorrect PINs. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`, lockedUntil: lock.until },
      { status: 429 },
    )
  }

  let pin
  try {
    pin = (await request.json())?.pin
  } catch {
    return json({ error: 'Expected JSON.' }, { status: 400 })
  }

  // A JSON number is accepted as the same PIN: `{"pin": 123456}` is a client bug, not a
  // guess, and refusing it burned a lockout attempt on the real user. Leading zeros can't
  // survive as a number, so only a six-digit number qualifies — anything else still fails.
  if (typeof pin === 'number' && Number.isInteger(pin) && /^\d{6}$/.test(String(pin))) pin = String(pin)

  // Check the shape before hashing: PBKDF2 is intentionally slow, so making it run on
  // obvious junk is free denial-of-service. This costs nothing and is not a timing leak
  // — the format of a PIN is not a secret.
  if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
    try {
      await recordFailure(env.DB, ip)
    } catch {
      return json({ error: UNAVAILABLE }, { status: 503 })
    }
    return json({ error: 'That PIN is not correct.' }, { status: 401 })
  }

  let correct
  try {
    correct = await verifyPin(pin, pinHash)
  } catch (err) {
    // The stored hash itself is unusable — wrong format, truncated, or (the one that
    // actually happened) more PBKDF2 iterations than Cloudflare Workers will run. Say so
    // rather than recording a failure: the person typing is not the problem, and letting
    // this burn lockout attempts would lock them out of a backend that cannot work yet.
    if (err instanceof PinHashUnusable) return json({ error: err.message }, { status: 503 })
    throw err
  }

  if (!correct) {
    try {
      await recordFailure(env.DB, ip)
    } catch {
      return json({ error: UNAVAILABLE }, { status: 503 })
    }
    const after = await checkLock(env.DB, ip).catch(() => ({ locked: false }))
    if (after.locked) {
      const minutes = Math.max(1, Math.ceil((after.until - Date.now()) / 60_000))
      return json({ error: `That PIN is not correct. Too many attempts — locked for ${minutes} minutes.`, lockedUntil: after.until }, { status: 429 })
    }
    return json({ error: 'That PIN is not correct.' }, { status: 401 })
  }

  // Best-effort: a stale failure count expires on its own, and refusing a correct PIN
  // over bookkeeping would be the fail-closed rule applied where it buys nothing.
  await clearFailures(env.DB, ip).catch(() => {})
  const id = await createSession(env.DB, { userAgent: request.headers.get('User-Agent') })
  const signed = await signSessionId(env.SESSION_SECRET, id)

  return json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie(signed) } })
}
