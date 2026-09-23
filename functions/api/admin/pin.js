import {
  currentPinHash,
  storePinHash,
  hashPin,
  verifyPin,
  PinHashUnusable,
  requireSession,
  revokeAllSessions,
  checkLock,
  recordFailure,
  clearFailures,
  clientIp,
  clearedCookieHeader,
  json,
} from './_lib/auth.js'

// POST /api/admin/pin  { currentPin, newPin }
//
// Changing the PIN signs EVERYONE out, including whoever changed it. That is the point:
// the reason to change a shared PIN is that the old one may be known by someone who
// shouldn't have it, and leaving their session alive would make the change cosmetic.
//
// The current PIN is required even though the caller is already signed in — an unlocked
// laptop left open should not be enough to lock the other person out of their own site.
// That check goes through the same lockout as /login, so this endpoint cannot be used as
// an un-rate-limited oracle for guessing the PIN.
const SIX_DIGITS = /^\d{6}$/

// Rejected outright, not scored: a PIN that is one repeated digit or a straight run is
// the first thing anyone tries, and "it let me" is worse than a moment's friction.
function weak(pin) {
  if (/^(\d)\1{5}$/.test(pin)) return 'That PIN is the same digit six times — please pick something less guessable.'
  const digits = [...pin].map(Number)
  const step = digits[1] - digits[0]
  if ((step === 1 || step === -1) && digits.every((d, i) => i === 0 || d - digits[i - 1] === step)) {
    return 'That PIN runs straight up or down — please pick something less guessable.'
  }
  return null
}

export async function onRequestPost(context) {
  const { request, env } = context
  const session = await requireSession(context)
  if (session instanceof Response) return session

  const ip = clientIp(request)
  const lock = await checkLock(env.DB, ip)
  if (lock.locked) {
    const minutes = Math.max(1, Math.ceil((lock.until - Date.now()) / 60_000))
    return json({ error: `Too many incorrect PINs. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`, lockedUntil: lock.until }, { status: 429 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Expected JSON.' }, { status: 400 })
  }

  const { currentPin, newPin } = body || {}
  // Shape first, so junk never reaches PBKDF2 (deliberately slow) and never burns a
  // lockout attempt on the person's own typo about the NEW PIN.
  if (typeof newPin !== 'string' || !SIX_DIGITS.test(newPin)) {
    return json({ error: 'The new PIN has to be exactly 6 digits.' }, { status: 400 })
  }
  const tooWeak = weak(newPin)
  if (tooWeak) return json({ error: tooWeak }, { status: 400 })
  if (currentPin === newPin) {
    return json({ error: 'That is already the PIN. Pick a different one.' }, { status: 400 })
  }
  // 403, never 401, for a wrong CURRENT pin: the session is perfectly valid, and the
  // admin app treats every 401 as "your session ended" and throws you back to the login
  // screen — losing the form, and misexplaining what happened.
  if (typeof currentPin !== 'string' || !SIX_DIGITS.test(currentPin)) {
    await recordFailure(env.DB, ip)
    return json({ error: 'That current PIN is not correct.' }, { status: 403 })
  }

  let stored
  try {
    stored = await currentPinHash(env)
  } catch {
    return json({ error: 'The admin database isn’t reachable right now. Try again in a minute.' }, { status: 503 })
  }
  if (!stored) return json({ error: 'This deployment has no PIN set, so there is nothing to change.' }, { status: 503 })

  let correct
  try {
    correct = await verifyPin(currentPin, stored)
  } catch (err) {
    if (err instanceof PinHashUnusable) return json({ error: err.message }, { status: 503 })
    throw err
  }

  if (!correct) {
    await recordFailure(env.DB, ip)
    const after = await checkLock(env.DB, ip)
    if (after.locked) {
      const minutes = Math.max(1, Math.ceil((after.until - Date.now()) / 60_000))
      return json({ error: `That current PIN is not correct. Too many attempts — locked for ${minutes} minutes.`, lockedUntil: after.until }, { status: 429 })
    }
    return json({ error: 'That current PIN is not correct.' }, { status: 403 })
  }

  // Write the new PIN BEFORE revoking sessions. The other order has a window where every
  // session is dead and the old PIN is still the one that works — locked out of your own
  // site by the act of securing it.
  const hash = await hashPin(newPin)
  await storePinHash(env.DB, hash)
  await revokeAllSessions(env.DB)
  await clearFailures(env.DB, ip)

  return json({ ok: true }, { headers: { 'Set-Cookie': clearedCookieHeader() } })
}
