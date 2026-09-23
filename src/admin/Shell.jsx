import { useCallback, useEffect, useRef, useState } from 'react'
import { logout, ApiError } from './api.js'
import { people, foundersReady, projectsIncludingHidden, STATUS_LABELS } from '../lib/content.js'
import SettingsEditor from './SettingsEditor.jsx'
import { usePublish } from './usePublish.js'
import { discardLeftUnsaved, hasLeftUnsaved, isSaveInFlight, useDraftActivity } from './useDraft.js'

// The desktop-first shell: left rail, top bar with state and Publish, main pane, right
// inspector. Phase 3 builds the real editors into these panes.
//
// What it shows right now is the PUBLISHED content, read-only, through the same adapter
// the site uses. That is deliberate: a shell full of placeholder rows tells you nothing
// about whether the layout works at the real density (9 projects, 4 founders, the actual
// name lengths). Step 5 swaps the source from published content to the D1 draft; the
// layout being judged now is the layout that survives.
const SECTIONS = [
  { id: 'projects', label: 'Projects' },
  { id: 'founders', label: 'Founders' },
  { id: 'settings', label: 'Settings' },
]

const dash = '—'

// Which pane edits a draft, and what to call it, for the "you left an unsaved change"
// notice. Project and founder drafts join when their editors exist.
// The label is the one on the rail button and the heading, so the notice names something
// the person can actually see and click.
const DRAFT_PANES = { site: { section: 'settings', label: 'Settings' } }
// A parked edit whose pane isn't listed above would otherwise hold Publish back with
// nothing on screen to explain it. Project and founder drafts land in their own panes, so
// the fallback sends people to the right one rather than to a button that does nothing.
const paneFor = (id) => ({
  id,
  ...(DRAFT_PANES[id] ?? {
    section: id.startsWith('project:') ? 'projects' : id.startsWith('founder') ? 'founders' : 'settings',
    label: 'an editor',
  }),
})

// One line, in one place. Projects and Founders are still read-only; Settings is the
// first pane with a real draft behind it.
function stateLine(section, draft, holdingPublish) {
  // Whatever else is true, the reason Publish is greyed out comes first: the button's
  // explanation lives in this line and nowhere else (never a tooltip). It names every
  // parked pane, including the one you are looking at — being on that pane is not an
  // explanation by itself, and a flush with nowhere to report counts too.
  if (holdingPublish) return holdingPublish
  if (section !== 'settings') return 'Read-only for now. Editing arrives with the project and founder editors.'
  if (!draft) return 'Loading…'
  switch (draft.state) {
    case 'loading':
      return 'Loading…'
    case 'saving':
      return 'Saving…'
    case 'dirty':
      return 'Unsaved changes…'
    case 'conflict':
      return 'Changed somewhere else — choose which version to keep.'
    case 'error':
      // `hasDraft` is false before anything has ever saved; `problems` is null while the
      // editor has no document to count in — i.e. the load failed and the fields aren't
      // there. Claiming "still on screen" then is the one thing that reads as work lost.
      return draft.problems === null ? 'Couldn’t open this pane. Nothing you typed has been thrown away.' : 'Couldn’t save. Your changes are still on screen.'
    default:
      if (!draft.hasDraft) return 'No changes yet'
      return draft.problems ? 'Saved as a draft · fix the highlighted fields to publish' : 'Saved as a draft · not on the site until you publish'
  }
}

// Which pane is open lives in the URL, not in component state. On a phone the system
// Back gesture would otherwise leave the admin entirely instead of going back a pane,
// and a reload would always land on Projects. It matters more in Phase 3, where a
// selected project and a selected image each become a state someone will instinctively
// back out of — and three of the incidents in CLAUDE.md are back-button bugs that came
// from grafting history onto components that already had their own state.
const sectionFromHash = () => {
  const id = (window.location.hash || '').replace(/^#\/?/, '')
  return SECTIONS.some((s) => s.id === id) ? id : 'projects'
}

export default function Shell({ session, onSignedOut }) {
  const [section, setSection] = useState(sectionFromHash)
  const [signingOut, setSigningOut] = useState(false)
  // Which parked edit the "Discard it" confirmation is for, if any.
  const [discarding, setDiscarding] = useState(null)
  // Declared here, above every effect whose dependency array names it: a `const` read by
  // an earlier effect's deps throws "cannot access before initialization" on every render
  // (CLAUDE.md's incident list — it white-screened the whole site once).
  const { parked, flushing } = useDraftActivity()
  const [error, setError] = useState(null)
  // Reported up by whichever pane owns a draft, so the top bar can show one save state
  // for the whole screen rather than each editor growing its own.
  const [draft, setDraft] = useState(null)

  useEffect(() => {
    // The editor that reported `draft` unmounts on a pane change; its last report would
    // otherwise keep holding Publish back (or letting it through) from a pane that is gone.
    const onHashChange = () => {
      setSection(sectionFromHash())
      setDraft(null)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const go = useCallback((id) => {
    window.location.hash = `#/${id}`
  }, [])

  // Stable identity: SettingsEditor reports through an effect that depends on this.
  const onDraftState = useCallback((s) => setDraft(s), [])

  // A confirmation left open for an edit that has since been saved (or discarded another
  // way) would reappear against the NEXT parked edit, one click from destroying it.
  useEffect(() => {
    setDiscarding((d) => (d && parked.includes(d.id) ? d : null))
  }, [parked])

  // Bumped after a publish or an undo: the editor remounts and reloads, because its
  // draft is gone (or its published version just changed) on the server.
  const [editorKey, setEditorKey] = useState(0)
  const onContentChanged = useCallback(() => setEditorKey((k) => k + 1), [])
  // Read through a ref so usePublish checks the state at click time.
  const draftRef = useRef(null)
  draftRef.current = draft
  const isEditorBusy = useCallback(() => {
    // An edit parked by a closed editor counts too: publishing now would publish the
    // version without it, and reopening would then show it as a conflict. So does a save
    // flushed by an editor that has already unmounted — for that moment nothing is parked
    // yet and no editor reports a state, and publishing inside it would commit the
    // version from before the last keystrokes.
    if (hasLeftUnsaved() || isSaveInFlight()) return true
    const d = draftRef.current
    return !!d && ['loading', 'dirty', 'saving', 'conflict', 'error'].includes(d.state)
  }, [])
  const pub = usePublish({ onContentChanged, isEditorBusy })
  const { refresh } = pub

  // What's waiting to be published changes whenever a save lands or a draft is
  // discarded, so re-ask then rather than on a timer.
  const settled = draft && (draft.state === 'clean' || draft.state === 'saved')
  useEffect(() => {
    if (settled) refresh()
  }, [settled, draft?.hasDraft, refresh])

  async function signOut() {
    if (signingOut) return
    // Signing out drops every parked edit with it, so say so rather than discovering it
    // after the fact — the whole point of parking is that nothing disappears silently.
    if (hasLeftUnsaved()) {
      setError('There’s an unsaved change waiting — the bar at the top of the screen can save or discard it. Signing out would throw it away.')
      return
    }
    setSigningOut(true)
    setError(null)
    try {
      await logout()
      onSignedOut()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign out.')
      setSigningOut(false)
    }
  }

  const counts = { projects: projectsIncludingHidden.length, founders: people.length, settings: null }
  const current = SECTIONS.find((s) => s.id === section)
  const live = session.publishBranch === 'main'
  const pending = pub.overview?.pending ?? []
  const editorBusy = isEditorBusy()
  // The strip appears for every parked edit, on whatever pane you are on: a parked edit
  // can appear while its own pane is open (a save that lands after the editor reloaded, or
  // a pane that won't load), and then there is nothing else on screen to explain it.
  const unsavedPanes = parked.map(paneFor)
  const holdingPublish = unsavedPanes.length
    ? `Can’t publish yet — a change in ${unsavedPanes.map((p) => p.label).join(' and ')} still needs saving.`
    : flushing
      ? 'Can’t publish yet — a change is still being saved.'
      : null
  // While a publish or undo is being confirmed or sent, the fields are locked: an edit
  // typed then would be lost when the editor reloads with the published version.
  const locked = ['publishing', 'undoing', 'confirm-publish', 'confirm-undo'].includes(pub.phase)
  const sending = pub.phase === 'publishing' || pub.phase === 'undoing'
  // Not disabled while the confirmation is open — a button that greys out the instant
  // it's pressed reads as broken, and drops keyboard focus. Pressing it again is a no-op.
  const canPublish = pending.length > 0 && !editorBusy && !draft?.problems && !sending && pub.phase !== 'confirm-undo'

  return (
    <div className="admin-app">
      <nav className="admin-rail" aria-label="Sections">
        <div className="admin-wordmark">
          <b>nirmal</b> <span>studio</span>
        </div>

        <div className="admin-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(s.id)}
              aria-current={s.id === section ? 'page' : undefined}
            >
              {s.label}
              {counts[s.id] != null && <span className="admin-nav-count">{counts[s.id]}</span>}
            </button>
          ))}
        </div>

        <div className="admin-rail-foot">
          {/* "Publishing to admin-test" was git jargon for the two people who use this,
              and it was hidden on phone — which is where "your changes are NOT going to
              the real site" matters most. Stated as a condition instead, and kept
              visible at every width. */}
          <p className="admin-where">
            {live
              ? 'Changes here go to the live site, nirmalstudio.com.'
              : 'Changes here go to a test copy of the site, not nirmalstudio.com.'}
          </p>
          <button className="admin-signout" type="button" onClick={signOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </nav>

      <div className="admin-col">
        <header className="admin-top">
          <h1>{current.label}</h1>
          {/* One honest sentence. The previous "No unpublished changes" read as though a
              draft system had checked and found nothing pending — there is no draft
              system yet, so it asserted something untrue in the first place the eye
              lands. It also carries the explanation for the disabled Publish button,
              which used to exist only in a `title` tooltip: invisible on touch,
              invisible to a keyboard, and usually suppressed on a disabled element. */}
          <p className="admin-state">{stateLine(section, draft, holdingPublish)}</p>
          {/* Disabled while there is nothing to publish, while a save is in flight (it
              would publish the version before the last keystrokes), or while a field is
              invalid. The line to the left always says which — never a tooltip. */}
          <button
            className="admin-publish"
            type="button"
            disabled={!canPublish}
            aria-expanded={pub.phase === 'confirm-publish'}
            onClick={() => pub.phase !== 'confirm-publish' && pub.askPublish()}
          >
            {pub.phase === 'publishing' ? 'Publishing…' : 'Publish'}
          </button>
        </header>

        <PublishBar pub={pub} pending={pending} live={live} editorBusy={editorBusy} />

        {unsavedPanes.map((pane) => (
          <div className="admin-pubbar admin-pubbar--unsaved" role="alert" key={pane.id}>
            <p>
              Your unsaved change to <strong>{pane.label}</strong> didn’t finish saving.{' '}
              {pane.section === section
                ? 'Nothing is lost — it’s still held in this tab, and it comes back when this pane reloads.'
                : `Nothing is lost — it’s still held in this tab. Open ${pane.label} to save it.`}{' '}
              Publishing is paused until then.
            </p>
            <div className="admin-pubbar-actions">
              {pane.section !== section && (
                <button type="button" className="admin-btn" onClick={() => go(pane.section)}>
                  Open {pane.label}
                </button>
              )}
              {/* Without this there is no way out of a parked edit that cannot be saved —
                  e.g. its pane won't load — and Publish stays held for the whole session. */}
              <button
                type="button"
                className="admin-btn admin-btn--quiet"
                onClick={() => setDiscarding(pane)}
              >
                Discard it
              </button>
            </div>
          </div>
        ))}

        {/* Gone if that edit got saved (or discarded) in another way meanwhile, and hidden
            on the pane that owns it — there the editor's own controls are the right place. */}
        {discarding && parked.includes(discarding.id) && (
          <div className="admin-pubbar admin-pubbar--unsaved" role="alert">
            <p>
              Throw away your unsaved change to <strong>{discarding.label}</strong>? What was already
              saved or published stays as it is. This can’t be undone.
            </p>
            <div className="admin-pubbar-actions">
              <button
                type="button"
                className="admin-btn"
                onClick={() => {
                  discardLeftUnsaved(discarding.id)
                  setDiscarding(null)
                }}
              >
                Yes, throw it away
              </button>
              <button type="button" className="admin-btn admin-btn--quiet" onClick={() => setDiscarding(null)}>
                Keep it
              </button>
            </div>
          </div>
        )}

        <div className="admin-panes">
          <main className="admin-main">
            {section === 'projects' && <Projects />}
            {section === 'founders' && <Founders />}
            {section === 'settings' && <SettingsEditor key={editorKey} onStateChange={onDraftState} locked={locked} live={live} />}
          </main>

          <aside className="admin-inspector" aria-label="Inspector">
            <p className="admin-eyebrow">Inspector</p>
            <p className="admin-hint">
              Nothing to show yet. Once the editors are built, selecting a project, an image or a
              founder will show its settings here — framing, type, caption, word counts, and where
              an image is used.
            </p>
          </aside>
        </div>
      </div>
    </div>
  )
}

function Projects() {
  return (
    <>
      <ul className="admin-list">
        {projectsIncludingHidden.map((p) => (
          <li key={p.slug}>
            <div className="admin-row">
              <strong>{p.name}</strong>
              <span className="admin-row-meta">
                {[p.facts.type, p.facts.city].filter(Boolean).join(' · ') || dash}
                {' · '}
                {p.sections.length} section{p.sections.length === 1 ? '' : 's'}
                {' · '}
                {p.pool.length} image{p.pool.length === 1 ? '' : 's'}
              </span>
              <span className="admin-tag">
                {p.hidden ? 'Hidden' : STATUS_LABELS[p.facts.status] || 'Status not set'}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="admin-note">
        Reordering, hiding, duplicating and the project editor itself come next.
      </p>
    </>
  )
}

function Founders() {
  return (
    <>
      <ul className="admin-list">
        {people.map((p) => {
          const missing = [!p.photo?.media && 'photo', !p.bio?.trim() && 'bio'].filter(Boolean)
          return (
            <li key={p.id}>
              <div className="admin-row">
                <strong>{p.name}</strong>
                <span className="admin-row-meta">{p.role || dash}</span>
                <span className="admin-tag">{missing.length ? `Needs ${missing.join(' + ')}` : 'Ready'}</span>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="admin-note">
        {foundersReady
          ? 'All four are complete, so the founders section is live on the site.'
          : 'The founders section stays off the site until every person has both a photo and a bio. That is deliberate — the site never shows placeholder people.'}
      </p>
    </>
  )
}


const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

const shown = (v) => (v == null || v === '' ? '(empty)' : `“${v}”`)
const cap = (s) => s[0].toUpperCase() + s.slice(1)

// The strip under the top bar: confirm → publishing → rebuilding → live, and Undo.
// One strip rather than a modal, so the details being published stay visible while
// deciding.
function PublishBar({ pub, pending, live, editorBusy }) {
  const { phase, overview, message, notice, problems, site, statusError } = pub
  const where = live ? 'nirmalstudio.com' : 'the test copy of the site'
  const latest = overview?.latest
  const what = pending.map((p) => p.label).join(', ')
  const wasUndo = latest?.kind === 'undo'
  const confirming = phase === 'confirm-publish' || phase === 'confirm-undo'

  // "3 min ago" is worked out at render; tick once a minute so it doesn't sit at
  // "just now" for an hour.
  const [, setNow] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  // Focus the primary action when a confirmation opens, and let Escape back out.
  const primaryRef = useRef(null)
  const { cancel } = pub
  // Re-run when "Checking…" turns into "Publish now": a disabled button can't hold focus.
  const ready = pub.confirmReady
  useEffect(() => {
    if (!confirming) return
    primaryRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirming, cancel, ready])

  const view = site && (
    <a className="admin-link admin-pubbar-view" href={site} target="_blank" rel="noreferrer">
      View it
    </a>
  )

  // Offered while rebuilding too — if the build is stuck or failed, undoing is exactly
  // what someone would reach for. Not while an edit is unsaved: the editor reloads after
  // an undo, and the edit would go with it.
  const undoBtn = overview?.canUndo && !editorBusy && (
    <button type="button" className="admin-btn admin-btn--quiet" onClick={pub.askUndo}>
      Undo this publish
    </button>
  )
  const actions = (...btns) => (btns.some(Boolean) ? <div className="admin-pubbar-actions">{btns}</div> : null)

  let body = null
  let tone = ''
  if (phase === 'confirm-publish') {
    tone = 'ask'
    const changes = pending.flatMap((p) => p.changes ?? [])
    const unknown = pending.some((p) => p.changes === null)
    body = (
      <>
        <div>
          <p>
            Publish <strong>{what || 'these changes'}</strong> to {where}?
            {live ? ' Visitors will see it within a couple of minutes.' : ''}
          </p>
          {changes.length > 0 && (
            <ul className="admin-pubbar-changes">
              {changes.map((c) => (
                <li key={c.field}>
                  <strong>{cap(c.field)}:</strong> {shown(c.from)} → {shown(c.to)}
                </li>
              ))}
            </ul>
          )}
          {unknown && <p className="admin-pubbar-sub">Couldn’t list the individual changes just now — publishing still checks everything.</p>}
        </div>
        {actions(
          <button key="go" ref={primaryRef} type="button" className="admin-btn" onClick={pub.publish} disabled={!pub.confirmReady}>
            {pub.confirmReady ? 'Publish now' : 'Checking…'}
          </button>,
          <button key="no" type="button" className="admin-btn admin-btn--quiet" onClick={pub.cancel}>
            Cancel
          </button>,
        )}
      </>
    )
  } else if (phase === 'confirm-undo' && latest) {
    tone = 'ask'
    body = (
      <>
        <p>
          Undo <strong>{latest.summary}</strong>? {cap(where)} goes back to how it was before that publish.
        </p>
        {actions(
          <button key="go" ref={primaryRef} type="button" className="admin-btn admin-btn--danger" onClick={pub.undo}>
            Yes, undo it
          </button>,
          <button key="no" type="button" className="admin-btn admin-btn--quiet" onClick={pub.cancel}>
            Keep it
          </button>,
        )}
      </>
    )
  } else if (phase === 'publishing' || phase === 'undoing') {
    body = <p>{phase === 'undoing' ? 'Undoing…' : 'Publishing…'} Keep this tab open for a few seconds.</p>
  } else if (phase === 'waiting') {
    body = (
      <>
        <p>
          {wasUndo ? 'Undone.' : 'Published.'} {cap(where)} is rebuilding — usually a minute or two. This updates by itself.
        </p>
        {actions(undoBtn)}
      </>
    )
  } else if (phase === 'slow' || phase === 'stopped') {
    tone = 'warn'
    body = (
      <>
        <p>
          {phase === 'slow'
            ? 'Still not showing after five minutes. The build may have failed — if so, the site keeps showing the previous version, so nothing is broken. Still checking.'
            : 'Stopped checking after 20 minutes — it probably didn’t build. The site is still showing the previous version, so nothing is broken. If this keeps happening, tell Parth.'}
        </p>
        {actions(
          phase === 'stopped' && (
            <button key="again" type="button" className="admin-btn admin-btn--quiet" onClick={pub.checkAgain}>
              Check again
            </button>
          ),
          undoBtn,
        )}
      </>
    )
  } else if (phase === 'live' && latest) {
    tone = 'ok'
    body = (
      <>
        <p>
          {wasUndo ? (
            <>
              <strong>Undone ✓</strong> {cap(where)} is back to how it was before that publish.
            </>
          ) : (
            <>
              <strong>Live ✓</strong> {latest.summary} is on {where}.
            </>
          )}{' '}
          {view}
        </p>
        {actions(undoBtn)}
      </>
    )
  } else if (phase === 'error') {
    tone = 'warn'
    body = (
      <>
        <div>
          <p role="alert">{message}</p>
          {problems?.length > 0 && (
            <ul className="admin-pubbar-changes">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
        {actions(
          <button key="ok" type="button" className="admin-btn admin-btn--quiet" onClick={pub.dismiss}>
            OK
          </button>,
        )}
      </>
    )
  } else if (latest) {
    body = (
      <>
        <p>
          {wasUndo ? 'Last change' : 'Last published'} {ago(latest.createdAt)}: {latest.summary}
        </p>
        {actions(undoBtn)}
      </>
    )
  }

  const extra = [notice, statusError].filter(Boolean)
  if (!body && !extra.length) return null
  // aria-live so a screen reader hears "Published", "Live" without having to hunt.
  return (
    <div className={`admin-pubbar${tone ? ` admin-pubbar--${tone}` : ''}`} aria-live="polite">
      {body}
      {extra.map((t) => (
        <p key={t} className="admin-pubbar-note">
          {t}
        </p>
      ))}
    </div>
  )
}
