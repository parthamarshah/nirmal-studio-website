// No real articles yet. The Journal section (src/components/Journal.jsx)
// hides itself entirely when this is empty — that's a deliberate choice over
// a "coming soon" state. Add entries here when real content exists; no
// component changes needed, as long as they match this shape:
//
// {
//   slug: 'unique-url-safe-id',   // used as the React key; no detail route yet
//   title: 'Post title',
//   excerpt: 'One or two sentences shown on the card.',
//   date: 'March 2026',           // rendered as-is, not parsed as a real Date
// }
export const journalPosts = []
