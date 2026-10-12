// The framing maths behind PhotoFramer.jsx — see the comment there. `a` is the frame's
// aspect ratio (width / height): 4:5 for founder photos, 16:9 for a project cover, and so on.

const PORTRAIT = 4 / 5
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
export const base = (W, H, a = PORTRAIT) => (W / H > a ? { cw: H * a, ch: H } : { cw: W, ch: W / a })

export function fit(v, W, H, a = PORTRAIT) {
  const b = base(W, H, a)
  const z = clamp(v.z, 1, 4)
  const cw = b.cw / z
  const ch = b.ch / z
  return { z, cx: clamp(v.cx, cw / 2, W - cw / 2), cy: clamp(v.cy, ch / 2, H - ch / 2) }
}

export function toCrop(v, W, H, a = PORTRAIT) {
  const b = base(W, H, a)
  const r = (n) => Math.round(n * 1e5) / 1e5
  const w = r(b.cw / v.z / W)
  const h = r(b.ch / v.z / H)
  return {
    x: clamp(r((v.cx - (b.cw / v.z) / 2) / W), 0, 1 - w),
    y: clamp(r((v.cy - (b.ch / v.z) / 2) / H), 0, 1 - h),
    w,
    h,
  }
}

// The framing a fresh upload starts with: the whole width or height, centred.
export const centredCrop = (W, H, a = PORTRAIT) => toCrop({ z: 1, cx: W / 2, cy: H / 2 }, W, H, a)

// A stored crop back to a view. A crop made for another shape keeps its centre and width.
export function fromCrop(crop, W, H, a = PORTRAIT) {
  if (!crop) return fit({ z: 1, cx: W / 2, cy: H / 2 }, W, H, a)
  return fit({ z: base(W, H, a).cw / (crop.w * W), cx: (crop.x + crop.w / 2) * W, cy: (crop.y + crop.h / 2) * H }, W, H, a)
}
