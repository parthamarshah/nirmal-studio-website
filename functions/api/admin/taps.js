import { requireSession, json } from './_lib/auth.js'

// GET /api/admin/taps → contact taps per kind, for this week and each of the 7 before it
// (weeks start on Monday, India time). See functions/api/tap.js.

const IST = 5.5 * 3600 * 1000

export async function onRequestGet(context) {
  const session = await requireSession(context)
  if (session instanceof Response) return session
  const now = new Date(Date.now() + IST)
  const dow = (now.getUTCDay() + 6) % 7 // Monday = 0
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow))
  const weekStart = (k) => new Date(monday.getTime() - k * 7 * 86400 * 1000).toISOString().slice(0, 10)
  const from = weekStart(7)
  let rows
  try {
    rows = (await context.env.DB.prepare('SELECT day, action AS kind, SUM(count) AS n FROM taps WHERE day >= ? GROUP BY day, action').bind(from).all()).results || []
  } catch {
    return json({ error: 'The counts couldn’t be read just now.' }, { status: 503 })
  }
  const weeks = Array.from({ length: 8 }, (_, k) => ({ start: weekStart(k), counts: {} }))
  for (const r of rows) {
    const w = weeks.find((x) => r.day >= x.start)
    if (w) w.counts[r.kind] = (w.counts[r.kind] ?? 0) + r.n
  }
  return json({ weeks })
}
