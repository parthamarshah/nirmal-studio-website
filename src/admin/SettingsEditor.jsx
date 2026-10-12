import { useEffect, useMemo, useState } from 'react'
import { site, projectsIncludingHidden } from '../lib/content.js'
import { CONTACT_FIELDS, SECTIONS, SOCIALS, SPOTS, contactProblem, siteProblems, socialProblem } from '../lib/siteRules.js'
import { COVER_SPOTS } from '../lib/projectRules.js'
import { isParked, useDraft } from './useDraft.js'
import { DraftBottomNotices, DraftLoading, DraftTopNotices } from './DraftNotices.jsx'

// Studio settings: contact details, social links, which images the homepage uses, and
// (tucked away under Advanced) which homepage sections show.
//
// The rules are src/lib/siteRules.js — the same file the publish check uses, and a mirror
// of scripts/build-content.mjs's `if (site)` block, which stays the authority.

// Projects for the homepage pickers, from this page's build (a publish behind at worst —
// the publish check reads the real files).
const PROJECTS = projectsIncludingHidden.filter((p) => !p.hidden)
const projectMap = new Map(projectsIncludingHidden.map((p) => [p.slug, p]))

// Which homepage section each spot belongs to: a spot whose section is switched off
// doesn't show anywhere, and says so.
const SPOT_SECTION = { focus: 'focusImage', philosophy: 'philosophy', timeline: 'ideaTimeline' }
const SPOT_HINT = {
  shareImage: 'WhatsApp and Facebook remember link previews for days, so a change can take a while to show there.',
  timeline: 'The timeline uses the whole project, not one image.',
}

const thumb = (img) => img?.media?.srcSet?.split(' ')[0] || img?.media?.src || null

export default function SettingsEditor({ onStateChange, locked = false, live = false }) {
  const draft = useDraft('site', site)
  const { doc, state, hasDraft, update } = draft
  const [confirmOff, setConfirmOff] = useState(null) // section key waiting for "yes, hide it"

  const problems = useMemo(() => (doc ? siteProblems(doc, { projects: projectMap }) : []), [doc])
  // null, not 0, when there is no document: the top bar tells "this pane wouldn't open"
  // apart from "a field is invalid".
  const problemCount = doc ? problems.length : null
  useEffect(() => {
    onStateChange?.({ state, hasDraft, problems: problemCount })
  }, [onStateChange, state, hasDraft, problemCount])

  if (state === 'loading' || !doc) return <DraftLoading draft={draft} id="site" isParked={isParked} />

  const set = (fn) => update((prev) => (prev ? fn(prev) : prev))
  const contact = doc.contact || {}
  const setField = (key, value) => set((p) => ({ ...p, contact: { ...p.contact, [key]: value } }))
  const setSocial = (key, patch) => set((p) => ({ ...p, socials: { ...p.socials, [key]: { url: null, on: false, ...p.socials?.[key], ...patch } } }))
  const setSpot = (key, v) => set((p) => ({ ...p, homepage: { ...p.homepage, [key]: v } }))
  const setSection = (key, on) => set((p) => ({ ...p, sections: { ...p.sections, [key]: on } }))
  const spotProblems = (key) => problems.filter((p) => p.where === `homepage:${key}`)

  return (
    <>
      <DraftTopNotices draft={draft} noun="these settings" />

      <fieldset className="admin-settings" disabled={locked}>
        <section className="admin-card">
          <h2 className="admin-card-title">Contact</h2>
          <div className="admin-grid2">
            {CONTACT_FIELDS.map((f) => {
              const err = contactProblem(f, contact[f.key])
              return (
                <div className={`admin-field${f.multiline || f.key === 'whatsappGreeting' ? ' admin-field--wide' : ''}`} key={f.key}>
                  <label htmlFor={`f-${f.key}`}>{f.label}</label>
                  {f.multiline ? (
                    <textarea id={`f-${f.key}`} rows={2} value={contact[f.key] ?? ''} aria-invalid={err ? 'true' : undefined} onChange={(e) => setField(f.key, e.target.value)} />
                  ) : (
                    <input
                      id={`f-${f.key}`}
                      type="text"
                      value={contact[f.key] ?? ''}
                      aria-invalid={err ? 'true' : undefined}
                      // Optional fields left empty are stored as "nothing", like the file's null.
                      onChange={(e) => setField(f.key, !f.required && !e.target.value.trim() ? null : e.target.value)}
                    />
                  )}
                  {err ? <p className="admin-field-error">{err}</p> : f.hint ? <p className="admin-field-hint">{f.hint}</p> : null}
                </div>
              )
            })}
          </div>
        </section>

        <section className="admin-card">
          <h2 className="admin-card-title">
            Social links <span className="admin-field-hint">— only ticked ones show, as icons in the Contact section</span>
          </h2>
          <div className="admin-contacts">
            {SOCIALS.map((x) => {
              const v = doc.socials?.[x.key] ?? { url: null, on: false }
              const err = socialProblem(x.key, v)
              return (
                <div className={`admin-contact${v.on ? '' : ' is-off'}`} key={x.key}>
                  <label className="admin-switch">
                    <input type="checkbox" checked={!!v.on} onChange={(e) => setSocial(x.key, { on: e.target.checked })} />
                    <span>{x.label}</span>
                  </label>
                  <input
                    type="text"
                    inputMode="url"
                    aria-label={`${x.label} link`}
                    aria-invalid={err ? 'true' : undefined}
                    placeholder={x.example}
                    value={v.url ?? ''}
                    onChange={(e) => {
                      const url = e.target.value.trim() ? e.target.value : null
                      // Pasting a link into an empty, unticked box means "show this".
                      setSocial(x.key, { url, ...(!v.on && !v.url && url ? { on: true } : {}) })
                    }}
                  />
                  {err && <p className="admin-field-error">{err[0].toUpperCase() + err.slice(1)}.</p>}
                </div>
              )
            })}
          </div>
        </section>

        <section className="admin-card">
          <h2 className="admin-card-title">Homepage images</h2>
          <p className="admin-field-hint">Which project (and which of its images) each part of the homepage shows.</p>
          <div className="admin-spots">
            {SPOTS.map((x) => {
              const v = doc.homepage?.[x.key] ?? {}
              const p = projectMap.get(v.project)
              const pool = p?.pool ?? []
              const canPickImage = x.key !== 'timeline'
              const chosen = v.image ? pool.find((i) => i.id === v.image) : COVER_SPOTS.has(x.key) ? pool.find((i) => i.id === p?.cover?.image) : null
              const probs = spotProblems(x.key)
              const sectionOff = SPOT_SECTION[x.key] && doc.sections?.[SPOT_SECTION[x.key]] === false
              const shown = chosen ?? (x.key === 'timeline' ? pool.find((i) => i.id === p?.cover?.image) ?? pool[0] : null)
              return (
                <div className={`admin-spot${probs.length ? ' is-bad' : ''}${sectionOff ? ' is-off' : ''}`} key={x.key}>
                  <div className="admin-spot-preview">{thumb(shown) ? <img src={thumb(shown)} alt="" /> : <span>{p ? 'No image' : '—'}</span>}</div>
                  <div className="admin-spot-fields">
                    <label htmlFor={`spot-${x.key}`} className="admin-field-label">
                      {x.label}
                      {sectionOff && <span className="admin-field-hint"> — not on the homepage now (its section is off under Advanced)</span>}
                    </label>
                    <select
                      id={`spot-${x.key}`}
                      value={v.project ?? ''}
                      // A new project means a new set of images: the image choice goes back to its cover.
                      onChange={(e) => setSpot(x.key, { project: e.target.value })}
                    >
                      {!p && <option value="">Choose a project…</option>}
                      {p?.hidden && <option value={p.slug}>{p.name} (hidden)</option>}
                      {PROJECTS.map((pr) => (
                        <option key={pr.slug} value={pr.slug}>
                          {pr.name}
                        </option>
                      ))}
                    </select>
                    {canPickImage && p && (
                      <div className="admin-pick admin-pick--small" role="radiogroup" aria-label={`Image for ${x.label}`}>
                        <button type="button" role="radio" aria-checked={!v.image} className="admin-pick-none" onClick={() => setSpot(x.key, { project: v.project })}>
                          Project cover
                        </button>
                        {pool.map((img, i) => (
                          <button key={img.id} type="button" role="radio" aria-checked={v.image === img.id} aria-label={img.caption || `Image ${i + 1}`} onClick={() => setSpot(x.key, { project: v.project, image: img.id })}>
                            <span className="admin-thumb">
                              <img src={thumb(img)} alt="" loading="lazy" />
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="admin-field-hint">
                      {SPOT_HINT[x.key] ?? (canPickImage ? 'Choosing another project switches back to that project’s cover.' : null)}
                    </p>
                    {probs.map((pr, i) => (
                      <p key={i} className="admin-field-error">
                        {pr.text}
                      </p>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <details className="admin-card admin-advanced">
          <summary className="admin-card-title">Advanced — homepage sections</summary>
          <p className="admin-field-hint">Turning a section off removes it from the homepage for everyone at the next Publish. Nothing in it is deleted.</p>
          <ul className="admin-section-switches">
            {SECTIONS.map((x) => {
              const on = doc.sections?.[x.key] !== false
              return (
                <li key={x.key}>
                  <label className="admin-switch">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => {
                        if (e.target.checked) setSection(x.key, true)
                        else setConfirmOff(x.key)
                      }}
                    />
                    <span>{x.label}</span>
                  </label>
                  {confirmOff === x.key && (
                    <span className="admin-confirm admin-confirm--inline" role="alert">
                      {x.key === 'contact'
                        ? 'Hide the Contact section? Visitors won’t see the address, map or WhatsApp button there (Talk with Us in the menu stays).'
                        : `Hide “${x.label}” from the homepage?`}
                      <button
                        type="button"
                        className="admin-btn admin-btn--small"
                        onClick={() => {
                          setSection(x.key, false)
                          setConfirmOff(null)
                        }}
                      >
                        Hide it
                      </button>
                      <button type="button" className="admin-link" onClick={() => setConfirmOff(null)}>
                        Keep it
                      </button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </details>
      </fieldset>

      <DraftBottomNotices draft={draft} problemCount={problems.length} locked={locked} live={live} />
    </>
  )
}
