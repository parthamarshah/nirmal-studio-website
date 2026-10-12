// POST /api/tap { kind } — counts one tap on a way to get in touch. Public (no
// session): the site sends it with navigator.sendBeacon from src/lib/tap.js.
//
// It never fails the visitor: whatever happens it answers 204 straight away, and the
// count is written after (waitUntil). Counts only — see migrations/0005_taps.sql.

const KINDS = new Set(['whatsapp', 'call', 'email', 'map', 'social', 'talk'])
// Per visitor per day. A real person taps a handful of times; past this it's a script.
const PER_DAY = 30
const done = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })

// India time, so a day means the studio's day.
const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)

async function count(env, request, kind) {
  const db = env.DB
  // Without the secret the hash below could be reversed to an address: don't count at all.
  if (!db || !env.SESSION_SECRET) return
  const day = today()
  // An IPv6 visitor controls a whole /64, so that block — not one address — is the visitor.
  const rawIp = request.headers.get('CF-Connecting-IP') || ''
  const ip = rawIp.includes(':') ? rawIp.split(':').slice(0, 4).join(':') : rawIp
  const raw = new TextEncoder().encode(`${ip}|${day}|${env.SESSION_SECRET}`)
  const bucket = [...new Uint8Array(await crypto.subtle.digest('SHA-256', raw))].map((b) => b.toString(16).padStart(2, '0')).join('')
  // One statement claims a slot; a visitor at the limit gets no row back and isn't counted.
  const slot = await db
    .prepare('INSERT INTO tap_limits (bucket, day, n) VALUES (?, ?, 1) ON CONFLICT(bucket) DO UPDATE SET n = n + 1 WHERE n < ? RETURNING n')
    .bind(bucket, day, PER_DAY)
    .first()
  if (!slot) return
  await db.batch([
    // `taps` is from migrations/0001 (day, action, count).
    db.prepare('INSERT INTO taps (day, action, count) VALUES (?, ?, 1) ON CONFLICT(day, action) DO UPDATE SET count = count + 1').bind(day, kind),
    // Housekeeping: limits older than two days are no longer needed.
    db.prepare('DELETE FROM tap_limits WHERE day < ?').bind(new Date(Date.now() + 5.5 * 3600 * 1000 - 2 * 86400 * 1000).toISOString().slice(0, 10)),
  ])
}

export async function onRequestPost(context) {
  const { request, env } = context
  // Only from the site's own pages: a browser always says where a beacon came from.
  const origin = request.headers.get('Origin')
  if (origin !== new URL(request.url).origin) return done()
  let body
  try {
    body = JSON.parse(await request.text())
  } catch {
    return done()
  }
  const kind = body?.kind
  if (!KINDS.has(kind)) return done()
  // Never the visitor's problem, but visible in the server log if counting breaks.
  context.waitUntil(count(env, request, kind).catch((err) => console.error('tap count failed:', err?.message)))
  return done()
}
