import { requireSession, json } from './_lib/auth.js'
import { isContentPath } from './_lib/documents.js'
import { explainGitHubError } from './_lib/github.js'
import { publishSetup, commitToBranch, busyBranch, latestPublish, canUndo, overview } from './_lib/publishes.js'

// POST /api/admin/undo → { id } — undo the most recent publish.
//
// Undo is a NEW commit that puts the files that publish touched back to exactly what they
// were before it. It is not `git revert` and never rewinds the branch: code commits pushed
// in between stay, and only the content files the publish itself wrote change back.
//
// It refuses unless each file still holds exactly what the publish wrote. If something
// has changed it since, restoring "before" would silently throw that change away too.

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

  const target = await latestPublish(db, branch)
  if (!target || target.id !== body?.id || !canUndo(target)) {
    return json({ error: 'Only the most recent publish can be undone, and this one isn’t it any more. Nothing was changed.', ...(await overview(context.env)) }, { status: 409 })
  }

  let files
  try {
    files = JSON.parse(target.files)
  } catch {
    files = null
  }
  if (!Array.isArray(files) || !files.length || !files.every((f) => isContentPath(f?.path))) {
    return json({ error: 'The record of that publish is incomplete, so it can’t be undone safely. Nothing was changed.' }, { status: 422 })
  }

  let result
  try {
    result = await commitToBranch(gh, branch, async (head) => {
      for (const f of files) {
        const current = await gh.file(f.path, head)
        if ((current?.sha ?? null) !== f.after) {
          return {
            stop: json(
              { error: `${f.path.replace(/^content\//, '')} has changed since that publish, so undoing it would also throw that change away. Nothing was changed.` },
              { status: 409 },
            ),
          }
        }
      }
      return {
        // sha: null deletes a file the publish created.
        entries: files.map((f) => ({ path: f.path, sha: f.before })),
        summary: `Undid “${target.summary}”`,
        message: `Undo publish from /admin: ${target.summary}\n\nRestores the content/ files that ${target.commit_sha.slice(0, 7)} changed to how they were before it.\nWritten by the /admin editor.`,
      }
    })
  } catch (err) {
    return json({ error: explainGitHubError(err, 'Nothing was undone.') }, { status: 502 })
  }
  if (result.busy) return busyBranch()
  if (result.stop) return result.stop

  let warning = null
  try {
    const now = Date.now()
    // Guarded on undone_at so two racing undos can't both mark it; git already refused the
    // second one's commit (the file no longer held `after`), so this is belt and braces.
    await db.prepare('UPDATE publishes SET undone_at = ? WHERE id = ? AND undone_at IS NULL').bind(now, target.id).run()
    await db
      .prepare('INSERT INTO publishes (commit_sha, branch, summary, files, parent_sha, created_at, kind) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(result.commit, branch, result.summary, JSON.stringify(files.map((f) => ({ path: f.path, before: f.after, after: f.before }))), result.parent, now, 'undo')
      .run()
  } catch {
    warning = 'Undone, but the record of it couldn’t be saved.'
  }

  const state = await overview(context.env).catch(() => ({}))
  return json({ ok: true, commitSha: result.commit, warning, ...state })
}
