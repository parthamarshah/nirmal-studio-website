import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from './api.js'

// Publish, Undo, and "is it live yet?".
//
// phase: idle | confirm-publish | confirm-undo | publishing | undoing
//        | waiting | slow | stopped | live | error
//
// After a publish or undo the hook watches the commit until the site itself serves it
// (see functions/api/admin/status.js). It cannot tell "still building" from "the build
// failed" — both are "not yet" — so after SLOW_MS it says that plainly, and after
// GIVE_UP_MS it stops and says it stopped rather than claiming to still be checking.

const POLL_MS = 5000
export const SLOW_MS = 5 * 60_000
const GIVE_UP_MS = 20 * 60_000

const pick = (res) => (res && Array.isArray(res.pending) ? { branch: res.branch, pending: res.pending, latest: res.latest, canUndo: res.canUndo } : null)

// `isEditorBusy` is read at the moment of the click, not captured at render: an edit
// typed after the confirmation opened must still stop the publish (it would otherwise be
// dropped when the editor reloads afterwards).
export function usePublish({ onContentChanged, isEditorBusy }) {
  const [overview, setOverview] = useState(null)
  const [phase, setPhase] = useState('idle')
  const [message, setMessage] = useState(null)
  const [notice, setNotice] = useState(null)
  const [problems, setProblems] = useState(null)
  const [watching, setWatching] = useState(null) // { commitSha, kind, since }
  const [site, setSite] = useState(null)
  const [statusError, setStatusError] = useState(null)
  // False from opening the confirmation until its fresh read lands, so "Publish now"
  // sends the versions the list on screen was computed from.
  const [confirmReady, setConfirmReady] = useState(false)
  // Set synchronously on click, before any await — a double-click must not send two
  // publishes (the server would refuse the second, but it should never get the chance).
  const busyRef = useRef(false)
  // Overview answers arrive out of order — each one reads GitHub, with varying latency —
  // and an older answer landing last would put back a change list (and draft versions)
  // from several saves ago. Found in a real run: the Publish confirmation listed an email
  // typo that had already been corrected. Only the newest request may write.
  const seqRef = useRef(0)
  const apply = (seq, next) => {
    if (next && seq === seqRef.current) setOverview(next)
  }

  const refresh = useCallback(async () => {
    const seq = ++seqRef.current
    try {
      const next = pick(await api('publish'))
      apply(seq, next)
      return next
    } catch {
      // Keep showing the last known state; the next save or action refreshes it.
      return null
    }
  }, [])

  // On load, pick up a recent publish that may still be rebuilding — a reload while
  // waiting (or while it is slow) shouldn't lose track of it.
  useEffect(() => {
    refresh().then((o) => {
      const l = o?.latest
      const age = l ? Date.now() - l.createdAt : Infinity
      if (age < GIVE_UP_MS) {
        setWatching({ commitSha: l.commitSha, kind: l.kind, since: l.createdAt })
        setPhase(age > SLOW_MS ? 'slow' : 'waiting')
      }
    })
  }, [refresh])

  const fail = (err, fallback) => {
    setPhase('error')
    setMessage(err instanceof ApiError ? err.message : fallback)
    setProblems(err instanceof ApiError ? (err.data?.problems ?? null) : null)
    apply(++seqRef.current, err instanceof ApiError ? pick(err.data) : null)
  }

  const run = useCallback(
    async (kind) => {
      if (busyRef.current || !overview) return
      if (isEditorBusy?.()) {
        setPhase('error')
        setMessage('Your latest edit is still saving. Wait for “Saved”, then try again.')
        setProblems(null)
        return
      }
      busyRef.current = true
      setPhase(kind === 'undo' ? 'undoing' : 'publishing')
      setMessage(null)
      setNotice(null)
      setProblems(null)
      setStatusError(null)
      try {
        const res =
          kind === 'undo'
            ? await api('undo', { method: 'POST', body: { id: overview.latest?.id } })
            : await api('publish', { method: 'POST', body: { drafts: overview.pending.map(({ id, updatedAt }) => ({ id, updatedAt })) } })
        apply(++seqRef.current, pick(res))
        onContentChanged?.()
        if (res.unchanged) {
          setPhase('idle')
          setNotice('Nothing to publish — the site already shows these details.')
          return
        }
        setNotice(res.warning || null)
        setWatching({ commitSha: res.commitSha, kind, since: Date.now() })
        setPhase('waiting')
      } catch (err) {
        fail(err, kind === 'undo' ? 'Could not undo.' : 'Could not publish.')
      } finally {
        busyRef.current = false
      }
    },
    [overview, onContentChanged, isEditorBusy],
  )

  // Poll until live. `since` is when the commit was made, so a reload doesn't restart
  // the clock.
  useEffect(() => {
    if (!watching) return
    let stopped = false
    let timer = null
    const tick = async () => {
      try {
        const res = await api(`status?commit=${watching.commitSha}`)
        if (stopped) return
        if (res.site) setSite(res.site)
        // e.g. an expired token: say so, rather than letting it look like a slow build.
        setStatusError(res.error || null)
        if (res.live) {
          setPhase((p) => (['waiting', 'slow', 'stopped'].includes(p) ? 'live' : p))
          setWatching(null)
          return
        }
      } catch {
        // A failed check is just "don't know yet".
      }
      if (stopped) return
      const age = Date.now() - watching.since
      if (age >= GIVE_UP_MS) {
        setPhase((p) => (p === 'waiting' || p === 'slow' ? 'stopped' : p))
        return
      }
      if (age > SLOW_MS) setPhase((p) => (p === 'waiting' ? 'slow' : p))
      timer = setTimeout(tick, POLL_MS)
    }
    tick()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [watching])

  // Starts a fresh 15-minute watch (it counts as already "slow", which it is).
  const checkAgain = useCallback(() => {
    const l = overview?.latest
    if (!l) return
    setPhase('slow')
    setWatching({ commitSha: l.commitSha, kind: l.kind, since: Date.now() - SLOW_MS })
  }, [overview])

  const settledPhase = () => {
    if (!watching) return 'idle'
    return Date.now() - watching.since > SLOW_MS ? 'slow' : 'waiting'
  }

  return {
    overview,
    phase,
    message,
    notice,
    problems,
    site,
    statusError,
    refresh,
    // Re-read on open: the confirmation lists the field-by-field changes, and the
    // versions it will publish must be the ones just saved, not those from a save ago.
    askPublish: () => {
      setPhase('confirm-publish')
      setConfirmReady(false)
      refresh().finally(() => setConfirmReady(true))
    },
    confirmReady,
    askUndo: () => setPhase('confirm-undo'),
    cancel: () => setPhase(settledPhase()),
    dismiss: () => {
      setPhase(settledPhase())
      setMessage(null)
      setProblems(null)
    },
    publish: () => run('publish'),
    undo: () => run('undo'),
    checkAgain,
  }
}
