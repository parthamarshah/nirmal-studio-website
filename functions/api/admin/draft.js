import { requireSession, json } from './_lib/auth.js'

// Drafts: the work-in-progress copy of one content document.
//
// A draft lives in D1, never in git. Git holds published truth; losing this database
// loses only unpublished edits and the live site does not notice. The `doc` is exactly
// the shape of the matching content/*.json file, so publishing is a copy rather than a
// translation — there is no second schema to keep in sync.
//
// GET    /api/admin/draft?id=site      → the draft, or exists:false if there isn't one
// PUT    /api/admin/draft              → save (optimistic concurrency, see below)
// DELETE /api/admin/draft              → discard, back to whatever is published

// Only these documents exist. An unchecked id would let any string become a row.
const ID = /^(site|founders|project:[a-z0-9][a-z0-9-]{0,79})$/

// D1 rows are capped, and a runaway doc would fail the write in a confusing way. The
// largest real document (a project with a full image pool) is a few tens of KB.
const MAX_BYTES = 512 * 1024

const badRequest = (error) => json({ error }, { status: 400 })

// `updated_at` doubles as the concurrency token, so it MUST strictly increase — two
// saves inside the same millisecond would otherwise share a token and a stale write
// could sneak through. MAX(now, previous + 1) guarantees it moves every time.
const nextStamp = 'MAX(?, drafts.updated_at + 1)'

const row = (db, id) => db.prepare('SELECT * FROM drafts WHERE id = ?').bind(id).first()

const shape = (r) =>
  r
    ? { exists: true, id: r.id, doc: JSON.parse(r.doc), updatedAt: r.updated_at, updatedBy: r.updated_by, baseSha: r.base_sha }
    : { exists: false }

export async function onRequestGet(context) {
  const session = await requireSession(context)
  if (session instanceof Response) return session

  const id = new URL(context.request.url).searchParams.get('id') || ''
  if (!ID.test(id)) return badRequest('Unknown document.')

  return json(shape(await row(context.env.DB, id)))
}

export async function onRequestPut(context) {
  const session = await requireSession(context)
  if (session instanceof Response) return session

  let body
  try {
    body = await context.request.json()
  } catch {
    return badRequest('Expected JSON.')
  }

  const { id, doc, ifUpdatedAt = null } = body || {}
  if (!ID.test(String(id || ''))) return badRequest('Unknown document.')
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return badRequest('A draft must be a JSON object.')

  const serialized = JSON.stringify(doc)
  if (new TextEncoder().encode(serialized).length > MAX_BYTES) {
    return json({ error: 'That document is too large to save.' }, { status: 413 })
  }

  const db = context.env.DB
  const now = Date.now()
  // Truncated so the column can say "someone else's tab" without storing a usable id.
  const by = String(session.id).slice(0, 8)

  // Both branches are a SINGLE guarded statement, so two tabs racing cannot both think
  // they won: SQLite decides, not a read-then-write in JavaScript. (Same lesson as the
  // login lockout counter — see _lib/auth.js's recordFailure.)
  const result =
    ifUpdatedAt == null
      ? // The client believes no draft exists. If one does, another tab made it.
        await db
          .prepare('INSERT INTO drafts (id, doc, base_sha, updated_at, updated_by) VALUES (?, ?, NULL, ?, ?) ON CONFLICT(id) DO NOTHING')
          .bind(id, serialized, now, by)
          .run()
      : // The client believes the draft is still at ifUpdatedAt. If it moved, somebody
        // else saved in between and this write must not silently flatten their work.
        await db
          .prepare(`UPDATE drafts SET doc = ?, updated_at = ${nextStamp}, updated_by = ? WHERE id = ? AND updated_at = ?`)
          .bind(serialized, now, by, id, ifUpdatedAt)
          .run()

  if (!result.meta?.changes) {
    // Hand back what is actually stored, so the editor can show the difference rather
    // than just refusing.
    return json({ error: 'This was changed somewhere else — in another tab, or by the other person.', current: shape(await row(db, id)) }, { status: 409 })
  }

  const saved = await row(db, id)
  return json({ ok: true, updatedAt: saved.updated_at, updatedBy: saved.updated_by })
}

export async function onRequestDelete(context) {
  const session = await requireSession(context)
  if (session instanceof Response) return session

  let body
  try {
    body = await context.request.json()
  } catch {
    return badRequest('Expected JSON.')
  }

  const { id, ifUpdatedAt = null } = body || {}
  if (!ID.test(String(id || ''))) return badRequest('Unknown document.')
  // Discarding is destructive and unrecoverable, so the version is REQUIRED — an
  // unguarded delete would throw away whatever arrived after the caller last looked.
  // A caller with no draft has nothing to discard, so there is no legitimate null case.
  if (ifUpdatedAt == null) return badRequest('Discarding needs the version you are looking at.')

  const db = context.env.DB
  const result = await db.prepare('DELETE FROM drafts WHERE id = ? AND updated_at = ?').bind(id, ifUpdatedAt).run()

  if (!result.meta?.changes) {
    return json({ error: 'This was changed somewhere else — in another tab, or by the other person.', current: shape(await row(db, id)) }, { status: 409 })
  }

  return json({ ok: true })
}
