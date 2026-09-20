import { getSession, revokeSession, clearedCookieHeader, json } from './_lib/auth.js'

// POST /api/admin/logout
//
// Revokes the session in the database as well as clearing the cookie. Clearing the
// cookie alone would leave a still-valid session that anyone holding a copy of the
// cookie could keep using — "logged out" has to mean it on the server.
export async function onRequestPost(context) {
  const session = await getSession(context.env, context.request)
  if (session) await revokeSession(context.env.DB, session.id)
  // Always succeed: logging out when already logged out is not an error worth surfacing.
  return json({ ok: true }, { headers: { 'Set-Cookie': clearedCookieHeader() } })
}
