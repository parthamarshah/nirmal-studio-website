import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ProjectStory from '../components/ProjectStory.jsx'
import { originalSrc } from './projectMedia.js'

// "Preview": the project page as it would look if this draft were published, drawn by the
// site's own ProjectStory component from the draft. Images are made here from the
// originals — rotated and trimmed the way the build will — at preview size; the real
// ones (with filters, every size, the blur placeholder) are made at publish.
//
// Laptop layout only: the site's phone rules follow the screen's width, which a preview
// box can't fake. Loaded on demand from ProjectEditor.

// The site's heading font (index.html loads it for the public pages; /admin doesn't).
const FONT_CSS = `
@font-face { font-family: 'Fraunces'; font-style: normal; font-weight: 300 600; font-display: swap; src: url('/fonts/fraunces-v38-latin.woff2') format('woff2'); }
@font-face { font-family: 'Fraunces'; font-style: italic; font-weight: 400; font-display: swap; src: url('/fonts/fraunces-v38-italic-latin.woff2') format('woff2'); }
`

const cache = new Map()
// One image, rotated then cropped like scripts/build-content.mjs decoded(), at most `max` px.
function render(src, rotation, crop, max = 1600) {
  const key = `${src}|${rotation}|${crop ? `${crop.x},${crop.y},${crop.w},${crop.h}` : ''}`
  if (!cache.has(key)) {
    cache.set(
      key,
      new Promise((resolve, reject) => {
        const im = new Image()
        im.onerror = reject
        im.onload = () => {
          try {
          const q = rotation % 180 !== 0
          const W = q ? im.naturalHeight : im.naturalWidth
          const H = q ? im.naturalWidth : im.naturalHeight
          const r = crop ?? { x: 0, y: 0, w: 1, h: 1 }
          const cw = r.w * W
          const ch = r.h * H
          const s = Math.min(1, max / Math.max(cw, ch))
          const c = document.createElement('canvas')
          c.width = Math.max(1, Math.round(cw * s))
          c.height = Math.max(1, Math.round(ch * s))
          const g = c.getContext('2d')
          g.scale(s, s)
          g.translate(-r.x * W, -r.y * H)
          g.translate(W / 2, H / 2)
          g.rotate((rotation * Math.PI) / 180)
          g.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight / 2)
          c.toBlob((b) => (b ? resolve({ src: URL.createObjectURL(b), width: c.width, height: c.height }) : reject(new Error('blob'))), 'image/jpeg', 0.85)
          } catch (err) {
            // Out of memory on a phone, say: fail this image rather than hang the preview.
            reject(err)
          }
        }
        im.src = src
      }).catch((err) => {
        // Not remembered: a network blip shouldn't hide this image from every later preview.
        cache.delete(key)
        throw err
      }),
    )
  }
  return cache.get(key)
}

const media = (r, kind) => ({ kind, width: r.width, height: r.height, src: r.src, srcSet: undefined, placeholder: null })

async function previewProject(slug, doc) {
  const pool = (doc.pool ?? []).filter((i) => !i.hidden)
  const made = await Promise.all(
    pool.map(async (img) => {
      try {
        const r = await render(originalSrc(slug, img.file), img.rotation ?? 0, img.crop ?? null)
        return { ...img, media: media(r, img.type === 'drawing' ? 'drawing' : 'photo') }
      } catch {
        return null
      }
    }),
  )
  const byId = new Map(pool.map((i) => [i.id, i]))
  const coverOf = async (id, crop) => {
    const img = id ? byId.get(id) : null
    if (!img) return null
    try {
      return media(await render(originalSrc(slug, img.file), img.rotation ?? 0, crop ?? img.crop ?? null), 'photo')
    } catch {
      return null
    }
  }
  const cv = doc.cover ?? {}
  return {
    missing: made.filter((m) => !m).length,
    ...doc,
    facts: { custom: [], ...doc.facts },
    sections: doc.sections ?? [],
    pool: made.filter(Boolean),
    coverMedia: { desktop: await coverOf(cv.image, cv.crop), phone: null },
  }
}

export default function ProjectPreview({ slug, doc, onClose }) {
  const [project, setProject] = useState(null)
  const [failed, setFailed] = useState(false)
  const closeRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    let live = true
    previewProject(slug, doc).then(
      (p) => live && setProject(p),
      () => live && setFailed(true),
    )
    return () => {
      live = false
    }
  }, [slug, doc])

  useEffect(() => {
    const root = document.getElementById('admin-root')
    if (root) root.inert = true
    closeRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.repeat) onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      if (root) root.inert = false
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return createPortal(
    <div className="admin-preview" role="dialog" aria-modal="true" aria-label="Preview of this project" data-lenis-prevent="">
      <header className="admin-preview-bar">
        <span>
          <strong>Preview</strong> · laptop layout — how this project’s page will look once published{doc.hidden ? ' (it’s hidden, so visitors can’t open it yet)' : ''}. Images are approximate until then.
        </span>
        <button type="button" className="admin-btn" ref={closeRef} onClick={onClose}>
          Close preview
        </button>
      </header>
      <div className="admin-preview-page">
        <style>{FONT_CSS}</style>
        {failed ? (
          <p>The preview couldn’t be made. Your changes are fine — this only affects the preview.</p>
        ) : !project ? (
          <p className="admin-hint">Preparing the preview…</p>
        ) : (
          <article className="admin-preview-article">
            {project.missing > 0 && (
              <p className="admin-note admin-note--warn">
                {project.missing} image{project.missing > 1 ? 's' : ''} couldn’t be shown in this preview. Your changes are fine — try Close preview and Preview again.
              </p>
            )}
            <ProjectStory project={project} titleLevel={1} showShare={false} onOpenImage={() => {}} />
          </article>
        )}
      </div>
    </div>,
    document.body,
  )
}
