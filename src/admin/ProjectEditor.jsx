import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { projectsIncludingHidden, site, projectPath } from '../lib/content.js'
import {
  IMAGE_TYPE_NAMES,
  LIMITS,
  SHAPES,
  SHAPE_NAMES,
  STATUS_NAMES,
  newImageId,
  projectProblems,
} from '../lib/projectRules.js'
import { isParked, useDraft } from './useDraft.js'
import { DraftBottomNotices, DraftLoading, DraftTopNotices } from './DraftNotices.jsx'
import { ApiError, uploadImage } from './api.js'
import { ImageError, prepareImage } from './images.js'
import PhotoFramer from './PhotoFramer.jsx'
import ImagePanel from './ImagePanel.jsx'
import { localPreviews, originalSrc, usage, useRotated } from './projectMedia.js'
import Thumb from './ProjectThumb.jsx'

// One project: its details, cover, images and story. The whole project file is one
// draft, so a new image and the section that uses it publish together.
//
// Layout follows Parth's review of the founders editor (2026-10-12): full width, no
// permanent side column. Each image's settings open in a slide-over (ImagePanel) that
// sits over the page and closes again — its own address, so Back closes it.

const RichEditor = lazy(() => import('./RichEditor.jsx'))

const TABS = [
  { id: 'details', label: 'Details' },
  { id: 'cover', label: 'Cover' },
  { id: 'images', label: 'Images' },
  { id: 'story', label: 'Story' },
]

// Type and city are "managed lists": what other projects already use, offered as
// suggestions, so "Ahmedabad" doesn't end up spelled three ways.
const suggestions = (key) => [...new Set(projectsIncludingHidden.map((p) => p.facts[key]).filter(Boolean))].sort()
const TYPE_LIST = suggestions('type')
const CITY_LIST = suggestions('city')

// Uploads outlive the editor, as in FoundersEditor: results that land after it closed are
// kept here and added when it opens again on a loaded draft.
const landed = new Map() // docId -> [pool entries]
// The open editor for each project, told when something lands for it — including one that
// opened after the upload started (it drained `landed` before this entry arrived).
const landedListeners = new Map() // docId -> () => void
let uploadsInFlight = 0
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (!uploadsInFlight && !landed.size) return
    e.preventDefault()
    e.returnValue = ''
  })
}

const textValue = (v) => (v.trim() ? v : null)

export default function ProjectEditor({ slug, route = [], onRoute, onBack, onStateChange, locked = false, live = false }) {
  const docId = `project:${slug}`
  // No bundled fallback: the editor always starts from the file on GitHub (useDraft reads
  // it), since the bundle drops hidden images and build-only fields.
  const draft = useDraft(docId, null)
  const { doc, state, hasDraft, update } = draft
  const tab = TABS.some((t) => t.id === route[0]) ? route[0] : 'details'
  const openImage = tab === 'images' ? route[1] ?? null : null

  const [uploads, setUploads] = useState([]) // { key, name, phase, preview?, error? }
  const [landedTick, setLandedTick] = useState(0)
  const mountedRef = useRef(true)
  // Whether an upload may be added right now: the same test as handing back landed ones.
  // Never during a conflict or an error — "use theirs" would throw it away unseen.
  const canApply = !!doc && ['clean', 'saved', 'dirty', 'saving'].includes(state)
  const canApplyRef = useRef(false)
  canApplyRef.current = canApply
  useEffect(() => {
    mountedRef.current = true
    const bump = () => setLandedTick((n) => n + 1)
    landedListeners.set(docId, bump)
    return () => {
      mountedRef.current = false
      if (landedListeners.get(docId) === bump) landedListeners.delete(docId)
    }
  }, [docId])

  useEffect(() => {
    const waiting = landed.get(docId)
    if (!canApply || !waiting?.length) return
    landed.delete(docId)
    update((prev) => (prev ? addToPool(prev, waiting) : prev))
  }, [canApply, update, docId, landedTick])

  const problems = useMemo(() => (doc ? projectProblems(doc, { homepage: site.homepage }) : []), [doc])
  const problemCount = doc ? problems.length : null
  const uploading = uploads.some((u) => u.phase)
  useEffect(() => {
    onStateChange?.({ state, hasDraft, problems: problemCount, uploading })
  }, [onStateChange, state, hasDraft, problemCount, uploading])

  if (state === 'loading') return <DraftLoading draft={draft} id={docId} isParked={isParked} />
  if (!doc) {
    return (
      <>
        <BackLink onBack={onBack} />
        <DraftLoading draft={draft} id={docId} isParked={isParked} />
        {state !== 'error' && <p className="admin-note">This project isn’t in the site’s files. It may have been removed.</p>}
      </>
    )
  }

  const set = (fn) => update((prev) => (prev ? fn(prev) : prev))
  // Closing the panel or stepping between images replaces the address rather than adding
  // one, so Back still goes where people expect, and never via history.back().
  const replaceRoute = (...parts) => window.location.replace(`#/projects/${[slug, ...parts].map(encodeURIComponent).join('/')}`)
  const where = (prefix) => problems.filter((p) => p.where === prefix || p.where.startsWith(`${prefix}:`))
  const tabProblems = {
    details: problems.filter((p) => p.where === 'name' || p.where === 'facts' || p.where === 'project').length,
    cover: where('cover').length,
    images: where('image').length,
    story: where('section').length,
  }
  const pool = Array.isArray(doc.pool) ? doc.pool : []
  const sections = Array.isArray(doc.sections) ? doc.sections : []

  async function addFiles(files, kind) {
    const list = [...(files || [])].filter(Boolean)
    if (!list.length) return
    const drawing = kind === 'drawing'
    // Two at a time: a phone on mobile data shouldn't be pushing six photos at once.
    let next = 0
    const one = async () => {
      while (next < list.length) {
        const file = list[next++]
        const key = `${Date.now()}-${Math.random()}`
        const setU = (v) => mountedRef.current && setUploads((u) => (v ? [...u.filter((x) => x.key !== key), { key, name: file.name, ...v }] : u.filter((x) => x.key !== key)))
        setU({ phase: 'preparing' })
        uploadsInFlight++
        let prepared
        try {
          // Drawings keep 4000px at high quality — their dimension text is barely legible
          // even uncompressed (CLAUDE.md). Everything else matches the build's 2400px.
          prepared = await prepareImage(file, drawing ? { maxEdge: 4000, quality: 0.95 } : { maxEdge: 2400 })
          setU({ phase: 'uploading', preview: prepared.previewUrl })
          const res = await uploadImage(docId, prepared, file.name.replace(/\.[^.]+$/, ''))
          localPreviews.set(res.path, prepared.previewUrl)
          const entry = { hint: file.name, file: res.file, type: drawing ? 'drawing' : 'render' }
          if (!mountedRef.current || !canApplyRef.current) {
            landed.set(docId, [...(landed.get(docId) ?? []), entry])
            landedListeners.get(docId)?.()
          } else {
            update((prev) => (prev ? addToPool(prev, [entry]) : prev))
          }
          setU(null)
        } catch (err) {
          if (prepared) URL.revokeObjectURL(prepared.previewUrl)
          setU({ error: err instanceof ImageError || err instanceof ApiError ? err.message : `Couldn’t add “${file.name}”. Try again.` })
        } finally {
          uploadsInFlight--
        }
      }
    }
    await Promise.all([one(), one()])
  }

  return (
    <div className="admin-project">
      <BackLink onBack={onBack} />
      <div className="admin-project-head">
        <h2 className="admin-project-title">{doc.name || 'Untitled project'}</h2>
        {!doc.hidden && (
          <a className="admin-link" href={projectPath(slug)} target="_blank" rel="noreferrer">
            View on the site ↗
          </a>
        )}
      </div>

      <DraftTopNotices draft={draft} noun="this project" scope="Either choice applies to the whole project." />

      <div className="admin-tabs" role="tablist" aria-label="Project">
        {TABS.map((t) => {
          const n = tabProblems[t.id]
          const count = t.id === 'images' ? pool.length : t.id === 'story' ? sections.length : null
          return (
            <button key={t.id} type="button" role="tab" aria-selected={t.id === tab} onClick={() => onRoute(t.id)}>
              <span className="admin-tab-name">
                {t.label}
                {count != null && <span className="admin-tab-count"> {count}</span>}
              </span>
              {n > 0 && <span className="admin-tab-status is-bad">{n === 1 ? '1 thing to fix' : `${n} things to fix`}</span>}
            </button>
          )
        })}
      </div>

      <fieldset className="admin-founder" disabled={locked}>
        {tab === 'details' && <DetailsTab doc={doc} set={set} problems={problems.filter((p) => p.where === 'name' || p.where === 'facts' || p.where === 'project')} />}
        {tab === 'cover' && <CoverTab slug={slug} doc={doc} set={set} problems={where('cover')} onImages={() => onRoute('images')} />}
        {tab === 'images' && (
          <ImagesTab slug={slug} doc={doc} uploads={uploads} onAdd={addFiles} onOpen={(id) => onRoute('images', id)} problems={problems} locked={locked} onDismiss={(key) => setUploads((u) => u.filter((x) => x.key !== key))} />
        )}
        {tab === 'story' && <StoryTab slug={slug} doc={doc} set={set} problems={problems} locked={locked} onOpenImage={(id) => onRoute('images', id)} />}
      </fieldset>

      {openImage && pool.some((i) => i.id === openImage) && (
        <ImagePanel
          key={openImage}
          slug={slug}
          doc={doc}
          imageId={openImage}
          set={set}
          locked={locked}
          problems={where(`image:${openImage}`).filter((p) => p.where === `image:${openImage}`)}
          onClose={() => replaceRoute('images')}
          onGo={(id) => replaceRoute('images', id)}
        />
      )}

      <DraftBottomNotices
        draft={draft}
        problemCount={problemCount}
        problemText={problems.length ? `${problems.slice(0, 3).map((p) => p.text).join(' ')}${problems.length > 3 ? ` (and ${problems.length - 3} more)` : ''} Your changes are still saved.` : null}
        scope="This covers the whole project, not just the tab that’s open."
        discardLabel="Discard all changes to this project"
        busy={uploading}
        locked={locked}
        live={live}
      />
    </div>
  )
}

function addToPool(prev, entries) {
  const taken = new Set((prev.pool ?? []).map((i) => i.id))
  const added = entries.map((e) => {
    const id = newImageId(e.hint, taken)
    taken.add(id)
    return { id, file: e.file, type: e.type, caption: '', rotation: 0, crop: null, hidden: false, showTag: false }
  })
  return { ...prev, pool: [...(prev.pool ?? []), ...added] }
}

function BackLink({ onBack }) {
  return (
    <button type="button" className="admin-link admin-back" onClick={onBack}>
      ← All projects
    </button>
  )
}

function Problems({ list }) {
  if (!list.length) return null
  return (
    <ul className="admin-problems" role="status">
      {list.map((p, i) => (
        <li key={i}>{p.text}</li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------- details

const FACTS = [
  { key: 'type', label: 'Type', list: 'admin-types', placeholder: 'e.g. Residential' },
  { key: 'city', label: 'City', list: 'admin-cities', placeholder: 'e.g. Ahmedabad' },
  { key: 'siteArea', label: 'Site area', placeholder: 'e.g. 1,200 sq m' },
  { key: 'builtUpArea', label: 'Built-up area', placeholder: 'e.g. 850 sq m' },
]

function DetailsTab({ doc, set, problems }) {
  const facts = doc.facts ?? {}
  const custom = Array.isArray(facts.custom) ? facts.custom : []
  const setFact = (k, v) => set((p) => ({ ...p, facts: { ...p.facts, [k]: v } }))
  const setCustom = (fn) => set((p) => ({ ...p, facts: { ...p.facts, custom: fn(Array.isArray(p.facts?.custom) ? p.facts.custom : []) } }))
  return (
    <div className="admin-grid2">
      <Problems list={problems} />
      <div className="admin-field admin-field--wide">
        <label htmlFor="pj-name">Name</label>
        <input id="pj-name" type="text" maxLength={LIMITS.name} value={doc.name ?? ''} onChange={(e) => set((p) => ({ ...p, name: e.target.value }))} />
        <p className="admin-field-hint">The project’s link stays the same if you rename it.</p>
      </div>
      {FACTS.map((f) => (
        <div className="admin-field" key={f.key}>
          <label htmlFor={`pj-${f.key}`}>{f.label}</label>
          <input id={`pj-${f.key}`} type="text" list={f.list} placeholder={f.placeholder} maxLength={LIMITS.factValue} value={facts[f.key] ?? ''} onChange={(e) => setFact(f.key, textValue(e.target.value))} />
        </div>
      ))}
      <datalist id="admin-types">
        {TYPE_LIST.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="admin-cities">
        {CITY_LIST.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <div className="admin-field">
        <label htmlFor="pj-status">Status</label>
        <select id="pj-status" value={facts.status ?? ''} onChange={(e) => setFact('status', e.target.value || null)}>
          <option value="">Not shown</option>
          {Object.entries(STATUS_NAMES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="admin-field--wide admin-custom-facts">
        <legend>
          Extra facts <span className="admin-field-hint">— e.g. Client: Private, Year: 2026</span>
        </legend>
        {custom.map((c, i) => (
          <div className="admin-fact-row" key={i}>
            <input type="text" aria-label={`Extra fact ${i + 1} label`} placeholder="Label" maxLength={LIMITS.factLabel} value={c?.label ?? ''} onChange={(e) => setCustom((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <input type="text" aria-label={`Extra fact ${i + 1} value`} placeholder="Value" maxLength={LIMITS.factValue} value={c?.value ?? ''} onChange={(e) => setCustom((l) => l.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
            <button type="button" className="admin-link" onClick={() => setCustom((l) => l.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        ))}
        {custom.length < LIMITS.customFacts && (
          <button type="button" className="admin-btn admin-btn--quiet admin-btn--small" onClick={() => setCustom((l) => [...l, { label: '', value: '' }])}>
            + Add a fact
          </button>
        )}
      </fieldset>
    </div>
  )
}

// ---------------------------------------------------------------- cover

function CoverFramer({ slug, img, crop, aspect, label, onChange }) {
  const src = useRotated(originalSrc(slug, img.file), img.rotation ?? 0)
  if (!src) return <div className="admin-framer-frame admin-framer-loading" style={{ aspectRatio: aspect }} />
  return <PhotoFramer src={src} crop={crop} aspect={aspect} label={label} softBelow={aspect > 1 ? 1200 : 700} onChange={({ crop: c }) => onChange(c)} />
}

function CoverTab({ slug, doc, set, problems, onImages }) {
  const cover = doc.cover ?? {}
  const visible = (doc.pool ?? []).filter((i) => !i.hidden)
  const main = visible.find((i) => i.id === cover.image) ?? null
  const phoneOwn = cover.phoneImage != null || cover.phoneCrop != null
  const phoneImg = visible.find((i) => i.id === (cover.phoneImage ?? cover.image)) ?? null
  const setCover = (patch) => set((p) => ({ ...p, cover: { image: null, crop: null, phoneImage: null, phoneCrop: null, ...p.cover, ...patch } }))

  const picker = ({ value, onPick, allowNone, label }) => (
    <div className="admin-pick" role="radiogroup" aria-label={label}>
      {allowNone && (
        <button type="button" role="radio" aria-checked={value == null} className="admin-pick-none" onClick={() => onPick(null)}>
          No cover
        </button>
      )}
      {visible.map((img) => (
        <button key={img.id} type="button" role="radio" aria-checked={value === img.id} aria-label={img.caption || `Image ${(doc.pool ?? []).indexOf(img) + 1}`} onClick={() => onPick(img.id)}>
          <Thumb slug={slug} img={img} />
        </button>
      ))}
    </div>
  )

  if (!visible.length) {
    return (
      <div className="admin-empty">
        <Problems list={problems} />
        <p>This project has no images on the site yet, so there’s nothing to use as a cover.</p>
        <button type="button" className="admin-btn" onClick={onImages}>
          Add images
        </button>
      </div>
    )
  }

  return (
    <div className="admin-cover">
      <Problems list={problems} />
      <section>
        <h3 className="admin-h3">Cover image</h3>
        <p className="admin-field-hint">Shown at the top of the project and on its card. Wide (16:9) on laptops.</p>
        {picker({ value: cover.image ?? null, allowNone: true, label: 'Cover image', onPick: (id) => setCover({ image: id, crop: null, ...(id == null ? { phoneImage: null, phoneCrop: null } : {}) }) })}
        {main && (
          <div className="admin-cover-frame">
            <CoverFramer slug={slug} img={main} crop={cover.crop} aspect={16 / 9} label="Framing of the cover on laptops" onChange={(c) => setCover({ crop: c })} />
            {cover.crop && (
              <button type="button" className="admin-link" onClick={() => setCover({ crop: null })}>
                Reset to centred
              </button>
            )}
          </div>
        )}
      </section>

      {main && (
        <section>
          <h3 className="admin-h3">On phones</h3>
          <label className="admin-switch">
            <input type="checkbox" checked={phoneOwn} onChange={(e) => setCover(e.target.checked ? { phoneImage: cover.image, phoneCrop: null } : { phoneImage: null, phoneCrop: null })} />
            <span>Use a different framing (or image) on phones</span>
          </label>
          {phoneOwn ? (
            <>
              {picker({ value: cover.phoneImage ?? cover.image, label: 'Phone cover image', onPick: (id) => setCover({ phoneImage: id, phoneCrop: null }) })}
              {phoneImg && (
                <div className="admin-cover-frame admin-cover-frame--phone">
                  <CoverFramer slug={slug} img={phoneImg} crop={cover.phoneCrop} aspect={4 / 5} label="Framing of the cover on phones" onChange={(c) => setCover({ phoneCrop: c })} />
                </div>
              )}
            </>
          ) : (
            <p className="admin-field-hint">Phones show the same image, cropped to a tall frame around its centre.</p>
          )}
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- images

function ImagesTab({ slug, doc, uploads, onAdd, onOpen, problems, locked, onDismiss }) {
  const photosRef = useRef(null)
  const drawingsRef = useRef(null)
  const [over, setOver] = useState(false)
  const pool = doc.pool ?? []
  const uses = useMemo(() => usage(doc), [doc])
  const accepts = (e) => !locked && e.dataTransfer?.types?.includes('Files')
  const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif'
  const pick = (ref, kind) => (
    <input
      ref={ref}
      type="file"
      multiple
      accept={ACCEPT}
      hidden
      onChange={(e) => {
        onAdd(e.target.files, kind)
        e.target.value = ''
      }}
    />
  )
  return (
    <div
      className={`admin-images${over ? ' is-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = accepts(e) ? 'copy' : 'none'
        setOver(accepts(e))
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (accepts(e)) onAdd(e.dataTransfer.files, 'photo')
      }}
    >
      <div className="admin-images-bar">
        {pick(photosRef, 'photo')}
        {pick(drawingsRef, 'drawing')}
        <button type="button" className="admin-btn" onClick={() => photosRef.current?.click()}>
          Add photos or renders
        </button>
        <button type="button" className="admin-btn admin-btn--quiet" onClick={() => drawingsRef.current?.click()}>
          Add drawings
        </button>
        <span className="admin-field-hint">Or drop images anywhere here. New images show on the site once you add them to a section in Story.</span>
      </div>

      {uploads.length > 0 && (
        <ul className="admin-uploads">
          {uploads.map((u) => (
            <li key={u.key} className={u.error ? 'is-error' : ''}>
              {u.preview && <img src={u.preview} alt="" />}
              <span>
                <strong>{u.name}</strong> — {u.error ?? (u.phase === 'preparing' ? 'Preparing…' : 'Uploading…')}
              </span>
              {u.error && (
                <button type="button" className="admin-link" onClick={() => onDismiss(u.key)}>
                  Dismiss
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {pool.length === 0 && !uploads.length ? (
        <p className="admin-empty">No images yet — drop photos here, or use the buttons above.</p>
      ) : (
        <ul className="admin-image-grid">
          {pool.map((img) => {
            const u = uses.get(img.id)
            const bad = problems.some((p) => p.where === `image:${img.id}`)
            const tags = [
              u.cover && 'Cover',
              !u.cover && u.phoneCover && 'Phone cover',
              img.hidden && 'Hidden',
              !u.sections.length && !u.cover && !u.phoneCover && !u.spots.length && 'Not used',
            ].filter(Boolean)
            return (
              <li key={img.id}>
                <button type="button" data-image-id={img.id} className={`admin-image-card${img.hidden ? ' is-hidden' : ''}${bad ? ' is-bad' : ''}`} onClick={() => onOpen(img.id)}>
                  <Thumb slug={slug} img={img} />
                  <span className="admin-image-meta">
                    <span className="admin-image-caption">{img.caption?.trim() || <em>No caption</em>}</span>
                    <span className="admin-image-sub">
                      {IMAGE_TYPE_NAMES[img.type] ?? 'Type?'}
                      {u.sections.length ? ` · in ${u.sections.length} section${u.sections.length > 1 ? 's' : ''}` : ''}
                    </span>
                  </span>
                  {(tags.length > 0 || bad) && (
                    <span className="admin-image-tags">
                      {bad && <span className="admin-tag admin-tag--bad">Fix</span>}
                      {tags.map((t) => (
                        <span key={t} className="admin-tag">
                          {t}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- story

function sectionId(heading, taken) {
  return newImageId(heading || 'section', taken)
}

function StoryTab({ slug, doc, set, problems, locked, onOpenImage }) {
  const sections = doc.sections ?? []
  const [confirming, setConfirming] = useState(null) // section id being deleted
  const [adding, setAdding] = useState(null) // section id whose image picker is open
  const setSections = (fn) => set((p) => ({ ...p, sections: fn(p.sections ?? []) }))
  const setSection = (id, fn) => setSections((l) => l.map((s) => (s.id === id ? fn(s) : s)))
  const move = (i, d) =>
    setSections((l) => {
      const j = i + d
      if (j < 0 || j >= l.length) return l
      const n = [...l]
      ;[n[i], n[j]] = [n[j], n[i]]
      return n
    })
  const pool = doc.pool ?? []
  const byId = new Map(pool.map((i) => [i.id, i]))

  return (
    <div className="admin-story">
      {sections.length === 0 && <p className="admin-empty">No sections yet.</p>}
      {sections.map((s, i) => {
        const probs = problems.filter((p) => p.where === `section:${s.id}`)
        return (
          <section key={s.id} className={`admin-section-card${probs.length ? ' is-bad' : ''}`} aria-label={s.heading || `Section ${i + 1}`}>
            <div className="admin-section-head">
              <input
                type="text"
                className="admin-section-heading"
                aria-label={`Heading of section ${i + 1}`}
                placeholder="Section heading (optional)"
                maxLength={LIMITS.heading}
                value={s.heading ?? ''}
                onChange={(e) => setSection(s.id, (x) => ({ ...x, heading: textValue(e.target.value) }))}
              />
              <div className="admin-section-tools">
                <button type="button" className="admin-icon-btn" aria-label="Move section up" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" className="admin-icon-btn" aria-label="Move section down" disabled={i === sections.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </button>
                <button type="button" className="admin-link admin-link--danger" onClick={() => setConfirming(s.id)}>
                  Delete
                </button>
              </div>
            </div>
            {confirming === s.id && (
              <div className="admin-confirm" role="alert">
                <span>Delete “{s.heading || `Section ${i + 1}`}” and its text? Its images stay in the project.</span>
                <button
                  type="button"
                  className="admin-btn admin-btn--small"
                  onClick={() => {
                    setSections((l) => l.filter((x) => x.id !== s.id))
                    setConfirming(null)
                  }}
                >
                  Delete section
                </button>
                <button type="button" className="admin-link" onClick={() => setConfirming(null)}>
                  Keep it
                </button>
              </div>
            )}
            <Problems list={probs} />
            <Suspense fallback={<div className="admin-rich admin-rich--loading">Loading the text editor…</div>}>
              <RichEditor value={s.body ?? null} disabled={locked} label={`Text of ${s.heading || `section ${i + 1}`}`} onChange={(body) => setSection(s.id, (x) => ({ ...x, body }))} />
            </Suspense>

            <div className="admin-section-images">
              {(s.images ?? []).map((ref, k) => {
                const img = byId.get(ref.image)
                const setRef = (fn) => setSection(s.id, (x) => ({ ...x, images: x.images.map((r, j) => (j === k ? fn(r) : r)) }))
                const moveRef = (d) =>
                  setSection(s.id, (x) => {
                    const n = [...x.images]
                    const j = k + d
                    if (j < 0 || j >= n.length) return x
                    ;[n[k], n[j]] = [n[j], n[k]]
                    return { ...x, images: n }
                  })
                return (
                  <div className="admin-ref" key={`${ref.image}-${k}`}>
                    <button type="button" className="admin-ref-thumb" onClick={() => img && onOpenImage(img.id)} aria-label="Image settings">
                      {img ? <Thumb slug={slug} img={img} className={img.hidden ? 'is-hidden' : ''} /> : <span className="admin-thumb is-missing">Missing</span>}
                      {img?.hidden && <span className="admin-tag">Hidden</span>}
                    </button>
                    <select aria-label="Frame" value={ref.shape} onChange={(e) => setRef((r) => ({ ...r, shape: e.target.value }))}>
                      {SHAPES.map((sh) => (
                        <option key={sh} value={sh}>
                          {SHAPE_NAMES[sh]}
                        </option>
                      ))}
                    </select>
                    <div className="admin-ref-tools">
                      <button type="button" className="admin-icon-btn" aria-label="Move image earlier" disabled={k === 0} onClick={() => moveRef(-1)}>
                        ←
                      </button>
                      <button type="button" className="admin-icon-btn" aria-label="Move image later" disabled={k === s.images.length - 1} onClick={() => moveRef(1)}>
                        →
                      </button>
                      <button type="button" className="admin-link" onClick={() => setSection(s.id, (x) => ({ ...x, images: x.images.filter((_, j) => j !== k) }))}>
                        Take out
                      </button>
                    </div>
                  </div>
                )
              })}
              {(s.images ?? []).length < LIMITS.sectionImages && (
                <button type="button" className="admin-ref-add" aria-expanded={adding === s.id} onClick={() => setAdding(adding === s.id ? null : s.id)}>
                  + Add image
                </button>
              )}
            </div>
            {adding === s.id && (
              <div className="admin-pick admin-pick--add" role="group" aria-label="Choose an image to add">
                {pool.length === 0 && <p className="admin-field-hint">No images in this project yet — add some in the Images tab.</p>}
                {pool.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    aria-label={`Add ${img.caption || `image ${pool.indexOf(img) + 1}`}`}
                    onClick={() => {
                      setSection(s.id, (x) => ({ ...x, images: [...(x.images ?? []), { image: img.id, shape: 'original' }] }))
                      setAdding(null)
                    }}
                  >
                    <Thumb slug={slug} img={img} className={img.hidden ? 'is-hidden' : ''} />
                  </button>
                ))}
              </div>
            )}
          </section>
        )
      })}
      {sections.length < LIMITS.sections && (
        <button
          type="button"
          className="admin-btn admin-btn--quiet"
          onClick={() => setSections((l) => [...l, { id: sectionId('section', new Set(l.map((x) => x.id))), heading: null, body: null, images: [] }])}
        >
          + Add a section
        </button>
      )}
    </div>
  )
}
