import { requireSession, json } from './_lib/auth.js'
import { mediaDirFor, mediaKvKey as kvKey } from './_lib/documents.js'
import { explainGitHubError } from './_lib/github.js'
import { publishSetup, safeParse } from './_lib/publishes.js'
import { ID_RE, projectProblems } from '../../../src/lib/projectRules.js'

// The project list.
//
// GET  /api/admin/projects → every project file on the publish branch (Trash included),
//                            each with its waiting draft if there is one
// POST /api/admin/projects { action: 'duplicate', from, to }
//                          → makes the images of project `from` available to a new
//                            project `to`, so its draft (written by the browser next)
//                            can publish with them
//
// The list is read from GitHub, not from the admin page's bundle: right after a publish
// the bundle is a build behind, and a reorder worked out from stale numbers would undo it.

// One GitHub read per project. The free plan allows 50 outgoing requests per call; this
// stays well inside it with room for the head and folder reads.
const MAX_PROJECTS = 40

const summary = (d, homepage) =>
  d && {
    problems: projectProblems(d, { homepage }).length,
    name: d.name ?? null,
    order: typeof d.order === 'number' ? d.order : null,
    hidden: d.hidden === true,
    deleted: d.deleted === true,
    type: d.facts?.type ?? null,
    city: d.facts?.city ?? null,
    status: d.facts?.status ?? null,
    images: Array.isArray(d.pool) ? d.pool.length : 0,
    sections: Array.isArray(d.sections) ? d.sections.length : 0,
    cover: d.cover?.image ?? null,
    previousSlugs: Array.isArray(d.previousSlugs) ? d.previousSlugs : [],
  }

export async function onRequestGet(context) {
  const session = await requireSession(context)
  if (session instanceof Response) return session
  const setup = publishSetup(context.env)
  if (setup instanceof Response) return setup
  const { gh, branch } = setup
  let files
  let head
  let site
  try {
    head = await gh.head(branch)
    const dir = await gh.listDir('content/projects', head)
    const slugs = [...dir.keys()].filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
    if (slugs.length > MAX_PROJECTS) return json({ error: `There are more than ${MAX_PROJECTS} projects, which this list can’t read in one go yet.` }, { status: 503 })
    ;[files, site] = await Promise.all([
      Promise.all(slugs.map(async (slug) => ({ slug, file: await gh.file(`content/projects/${slug}.json`, head) }))),
      gh.file('content/site.json', head),
    ])
  } catch (err) {
    return json({ error: explainGitHubError(err, '') }, { status: 502 })
  }
  let rows
  try {
    rows = (await context.env.DB.prepare("SELECT id, doc, updated_at FROM drafts WHERE id LIKE 'project:%'").all()).results || []
  } catch {
    return json({ error: 'The saved drafts couldn’t be read just now. Try again in a minute.' }, { status: 503 })
  }
  const homepage = safeParse(site?.text)?.homepage
  const drafts = new Map(rows.map((r) => [r.id.slice('project:'.length), r]))
  const out = files.map(({ slug, file }) => {
    const r = drafts.get(slug)
    drafts.delete(slug)
    return { slug, published: summary(file ? safeParse(file.text) : null, homepage), draft: r ? { ...summary(safeParse(r.doc), homepage), updatedAt: r.updated_at } : null }
  })
  // Drafts with no file yet: new projects.
  for (const [slug, r] of drafts) out.push({ slug, published: null, draft: { ...summary(safeParse(r.doc), homepage), updatedAt: r.updated_at } })
  return json({ head, homepage: homepage ?? null, projects: out })
}

export async function onRequestPost(context) {
  const session = await requireSession(context)
  if (session instanceof Response) return session
  const { env } = context
  const setup = publishSetup(env)
  if (setup instanceof Response) return setup
  const { gh, branch } = setup
  let body
  try {
    body = await context.request.json()
  } catch {
    return json({ error: 'Expected JSON.' }, { status: 400 })
  }
  const { action, from, to } = body || {}
  if (action !== 'duplicate') return json({ error: 'Unknown action.' }, { status: 400 })
  if (![from, to].every((s) => typeof s === 'string' && ID_RE.test(s) && s.length <= 80) || from === to) return json({ error: 'Unknown project.' }, { status: 400 })

  // The source as the person sees it: its draft if there is one, else what is published.
  let source
  let inRepo
  try {
    const head = await gh.head(branch)
    if (await gh.file(`content/projects/${to}.json`, head)) return json({ error: 'That link name is already taken.' }, { status: 409 })
    const row = await env.DB.prepare('SELECT doc FROM drafts WHERE id = ?').bind(`project:${from}`).first()
    source = row ? safeParse(row.doc) : safeParse((await gh.file(`content/projects/${from}.json`, head))?.text)
    if (!source) return json({ error: 'The project to copy wasn’t found.' }, { status: 404 })
    inRepo = await gh.listDir(mediaDirFor(`project:${from}`), head)
  } catch (err) {
    return json({ error: explainGitHubError(err, 'Nothing was copied.') }, { status: 502 })
  }
  const taken = await env.DB.prepare('SELECT 1 FROM drafts WHERE id = ?').bind(`project:${to}`).first()
  if (taken) return json({ error: 'That link name is already taken.' }, { status: 409 })

  // Each image becomes an "upload" of the new project pointing at the SAME git blob — no
  // bytes move. Publish then places those blobs at the new folder's paths.
  const fromDir = mediaDirFor(`project:${from}`)
  const toDir = mediaDirFor(`project:${to}`)
  const names = [...new Set((source.pool ?? []).map((i) => i?.file).filter((f) => typeof f === 'string'))]
  const missing = []
  const now = Date.now()
  for (const name of names) {
    let sha = inRepo.get(name)
    if (!sha) {
      const up = await env.DB.prepare('SELECT blob_sha FROM uploads WHERE path = ?').bind(`${fromDir}/${name}`).first()
      sha = up?.blob_sha
      // A staged image's preview copy, so the new project can show it before publishing.
      const kv = env.UPLOADS ? await env.UPLOADS.get(kvKey(`${fromDir}/${name}`)) : null
      if (kv) await env.UPLOADS.put(kvKey(`${toDir}/${name}`), kv, { expirationTtl: 90 * 24 * 60 * 60, metadata: { type: 'image/jpeg' } })
    }
    if (!sha) {
      missing.push(name)
      continue
    }
    await env.DB.prepare('INSERT OR REPLACE INTO uploads (path, doc_id, blob_sha, bytes, width, height, created_at, created_by) VALUES (?, ?, ?, 0, NULL, NULL, ?, ?)')
      .bind(`${toDir}/${name}`, `project:${to}`, sha, now, String(session.id).slice(0, 8))
      .run()
  }
  return json({ ok: true, doc: source, copied: names.length - missing.length, missing })
}
