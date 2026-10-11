// Getting an image from someone's Mac or phone into a shape the site's build accepts,
// in the browser, before it is uploaded.
//
// - iPhone HEIC files are converted to JPEG. The build only takes JPEG/PNG/WebP, and
//   Chrome/Edge/Firefox can't even display HEIC. The converter (a few MB of WebAssembly)
//   is loaded only when a HEIC actually turns up, and only ever in the admin.
// - The camera's rotation flag is applied and then dropped, along with everything else
//   in the file's metadata (GPS location included) — re-drawing through a canvas keeps
//   only the pixels.
// - It is shrunk so the longest side is at most `maxEdge`: 2400px for photos and
//   renders, 4000px for drawings, whose dimension text needs it (CLAUDE.md). Larger
//   originals would only be shrunk again by the build, after costing upload time and
//   repository space.

const HEIC = /\.(heic|heif)$/i

export class ImageError extends Error {}

async function decode(file) {
  // Safari (Mac and iPhone) decodes HEIC itself; this succeeds there and on every
  // ordinary JPEG/PNG/WebP. 'from-image' applies the EXIF rotation.
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // An older engine may reject the option rather than the file — try without it, then
    // the plain <img> decoder, before deciding it isn't an image. (<img> and current
    // browsers apply the rotation flag by default anyway.)
  }
  try {
    return await createImageBitmap(file)
  } catch {
    // fall through
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    if (img.naturalWidth) return img
  } catch {
    // fall through
  } finally {
    URL.revokeObjectURL(url)
  }
  const looksHeic = HEIC.test(file.name || '') || /hei[cf]/i.test(file.type || '')
  if (!looksHeic) throw new ImageError(`“${file.name}” isn’t an image this browser can open. Use a JPEG, PNG, WebP or iPhone (HEIC) photo.`)
  try {
    const { heicTo } = await import('heic-to')
    return await heicTo({ blob: file, type: 'bitmap', options: { imageOrientation: 'from-image' } })
  } catch {
    throw new ImageError(`Couldn’t convert the iPhone photo “${file.name}”. Try exporting it as a JPEG first.`)
  }
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).slice(String(r.result).indexOf(',') + 1))
    r.onerror = () => reject(new ImageError('Couldn’t read the converted image.'))
    r.readAsDataURL(blob)
  })
}

// → { base64, blob, width, height, originalWidth, originalHeight, previewUrl }
// The caller owns previewUrl and should URL.revokeObjectURL it when done.
export async function prepareImage(file, { maxEdge = 2400, quality = 0.88 } = {}) {
  const bitmap = await decode(file)
  const originalWidth = bitmap.naturalWidth || bitmap.width
  const originalHeight = bitmap.naturalHeight || bitmap.height
  const scale = Math.min(1, maxEdge / Math.max(originalWidth, originalHeight))
  const width = Math.max(1, Math.round(originalWidth * scale))
  const height = Math.max(1, Math.round(originalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  // iOS returns null here when it is short of memory.
  if (!ctx) throw new ImageError(`Not enough memory to process “${file.name}”. Close other tabs and try again, or use a smaller copy.`)
  // JPEG has no transparency: a transparent PNG would otherwise turn black where it's clear.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  // Safari can return null for a canvas bigger than its memory budget allows.
  if (!blob) throw new ImageError(`“${file.name}” is too large for this browser to process. Try a smaller copy.`)
  canvas.width = canvas.height = 0
  return { base64: await toBase64(blob), blob, width, height, originalWidth, originalHeight, previewUrl: URL.createObjectURL(blob) }
}
