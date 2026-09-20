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

export function useDraft(id, published) {
  const [doc, setDoc] = useState(null)
  const [state, setState] = useState('loading')
  const [message, setMessage] = useState(null)
  const [conflict, setConflict] = useState(null)
  const [hasDraft, setHasDraft] = useState(false)

  // The token for the row we are building on: the draft's updatedAt, or null when no
  // draft row exists yet.
  const tokenRef = useRef(null)
  const docRef = useRef(null)
  const timerRef = useRef(null)
  const savingRef = useRef(false)
  const queuedRef = useRef(false)

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
      const res = await api('draft', { method: 'PUT', body: { id, doc: docRef.current, ifUpdatedAt: tokenRef.current } })
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

  const load = useCallback(async () => {
    setState('loading')
    setMessage(null)
    setConflict(null)
    try {
      const res = await api(`draft?id=${encodeURIComponent(id)}`)
      const next = res.exists ? res.doc : structuredClone(published)
      docRef.current = next
      tokenRef.current = res.exists ? res.updatedAt : null
      setDoc(next)
      setHasDraft(!!res.exists)
      setState('clean')
    } catch (err) {
      setState('error')
      setMessage(err instanceof ApiError ? err.message : 'Could not load your draft.')
    }
  }, [id, published])

  useEffect(() => {
    load()
    return clearTimer
  }, [load])

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
    try {
      await api('draft', { method: 'DELETE', body: { id, ifUpdatedAt: tokenRef.current } })
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 409) {
        setState('error')
        setMessage(err instanceof ApiError ? err.message : 'Could not discard.')
        return
      }
      // A 409 on discard means somebody saved in the meantime; reloading shows what.
    }
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
