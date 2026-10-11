// Shared by publish.js, undo.js and status.js: turning GitHub into one commit, and the
// `publishes` rows that record it.
import { github, isBranchName, isFastForwardRefusal, isMissingObject } from './github.js'
import { json } from './auth.js'
import { label, pathFor, listChanges } from './documents.js'

const ATTEMPTS = 3

// Everything a write to GitHub needs, or a 503 saying which piece is missing.
export function publishSetup(env) {
  if (!env.GITHUB_TOKEN) return json({ error: 'Publishing isn’t set up on this deployment: GITHUB_TOKEN is missing from the Cloudflare settings.' }, { status: 503 })
  if (!isBranchName(env.PUBLISH_BRANCH)) return json({ error: 'Publishing isn’t set up on this deployment: PUBLISH_BRANCH is missing or not a branch name.' }, { status: 503 })
  return { gh: github(env), branch: env.PUBLISH_BRANCH }
}

// Build one commit on the branch's CURRENT head and move the branch to it.
//
// `plan(headSha)` looks at that head and returns either { entries, message } to commit,
// or { stop: <Response> } to give up without committing (a stale draft, nothing left to
// change). It is re-run from scratch on every attempt, because a retry means the branch
// moved: the file shas it compared against may have changed, and the tree must be rebuilt
// on the new base — a tree made on the old one would silently undo whatever was pushed.
export async function commitToBranch(gh, branch, plan) {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const head = await gh.head(branch)
    const result = await plan(head)
    if (result.stop) return { stop: result.stop }
    const base = await gh.treeOf(head)
    let tree
    try {
      tree = await gh.createTree(base, result.entries)
    } catch (err) {
      // A referenced blob GitHub no longer has (an upload that sat unpublished for long
      // enough to be garbage-collected). `repair` re-creates it from the stored copy —
      // same bytes, same sha — and the tree is tried once more.
      if (!result.repair || !isMissingObject(err)) throw err
      await result.repair()
      tree = await gh.createTree(base, result.entries)
    }
    const commit = await gh.createCommit(result.message, tree, head)
    try {
      await gh.moveBranch(branch, commit)
      return { commit, parent: head, ...result }
    } catch (err) {
      // Somebody pushed in between. The commit we made is orphaned (harmless — GitHub
      // garbage-collects it) and we start again on the new head.
      if (isFastForwardRefusal(err)) continue
      // Anything else (a timeout, a 5xx) may have arrived AFTER GitHub moved the branch.
      // Saying "nothing was published" when it was would invite a second publish, so look.
      const now = await gh.head(branch).catch(() => null)
      if (now === commit) return { commit, parent: head, ...result }
      throw err
    }
  }
  return { busy: true }
}

export const busyBranch = () =>
  json({ error: 'The site’s code was being updated at the same moment, three times in a row. Nothing was published and your changes are kept — try again in a minute.' }, { status: 409 })

export const shapePublish = (r) =>
  r && {
    id: r.id,
    kind: r.kind,
    commitSha: r.commit_sha,
    branch: r.branch,
    summary: r.summary,
    createdAt: r.created_at,
    undoneAt: r.undone_at,
  }

// Per branch. Preview and production have had separate D1 databases since step 7, so this
// filter is now belt-and-braces: it keeps "latest" honest if they are ever shared again.
export const latestPublish = (db, branch) =>
  db.prepare('SELECT * FROM publishes WHERE branch = ? ORDER BY id DESC LIMIT 1').bind(branch).first()

// Only the newest row can be undone, and only if it is a publish that hasn't been undone.
// Undoing an older one would take every later publish with it.
export const canUndo = (r) => !!r && r.kind === 'publish' && !r.undone_at

export const pendingRows = (db) => db.prepare('SELECT id, doc, base_sha, updated_at FROM drafts ORDER BY id').all().then((r) => r.results || [])

const shapePending = (r) => ({ id: r.id, updatedAt: r.updated_at, label: label(r.id, safeParse(r.doc)) })

export function safeParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// `withChanges` adds, per pending draft, the field-by-field difference from what is on
// the branch now — one GitHub read per draft, so only the GET that feeds the Publish
// confirmation asks for it. If GitHub can't be read, `changes` is null and the
// confirmation says it couldn't list them (Publish itself re-reads and re-checks).
//
// `withUndoChanges` adds `undoChanges`: what Undo would put back, read from the files at
// the publish's own commit and at the one before it. null when it can't be worked out —
// the confirmation then just doesn't list them; Undo itself re-checks every file.
export async function overview(env, { withChanges = false, withUndoChanges = false } = {}) {
  const branch = env.PUBLISH_BRANCH
  const latest = await latestPublish(env.DB, branch)
  const undoChanges = withUndoChanges && canUndo(latest) ? await changesUndoWouldMake(env, latest) : null
  const rows = await pendingRows(env.DB)
  let head = null
  if (withChanges && rows.length && env.GITHUB_TOKEN && isBranchName(branch)) {
    head = await github(env).head(branch).catch(() => null)
  }
  const pending = await Promise.all(
    rows.map(async (r) => {
      const p = shapePending(r)
      if (!withChanges) return p
      if (!head) return { ...p, changes: null }
      try {
        const file = await github(env).file(pathFor(r.id), head)
        return { ...p, changes: listChanges(r.id, safeParse(r.doc), file ? safeParse(file.text) : null) }
      } catch {
        return { ...p, changes: null }
      }
    }),
  )
  return { branch, pending, latest: shapePublish(latest), canUndo: canUndo(latest), ...(withUndoChanges ? { undoChanges } : {}) }
}

const ID_FOR_PATH = { 'content/site.json': 'site', 'content/founders.json': 'founders' }

// Field-by-field, from what the publish wrote back to what was there before it. Only the
// contact details and founder photos are listed field by field today (`listChanges`), same as the Publish
// confirmation — other documents contribute nothing rather than something misleading.
async function changesUndoWouldMake(env, row) {
  if (!row.parent_sha || !env.GITHUB_TOKEN) return null
  let files
  try {
    files = JSON.parse(row.files)
  } catch {
    return null
  }
  if (!Array.isArray(files)) return null
  try {
    const gh = github(env)
    const lists = await Promise.all(
      files.map(async (f) => {
        const id = ID_FOR_PATH[f?.path] ?? (f?.path?.startsWith('content/projects/') ? `project:${f.path.slice(17, -5)}` : null)
        if (!id) return []
        const [now, before] = await Promise.all([gh.file(f.path, row.commit_sha), gh.file(f.path, row.parent_sha)])
        return listChanges(id, before ? safeParse(before.text) : null, now ? safeParse(now.text) : null)
      }),
    )
    return lists.flat()
  } catch {
    return null
  }
}
