import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from './api.js'

// Owns one document's draft: load it, debounce-save it, and refuse to silently flatten
// somebody else's edit.
//
// The concurrency rule, because it is the whole point of this hook: every save carries
// the `updatedAt` of the row we believe we are building on. The server writes only if
// that still matches. When it doesn't, we do NOT retry and we do NOT overwrite — we stop
// and ask, because the alternative is Tej's edit disappearing while Parth's tab was open.
//
// States: loading → clean | dirty | saving | saved | error | conflict

const DEBOUNCE_MS = 800

// Edits that were still unsaved when their editor went away (a pane switch, or the
// system Back gesture, during the debounce or while a save was in flight). The unmounting
// editor flushes its save, but if that save then fails — a 409 because the other person
// saved first, or the network — there is no editor left to show the problem, and the
// edit used to vanish. It is parked here instead, keyed by document id, and handed back
// to the editor when it next opens; the Shell shows a notice until then.
//
// In memory, not sessionStorage: it only has to outlive the pane switch, and a reload is
// already guarded by the beforeunload prompt below.
const leftUnsaved = new Map() // id -> { doc, token, base, message }
const listeners = new Set()
// The save still in flight per document, so a reopening editor waits for the one its
// previous instance flushed on the way out — otherwise it would load the version from
// before that save and then collide with its own edit.
const inflight = new Map() // id -> promise
export const hasLeftUnsaved = () => leftUnsaved.size > 0
// A save flushed by an editor that has already unmounted is not parked yet and no editor
// reports it, so nothing else marks this window — and publishing inside it would commit
// the version from before those keystrokes.
export const isSaveInFlight = () => inflight.size > 0
// The only way to abandon a parked edit on purpose (the Shell's "Discard it").
export function discardLeftUnsaved(id) {
  unpark(id)
}
// How long a reopening editor waits for the previous instance's save before loading
// anyway: `api()` has no timeout, and a stalled PUT must not hold the editor on
// "Loading…", which has no way out.
const FLUSH_WAIT_MS = 5000
const notify = () => listeners.forEach((fn) => fn())

function park(id, entry) {
  leftUnsaved.set(id, entry)
  notify()
}

function unpark(id) {
  const entry = leftUnsaved.get(id)
  if (entry) {
    leftUnsaved.delete(id)
    notify()
  }
  return entry
}

// For the Shell: which documents have an edit waiting for their editor to reopen.
export function useLeftUnsaved() {
  const [ids, setIds] = useState(() => [...leftUnsaved.keys()])
  useEffect(() => {
    const update = () => setIds([...leftUnsaved.keys()])
    listeners.add(update)
    update()
    return () => listeners.delete(update)
  }, [])
  return ids
}

// A parked edit is exactly as unsaved as one in an open editor, so closing the tab must
// still ask. Registered once, checked at the moment of leaving.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (!leftUnsaved.size) return
    e.preventDefault()
    e.returnValue = ''
  })
}

export function useDraft(id, published) {
  const [doc, setDoc] = useState(null)
  const [state, setState] = useState('loading')
  const [message, setMessage] = useState(null)
  const [conflict, setConflict] = useState(null)
  const [hasDraft, setHasDraft] = useState(false)

  // The token for the row we are building on: the draft's updatedAt, or null when no
  // draft row exists yet.
  const tokenRef = useRef(null)
  // Which published file (git blob sha) this draft started from. Sent only when the draft
  // row is first created, so Publish can tell if the site changed underneath it.
  const baseRef = useRef(null)
  const docRef = useRef(null)
  const timerRef = useRef(null)
  const savingRef = useRef(false)
  const queuedRef = useRef(false)
  // False once the editor has unmounted: a save still finishing after that has nobody to
  // report to, so a failure is parked (see `leftUnsaved`) instead of set as state.
  const mountedRef = useRef(true)
  const stateRef = useRef('loading')
  stateRef.current = state

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }

  // Declared above every effect that names it — a `const` referenced in an earlier
  // effect's dependency array throws "cannot access before initialization" on every
  // render, and this app has no error boundary (see CLAUDE.md's incident list).
  const save = useCallback(async () => {
    if (savingRef.current) {
      queuedRef.current = true
      return
    }
    clearTimer()
    savingRef.current = true
    setState('saving')
    setMessage(null)
    try {
      const creating = tokenRef.current == null
      const request = api('draft', {
        method: 'PUT',
        body: { id, doc: docRef.current, ifUpdatedAt: tokenRef.current, ...(creating ? { baseSha: baseRef.current } : {}) },
      })
      inflight.set(id, request)
      let res
      try {
        res = await request
      } finally {
        if (inflight.get(id) === request) inflight.delete(id)
      }
      tokenRef.current = res.updatedAt
      setHasDraft(true)
      savingRef.current = false
      if (queuedRef.current) {
        queuedRef.current = false
        save()
      } else {
        setState('saved')
      }
    } catch (err) {
      savingRef.current = false
      queuedRef.current = false
      if (!mountedRef.current) {
        park(id, { doc: docRef.current, token: tokenRef.current, base: baseRef.current })
        return
      }
      if (err instanceof ApiError && err.status === 409) {
        setConflict(err.data?.current ?? null)
        setState('conflict')
        setMessage(err.message)
        return
      }
      setState('error')
      setMessage(err instanceof ApiError ? err.message : 'Could not save.')
    }
  }, [id])

  // Every load carries a sequence number, and a response is only applied if it is still
  // the newest AND this editor is still mounted. Both matter: a draft GET reads GitHub,
  // so two of them can land out of order (CLAUDE.md's out-of-order incident), and a load
  // that lands after the editor closed would unpark a parked edit into a dead component
  // — deleting it, with the notice and Publish silently re-enabled.
  const loadSeq = useRef(0)

  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    const stale = () => !mountedRef.current || seq !== loadSeq.current
    setState('loading')
    setMessage(null)
    setConflict(null)
    try {
      // A queued save chains straight into the next one, so keep waiting until none is
      // left — but never longer than FLUSH_WAIT_MS in total.
      const until = Date.now() + FLUSH_WAIT_MS
      while (inflight.has(id) && Date.now() < until) {
        await Promise.race([
          inflight.get(id).catch(() => {}),
          new Promise((r) => setTimeout(r, Math.max(0, until - Date.now()))),
        ])
      }
      const res = await api(`draft?id=${encodeURIComponent(id)}`)
      // Before unpark(): unparking for an editor that is gone would drop the edit.
      if (stale()) return
      // With no draft, start from what the server says is published (read from GitHub),
      // not the copy bundled into this page: right after a publish or an Undo, the bundle
      // is a build behind. The bundled copy is only the fallback if GitHub didn't answer.
      const next = res.exists ? res.doc : structuredClone(res.published?.doc ?? published)
      const serverToken = res.exists ? res.updatedAt : null
      const parked = unpark(id)
      if (parked) {
        // An edit made before leaving this pane didn't save. Show it, never the server's
        // version silently. If nobody has saved since it was made, just finish saving it;
        // otherwise it is a conflict like any other, and the person chooses.
        docRef.current = parked.doc
        setDoc(parked.doc)
        setHasDraft(!!res.exists)
        // No draft on either side is only "unchanged" if the published version is the one
        // the edit started from; a publish in between means it is building on old content.
        const unchanged = serverToken === parked.token && (serverToken !== null || (res.published?.sha ?? null) === parked.base)
        if (unchanged) {
          tokenRef.current = parked.token
          baseRef.current = parked.base
          setState('dirty')
          clearTimer()
          timerRef.current = setTimeout(save, 0)
        } else {
          tokenRef.current = parked.token
          baseRef.current = parked.base
          setConflict(res)
          setState('conflict')
          setMessage('Your change here didn’t finish saving when you left this pane — it is in the fields below, nothing is lost. Someone also saved these settings since.')
        }
        return
      }
      docRef.current = next
      tokenRef.current = serverToken
      baseRef.current = res.exists ? (res.baseSha ?? null) : (res.published?.sha ?? null)
      setDoc(next)
      setHasDraft(!!res.exists)
      setState('clean')
    } catch (err) {
      if (stale()) return
      setState('error')
      setMessage(err instanceof ApiError ? err.message : 'Could not load your draft.')
    }
  }, [id, published, save])

  // Leaving the pane mid-debounce used to drop the last few keystrokes: the cleanup
  // cleared the timer and nothing saved. Flush instead.
  //
  // An edit that was already in conflict (or failed) when the pane closed can't be
  // flushed — it would just fail again — so it is parked as-is for the next open.
  useEffect(() => {
    mountedRef.current = true
    load()
    return () => {
      mountedRef.current = false
      const s = stateRef.current
      if ((s === 'conflict' || s === 'error') && docRef.current) {
        clearTimer()
        park(id, { doc: docRef.current, token: tokenRef.current, base: baseRef.current })
      } else if (timerRef.current && docRef.current) {
        clearTimer()
        save()
      }
    }
  }, [id, load, save])

  // An edit while a conflict is unresolved would be building on a version we already
  // know is stale, so the caller must resolve first.
  const update = useCallback(
    (updater) => {
      setDoc((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        docRef.current = next
        return next
      })
      setState((s) => (s === 'conflict' ? s : 'dirty'))
      clearTimer()
      timerRef.current = setTimeout(save, DEBOUNCE_MS)
    },
    [save],
  )

  const discard = useCallback(async () => {
    clearTimer()
    // Discarding throws away whatever draft is on the server, so it needs that row's
    // version. This editor's own token can be null — a restored parked edit keeps the
    // token it had when it failed to save, which is null when the collision happened
    // while CREATING the draft — and the server (rightly) refuses a null with a 400. So
    // read the current version first, and treat "no draft row" as nothing to discard.
    let token = tokenRef.current
    try {
      if (token == null) {
        const cur = await api(`draft?id=${encodeURIComponent(id)}`)
        token = cur.exists ? cur.updatedAt : null
      }
      if (token != null) await api('draft', { method: 'DELETE', body: { id, ifUpdatedAt: token } })
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 409) {
        setState('error')
        setMessage(err instanceof ApiError ? err.message : 'Could not discard.')
        return
      }
      // A 409 on discard means somebody saved in the meantime; reloading shows what.
    }
    // Deliberately before the reload: if the reload then fails, leaving the editor in
    // `error` with the discarded document still in docRef would park it on the next pane
    // switch — offering to restore, and to overwrite with, content just thrown away.
    docRef.current = null
    unpark(id)
    await load()
  }, [id, load])

  // Conflict resolutions, both explicit. There is deliberately no automatic merge: these
  // are two people editing the same studio's details, and guessing would be worse than
  // asking.
  const keepTheirs = useCallback(async () => {
    setConflict(null)
    await load()
  }, [load])

  const keepMine = useCallback(async () => {
    if (!conflict) return
    tokenRef.current = conflict.exists ? conflict.updatedAt : null
    // The draft is gone (published or discarded elsewhere): re-base on what is live now.
    if (!conflict.exists) baseRef.current = conflict.published?.sha ?? baseRef.current
    setConflict(null)
    await save()
  }, [conflict, save])

  // Cmd/Ctrl+S saves now rather than waiting out the debounce.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (docRef.current) save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  // Closing the tab mid-debounce would lose the last edit. The browser only shows its
  // own generic wording, but the prompt is what matters.
  useEffect(() => {
    const unsaved = state === 'dirty' || state === 'saving' || state === 'conflict'
    if (!unsaved) return
    const onLeave = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [state])

  return { doc, state, message, conflict, hasDraft, update, save, discard, keepTheirs, keepMine, reload: load }
}
