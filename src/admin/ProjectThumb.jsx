import { thumbFor } from './projectMedia.js'

// A square thumbnail of one project image (see thumbFor for which copy it shows).
export default function Thumb({ slug, img, className = '' }) {
  const t = thumbFor(slug, img)
  return (
    <span className={`admin-thumb ${className}`}>
      <img src={t.src} alt="" loading="lazy" draggable={false} style={t.rotation ? { transform: `rotate(${t.rotation}deg)` } : undefined} />
    </span>
  )
}

