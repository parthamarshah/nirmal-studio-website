import { useEffect } from 'react'
import { site } from '../lib/content.js'
import { useDraft } from './useDraft.js'

// The first real editor, and deliberately the smallest one: the studio's contact
// details. It exists to exercise the draft machinery end to end — type, autosave,
// reload, conflict — on fields that are plain text and easy to check. The project and
// founder editors are Phase 3 and will use this same hook.

// Mirrors scripts/build-content.mjs's rules so a mistake is caught while it is being
// typed, not as a failed publish later. The build stays the backstop, never the first
// place an error appears. functions/api/admin/_lib/documents.js's validate() re-checks
// the same rules on Publish — change one of the three, change all three.
const FIELDS = [
  { key: 'phoneDisplay', label: 'Phone, as shown on the site', required: true, hint: 'e.g. 910 699 8434' },
  { key: 'phone', label: 'Phone, for the dial link', required: true, hint: 'With country code, e.g. +919106998434' },
  { key: 'whatsapp', label: 'WhatsApp number', required: true, hint: 'Digits only, with country code', pattern: /^\d{8,15}$/, patternError: 'Digits only, 8–15 of them, including the country code.' },
  { key: 'whatsappGreeting', label: 'First WhatsApp message', required: false },
  { key: 'email', label: 'Email', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternError: 'That doesn’t look like an email address.' },
  { key: 'address', label: 'Studio address', required: true, multiline: true },
  { key: 'addressShort', label: 'Short address', required: false, hint: 'Used on the “Visit” link, e.g. Ambavadi, Ahmedabad' },
]

const problem = (f, value) => {
  const v = (value ?? '').trim()
  if (!v) return f.required ? 'This can’t be empty.' : null
  // Tested untrimmed, exactly as the build and the Publish check test it: a trailing
  // space passing here would only fail later, as a refused publish.
  if (f.pattern && !f.pattern.test(value)) return f.patternError
  return null
}

// `locked` while a publish or undo is being confirmed or sent — the editor reloads right
// after, so anything typed in that window would be lost. `live` picks the wording for
// where published changes go.
export default function SettingsEditor({ onStateChange, locked = false, live = false }) {
  const draft = useDraft('site', site)
  const { doc, state, message, conflict, hasDraft, update, discard, keepTheirs, keepMine, reload } = draft

  // Reported through an effect, never during render: calling a parent's setState while
  // this component renders is the "cannot update a component while rendering a
  // different component" warning, and it can loop.
  // Counted here, above the early returns, so the top bar can hold Publish back while a
  // field is invalid — the server would refuse it anyway, but later and less clearly.
  const problemCount = doc ? FIELDS.filter((f) => problem(f, doc.contact?.[f.key])).length : 0
  useEffect(() => {
    onStateChange?.({ state, hasDraft, problems: problemCount })
  }, [onStateChange, state, hasDraft, problemCount])

  if (state === 'loading') return <p className="admin-hint">Loading your draft…</p>
  if (!doc) {
    return (
      <>
        <p className="admin-error" role="alert">
          {message || 'Could not load your draft.'} Nothing you typed has been thrown away — it is
          still held here.
        </p>
        <button type="button" className="admin-btn admin-btn--quiet" onClick={reload}>
          Try again
        </button>
      </>
    )
  }

  const contact = doc.contact || {}
  const problems = FIELDS.map((f) => [f, problem(f, contact[f.key])]).filter(([, p]) => p)

  const setField = (key, value) =>
    update((prev) => ({ ...prev, contact: { ...prev.contact, [key]: value } }))

  return (
    <>
      {conflict !== null && (
        <div className="admin-conflict" role="alert">
          <strong>This was changed somewhere else.</strong>
          {/* `message` is set when the draft got here by being parked on a pane switch —
              the fields below are that unsaved edit, which is worth saying plainly before
              offering a button that discards it. */}
          <p>
            {message ||
              'Another tab — or the other person — saved these settings after you started. Nothing has been overwritten.'}{' '}
            Choose which version to keep.
          </p>
          <div className="admin-conflict-actions">
            <button type="button" className="admin-btn" onClick={keepTheirs}>
              {message ? 'Use the other version — discard my change' : 'Use the other version'}
            </button>
            <button type="button" className="admin-btn admin-btn--quiet" onClick={keepMine}>
              Keep mine and overwrite it
            </button>
          </div>
        </div>
      )}

      <fieldset className="admin-fields" disabled={locked}>
        {FIELDS.map((f) => {
          const err = problem(f, contact[f.key])
          return (
            <div className="admin-field" key={f.key}>
              <label htmlFor={`f-${f.key}`}>{f.label}</label>
              {f.multiline ? (
                <textarea
                  id={`f-${f.key}`}
                  rows={2}
                  value={contact[f.key] ?? ''}
                  aria-invalid={err ? 'true' : undefined}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              ) : (
                <input
                  id={`f-${f.key}`}
                  type="text"
                  value={contact[f.key] ?? ''}
                  aria-invalid={err ? 'true' : undefined}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              )}
              {err ? <p className="admin-field-error">{err}</p> : f.hint ? <p className="admin-field-hint">{f.hint}</p> : null}
            </div>
          )
        })}
      </fieldset>

      {problems.length > 0 && (
        <p className="admin-note admin-note--warn">
          {problems.length} {problems.length === 1 ? 'field needs' : 'fields need'} fixing before this
          can be published. Your changes are still saved.
        </p>
      )}

      {hasDraft && (
        <p className="admin-note">
          These are unpublished changes — {live ? 'nirmalstudio.com' : 'the test copy of the site'} still shows what was
          published.{' '}
          <button type="button" className="admin-link" onClick={discard} disabled={locked}>
            Discard them
          </button>{' '}
          to go back to the published version.
        </p>
      )}
    </>
  )
}
