// No real social accounts exist yet — Instagram is coming soon. Contact.jsx
// renders an icon only for keys that aren't null, and renders nothing at all
// when every key is null, same "no placeholder until real content exists"
// precedent as journal.js/testimonials.js. Add a real URL below when the
// account exists; no component changes needed.
//
// If a URL is added here, also add it to the JSON-LD `sameAs` array in
// index.html by hand — that script tag is intentionally static HTML (not
// read from this file at runtime) so it's guaranteed present for crawlers.
export const social = {
  instagram: null,
  linkedin: null,
  facebook: null,
}
