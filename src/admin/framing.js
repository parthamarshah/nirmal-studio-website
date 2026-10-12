// The 4:5 framing maths behind PhotoFramer.jsx — see the comment there.

const ASPECT = 4 / 5
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
export const base = (W, H) => (W / H > ASPECT ? { cw: H * ASPECT, ch: H } : { cw: W, ch: W / ASPECT })

export function fit(v, W, H) {
  const b = base(W, H)
  const z = clamp(v.z, 1, 4)
  const cw = b.cw / z
  const ch = b.ch / z
  return { z, cx: clamp(v.cx, cw / 2, W - cw / 2), cy: clamp(v.cy, ch / 2, H - ch / 2) }
}

export function toCrop(v, W, H) {
  const b = base(W, H)
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
export const centredCrop = (W, H) => toCrop({ z: 1, cx: W / 2, cy: H / 2 }, W, H)

export function fromCrop(crop, W, H) {
  if (!crop) return fit({ z: 1, cx: W / 2, cy: H / 2 }, W, H)
  return fit({ z: base(W, H).cw / (crop.w * W), cx: (crop.x + crop.w / 2) * W, cy: (crop.y + crop.h / 2) * H }, W, H)
}
