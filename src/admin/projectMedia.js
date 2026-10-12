import { useEffect, useState } from 'react'
import { projectsIncludingHidden, site } from '../lib/content.js'
import { COVER_SPOTS, SPOT_NAMES, spotsUsing } from '../lib/projectRules.js'
import { stagedImageUrl } from './api.js'

// Image sources and usage for the project editor and its image panel.

const mediaPath = (slug, file) => `content/media/projects/${slug}/${file}`
// Images uploaded in this tab show from memory: no round trip, no wait for KV.
export const localPreviews = new Map()
export const originalSrc = (slug, file) => localPreviews.get(mediaPath(slug, file)) ?? stagedImageUrl(mediaPath(slug, file))

// A small, already-built copy for thumbnails when the image is unchanged since the last
// build; otherwise the original (fetched through /admin) with its rotation applied in CSS.
export function thumbFor(slug, img) {
  const built = projectsIncludingHidden.find((p) => p.slug === slug)?.pool.find((i) => i.id === img.id)
  if (built?.media && built.file === img.file && (built.rotation ?? 0) === (img.rotation ?? 0) && JSON.stringify(built.crop ?? null) === JSON.stringify(img.crop ?? null)) {
    return { src: built.media.srcSet?.split(' ')[0] || built.media.src, rotation: 0 }
  }
  return { src: originalSrc(slug, img.file), rotation: img.rotation ?? 0 }
}

// A rotated copy of an image as an object URL, for framing a rotated image the way the
// build will see it (rotate first, then crop). Cached for the life of the page.
const rotatedCache = new Map()
export function useRotated(src, rotation) {
  const key = `${src}|${rotation}`
  const [url, setUrl] = useState(() => (rotation ? rotatedCache.get(key) ?? null : src))
  useEffect(() => {
    if (!rotation) return setUrl(src)
    if (rotatedCache.has(key)) return setUrl(rotatedCache.get(key))
    let live = true
    setUrl(null)
    const im = new Image()
    im.onload = () => {
      const q = rotation % 180 !== 0
      const c = document.createElement('canvas')
      c.width = q ? im.naturalHeight : im.naturalWidth
      c.height = q ? im.naturalWidth : im.naturalHeight
      const g = c.getContext('2d')
      g.translate(c.width / 2, c.height / 2)
      g.rotate((rotation * Math.PI) / 180)
      g.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight / 2)
      c.toBlob((b) => {
        if (!b) return
        const u = URL.createObjectURL(b)
        rotatedCache.set(key, u)
        if (live) setUrl(u)
      }, 'image/jpeg', 0.9)
    }
    // A file that won't load: hand back the original, so the framer shows its own error
    // instead of "loading" forever.
    im.onerror = () => live && setUrl(src)
    im.src = src
    return () => {
      live = false
    }
  }, [src, rotation, key])
  return url
}

// Where each image is used: sections (by heading), the cover, homepage spots.
export function usage(doc) {
  const m = new Map((doc.pool ?? []).map((i) => [i.id, { sections: [], cover: false, phoneCover: false, spots: [] }]))
  for (const s of doc.sections ?? []) for (const r of s.images ?? []) m.get(r.image)?.sections.push(s)
  if (m.has(doc.cover?.image)) m.get(doc.cover.image).cover = true
  if (m.has(doc.cover?.phoneImage)) m.get(doc.cover.phoneImage).phoneCover = true
  for (const { spot, image } of spotsUsing(doc.slug, site.homepage)) {
    const id = image ?? (COVER_SPOTS.has(spot) ? doc.cover?.image : null)
    if (m.has(id)) m.get(id).spots.push(SPOT_NAMES[spot])
  }
  return m
}

