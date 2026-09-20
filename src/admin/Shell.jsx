import { useCallback, useEffect, useState } from 'react'
import { logout, ApiError } from './api.js'
import { people, foundersReady, projectsIncludingHidden, STATUS_LABELS } from '../lib/content.js'
import SettingsEditor from './SettingsEditor.jsx'

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

// One line, in one place. Projects and Founders are still read-only; Settings is the
// first pane with a real draft behind it.
function stateLine(section, draft) {
  if (section !== 'settings') return 'Read-only for now. Editing arrives with the project and founder editors.'
  if (!draft) return 'Publishing arrives in the next step.'
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
      return 'Couldn’t save. Your changes are still on screen.'
    default:
      return draft.hasDraft ? 'Saved as a draft · publishing arrives next' : 'No changes yet'
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
  const [error, setError] = useState(null)
  // Reported up by whichever pane owns a draft, so the top bar can show one save state
  // for the whole screen rather than each editor growing its own.
  const [draft, setDraft] = useState(null)

  useEffect(() => {
    const onHashChange = () => setSection(sectionFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const go = useCallback((id) => {
    window.location.hash = `#/${id}`
  }, [])

  // Stable identity: SettingsEditor reports through an effect that depends on this.
  const onDraftState = useCallback((s) => setDraft(s), [])

  async function signOut() {
    if (signingOut) return
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
          <p className="admin-state">{stateLine(section, draft)}</p>
          {/* Still inert: the Publish endpoint is the next step. The line to the left
              says so, rather than a tooltip nobody on a touchscreen can see. */}
          <button className="admin-publish" type="button" disabled>
            Publish
          </button>
        </header>

        <div className="admin-panes">
          <main className="admin-main">
            {section === 'projects' && <Projects />}
            {section === 'founders' && <Founders />}
            {section === 'settings' && <SettingsEditor onStateChange={onDraftState} />}
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

