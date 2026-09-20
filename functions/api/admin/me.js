import { getSession, json, clearedCookieHeader } from './_lib/auth.js'

// GET /api/admin/me — used by the admin app on load to decide between the login screen
// and the editor. Returns 200 with session info, or 401. Never returns anything
// sensitive: just enough to render "signed in since …".
export async function onRequestGet(context) {
  const session = await getSession(context.env, context.request)
  // Clear the cookie on the way out. A revoked or expired one would otherwise sit in the
  // browser for the rest of its 30-day Max-Age, failing on every single request.
  if (!session) return json({ signedIn: false }, { status: 401, headers: { 'Set-Cookie': clearedCookieHeader() } })
  return json({
    signedIn: true,
    since: session.created_at,
    expiresAt: session.expires_at,
    publishBranch: context.env.PUBLISH_BRANCH || 'admin-test',
  })
}
