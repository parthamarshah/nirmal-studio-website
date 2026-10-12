import { useCallback, useEffect, useRef, useState } from 'react'
import { STATUS_NAMES, SPOT_NAMES, blankProject, newSlug, spotsUsing } from '../lib/projectRules.js'
import { api, ApiError } from './api.js'
import { isParked } from './useDraft.js'
import TapsCard from './TapsCard.jsx'

// The project list: open, reorder, show/hide, new, duplicate, Trash.
//
// Each of those is an edit to one or two project files, made as their DRAFTS — exactly as
// if the project had been opened and changed — so they wait for Publish like everything
// else, show up in its confirmation, and can be discarded. Read from /api/admin/projects
// (GitHub + the drafts), never from the page's bundle, which is a build behind after a
// publish: a reorder worked out from those numbers would quietly undo the last one.

const dash = '—'

// One project's draft, changed by `fn`. Starts from the draft if there is one, else from
// what is published; if someone saved it in between, reads again and retries once.
async function editDraft(id, fn) {
  for (let attempt = 0; ; attempt++) {
    const cur = await api(`draft?id=${encodeURIComponent(id)}`)
    const base = cur.exists ? cur.doc : cur.published?.doc
    if (!base) throw new ApiError('That project couldn’t be found.', { status: 404 })
    const doc = fn(structuredClone(base))
    try {
      return await api('draft', { method: 'PUT', body: { id, doc, ifUpdatedAt: cur.exists ? cur.updatedAt : null, ...(cur.exists ? {} : { baseSha: cur.published?.sha ?? null }) } })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && attempt === 0) continue
      throw err
    }
  }
}

const eff = (p) => p.draft ?? p.published
const byOrder = (a, b) => (eff(a).order ?? 1e9) - (eff(b).order ?? 1e9) || a.slug.localeCompare(b.slug)

export default function ProjectList({ onOpen, onStateChange }) {
  const [list, setList] = useState(null)
  // The homepage as it is on the branch now (not the page's bundle, a build behind).
  const [homepage, setHomepage] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(null) // the name being typed, or null
  const [confirmTrash, setConfirmTrash] = useState(null)
  // The row being saved, and what it will show once saved — shown at once, where the tap was.
  const [pending, setPending] = useState(null) // { slug, hidden? }
  const [notice, setNotice] = useState(null) // { text, open? }
  const seq = useRef(0)
  // Set at once, so a double press (Enter twice on Create) can't start two changes.
  const busyRef = useRef(false)

  const load = useCallback(async () => {
    const n = ++seq.current
    try {
      const res = await api('projects')
      if (n === seq.current) {
        setList(res.projects)
        setHomepage(res.homepage)
        setError(null)
      }
    } catch (err) {
      if (n === seq.current) setError(err instanceof ApiError ? err.message : 'Couldn’t load the projects.')
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  // Publish waits while a change here is being saved; the top bar says so.
  useEffect(() => {
    onStateChange?.({ state: busy ? 'saving' : 'clean', hasDraft: false, problems: 0, list: true })
  }, [busy, onStateChange])

  // Every change goes through here: one at a time, then the list is read again.
  async function run(what, ids, row = null) {
    if (busyRef.current) return
    const parked = ids.find((id) => isParked(id))
    if (parked) {
      const name = list?.find((p) => `project:${p.slug}` === parked)
      setError(`${name ? eff(name).name : 'That project'} has an unsaved change waiting — open it first so it can save.`)
      return
    }
    busyRef.current = true
    setBusy(true)
    setPending(row)
    setError(null)
    setNotice(null)
    try {
      await what()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That didn’t work. Try again.')
    } finally {
      await load()
      busyRef.current = false
      setBusy(false)
      setPending(null)
    }
  }

  if (!list) {
    return error ? (
      <div className="admin-note admin-note--warn" role="alert">
        {error}{' '}
        <button type="button" className="admin-link" onClick={load}>
          Try again
        </button>
      </div>
    ) : (
      <p className="admin-hint">Loading projects…</p>
    )
  }

  const live = list.filter((p) => eff(p) && !eff(p).deleted).sort(byOrder)
  const trash = list.filter((p) => eff(p)?.deleted).sort(byOrder)
  // Taken link names: every project file and draft (Trash too) and every old link.
  const taken = new Set(list.flatMap((p) => [p.slug, ...(p.published?.previousSlugs ?? []), ...(p.draft?.previousSlugs ?? [])]))
  const nextOrder = Math.max(0, ...list.map((p) => eff(p)?.order ?? 0)) + 1

  const move = (i, d) => {
    const j = i + d
    if (j < 0 || j >= live.length) return
    const next = [...live]
    ;[next[i], next[j]] = [next[j], next[i]]
    // Renumber 1..n and write only the projects whose number actually changes (two, for a
    // normal swap). Trash keeps its numbers.
    const changes = next.map((p, k) => ({ p, order: k + 1 })).filter(({ p, order }) => eff(p).order !== order)
    run(async () => {
      for (const { p, order } of changes) await editDraft(`project:${p.slug}`, (d0) => ({ ...d0, order }))
    }, changes.map(({ p }) => `project:${p.slug}`))
  }
  const blockedBy = (slug) => spotsUsing(slug, homepage).map((x) => SPOT_NAMES[x.spot])

  return (
    <div className="admin-projects">
      <TapsCard />
      <div className="admin-projects-bar">
        {creating === null ? (
          <button type="button" className="admin-btn" disabled={busy} onClick={() => setCreating('')}>
            + New project
          </button>
        ) : (
          <form
            className="admin-new-project"
            onSubmit={(e) => {
              e.preventDefault()
              const name = creating.trim()
              if (!name) return
              const slug = newSlug(name, taken)
              run(async () => {
                await api('draft', { method: 'PUT', body: { id: `project:${slug}`, doc: blankProject(slug, name, nextOrder), ifUpdatedAt: null, baseSha: null } })
                setCreating(null)
                onOpen(slug)
              }, [])
            }}
          >
            <label htmlFor="new-project-name">Name of the new project</label>
            <input id="new-project-name" type="text" autoFocus maxLength={80} value={creating} onChange={(e) => setCreating(e.target.value)} />
            <button type="submit" className="admin-btn" disabled={busy || !creating.trim()}>
              Create
            </button>
            <button type="button" className="admin-link" onClick={() => setCreating(null)}>
              Cancel
            </button>
            {creating.trim() && <p className="admin-field-hint">Its link will be nirmalstudio.com/projects/{newSlug(creating.trim(), taken)}/ — it starts hidden.</p>}
          </form>
        )}
        {busy && <span className="admin-field-hint">Saving…</span>}
      </div>

      {error && (
        <p className="admin-note admin-note--warn" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="admin-note" role="status">
          {notice.text}{' '}
          {notice.open && (
            <button type="button" className="admin-link" onClick={() => onOpen(notice.open)}>
              Open the copy
            </button>
          )}
        </p>
      )}

      <ul className="admin-list admin-plist">
        {live.map((p, i) => {
          const e = eff(p)
          const spots = blockedBy(p.slug)
          const saving = pending?.slug === p.slug
          const shownHidden = saving && pending.hidden !== undefined ? pending.hidden : e.hidden
          // What a Publish would change about this row, said on the row itself.
          const waiting = p.published && p.draft ? (p.published.hidden !== p.draft.hidden ? (p.draft.hidden ? 'Hidden at next Publish' : 'Shown at next Publish') : null) : null
          return (
            <li key={p.slug} className={shownHidden ? 'is-hidden' : ''}>
              <div className="admin-plist-move">
                <button type="button" className="admin-icon-btn" aria-label={`Move ${e.name} up`} disabled={busy || i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" className="admin-icon-btn" aria-label={`Move ${e.name} down`} disabled={busy || i === live.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </button>
              </div>
              <button type="button" className="admin-plist-open" disabled={busy} onClick={() => onOpen(p.slug)}>
                <strong>{e.name || p.slug}</strong>
                <span className="admin-row-meta">
                  {[e.type, e.city].filter(Boolean).join(' · ') || dash} · {e.sections} section{e.sections === 1 ? '' : 's'} · {e.images} image{e.images === 1 ? '' : 's'}
                </span>
              </button>
              <span className="admin-plist-tags">
                {e.problems > 0 && <span className="admin-tag admin-tag--bad">Needs fixing</span>}
                {spots.length > 0 && (
                  <span className="admin-tag" title={`Used by ${spots.join(' and ')}, so it can’t be hidden or trashed. Change that in Settings.`}>
                    Homepage
                  </span>
                )}
                {!p.published && <span className="admin-tag">New</span>}
                {p.published && p.draft && <span className="admin-tag admin-tag--draft">Unpublished changes</span>}
                <span className="admin-tag">{STATUS_NAMES[e.status] ?? 'Status not set'}</span>
              </span>
              <label className="admin-switch admin-plist-show" title={spots.length && !e.hidden ? `Used by ${spots.join(' and ')} — change that in Settings first.` : undefined}>
                <input
                  type="checkbox"
                  checked={!shownHidden}
                  // Switching ON a project with problems would hold up every publish; fix it first.
                  disabled={busy || (!!spots.length && !e.hidden) || (e.hidden && e.problems > 0)}
                  onChange={(ev) => {
                    // Read now: the box is controlled, so by the time the save runs React
                    // has put it back to the stored value.
                    const hidden = !ev.target.checked
                    run(() => editDraft(`project:${p.slug}`, (d) => ({ ...d, hidden })), [`project:${p.slug}`], { slug: p.slug, hidden })
                  }}
                />
                <span>On site</span>
              </label>
              <span className="admin-plist-actions">
                <button
                  type="button"
                  className="admin-link"
                  disabled={busy}
                  onClick={() => {
                    const name = `Copy of ${e.name}`.slice(0, 80)
                    const slug = newSlug(`${p.slug}-copy`, taken)
                    run(async () => {
                      const res = await api('projects', { method: 'POST', body: { action: 'duplicate', from: p.slug, to: slug } })
                      const src = res.doc
                      const missing = new Set(res.missing ?? [])
                      const pool = (src.pool ?? []).filter((img) => !missing.has(img.file))
                      const ids = new Set(pool.map((img) => img.id))
                      const doc = {
                        ...src,
                        slug,
                        previousSlugs: [],
                        name,
                        order: nextOrder,
                        hidden: true,
                        deleted: false,
                        pool,
                        sections: (src.sections ?? []).map((s) => ({ ...s, images: (s.images ?? []).filter((r) => ids.has(r.image)) })),
                        cover: ids.has(src.cover?.image) ? { ...src.cover, ...(ids.has(src.cover?.phoneImage) ? {} : { phoneImage: null, phoneCrop: null }) } : { image: null, crop: null, phoneImage: null, phoneCrop: null },
                      }
                      await api('draft', { method: 'PUT', body: { id: `project:${slug}`, doc, ifUpdatedAt: null, baseSha: null } })
                      // Say so, rather than open a copy that quietly has fewer images.
                      if (missing.size) setNotice({ text: `${name} was made, but ${missing.size} image${missing.size > 1 ? 's' : ''} couldn’t be copied.`, open: slug })
                      else onOpen(slug)
                    }, [], { slug: p.slug })
                  }}
                >
                  Duplicate
                </button>
                {confirmTrash === p.slug ? (
                  <span className="admin-confirm admin-confirm--inline" role="alert">
                    Move to Trash? It leaves the site at the next Publish.
                    <button
                      type="button"
                      className="admin-btn admin-btn--small"
                      onClick={() => {
                        setConfirmTrash(null)
                        run(() => editDraft(`project:${p.slug}`, (d) => ({ ...d, deleted: true })), [`project:${p.slug}`], { slug: p.slug })
                      }}
                    >
                      Move to Trash
                    </button>
                    <button type="button" className="admin-link" onClick={() => setConfirmTrash(null)}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="admin-link admin-link--danger"
                    disabled={busy || !!spots.length}
                    title={spots.length ? `Used by ${spots.join(' and ')} — change that in Settings first.` : undefined}
                    onClick={() => setConfirmTrash(p.slug)}
                  >
                    Trash
                  </button>
                )}
              </span>
              {(saving || waiting || spots.length > 0) && (
                <p className="admin-plist-note">
                  {saving
                    ? 'Saving…'
                    : [
                        waiting,
                        e.hidden && e.problems > 0 ? 'Needs fixing before it can go on the site — open it to see what.' : null,
                        spots.length ? (
                          <span key="spots">
                            On {spots.join(' and ')} — to hide or trash it, change that in{' '}
                            <a className="admin-link" href="#/settings">
                              Settings
                            </a>{' '}
                            first.
                          </span>
                        ) : null,
                      ].filter(Boolean).reduce((acc, x, i) => (i ? [...acc, ' · ', x] : [x]), [])}
                </p>
              )}
            </li>
          )
        })}
      </ul>
      <p className="admin-hint admin-list-foot">
        Changes here wait for Publish, like any other edit. A project in Trash leaves the site when published, and can be restored.
      </p>

      {trash.length > 0 && (
        <details className="admin-trash">
          <summary>Trash ({trash.length})</summary>
          <ul className="admin-list">
            {trash.map((p) => (
              <li key={p.slug} className="admin-trash-row">
                <strong>{eff(p).name || p.slug}</strong>
                {p.draft && p.published && !p.published.deleted && <span className="admin-tag admin-tag--draft">Not published yet</span>}
                <button type="button" className="admin-link" disabled={busy} onClick={() => run(() => editDraft(`project:${p.slug}`, (d) => ({ ...d, deleted: false, order: nextOrder })), [`project:${p.slug}`])}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
