// Vite doesn't process public/ (see CLAUDE.md's image-path convention), so
// there's no import-graph-based image pipeline — WebP siblings were
// generated on disk this session next to every JPEG under public/images/,
// same filename/directory, .webp extension. Every floor-plan drawing
// (public/images/*/drawings-ground-floor.jpg) was deliberately excluded from
// that conversion and has no .webp sibling — the fine dimension text under
// each room label is already barely legible at full resolution, and lossy
// compression would make it worse. Never call this on a `drawings` path.
export const webp = (jpgPath) => (jpgPath ? jpgPath.replace(/\.jpe?g$/i, '.webp') : jpgPath)
