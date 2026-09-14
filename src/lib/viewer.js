// Size for a floor plan in a zoomable ("pan") viewer: big enough that dimension
// text is readable — about twice the screen width on phones, the drawing's real
// pixel size on larger screens — and never wider than the file itself. The
// global `img { max-width: 100% }` rule would otherwise shrink it to fit.
export const panImageStyle = (media) => ({
  display: 'block',
  margin: '0 auto',
  position: 'relative',
  zIndex: 1,
  maxWidth: 'none',
  width: `min(${media.width}px, max(200vw, 100%))`,
  height: 'auto',
})
