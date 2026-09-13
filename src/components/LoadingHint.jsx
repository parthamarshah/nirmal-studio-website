// Quiet "Loading…" text for full-screen image viewers. It sits centred behind
// the image (fixed, so it stays centred while a drawing is panned); the opaque
// image covers it the moment it loads. Viewers fetch a larger file than the
// thumbnail the visitor tapped, so without this a slow connection shows only
// a black screen.
export default function LoadingHint() {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 0,
        color: 'rgba(251, 250, 246, 0.55)',
        fontFamily: 'var(--font-body)',
        fontSize: '0.75rem',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        pointerEvents: 'none',
      }}
    >
      Loading…
    </span>
  )
}
