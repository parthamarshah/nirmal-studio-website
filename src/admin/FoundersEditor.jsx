import { useEffect, useRef, useState } from 'react'
import { people as publishedPeople, foundersIntro, foundersReady } from '../lib/content.js'
import { FALLBACK_INTRO } from '../lib/foundersIntro.js'
import { isParked, useDraft } from './useDraft.js'
import { DraftBottomNotices, DraftLoading, DraftTopNotices } from './DraftNotices.jsx'
import { ApiError, stagedImageUrl, uploadImage } from './api.js'
import { ImageError, prepareImage } from './images.js'
import PhotoFramer from './PhotoFramer.jsx'
import { centredCrop } from './framing.js'
import { CONTACTS, FOUNDER_ID, bioState, contactProblem, countWords, INTRO_WORDS_SOFT_MAX, personProblems } from './founderRules.js'

// The founders editor: one tab per person plus one for the two introductions. Names are
// locked (decided in v1 planning); bios are written by Parth or Tej, never generated.
//
// The whole of founders.json is ONE draft — four people and two intros — so a photo and
// a bio edited together publish together, and the "all four complete" switch on the site
// (src/lib/content.js foundersReady) flips in exactly one publish.

// Only the fallback if GitHub doesn't answer: the bundled copy, with the build's added
// `media` taken back out so a save never writes build output into the source file.
const publishedDoc = JSON.parse(
  JSON.stringify({
    intro: foundersIntro,
    people: publishedPeople.map((p) => ({
      ...p,
      photo: p.photo ? { file: p.photo.file, crop: p.photo.crop, zoom: p.photo.zoom, filter: p.photo.filter } : null,
    })),
  }),
)

const TEXT_FIELDS = [
  // FOLD members are never Nirmal Studio co-founders (CLAUDE.md), so the example must not
  // suggest it on their tabs.
  { key: 'role', label: 'Role', placeholder: (p) => (p.id === FOUNDER_ID ? 'e.g. Founder, Nirmal Studio' : 'e.g. Architect, FOLD') },
  { key: 'basedIn', label: 'Based in', placeholder: () => 'e.g. Ahmedabad' },
  { key: 'previously', label: 'Previously at', placeholder: () => 'e.g. R+R Architects, Ahmedabad', wide: true },
]

const FILTERS = [
  { key: 'original', label: 'Original' },
  { key: 'warm', label: 'Warm' },
  { key: 'bw', label: 'B&W' },
]

const INTROS = [
  { key: 'nirmal', label: 'Nirmal Studio introduction', hint: 'Shown above Tej’s card.' },
  { key: 'fold', label: 'FOLD introduction', hint: 'Shown above the other three — what FOLD is, and that it isn’t Nirmal Studio.' },
]

// "Bhumika Tak’s bio and LinkedIn need fixing" — the field is often on a tab that isn't open.
function problemText(list) {
  const parts = list
    .map((p) => [p.name, personProblems(p)])
    .filter(([, probs]) => probs.length)
    .map(([name, probs]) => `${name}’s ${probs.length > 1 ? `${probs.slice(0, -1).join(', ')} and ${probs.at(-1)}` : probs[0]}`)
  if (!parts.length) return null
  const total = list.reduce((n, p) => n + personProblems(p).length, 0)
  return `${parts.join('; ')} ${total === 1 ? 'needs' : 'need'} fixing before this can be published. Your changes are still saved.`
}

// What a person still needs before the new founders section can go live — shown on their tab.
function statusOf(p) {
  if (personProblems(p).length) return { level: 'bad', text: 'Needs fixing' }
  const missing = [!p.photo && 'photo', !p.bio?.trim() && 'bio'].filter(Boolean)
  return missing.length ? { level: 'todo', text: `Needs ${missing.join(' + ')}` } : { level: 'ok', text: 'Ready' }
}

// One line instead of a panel: what is live, and how far the draft is from switching the
// site to the new section (same test as src/lib/content.js foundersReady). "Live" comes
// from this page's build, so it can lag a publish by a minute or two.
function Readiness({ list }) {
  const ready = list.filter((p) => statusOf(p).level === 'ok').length
  const all = list.length > 0 && ready === list.length
  let text
  if (foundersReady && all) text = <>Live: the new founders section.</>
  else if (foundersReady)
    text = (
      <>
        <strong>
          {ready} of {list.length} ready.
        </strong>{' '}
        Publishing this switches the site back to the older Tej + FOLD section — every person needs a photo and a bio.
      </>
    )
  else if (all) text = <><strong>All {list.length} ready</strong> — publishing switches the site to the new founders section.</>
  else
    text = (
      <>
        <strong>
          {ready} of {list.length} ready.
        </strong>{' '}
        The site keeps the older Tej + FOLD section until all {list.length} have a photo and a bio.
      </>
    )
  return <p className={`admin-founders-status${foundersReady && !all ? ' is-warn' : ''}`}>{text}</p>
}

const mediaPath = (file) => `content/media/founders/${file}`
// Photos uploaded in this tab show from memory: no round trip, and no wait for KV, which
// can take a moment to see a fresh write. Kept for the life of the page (a handful of URLs).
const localPreviews = new Map()
const photoSrc = (file) => localPreviews.get(mediaPath(file)) ?? stagedImageUrl(mediaPath(file))

// Uploads outlive the editor. Leaving the pane (or a Discard reloading it) while a photo
// is still uploading must not lose it: the upload finishes, and its result waits here
// until the editor is open on a loaded draft again, then it is added like any other edit.
// Same rule as useDraft's parked edits — nothing disappears silently.
const uploadSeq = new Map() // person id -> newest upload number; an older one never lands
const landed = new Map() // person id -> { file, crop } waiting for the editor
let uploadsInFlight = 0
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (!uploadsInFlight && !landed.size) return
    e.preventDefault()
    e.returnValue = ''
  })
}

// An empty box is "no text", the same as the file's null — not an empty string the build
// would warn about.
const textValue = (v) => (v.trim() ? v : null)

export default function FoundersEditor({ onStateChange, locked = false, live = false, selected, onSelect }) {
  const draft = useDraft('founders', publishedDoc)
  const { doc, state, hasDraft, update } = draft
  const list = Array.isArray(doc?.people) ? doc.people : []

  // Per person: { phase: 'preparing' | 'uploading' } or { error }.
  const [uploads, setUploads] = useState({})
  const mountedRef = useRef(true)
  // Whether a result can be applied right now: mounted, with a loaded document (not mid
  // reload after a Discard, when there is nothing to add it to).
  const liveRef = useRef(false)
  liveRef.current = !!doc && state !== 'loading'
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
  // Hand back photos that finished uploading while this editor was closed or reloading.
  const canApply = !!doc && ['clean', 'saved', 'dirty', 'saving'].includes(state)
  useEffect(() => {
    if (!canApply || !landed.size) return
    const done = [...landed.entries()]
    landed.clear()
    update((prev) =>
      prev
        ? { ...prev, people: prev.people.map((p) => { const l = done.find(([id]) => id === p.id); return l ? { ...p, photo: { ...l[1], zoom: 1, filter: p.photo?.filter ?? 'original' } } : p }) }
        : prev,
    )
    setUploads((u) => {
      const next = { ...u }
      for (const [id] of done) next[id] = { note: 'This photo finished uploading while you were away, and has been added.' }
      return next
    })
  }, [canApply, update])

  // A removed photo, kept so "Put it back" can restore it while it is still removed.
  const [removed, setRemoved] = useState({})

  const problemCount = doc ? list.reduce((n, p) => n + personProblems(p).length, 0) : null
  const uploading = Object.values(uploads).some((u) => u.phase)
  useEffect(() => {
    onStateChange?.({ state, hasDraft, problems: problemCount, uploading })
  }, [onStateChange, state, hasDraft, problemCount, uploading])

  if (state === 'loading' || !doc) return <DraftLoading draft={draft} id="founders" isParked={isParked} />

  // `prev` is null for a moment after a Discard; an edit landing then has nothing to apply to.
  const setPerson = (id, fn) => update((prev) => (prev ? { ...prev, people: prev.people.map((p) => (p.id === id ? fn(p) : p)) } : prev))
  const setIntro = (key, value) => update((prev) => (prev ? { ...prev, intro: { ...prev.intro, [key]: textValue(value) } } : prev))

  async function pickPhoto(person, file) {
    if (!file) return
    const id = person.id
    // The newest upload per person wins: a second photo picked while the first is still
    // uploading must not have the first land afterwards and replace it.
    const seq = (uploadSeq.get(id) ?? 0) + 1
    uploadSeq.set(id, seq)
    landed.delete(id)
    const superseded = () => uploadSeq.get(id) !== seq
    // Progress and errors only mean something to the editor that is showing them.
    const set = (v) => mountedRef.current && setUploads((u) => ({ ...u, [id]: v }))
    set({ phase: 'preparing' })
    let prepared
    uploadsInFlight++
    try {
      prepared = await prepareImage(file, { maxEdge: 2400 })
      if (superseded()) return URL.revokeObjectURL(prepared.previewUrl)
      set({ phase: 'uploading', preview: prepared.previewUrl })
      const res = await uploadImage('founders', prepared, id)
      if (superseded()) return URL.revokeObjectURL(prepared.previewUrl)
      localPreviews.set(res.path, prepared.previewUrl)
      const crop = centredCrop(prepared.width, prepared.height)
      if (!mountedRef.current || !liveRef.current) {
        // Closed or reloading: wait for the next loaded editor (the effect above).
        landed.set(id, { file: res.file, crop })
        set({})
        return
      }
      setPerson(id, (p) => ({ ...p, photo: { file: res.file, crop, zoom: 1, filter: p.photo?.filter ?? 'original' } }))
      setRemoved((r) => ({ ...r, [id]: undefined }))
      set({})
    } catch (err) {
      if (prepared) URL.revokeObjectURL(prepared.previewUrl)
      if (superseded()) return
      set({ error: err instanceof ImageError || err instanceof ApiError ? err.message : 'Couldn’t add that photo. Try again.' })
    } finally {
      uploadsInFlight--
    }
  }

  const tabs = [...list.map((p) => ({ id: p.id, label: p.name })), { id: 'intro', label: 'Introductions' }]
  const current = tabs.some((t) => t.id === selected) ? selected : tabs[0]?.id
  const person = list.find((p) => p.id === current)

  return (
    <>
      <DraftTopNotices draft={draft} noun="the founders" scope="Either choice applies to all four people and both introductions." />

      <Readiness list={list} />
      <div className="admin-tabs" role="tablist" aria-label="Founders">
        {tabs.map((t) => {
          const p = list.find((x) => x.id === t.id)
          const st = p ? statusOf(p) : null
          return (
            <button key={t.id} type="button" role="tab" aria-selected={t.id === current} onClick={() => onSelect(t.id)}>
              <span className="admin-tab-name">{t.label}</span>
              {st && <span className={`admin-tab-status is-${st.level}`}>{st.text}</span>}
            </button>
          )
        })}
      </div>

      <fieldset className="admin-founder" disabled={locked}>
        {person ? (
          <PersonForm
            key={person.id}
            person={person}
            upload={uploads[person.id] ?? {}}
            removedPhoto={removed[person.id]}
            onPick={(file) => pickPhoto(person, file)}
            onRemovePhoto={() => {
              setRemoved((r) => ({ ...r, [person.id]: person.photo }))
              setPerson(person.id, (p) => ({ ...p, photo: null }))
            }}
            onRestorePhoto={() => {
              const ph = removed[person.id]
              setRemoved((r) => ({ ...r, [person.id]: undefined }))
              if (ph) setPerson(person.id, (p) => ({ ...p, photo: ph }))
            }}
            onChange={(fn) => setPerson(person.id, fn)}
            locked={locked}
          />
        ) : (
          <div className="admin-fields admin-fields--wide">
            {!foundersReady && (
              <p className="admin-field-hint">These show with the new founders section, not the older one live now.</p>
            )}
            {INTROS.map((f) => {
              const value = doc.intro?.[f.key] ?? ''
              const n = countWords(value)
              return (
                <div className="admin-field" key={f.key}>
                  <label htmlFor={`intro-${f.key}`}>{f.label}</label>
                  <textarea
                    id={`intro-${f.key}`}
                    rows={5}
                    value={value}
                    placeholder={FALLBACK_INTRO[f.key]}
                    onChange={(e) => setIntro(f.key, e.target.value)}
                  />
                  <p className={`admin-field-hint${n > INTRO_WORDS_SOFT_MAX ? ' admin-field-hint--warn' : ''}`}>
                    {f.hint}{' '}
                    {n === 0 ? (
                      <>
                        Left empty, the site shows the grey wording above.{' '}
                        <button type="button" className="admin-link" onClick={() => setIntro(f.key, FALLBACK_INTRO[f.key])}>
                          Start from that wording
                        </button>
                      </>
                    ) : n > INTRO_WORDS_SOFT_MAX
                      ? `${n} words — this is getting long for an introduction.`
                      : `${n} words.`}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </fieldset>

      <DraftBottomNotices
        draft={draft}
        problemCount={problemCount}
        problemText={problemText(list)}
        scope="This covers all four people and both introductions, not just the tab that’s open."
        discardLabel="Discard all founders changes"
        busy={uploading}
        locked={locked}
        live={live}
      />
    </>
  )
}

function PersonForm({ person, upload, removedPhoto, onPick, onRemovePhoto, onRestorePhoto, onChange, locked }) {
  const fileRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const bio = bioState(person)
  const photo = person.photo
  const busy = !!upload.phase
  const choose = () => fileRef.current?.click()
  // Only the empty frame takes a dropped file. Over an existing photo a drop would replace
  // it with no warning and no way back, so it is refused there (Replace is one click).
  // preventDefault always: otherwise the browser opens the dropped file in place of /admin.
  const accepts = (e) => !photo && !locked && !busy && e.dataTransfer?.types?.includes('Files')
  const drop = {
    onDragOver: (e) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = accepts(e) ? 'copy' : 'none'
      setDragOver(accepts(e))
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false)
    },
    onDrop: (e) => {
      e.preventDefault()
      setDragOver(false)
      if (accepts(e)) onPick(e.dataTransfer.files?.[0])
    },
  }

  return (
    <div className="admin-person">
      <section className="admin-person-photo" aria-label={`${person.name}’s photo`} {...drop}>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          hidden
          onChange={(e) => {
            onPick(e.target.files?.[0])
            // Picking the same file again after an error must still fire.
            e.target.value = ''
          }}
        />
        {photo ? (
          <>
            <PhotoFramer
              src={photoSrc(photo.file)}
              crop={photo.crop}
              filter={photo.filter ?? 'original'}
              disabled={locked || busy}
              label={`Framing of ${person.name}’s photo`}
              onChange={({ crop, zoom }) => onChange((p) => ({ ...p, photo: { ...p.photo, crop, zoom } }))}
            />
            <div className="admin-chips" role="radiogroup" aria-label="Filter">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="radio"
                  aria-checked={(photo.filter ?? 'original') === f.key}
                  onClick={() => onChange((p) => ({ ...p, photo: { ...p.photo, filter: f.key } }))}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="admin-photo-actions">
              <button type="button" className="admin-link" disabled={busy} onClick={choose}>
                {upload.phase === 'preparing' ? 'Preparing…' : upload.phase === 'uploading' ? 'Uploading…' : 'Replace'}
              </button>
              {!busy && (
                <button type="button" className="admin-link" onClick={onRemovePhoto}>
                  Remove
                </button>
              )}
            </div>
          </>
        ) : upload.preview ? (
          // The prepared image is already in memory: show it while it uploads.
          <div className="admin-dropzone is-busy">
            <img src={upload.preview} alt="" className="admin-framer-pending" />
            <span className="admin-dropzone-label">Uploading…</span>
          </div>
        ) : (
          <button type="button" className={`admin-dropzone${dragOver ? ' is-over' : ''}`} disabled={busy} onClick={choose}>
            <span className="admin-dropzone-label">{busy ? 'Preparing…' : 'Add a photo'}</span>
            {!busy && <span className="admin-dropzone-hint">Click, or drop one here. Any phone photo works.</span>}
          </button>
        )}
        {!photo && removedPhoto && !busy && (
          <button type="button" className="admin-link admin-photo-restore" onClick={onRestorePhoto}>
            Put the removed photo back
          </button>
        )}
        {busy && <p className="admin-field-hint">You can keep editing while it uploads.</p>}
        {upload.note && <p className="admin-field-hint">{upload.note}</p>}
        {upload.error && (
          <p className="admin-field-error" role="alert">
            {upload.error}
          </p>
        )}
      </section>

      <div className="admin-person-fields">
        {TEXT_FIELDS.map((f) => (
          <div className={`admin-field${f.wide ? ' admin-field--wide' : ''}`} key={f.key}>
            <label htmlFor={`p-${f.key}`}>{f.label}</label>
            <input
              id={`p-${f.key}`}
              type="text"
              value={person[f.key] ?? ''}
              placeholder={f.placeholder(person)}
              onChange={(e) => onChange((p) => ({ ...p, [f.key]: textValue(e.target.value) }))}
            />
          </div>
        ))}

        <div className="admin-field admin-field--wide">
          <div className="admin-label-row">
            <label htmlFor="p-bio">Bio</label>
            <span id="p-bio-count" className={bio.level === 'error' ? 'admin-field-error' : `admin-field-hint${bio.level === 'warn' ? ' admin-field-hint--warn' : ''}`}>
              {bio.text}
            </span>
          </div>
          <textarea
            id="p-bio"
            rows={10}
            value={person.bio ?? ''}
            aria-invalid={bio.level === 'error' ? 'true' : undefined}
            aria-describedby="p-bio-count"
            onChange={(e) => onChange((p) => ({ ...p, bio: textValue(e.target.value) }))}
          />
        </div>

        <fieldset className="admin-contacts admin-field--wide">
          <legend>
            Contact links <span className="admin-field-hint">— only ticked ones show on the card</span>
          </legend>
          {CONTACTS.map((c) => {
            const value = person.contacts?.[c.key] ?? { value: null, on: false }
            const err = contactProblem(c.key, value)
            const setContact = (next) =>
              onChange((p) => ({ ...p, contacts: { ...p.contacts, [c.key]: { ...(p.contacts?.[c.key] ?? { value: null, on: false }), ...next } } }))
            return (
              <div className={`admin-contact${value.on ? '' : ' is-off'}`} key={c.key}>
                <label className="admin-switch">
                  <input type="checkbox" checked={!!value.on} onChange={(e) => setContact({ on: e.target.checked })} />
                  <span>{c.label}</span>
                </label>
                <input
                  type="text"
                  inputMode={c.inputMode}
                  aria-label={`${c.label} for ${person.name}`}
                  aria-invalid={err ? 'true' : undefined}
                  value={value.value ?? ''}
                  placeholder={c.example}
                  onChange={(e) => {
                    // A WhatsApp number is stored as digits only; spaces, + and dashes
                    // pasted from a phone's contact card are dropped as you type.
                    const v = c.key === 'whatsapp' ? e.target.value.replace(/[\s+()-]/g, '') : e.target.value
                    // Typing into an empty, switched-off box means "show this" — a link
                    // pasted and never switched on would otherwise silently never appear.
                    const switchOn = !value.on && !value.value && v.trim() ? { on: true } : {}
                    setContact({ value: textValue(v), ...switchOn })
                  }}
                />
                {err ? (
                  <p className="admin-field-error">{err}</p>
                ) : !value.on && value.value ? (
                  <p className="admin-field-hint">Not ticked — hidden on the site.</p>
                ) : null}
              </div>
            )
          })}
        </fieldset>
      </div>
    </div>
  )
}
