import { requireSession, json } from './_lib/auth.js'
import { explainGitHubError } from './_lib/github.js'
import { publishSetup } from './_lib/publishes.js'

// GET /api/admin/status?commit=<sha> → { live: true|false, deployed }
//
// "Is this publish live yet?" is answered by LOOKING AT THE SITE, not by asking
// Cloudflare's deployment API. That is a lesson this project already paid for: the
// deployment listing called a failed build "Active" for half an hour (progress.md, "Read
// deployment status by fetching the URL"). Every build writes /_version.json with the
// commit it was built from (scripts/prerender.mjs), so the question becomes "does the
// site visitors get contain this commit?" — which is the question that matters anyway.
//
// It cannot tell "still building" from "the build failed": both look like "not yet". The
// editor says so honestly after a few minutes rather than guessing.

const SHA = /^[0-9a-f]{40}$/

// Where visitors see PUBLISH_BRANCH. Cloudflare's branch alias lower-cases the name and
// turns anything else into dashes.
export function siteFor(branch) {
  if (branch === 'main') return 'https://nirmalstudio.com'
  const alias = branch.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `https://${alias}.nirmal-studio.pages.dev`
}

export async function onRequestGet(context) {
  const session = await requireSession(context)
  if (session instanceof Response) return session

  const setup = publishSetup(context.env)
  if (setup instanceof Response) return setup
  const { gh, branch } = setup

  const commit = new URL(context.request.url).searchParams.get('commit') || ''
  if (!SHA.test(commit)) return json({ error: 'commit must be a full git sha.' }, { status: 400 })

  const site = siteFor(branch)
  let deployed = null
  try {
    // Cache-busted: the edge must not answer with the version from a minute ago.
    const res = await fetch(`${site}/_version.json?t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' }, cf: { cacheTtl: 0 } })
    if (res.ok && (res.headers.get('Content-Type') || '').includes('json')) deployed = (await res.json())?.commit ?? null
  } catch {
    // Unreachable counts as "not yet"; the next poll tries again.
  }
  if (!deployed || !SHA.test(deployed)) return json({ live: false, deployed: null, site })

  try {
    // Usually the same commit. If someone pushed code after the publish, the site may
    // already be on a LATER commit that contains it — that is live too.
    return json({ live: await gh.contains(deployed, commit), deployed, site })
  } catch (err) {
    return json({ live: false, deployed, site, error: explainGitHubError(err, '') })
  }
}
