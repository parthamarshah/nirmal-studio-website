import { useEffect, useRef, useState } from 'react'
import { base, fit, fromCrop, toCrop } from './framing.js'

// A fixed-shape frame (4:5 unless `aspect` says otherwise) over a photo: drag to move it, slide (or +/−) to zoom. What it stores
// is the build's own crop format — {x, y, w, h} as fractions of the image — so the site
// shows exactly this framing (scripts/build-content.mjs crops before resizing).
//
// The image it frames is the uploaded file, already rotated upright and stripped of its
// rotation flag by images.js, so "fractions of the image" mean the same thing here and in
// the build. A published photo is framed from its original, fetched through the admin.
//
// Internally the view is a zoom (1 = the largest 4:5 that fits) and a centre point in
// image pixels; it becomes a crop only when handed back.

// Close to what the build's colour matrices do (warm = 30% sepia, a little saturation;
// b&w = luminance plus a touch of contrast). The real version is made at publish.
const FILTER_CSS = { original: 'none', warm: 'sepia(0.3) saturate(1.12) brightness(1.02)', bw: 'grayscale(1) contrast(1.08)' }

// Below this many pixels across, a portrait starts to look soft at the size the founders
// section shows it on a laptop (about 350px wide, on a 2–3x screen).
const SOFT_BELOW = 700

export default function PhotoFramer({ src, crop, filter = 'original', disabled, onChange, label, aspect = 4 / 5, softBelow = SOFT_BELOW }) {
  const frameRef = useRef(null)
  // The image's own pixel size, tagged with the src it was measured from: a new photo
  // counts as not loaded until its own load event. (Not reset in an effect — a cached image
  // can fire `load` before that effect runs, which would wipe its size for good.)
  const [loaded, setLoaded] = useState(null)
  const dims = loaded?.src === src && !loaded.failed ? loaded : null
  const failed = loaded?.src === src && loaded.failed
  const [frameW, setFrameW] = useState(0)
  const [view, setViewState] = useState(null)
  // The view as of the last change, for handlers that run before the next render.
  const viewRef = useRef(null)
  const setView = (v) => {
    viewRef.current = v
    setViewState(v)
  }
  const cropRef = useRef(crop)
  cropRef.current = crop
  const drag = useRef(null)


  // Follow the stored crop (an undo, a reload, a conflict resolved) — except mid-drag,
  // where the view on screen is newer than what has been saved.
  const cropKey = crop ? `${crop.x},${crop.y},${crop.w},${crop.h}` : ''
  useEffect(() => {
    if (!dims || drag.current) return
    // cropKey stands in for crop, whose object is new on every render.
    setView(fromCrop(cropRef.current, dims.W, dims.H, aspect))
  }, [dims, cropKey, aspect])

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setFrameW(el.clientWidth))
    ro.observe(el)
    setFrameW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const commit = (v) => onChange?.({ crop: toCrop(v, dims.W, dims.H, aspect), zoom: Math.round(v.z * 100) / 100 })

  const ready = dims && view && frameW
  const b = dims ? base(dims.W, dims.H, aspect) : null
  const cw = ready ? b.cw / view.z : 0
  const s = ready ? frameW / cw : 1 // screen px per image px

  const onPointerDown = (e) => {
    if (disabled || !ready || e.button > 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, view }
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    setView(fit({ z: d.view.z, cx: d.view.cx - (e.clientX - d.x) / s, cy: d.view.cy - (e.clientY - d.y) / s }, dims.W, dims.H, aspect))
  }
  const endDrag = (e) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    if (viewRef.current !== d.view) commit(viewRef.current)
  }

  const zoomTo = (z) => {
    const v = fit({ ...view, z }, dims.W, dims.H, aspect)
    setView(v)
    commit(v)
  }

  const onKeyDown = (e) => {
    if (disabled || !ready) return
    const step = cw * (e.shiftKey ? 0.1 : 0.02)
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (moves[e.key]) {
      e.preventDefault()
      const v = fit({ ...view, cx: view.cx + moves[e.key][0], cy: view.cy + moves[e.key][1] }, dims.W, dims.H, aspect)
      setView(v)
      commit(v)
    } else if (e.key === '+' || e.key === '=' || e.key === '-') {
      e.preventDefault()
      zoomTo(view.z + (e.key === '-' ? -0.1 : 0.1))
    }
  }

  const imgStyle = ready
    ? {
        width: dims.W * s,
        height: dims.H * s,
        left: -(view.cx - cw / 2) * s,
        top: -(view.cy - (b.ch / view.z) / 2) * s,
        filter: FILTER_CSS[filter] || 'none',
      }
    : { visibility: 'hidden' }
  const usedPx = ready ? Math.round(cw) : null

  return (
    <div className="admin-framer">
      <div
        ref={frameRef}
        className={`admin-framer-frame${disabled ? ' is-disabled' : ''}`}
        style={{ aspectRatio: aspect }}
        role="group"
        aria-label={`${label}. Drag, or use the arrow keys, to move the framing; plus and minus to zoom.`}
        tabIndex={disabled || !ready ? -1 : 0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          style={imgStyle}
          onLoad={(e) => setLoaded({ src, W: e.currentTarget.naturalWidth, H: e.currentTarget.naturalHeight })}
          onError={() => setLoaded({ src, failed: true })}
        />
        {!ready && <p className="admin-framer-msg">{failed ? 'Couldn’t load this photo — reload the page, or choose Replace photo.' : 'Loading photo…'}</p>}
      </div>
      <p className="admin-field-hint admin-framer-how">Drag to reframe.</p>
      <label className="admin-framer-zoom">
        <span>Zoom</span>
        <input
          type="range"
          min="1"
          max="4"
          step="0.01"
          value={view?.z ?? 1}
          disabled={disabled || !ready}
          onChange={(e) => zoomTo(Number(e.target.value))}
        />
      </label>
      {usedPx != null && usedPx < softBelow && (
        <p className="admin-field-hint admin-framer-soft">
          This framing uses only {usedPx}px of the photo’s width, so it may look soft on large screens. Zoom out, or use a
          bigger photo.
        </p>
      )}
    </div>
  )
}
