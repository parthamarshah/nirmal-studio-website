import { useState } from 'react'

// The notices every draft editor shows around its fields: a save error, a conflict with
// its two choices, "needs fixing before it can be published", and the unpublished-changes
// line with its Discard (which asks first — it deletes the saved draft for good, same as
// the parked-edit "Discard it" in Shell.jsx).
//
// `draft` is useDraft()'s return value. `noun` names what was saved elsewhere ("these
// settings", "the founders"). `top` renders above the fields, `bottom` below them.
export function DraftTopNotices({ draft, noun, scope }) {
  const { state, message, conflict, restored, keepTheirs, keepMine } = draft
  return (
    <>
      {/* An error that isn't a conflict and isn't a failed load — a refused discard, or a
          save that failed for some other reason — has nowhere else to appear. */}
      {state === 'error' && message && (
        <p className="admin-error" role="alert">
          {message}
        </p>
      )}

      {conflict !== null && (
        <div className="admin-conflict" role="alert">
          <strong>This was changed somewhere else.</strong>
          {/* `restored` — not `message`, which every ordinary 409 sets too — means the
              fields below are an unsaved edit recovered from a pane switch. Worth saying
              plainly, right above a button that throws it away. */}
          <p>
            {restored
              ? message
              : `Another tab — or the other person — saved ${noun} after you started. Nothing has been overwritten.`}{' '}
            Choose which version to keep.{scope ? ` ${scope}` : ''}
          </p>
          <div className="admin-conflict-actions">
            <button type="button" className="admin-btn" onClick={keepTheirs}>
              {restored ? 'Use the other version — discard my change' : 'Use the other version'}
            </button>
            <button type="button" className="admin-btn admin-btn--quiet" onClick={keepMine}>
              Keep mine and overwrite it
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// `problemText` replaces the generic count when the editor can say who and what; `scope`
// is said in the discard confirmation when one draft covers more than the open tab.
// `busy` (a photo still uploading) holds Discard: the photo would land straight after it.
export function DraftBottomNotices({ draft, problemCount, problemText, scope, discardLabel = 'Discard them', busy = false, locked, live }) {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const { hasDraft, discard } = draft
  return (
    <>
      {problemCount > 0 && (
        <p className="admin-note admin-note--warn">
          {problemText ||
            `${problemCount} ${problemCount === 1 ? 'field needs' : 'fields need'} fixing before this can be published. Your changes are still saved.`}
        </p>
      )}

      {hasDraft && !confirmingDiscard && (
        <p className="admin-note">
          These are unpublished changes — {live ? 'nirmalstudio.com' : 'the test copy of the site'} still shows what was
          published.{' '}
          <button type="button" className="admin-link" onClick={() => setConfirmingDiscard(true)} disabled={locked || busy}>
            {discardLabel}
          </button>{' '}
          to go back to the published version.
        </p>
      )}

      {hasDraft && confirmingDiscard && (
        <div className="admin-pubbar admin-pubbar--unsaved" role="alert">
          <p>
            Throw away all your unpublished changes here?{scope ? ` ${scope}` : ''} The site keeps what was published.
            This can’t be undone.
          </p>
          <div className="admin-pubbar-actions">
            <button
              type="button"
              className="admin-btn"
              disabled={locked || busy}
              onClick={() => {
                setConfirmingDiscard(false)
                discard()
              }}
            >
              Yes, throw them away
            </button>
            <button type="button" className="admin-btn admin-btn--quiet" onClick={() => setConfirmingDiscard(false)}>
              Keep them
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// The two states before there is a document to edit.
export function DraftLoading({ draft, id, isParked }) {
  if (draft.state === 'loading') return <p className="admin-hint">Loading your draft…</p>
  return (
    <>
      <p className="admin-error" role="alert">
        {draft.message || 'Could not load your draft.'}
        {isParked(id) && ' Nothing you typed has been thrown away — it is still held here.'}
      </p>
      <button type="button" className="admin-btn admin-btn--quiet" onClick={draft.reload}>
        Try again
      </button>
    </>
  )
}
