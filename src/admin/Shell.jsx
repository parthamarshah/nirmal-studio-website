import { useState } from 'react'
import { logout, ApiError } from './api.js'
import { site, people, foundersReady, STATUS_LABELS } from '../lib/content.js'
import { projects as allProjects } from '../generated/content.js'

// The desktop-first shell: left rail, top bar with draft state and Publish, main pane,
// right inspector. Phase 3 builds the real editors into these panes.
//
// What it shows right now is the PUBLISHED content, read-only, straight from the same
// generated data the site renders. That is deliberate: a shell full of placeholder rows
// tells you nothing about whether the layout works at the real density (9 projects, 4
// founders, the actual name lengths). Step 5 swaps the source from published content to
// the D1 draft; the layout it is being judged on now is the layout that survives.
const SECTIONS = [
  { id: 'projects', label: 'Projects' },
  { id: 'founders', label: 'Founders' },
  { id: 'settings', label: 'Settings' },
]

const dash = '—'

export default function Shell({ session, onSignedOut }) {
  const [section, setSection] = useState('projects')
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState(null)

  const counts = {
    projects: allProjects.length,
    founders: people.length,
    settings: null,
  }

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

  const current = SECTIONS.find((s) => s.id === section)

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
              onClick={() => setSection(s.id)}
              aria-current={s.id === section ? 'page' : undefined}
            >
              {s.label}
              {counts[s.id] != null && <span className="admin-nav-count">{counts[s.id]}</span>}
            </button>
          ))}
        </div>

        <div className="admin-rail-foot">
          <p>
            Publishing to <strong>{session.publishBranch}</strong>
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
          <p className="admin-draft-state">
            <span className="admin-dot" aria-hidden="true" />
            No unpublished changes
          </p>
          {/* Publish is deliberately inert until step 6 builds it. A button that looks
              ready and does nothing is worse than one that says why it can't. */}
          <button className="admin-publish" type="button" disabled title="Editing arrives in the next phase">
            Publish
          </button>
        </header>

        <div className="admin-panes">
          <main className="admin-main">
            {section === 'projects' && <Projects />}
            {section === 'founders' && <Founders />}
            {section === 'settings' && <Settings />}
          </main>

          <aside className="admin-inspector" aria-label="Inspector">
            <p className="admin-eyebrow">Inspector</p>
            <p className="admin-hint">
              Selecting a project, an image or a founder will show its settings here — framing, type,
              caption, word counts, where an image is used.
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
      <p className="admin-eyebrow">Published now · read-only</p>
      <ul className="admin-list">
        {allProjects.map((p) => (
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
        Reordering, hiding, duplicating and the project editor itself come next. Nothing on this
        screen can change the site yet.
      </p>
    </>
  )
}

function Founders() {
  return (
    <>
      <p className="admin-eyebrow">Published now · read-only</p>
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

function Settings() {
  const socialsOn = Object.entries(site.socials || {}).filter(([, v]) => v.on && v.url)
  const sectionsOff = Object.entries(site.sections || {}).filter(([, on]) => on === false)

  return (
    <>
      <p className="admin-eyebrow">Published now · read-only</p>
      <ul className="admin-list">
        <li>
          <div className="admin-row">
            <strong>Phone</strong>
            <span className="admin-row-meta">{site.contact.phone || dash}</span>
          </div>
        </li>
        <li>
          <div className="admin-row">
            <strong>Email</strong>
            <span className="admin-row-meta">{site.contact.email || dash}</span>
          </div>
        </li>
        <li>
          <div className="admin-row">
            <strong>Address</strong>
            <span className="admin-row-meta">{site.contact.address || dash}</span>
          </div>
        </li>
        <li>
          <div className="admin-row">
            <strong>Social links</strong>
            <span className="admin-row-meta">
              {socialsOn.length ? socialsOn.map(([k]) => k).join(', ') : 'None switched on'}
            </span>
          </div>
        </li>
        <li>
          <div className="admin-row">
            <strong>Hidden sections</strong>
            <span className="admin-row-meta">
              {sectionsOff.length ? sectionsOff.map(([k]) => k).join(', ') : 'None — all sections shown'}
            </span>
          </div>
        </li>
      </ul>
      <p className="admin-note">
        Changing the PIN, the switches for each social link and the homepage image spots all live
        here once the editors are built.
      </p>
    </>
  )
}
