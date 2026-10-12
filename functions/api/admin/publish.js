import { requireSession, json } from './_lib/auth.js'
import { pathFor, isContentPath, serialize, validate, describeChange, label, referencedMedia, isMediaPath, mediaKvKey as kvKey } from './_lib/documents.js'
import { gitBlobSha, explainGitHubError } from './_lib/github.js'
import { publishSetup, commitToBranch, busyBranch, overview, pendingRows, safeParse } from './_lib/publishes.js'

// Publish: every pending draft becomes ONE commit on PUBLISH_BRANCH, touching only the
// content/ files those drafts stand for. Cloudflare builds that commit like any other, and
// the build's own content check stays the last line of defence — if it fails, the
// previous deploy keeps serving.
//
// GET  /api/admin/publish → what is waiting to be published, and the latest publish
// POST /api/admin/publish → { drafts: [{ id, updatedAt }] } — publish exactly those
//
// The request names the draft versions it means, the same guard draft.js uses. Publish
// is the most expensive double-click in the app, and "publish what I was looking at"
// must not quietly become "publish whatever the other person saved a second ago".

export async function onRequestGet(context) {
  const session = await requireSession(context)
  if (session instanceof Response) return session
  // ?undo=1 is the Undo confirmation asking what it would put back.
  const withUndoChanges = new URL(context.request.url).searchParams.get('undo') === '1'
  return json(await overview(context.env, { withChanges: true, withUndoChanges }))
}

export async function onRequestPost(context) {
  const session = await requireSession(context)
  if (session instanceof Response) return session

  const setup = publishSetup(context.env)
  if (setup instanceof Response) return setup
  const { gh, branch } = setup
  const db = context.env.DB

  let body
  try {
    body = await context.request.json()
  } catch {
    return json({ error: 'Expected JSON.' }, { status: 400 })
  }
  const wanted = Array.isArray(body?.drafts) ? body.drafts : null
  if (!wanted || !wanted.length) return json({ error: 'Nothing to publish.' }, { status: 400 })

  const rows = await pendingRows(db)
  const matches =
    rows.length === wanted.length && rows.every((r) => wanted.some((w) => w?.id === r.id && w?.updatedAt === r.updated_at))
  if (!matches) {
    return json(
      { error: 'The changes waiting to be published have changed since you looked — another tab, or the other person. Nothing was published; check them and try again.', ...(await overview(context.env)) },
      { status: 409 },
    )
  }

  const docs = []
  for (const r of rows) {
    const doc = safeParse(r.doc)
    const path = pathFor(r.id)
    if (!doc || !path || !isContentPath(path)) return json({ error: `${r.id} can’t be published — it isn’t a content file this editor knows.` }, { status: 422 })
    const text = serialize(doc)
    docs.push({ id: r.id, row: r, doc, path, text, after: await gitBlobSha(text) })
  }

  // Images the drafts point at that were uploaded from here and are waiting. Read once:
  // whether each is already in the repo is decided per attempt below, against that head.
  const wantedMedia = [...new Set(docs.flatMap((d) => referencedMedia(d.id, d.doc)))]
  const staged = new Map()
  if (wantedMedia.length) {
    try {
      // D1 allows 100 bound values per statement; a project's image pool can exceed that.
      for (let i = 0; i < wantedMedia.length; i += 90) {
        const part = wantedMedia.slice(i, i + 90)
        const res = await db.prepare(`SELECT path, doc_id, blob_sha FROM uploads WHERE path IN (${part.map(() => '?').join(',')})`).bind(...part).all()
        for (const r of res.results || []) staged.set(r.path, r)
      }
    } catch {
      return json({ error: 'The list of uploaded images couldn’t be read just now. Nothing was published; try again in a minute.', retry: true }, { status: 503 })
    }
  }

  let media = []
  let result
  try {
    result = await commitToBranch(gh, branch, async (head) => {
      const problems = []
      const stale = []
      const changes = []
      const summaries = []
      media = []
      const dirs = new Map()
      const inRepo = async (path) => {
        const dir = path.slice(0, path.lastIndexOf('/'))
        if (!dirs.has(dir)) dirs.set(dir, await gh.listDir(dir, head))
        return dirs.get(dir).has(path.slice(dir.length + 1))
      }
      // A project's images are used by the homepage (site.json), so a project is checked
      // against site.json as this commit would leave it.
      let site = docs.find((d) => d.id === 'site')?.doc ?? null
      if (!site && docs.some((d) => d.id.startsWith('project:'))) {
        const f = await gh.file('content/site.json', head)
        site = f ? safeParse(f.text) : null
      }
      for (const d of docs) {
        const current = await gh.file(d.path, head)
        d.before = current?.sha ?? null
        const published = current ? safeParse(current.text) : null
        // Checked FIRST, whatever the base says: a draft whose bytes already equal the
        // file is a no-op. That is exactly the state after a publish whose commit landed
        // but whose clean-up didn't (a D1 failure, a dropped connection) — its base is the
        // old file, so checking staleness first would refuse it forever.
        if (d.after === d.before) continue
        // The draft was started from one version of this file, and the file now holds
        // another — an Undo, a hand edit, or a publish of an older copy of this draft.
        // Publishing would quietly throw that change away, so stop and say so instead.
        // A NULL base only matches a file that didn't exist; a draft with no recorded
        // base on an existing file can't be checked, so it is refused rather than trusted.
        if ((d.row.base_sha ?? null) !== d.before) {
          stale.push(label(d.id, d.doc))
          continue
        }
        for (const p of validate(d.id, d.doc, published, { site })) problems.push(`${label(d.id, d.doc)}: ${p}`)
        // Every image the document points at must be in the repo already, or uploaded for
        // THIS document and committed alongside it. Anything else would reach a build that
        // can't find the file — and a failed build freezes the live site until it's fixed.
        for (const path of referencedMedia(d.id, d.doc)) {
          if (await inRepo(path)) continue
          const up = staged.get(path)
          const name = path.slice(path.lastIndexOf('/') + 1)
          if (!up || up.doc_id !== d.id || !isMediaPath(path)) problems.push(`${label(d.id, d.doc)}: the image “${name}” isn’t uploaded any more. Remove it and add it again.`)
          else if (!media.some((m) => m.path === path)) media.push({ path, sha: up.blob_sha })
        }
        changes.push({ path: d.path, content: d.text })
        summaries.push(describeChange(d.id, d.doc, published))
      }
      if (stale.length) {
        return {
          stop: json(
            { error: `${stale.join(', ')} changed on the site after this draft was started (an Undo, perhaps). Nothing was published. Discard the draft to start again from what is live now.`, stale, ...(await overview(context.env)) },
            { status: 409 },
          ),
        }
      }
      if (problems.length) {
        return { stop: json({ error: 'Some things need fixing before this can be published. Your changes are kept.', problems }, { status: 422 }) }
      }
      if (!changes.length) return { stop: 'unchanged' }
      const summary = summaries.join('; ')
      return {
        entries: [...changes, ...media],
        // An upload's blob may have been garbage-collected by GitHub if it sat unpublished
        // for a long time. The KV copy re-creates it — same bytes, so the same sha.
        repair: () => recreateBlobs(gh, context.env, media),
        summary,
        message: `Publish from /admin: ${summary}\n\nWritten by the /admin editor. This commit touches only content/ files.`,
      }
    })
  } catch (err) {
    return json({ error: err?.plain ? `${err.message} Nothing was published.` : explainGitHubError(err) }, { status: 502 })
  }

  if (result.busy) return busyBranch()

  // Every draft already matches what is published — a repeat click, or a publish whose
  // commit landed but whose clean-up below didn't. Clearing the drafts is then correct:
  // there is nothing in them that isn't already on the branch.
  if (result.stop === 'unchanged') {
    await clearDrafts(db, docs)
    return json({ ok: true, unchanged: true, ...(await overview(context.env)) })
  }
  // The request itself may have been cut short after GitHub applied it; that case is
  // handled in commitToBranch, which re-reads the branch before calling it a failure.
  if (result.stop) return result.stop

  // The commit is on the branch now, so the publish HAS happened; everything below is
  // bookkeeping. Order matters: the row first, then the drafts — if the drafts went first
  // and the row failed, Undo would have nothing to work from.
  const now = Date.now()
  const files = [
    ...docs.filter((d) => d.after !== d.before).map((d) => ({ path: d.path, before: d.before, after: d.after })),
    // Added by this publish, so Undo removes them (before: null deletes).
    ...media.map((m) => ({ path: m.path, before: null, after: m.sha })),
  ]
  let warning = null
  // Two identical publishes fired within the same second (a double-click) build
  // byte-identical commits — same tree, parent, message and timestamp — so they share
  // one sha, and the second ref update is a no-op that also "succeeds". Exactly one
  // commit landed; the conditional insert makes exactly one request own it. The other
  // answers as a repeat, so the history gets one row and the UI one confirmation.
  let recorded = true
  try {
    const res = await db
      .prepare(
        'INSERT INTO publishes (commit_sha, branch, summary, files, parent_sha, created_at, kind) ' +
          'SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM publishes WHERE commit_sha = ? AND branch = ?)',
      )
      .bind(result.commit, branch, result.summary, JSON.stringify(files), result.parent, now, 'publish', result.commit, branch)
      .run()
    recorded = Boolean(res.meta?.changes)
  } catch {
    warning = 'Published, but the record of it couldn’t be saved, so Undo isn’t available for this one.'
  }
  if (!recorded) {
    await clearDrafts(db, docs).catch(() => {})
    const state = await overview(context.env).catch(() => ({}))
    return json({ ok: true, unchanged: true, ...state })
  }
  try {
    await clearDrafts(db, docs)
  } catch {
    // Harmless: the next Publish finds the draft identical to the file and clears it.
    warning = warning || 'Published. The draft may still show as unpublished for a moment — publishing again just clears it.'
  }

  // Tolerant for the same reason: the publish succeeded, so a D1 hiccup here must not
  // turn into an error screen that makes someone publish twice.
  const state = await overview(context.env).catch(() => ({}))
  return json({ ok: true, commitSha: result.commit, warning, ...state })
}

// A draft is removed only if it is still the version that was published. If someone kept
// typing while the commit was being made, their draft survives — and since it was built
// on top of what just went out, its base moves to the new file.
async function clearDrafts(db, docs) {
  for (const d of docs) {
    const res = await db.prepare('DELETE FROM drafts WHERE id = ? AND updated_at = ?').bind(d.id, d.row.updated_at).run()
    if (!res.meta?.changes) await db.prepare('UPDATE drafts SET base_sha = ? WHERE id = ?').bind(d.after, d.id).run()
  }
}

async function recreateBlobs(gh, env, media) {
  for (const m of media) {
    const data = env.UPLOADS ? await env.UPLOADS.get(kvKey(m.path)) : null
    if (!data) throw Object.assign(new Error(`The uploaded image ${m.path.slice(m.path.lastIndexOf('/') + 1)} has expired. Remove it and add it again.`), { plain: true })
    const sha = await gh.createBlob(data)
    if (sha !== m.sha) throw Object.assign(new Error('An uploaded image came back different from how it was uploaded. Remove it and add it again.'), { plain: true })
  }
}
