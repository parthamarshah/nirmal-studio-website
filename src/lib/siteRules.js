// What content/site.json may look like when it comes from the /admin Settings editor.
// Imported by the editor AND by the server's publish check
// (functions/api/admin/_lib/documents.js), like projectRules.js — plain JS, no browser or
// Worker APIs. scripts/build-content.mjs (the `if (site)` block) stays the authority;
// these are the same rules plus a few limits of their own, never looser.

import { COVER_SPOTS, SPOT_NAMES } from './projectRules.js'

export const CONTACT_FIELDS = [
  { key: 'phoneDisplay', label: 'Phone, as shown on the site', required: true, hint: 'e.g. 910 699 8434' },
  { key: 'phone', label: 'Phone, for the dial link', required: true, hint: 'With country code, e.g. +919106998434' },
  { key: 'whatsapp', label: 'WhatsApp number', required: true, hint: 'Digits only, with country code — 91 is added if you leave it out', pattern: /^\d{8,15}$/, patternError: 'Digits only, 8–15 of them, including the country code.' },
  { key: 'whatsappGreeting', label: 'First WhatsApp message', required: false, hint: 'What the message box starts with when someone taps WhatsApp.' },
  { key: 'email', label: 'Email', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternError: 'That doesn’t look like an email address.' },
  { key: 'address', label: 'Studio address', required: true, multiline: true },
  { key: 'addressShort', label: 'Short address', required: false, hint: 'Used on the “Visit” link, e.g. Ambavadi, Ahmedabad' },
  { key: 'hours', label: 'Studio hours', required: false, hint: 'Shown next to “Visit” in Talk with Us, e.g. Mon–Sat, 10am–7pm. Leave empty to show nothing.' },
  { key: 'replyTime', label: 'Reply time', required: false, hint: 'Shown under the WhatsApp button, e.g. Usually replies within a few hours. Leave empty to show nothing.' },
]
const TEXT_MAX = 300

// Facebook, Instagram, LinkedIn. (The site's WhatsApp link is always the contact number.)
export const SOCIALS = [
  { key: 'instagram', label: 'Instagram', example: 'https://www.instagram.com/…' },
  { key: 'facebook', label: 'Facebook', example: 'https://www.facebook.com/…' },
  { key: 'linkedin', label: 'LinkedIn', example: 'https://www.linkedin.com/company/…' },
]
const SOCIAL_KEYS = ['facebook', 'instagram', 'whatsapp', 'linkedin']

export const SECTIONS = [
  { key: 'statement', label: 'Statement' },
  { key: 'focusImage', label: 'Focus image' },
  { key: 'philosophy', label: 'Philosophy' },
  { key: 'ideaTimeline', label: 'From idea to building (timeline)' },
  { key: 'featuredProjects', label: 'Featured projects' },
  { key: 'studio', label: 'The studio (founders)' },
  { key: 'process', label: 'Process' },
  { key: 'contact', label: 'Contact' },
]

export const SPOTS = [
  { key: 'hero', label: 'Hero — the first image on the homepage' },
  { key: 'focus', label: 'Focus image' },
  { key: 'philosophy', label: 'Philosophy image' },
  { key: 'timeline', label: 'Timeline project' },
  { key: 'shareImage', label: 'Link preview (WhatsApp, Facebook…)' },
]

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isStr = (v) => typeof v === 'string' && v.trim().length > 0
const isNullableStr = (v) => v === null || v === undefined || typeof v === 'string'
const isHttps = (v) => {
  try {
    return new URL(v).protocol === 'https:'
  } catch {
    return false
  }
}

export function contactProblem(f, value) {
  if (!isNullableStr(value)) return 'This must be text.'
  const v = (value ?? '').trim()
  if (!v) return f.required ? 'This can’t be empty.' : null
  if (value.length > TEXT_MAX) return `Keep this to ${TEXT_MAX} characters.`
  // Tested untrimmed, exactly as the build tests it.
  if (f.pattern && !f.pattern.test(value)) return f.patternError
  return null
}

export function socialProblem(key, v) {
  if (!isObj(v) || typeof v.on !== 'boolean') return 'needs an on/off switch'
  if (Object.keys(v).some((k) => k !== 'on' && k !== 'url')) return 'has settings this editor doesn’t know'
  if (!isNullableStr(v.url)) return 'must be text'
  if (key !== 'whatsapp' && v.url != null && v.url !== '' && !isHttps(v.url)) return 'must be a full link starting https://'
  if (v.on && key !== 'whatsapp' && !isStr(v.url)) return 'is switched on but has no link'
  return null
}

// Every problem with a settings document, as { where, text }. `projects`: Map(slug → the
// project document as this publish would leave it), for the homepage checks; omitted, the
// homepage is checked for shape only.
export function siteProblems(doc, { projects } = {}) {
  const out = []
  const add = (where, text) => out.push({ where, text })
  if (!isObj(doc)) return [{ where: 'site', text: 'The settings are broken.' }]
  const c = doc.contact
  if (!isObj(c)) add('contact', 'The contact details are missing.')
  else {
    const known = new Set(CONTACT_FIELDS.map((f) => f.key))
    if (Object.keys(c).some((k) => !known.has(k))) add('contact', 'The contact details have a part this editor doesn’t know.')
    for (const f of CONTACT_FIELDS) {
      const p = contactProblem(f, c[f.key])
      if (p) add(`contact:${f.key}`, `${f.label}: ${p}`)
    }
  }
  const s = doc.socials
  if (!isObj(s)) add('socials', 'The social links are missing.')
  else {
    if (Object.keys(s).some((k) => !SOCIAL_KEYS.includes(k))) add('socials', 'There is a social link this editor doesn’t know.')
    for (const k of SOCIAL_KEYS) {
      const p = socialProblem(k, s[k])
      if (p) add(`socials:${k}`, `${SOCIALS.find((x) => x.key === k)?.label ?? k} ${p}.`)
    }
  }
  const sec = doc.sections
  if (!isObj(sec)) add('sections', 'The section switches are missing.')
  else {
    if (Object.keys(sec).some((k) => !SECTIONS.some((x) => x.key === k))) add('sections', 'There is a section this editor doesn’t know.')
    for (const x of SECTIONS) if (typeof sec[x.key] !== 'boolean') add('sections', `${x.label} needs an on/off switch.`)
  }
  const h = doc.homepage
  if (!isObj(h)) add('homepage', 'The homepage images are missing.')
  else {
    if (Object.keys(h).some((k) => !SPOTS.some((x) => x.key === k))) add('homepage', 'There is a homepage spot this editor doesn’t know.')
    for (const { key } of SPOTS) {
      const v = h[key]
      const where = `homepage:${key}`
      const name = SPOT_NAMES[key][0].toUpperCase() + SPOT_NAMES[key].slice(1)
      if (!isObj(v) || !isStr(v.project)) {
        add(where, `${name}: choose a project.`)
        continue
      }
      if (Object.keys(v).some((k) => k !== 'project' && k !== 'image')) add(where, `${name} has settings this editor doesn’t know.`)
      if (v.image != null && !isStr(v.image)) add(where, `${name}: the image choice is broken.`)
      if (!projects) continue
      const p = projects.get(v.project)
      if (!p || p.deleted) {
        add(where, `${name}: that project doesn’t exist (or is in Trash).`)
        continue
      }
      if (p.hidden) add(where, `${name}: ${p.name} is hidden on the site — show it, or choose another project.`)
      const pool = new Map((p.pool ?? []).map((i) => [i.id, i]))
      const id = v.image ?? (COVER_SPOTS.has(key) ? p.cover?.image : null)
      if (v.image != null && !pool.has(v.image)) add(where, `${name}: that image isn’t in ${p.name} any more.`)
      else if (id && pool.get(id)?.hidden) add(where, `${name}: that image of ${p.name} is hidden.`)
      else if (COVER_SPOTS.has(key) && !id) add(where, `${name}: ${p.name} has no cover image — choose one of its images here, or give it a cover.`)
    }
  }
  return out
}
