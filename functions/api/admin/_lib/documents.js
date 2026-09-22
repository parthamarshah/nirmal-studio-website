// What a draft id means on disk, how a document is written, and what may be published.

// The same ids draft.js accepts.
export const DOC_ID = /^(site|founders|project:[a-z0-9][a-z0-9-]{0,79})$/

export function pathFor(id) {
  if (id === 'site') return 'content/site.json'
  if (id === 'founders') return 'content/founders.json'
  if (id.startsWith('project:')) return `content/projects/${id.slice('project:'.length)}.json`
  return null
}

// The line that makes "a publish can never touch code" checkable rather than argued:
// every path a publish or an undo writes goes through this, whatever computed it.
const CONTENT_PATH = /^content\/(site\.json|founders\.json|projects\/[a-z0-9][a-z0-9-]*\.json)$/
export const isContentPath = (p) => CONTENT_PATH.test(p)

// Exactly how content/*.json is formatted in the repo — two-space indent, trailing
// newline. Verified byte-for-byte against every file on 2026-09-22; if this drifted,
// every publish would rewrite whole files and the diff would stop being readable.
export const serialize = (doc) => JSON.stringify(doc, null, 2) + '\n'

export function label(id, doc) {
  if (id === 'site') return 'Studio settings'
  if (id === 'founders') return 'Founders'
  return `Project: ${doc?.name || id.slice('project:'.length)}`
}

// A short "what changed" for the commit message and the publish history. For settings it
// names the contact fields, which is what the editor can change today.
export function describeChange(id, doc, published) {
  const name = label(id, doc)
  if (id !== 'site' || !published) return name
  const keys = new Set([...Object.keys(doc.contact || {}), ...Object.keys(published.contact || {})])
  const changed = [...keys].filter((k) => !same(doc.contact?.[k], published.contact?.[k]))
  const other = Object.keys({ ...doc, ...published }).filter((k) => k !== 'contact' && !same(doc[k], published[k]))
  const parts = [...changed.map((k) => CONTACT_LABELS[k] || k), ...other]
  return parts.length ? `${name} — ${parts.join(', ')}` : name
}

// Field by field, old → new, for the Publish confirmation. A publish can change the
// phone or WhatsApp number people use to reach Tej, so "Publish Studio settings?" is not
// enough to decide on — the values are.
export function listChanges(id, doc, published) {
  if (id !== 'site' || !doc) return []
  const from = published?.contact || {}
  const to = doc.contact || {}
  return [...new Set([...Object.keys(from), ...Object.keys(to)])]
    .filter((k) => !same(to[k], from[k]))
    .map((k) => ({ field: CONTACT_LABELS[k] || k, from: from[k] ?? null, to: to[k] ?? null }))
}

const CONTACT_LABELS = {
  phoneDisplay: 'phone (shown)',
  phone: 'phone (dial link)',
  whatsapp: 'WhatsApp number',
  whatsappGreeting: 'WhatsApp message',
  email: 'email',
  address: 'address',
  addressShort: 'short address',
  hours: 'hours',
  replyTime: 'reply time',
}

// Order-insensitive deep equality for plain JSON values.
export function same(a, b) {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return (a ?? null) === (b ?? null)
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => same(v, b[i]))
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && same(a[k], b[k]))
}

// ---------------------------------------------------------------- validation
//
// scripts/build-content.mjs is the authority: it runs on every build and a failure there
// keeps the previous deploy live. This exists so a mistake shows up in the editor with
// the draft kept, instead of as a failed build nobody is watching.
//
// It deliberately covers only what an editor can produce today — the contact block. The
// contact rules therefore live in THREE places, which is the cost of the build running
// in Node and this running in a Worker: build-content.mjs (the `if (site)` block),
// src/admin/SettingsEditor.jsx (FIELDS), and here. Change one, change all three.
//
// Everything else in site.json references other documents (homepage spots → a project's
// images), which only the build can see. No editor changes those parts yet, so rather
// than half-check them they must be IDENTICAL to what is published; when the Phase 3
// editors start changing them, this is where their checks go.

const isStr = (v) => typeof v === 'string' && v.trim().length > 0
const isNullableStr = (v) => v === null || v === undefined || typeof v === 'string'
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

export function validate(id, doc, published) {
  if (id !== 'site') {
    // No editor writes these yet, so nothing has checked a draft of them either.
    return [`${label(id, doc)} can’t be published from here yet — its editor hasn’t been built.`]
  }
  const problems = []
  const c = doc.contact
  if (!isObj(c)) return ['The contact details are missing.']
  const names = { email: 'Email', phone: 'Phone, for the dial link', phoneDisplay: 'Phone, as shown on the site', whatsapp: 'WhatsApp number', address: 'Studio address' }
  for (const [k, n] of Object.entries(names)) if (!isStr(c[k])) problems.push(`${n} can’t be empty.`)
  for (const k of ['whatsappGreeting', 'hours', 'replyTime', 'addressShort']) if (!isNullableStr(c[k])) problems.push(`${CONTACT_LABELS[k]} must be text.`)
  if (isStr(c.whatsapp) && !/^\d{8,15}$/.test(c.whatsapp)) problems.push('WhatsApp number must be digits only, 8–15 of them, including the country code.')
  if (isStr(c.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) problems.push('That email doesn’t look like an email address.')

  if (!published) problems.push('There is no published settings file to compare with, so this can’t be checked.')
  else
    for (const k of new Set([...Object.keys(doc), ...Object.keys(published)])) {
      if (k !== 'contact' && !same(doc[k], published[k])) problems.push(`“${k}” was changed, and nothing here can check that part yet.`)
    }
  return problems
}
