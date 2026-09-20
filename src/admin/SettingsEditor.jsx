import { useEffect } from 'react'
import { site } from '../lib/content.js'
import { useDraft } from './useDraft.js'

// The first real editor, and deliberately the smallest one: the studio's contact
// details. It exists to exercise the draft machinery end to end — type, autosave,
// reload, conflict — on fields that are plain text and easy to check. The project and
// founder editors are Phase 3 and will use this same hook.

// Mirrors scripts/build-content.mjs's rules so a mistake is caught while it is being
// typed, not as a failed publish later. The build stays the backstop, never the first
// place an error appears.
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
  if (f.pattern && !f.pattern.test(v)) return f.patternError
  return null
}

export default function SettingsEditor({ onStateChange }) {
  const draft = useDraft('site', site)
  const { doc, state, message, conflict, hasDraft, update, discard, keepTheirs, keepMine } = draft

  // Reported through an effect, never during render: calling a parent's setState while
  // this component renders is the "cannot update a component while rendering a
  // different component" warning, and it can loop.
  useEffect(() => {
    onStateChange?.({ state, hasDraft })
  }, [onStateChange, state, hasDraft])

  if (state === 'loading') return <p className="admin-hint">Loading your draft…</p>
  if (!doc) {
    return (
      <p className="admin-error" role="alert">
        {message || 'Could not load your draft.'}
      </p>
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
          <p>
            Another tab — or the other person — saved these settings after you started. Nothing has
            been overwritten. Choose which version to keep.
          </p>
          <div className="admin-conflict-actions">
            <button type="button" className="admin-btn" onClick={keepTheirs}>
              Use the other version
            </button>
            <button type="button" className="admin-btn admin-btn--quiet" onClick={keepMine}>
              Keep mine and overwrite it
            </button>
          </div>
        </div>
      )}

      <div className="admin-fields">
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
      </div>

      {problems.length > 0 && (
        <p className="admin-note admin-note--warn">
          {problems.length} {problems.length === 1 ? 'field needs' : 'fields need'} fixing before this
          can be published. Your changes are still saved.
        </p>
      )}

      {hasDraft && (
        <p className="admin-note">
          These are unpublished changes — the live site still shows what was published.{' '}
          <button type="button" className="admin-link" onClick={discard}>
            Discard them
          </button>{' '}
          to go back to the published version.
        </p>
      )}
    </>
  )
}
