import { getSession, json } from './_lib/auth.js'

// GET /api/admin/me — used by the admin app on load to decide between the login screen
// and the editor. Returns 200 with session info, or 401. Never returns anything
// sensitive: just enough to render "signed in since …".
export async function onRequestGet(context) {
  const session = await getSession(context.env, context.request)
  if (!session) return json({ signedIn: false }, { status: 401 })
  return json({
    signedIn: true,
    since: session.created_at,
    expiresAt: session.expires_at,
    publishBranch: context.env.PUBLISH_BRANCH || 'admin-test',
  })
}
