import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IMAGE_TYPES, IMAGE_TYPE_NAMES, LIMITS } from '../lib/projectRules.js'
import PhotoFramer from './PhotoFramer.jsx'
import { originalSrc, usage, useRotated } from './projectMedia.js'
import { centredCrop } from './framing.js'

// One image's settings, in a panel that slides over the right of the page (Parth chose
// this over a permanent column, 2026-10-12). It has its own address
// (#/projects/<slug>/images/<id>), so Back closes it; Esc, × and a click on the dimmed
// page close it too — by replacing the address, never history.back(), whose delay is
// how two of CLAUDE.md's incidents navigated people off the site.
//
// Portalled to <body>: a fixed panel inside a transformed or filtered ancestor would be
// sized to that ancestor instead of the screen (the TalkToTej incident).

const TRIMS = [
  { key: 'none', label: 'No trim', aspect: null },
  { key: '3:2', label: '3:2', aspect: 3 / 2 },
  { key: '16:9', label: '16:9', aspect: 16 / 9 },
  { key: '4:5', label: '4:5', aspect: 4 / 5 },
  { key: '1:1', label: 'Square', aspect: 1 },
]

function useSize(src) {
  const [size, setSize] = useState(null)
  useEffect(() => {
    if (!src) return
    let live = true
    const im = new Image()
    im.onload = () => live && setSize({ src, W: im.naturalWidth, H: im.naturalHeight })
    im.src = src
    return () => {
      live = false
    }
  }, [src])
  return size?.src === src ? size : null
}

export default function ImagePanel({ slug, doc, imageId, set, locked, problems, onClose, onGo }) {
  const pool = doc.pool ?? []
  const index = pool.findIndex((i) => i.id === imageId)
  const img = pool[index]
  const u = usage(doc).get(imageId)
  const src = useRotated(originalSrc(slug, img.file), img.rotation ?? 0)
  const size = useSize(src)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [addTo, setAddTo] = useState('')
  const closeRef = useRef(null)
  const panelRef = useRef(null)

  // Which trim the stored crop is, worked out from its proportions on this image.
  const crop = img.crop ?? null
  let trim = 'none'
  if (crop && size) {
    const r = (crop.w * size.W) / (crop.h * size.H)
    trim = TRIMS.find((t) => t.aspect && Math.abs(t.aspect - r) / t.aspect < 0.02)?.key ?? 'custom'
  }
  const [trimChoice, setTrimChoice] = useState(null) // chosen but not yet dragged
  const shownTrim = trimChoice ?? trim

  useEffect(() => {
    setConfirmRemove(false)
    setTrimChoice(null)
    setAddTo('')
  }, [imageId])

  // onClose is a new function on every parent render (each keystroke saves and
  // re-renders), so it is read through a ref: an effect depending on it would re-run per
  // keystroke and pull focus out of the caption box.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.repeat) onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // While open, the page behind is inert (Tab stays in the panel, a screen reader stays
  // in it); on close, focus goes back to this image's card.
  useEffect(() => {
    const root = document.getElementById('admin-root')
    if (root) root.inert = true
    closeRef.current?.focus()
    return () => {
      if (root) root.inert = false
      const card = document.querySelector(`[data-image-id="${CSS.escape(imageId)}"]`) ?? document.querySelector('.admin-image-card')
      card?.focus()
    }
  }, [imageId])

  const setImg = (fn) => set((p) => ({ ...p, pool: p.pool.map((i) => (i.id === imageId ? fn(i) : i)) }))
  // A rotation makes every framing of this image meaningless (they are fractions of the
  // rotated picture), so its own trim and any cover framing of it are cleared too.
  const rotate = (d) => {
    setTrimChoice(null)
    set((p) => ({
      ...p,
      pool: p.pool.map((i) => (i.id === imageId ? { ...i, rotation: ((((i.rotation ?? 0) + d) % 360) + 360) % 360, crop: null } : i)),
      cover: {
        ...p.cover,
        ...(p.cover?.image === imageId ? { crop: null } : {}),
        ...((p.cover?.phoneImage ?? p.cover?.image) === imageId ? { phoneCrop: null } : {}),
      },
    }))
  }
  const blockHide = u.cover || u.phoneCover ? 'It’s the cover — choose another cover first.' : u.spots.length ? `It’s used by ${u.spots.join(' and ')}. Change that in Settings first.` : null
  const blockRemove = u.spots.length ? `It’s used by ${u.spots.join(' and ')}. Change that in Settings first.` : null
  const sections = doc.sections ?? []
  const notIn = sections.filter((s) => !(s.images ?? []).some((r) => r.image === imageId))

  const panel = (
    <div
      className="admin-panel-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <aside className="admin-panel" role="dialog" aria-modal="true" aria-labelledby="admin-panel-title" ref={panelRef} data-lenis-prevent="">
        <header className="admin-panel-head">
          <h2 id="admin-panel-title">
            Image {index + 1} of {pool.length}
          </h2>
          <div className="admin-panel-nav">
            <button type="button" className="admin-icon-btn" aria-label="Previous image" disabled={index <= 0} onClick={() => onGo(pool[index - 1].id)}>
              ‹
            </button>
            <button type="button" className="admin-icon-btn" aria-label="Next image" disabled={index >= pool.length - 1} onClick={() => onGo(pool[index + 1].id)}>
              ›
            </button>
            <button type="button" className="admin-icon-btn" aria-label="Close" ref={closeRef} onClick={onClose}>
              ×
            </button>
          </div>
        </header>

        <fieldset className="admin-panel-body" disabled={locked}>
          {problems.length > 0 && (
            <ul className="admin-problems" role="status">
              {problems.map((p, i) => (
                <li key={i}>{p.text}</li>
              ))}
            </ul>
          )}

          <div className="admin-panel-preview">
            {!src ? (
              <div className="admin-framer-frame admin-framer-loading" />
            ) : shownTrim === 'none' || shownTrim === 'custom' ? (
              <img src={src} alt={img.caption || ''} className="admin-panel-img" />
            ) : (
              <PhotoFramer
                src={src}
                crop={crop}
                aspect={TRIMS.find((t) => t.key === shownTrim).aspect}
                label="Trim of this image"
                softBelow={0}
                onChange={({ crop: c }) => {
                  setImg((i) => ({ ...i, crop: c }))
                  setTrimChoice(null)
                }}
              />
            )}
          </div>

          <div className="admin-panel-row">
            <span className="admin-field-label">Rotate</span>
            <button type="button" className="admin-btn admin-btn--quiet admin-btn--small" onClick={() => rotate(-90)}>
              ↺ Left
            </button>
            <button type="button" className="admin-btn admin-btn--quiet admin-btn--small" onClick={() => rotate(90)}>
              ↻ Right
            </button>
          </div>

          <div className="admin-field">
            <span className="admin-field-label">Trim</span>
            <div className="admin-chips admin-chips--wrap" role="radiogroup" aria-label="Trim">
              {TRIMS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={shownTrim === t.key}
                  disabled={!size}
                  title={t.key === 'none' && shownTrim === 'custom' ? 'Removes the custom trim' : undefined}
                  onClick={() => {
                    if (t.key === 'none') {
                      setImg((i) => ({ ...i, crop: null }))
                      setTrimChoice(null)
                    } else {
                      // Saved straight away, centred, so the choice isn't lost if nobody drags.
                      setImg((i) => ({ ...i, crop: centredCrop(size.W, size.H, t.aspect) }))
                      setTrimChoice(t.key)
                    }
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="admin-field-hint">
              {shownTrim === 'custom' ? 'This image has a custom trim. ' : ''}Cuts the edges off everywhere this image is used. Each section can also frame it on its own.
            </p>
          </div>

          <div className="admin-field">
            <span className="admin-field-label">What it is</span>
            <div className="admin-chips admin-chips--wrap" role="radiogroup" aria-label="What it is">
              {IMAGE_TYPES.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={img.type === t} onClick={() => setImg((i) => ({ ...i, type: t }))}>
                  {IMAGE_TYPE_NAMES[t]}
                </button>
              ))}
            </div>
            <label className="admin-switch">
              <input type="checkbox" checked={!!img.showTag} onChange={(e) => setImg((i) => ({ ...i, showTag: e.target.checked }))} />
              <span>Show “{IMAGE_TYPE_NAMES[img.type] ?? 'type'}” as a small label on the image</span>
            </label>
          </div>

          <div className="admin-field">
            <label htmlFor="img-caption">Caption</label>
            <input
              id="img-caption"
              type="text"
              maxLength={LIMITS.caption}
              value={img.caption ?? ''}
              placeholder="e.g. Living room, looking towards the courtyard"
              onChange={(e) => setImg((i) => ({ ...i, caption: e.target.value }))}
            />
            <p className="admin-field-hint">Shown under the image when it’s on its own, and read out for people who can’t see it.</p>
          </div>

          <div className="admin-field">
            <label className="admin-switch">
              <input type="checkbox" checked={!img.hidden} disabled={!!blockHide && !img.hidden} onChange={(e) => setImg((i) => ({ ...i, hidden: !e.target.checked }))} />
              <span>Show on the site</span>
            </label>
            {blockHide && !img.hidden && <p className="admin-field-hint">{blockHide}</p>}
            {img.hidden && <p className="admin-field-hint">Hidden: kept here, and keeps its place in sections, but the site skips it.</p>}
          </div>

          <div className="admin-field">
            <span className="admin-field-label">Where it’s used</span>
            <ul className="admin-used">
              {u.cover && <li>The cover{u.phoneCover ? ' (and on phones)' : ''}</li>}
              {!u.cover && u.phoneCover && <li>The phone cover</li>}
              {u.sections.map((s) => (
                <li key={s.id}>Section “{s.heading || 'untitled'}”</li>
              ))}
              {u.spots.map((sp) => (
                <li key={sp}>{sp[0].toUpperCase() + sp.slice(1)}</li>
              ))}
              {!u.cover && !u.phoneCover && !u.sections.length && !u.spots.length && <li>Nowhere yet — it isn’t on the site.</li>}
            </ul>
            <div className="admin-panel-row">
              {!u.cover && !img.hidden && (
                <button type="button" className="admin-btn admin-btn--quiet admin-btn--small" onClick={() => set((p) => ({ ...p, cover: { ...p.cover, image: imageId, crop: null } }))}>
                  Use as cover
                </button>
              )}
              {notIn.length > 0 && (
                <>
                  <select aria-label="Add to a section" value={addTo} onChange={(e) => setAddTo(e.target.value)}>
                    <option value="">Add to a section…</option>
                    {notIn.map((s, i) => (
                      <option key={s.id} value={s.id}>
                        {s.heading || `Section ${sections.indexOf(s) + 1 || i + 1}`}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="admin-btn admin-btn--quiet admin-btn--small"
                    disabled={!addTo}
                    onClick={() => {
                      set((p) => ({ ...p, sections: p.sections.map((s) => (s.id === addTo ? { ...s, images: [...(s.images ?? []), { image: imageId, shape: 'original' }] } : s)) }))
                      setAddTo('')
                    }}
                  >
                    Add
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="admin-panel-danger">
            {blockRemove ? (
              <p className="admin-field-hint">Can’t be removed: {blockRemove}</p>
            ) : confirmRemove ? (
              <div className="admin-confirm" role="alert">
                <span>
                  Remove this image from the project?
                  {u.sections.length ? ` It will be taken out of ${u.sections.length} section${u.sections.length > 1 ? 's' : ''}.` : ''}
                  {u.cover || u.phoneCover ? ' The project will have no cover.' : ''}
                </span>
                <button
                  type="button"
                  className="admin-btn admin-btn--small"
                  onClick={() => {
                    const next = pool[index + 1]?.id ?? pool[index - 1]?.id ?? null
                    set((p) => ({
                      ...p,
                      pool: p.pool.filter((i) => i.id !== imageId),
                      sections: (p.sections ?? []).map((s) => ({ ...s, images: (s.images ?? []).filter((r) => r.image !== imageId) })),
                      cover: {
                        ...p.cover,
                        ...(p.cover?.image === imageId ? { image: null, crop: null, phoneImage: null, phoneCrop: null } : {}),
                        ...(p.cover?.phoneImage === imageId ? { phoneImage: null, phoneCrop: null } : {}),
                      },
                    }))
                    if (next) onGo(next)
                    else onClose()
                  }}
                >
                  Remove image
                </button>
                <button type="button" className="admin-link" onClick={() => setConfirmRemove(false)}>
                  Keep it
                </button>
              </div>
            ) : (
              <button type="button" className="admin-link admin-link--danger" onClick={() => setConfirmRemove(true)}>
                Remove from project
              </button>
            )}
          </div>
        </fieldset>
      </aside>
    </div>
  )
  return createPortal(panel, document.body)
}
