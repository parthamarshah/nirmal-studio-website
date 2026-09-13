// Renders a media object from src/lib/content.js: responsive srcset, real
// width/height (so the page never jumps while images load, and ScrollTrigger
// measures the right heights), and a tiny blurred placeholder behind photos.
//
// Every file it points at was produced by scripts/build-content.mjs, so the
// old "<source> pointing at a missing .webp shows a broken image" failure
// (CLAUDE.md) can't happen here.
//
// Props:
//   media       — required media object ({ src, srcSet, width, height, placeholder })
//   mobile      — optional second media object shown at ≤640px (portrait framing)
//   sizes       — how wide the image displays; lets the browser pick a small file on phones
//   intrinsic   — false omits width/height attributes, for images sized only by
//                 max-width/max-height (lightboxes), where they'd fight the CSS
//   placeholder — false skips the blurred background (letterboxed/contain images)
export default function Img({ media, mobile, sizes = '100vw', alt = '', imgRef, intrinsic = true, placeholder = true, style, ...rest }) {
  if (!media) return null
  const blur =
    placeholder && media.placeholder
      ? { backgroundImage: `url(${media.placeholder})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : null
  const img = (
    <img
      ref={imgRef}
      src={media.src}
      srcSet={media.srcSet}
      sizes={sizes}
      width={intrinsic ? media.width : undefined}
      height={intrinsic ? media.height : undefined}
      alt={alt}
      decoding="async"
      style={blur ? { ...blur, ...style } : style}
      {...rest}
    />
  )
  if (!mobile) return img
  return (
    <picture>
      <source media="(max-width: 640px)" srcSet={mobile.srcSet} sizes={sizes} width={mobile.width} height={mobile.height} />
      {img}
    </picture>
  )
}
