import { requireSession, json } from './_lib/auth.js'
import { pathFor, isContentPath, serialize, validate, describeChange, label } from './_lib/documents.js'
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
  return json(await overview(context.env, { withChanges: true }))
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

  let result
  try {
    result = await commitToBranch(gh, branch, async (head) => {
      const problems = []
      const stale = []
      const changes = []
      const summaries = []
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
        for (const p of validate(d.id, d.doc, published)) problems.push(`${label(d.id, d.doc)}: ${p}`)
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
        entries: changes,
        summary,
        message: `Publish from /admin: ${summary}\n\nWritten by the /admin editor. This commit touches only content/ files.`,
      }
    })
  } catch (err) {
    return json({ error: explainGitHubError(err) }, { status: 502 })
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
  const files = docs.filter((d) => d.after !== d.before).map((d) => ({ path: d.path, before: d.before, after: d.after }))
  let warning = null
  try {
    await db
      .prepare('INSERT INTO publishes (commit_sha, branch, summary, files, parent_sha, created_at, kind) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(result.commit, branch, result.summary, JSON.stringify(files), result.parent, now, 'publish')
      .run()
  } catch {
    warning = 'Published, but the record of it couldn’t be saved, so Undo isn’t available for this one.'
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
