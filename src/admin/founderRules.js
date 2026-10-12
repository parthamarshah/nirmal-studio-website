// The founders rules, for feedback while typing. The build (scripts/build-content.mjs,
// founders block) is the authority and functions/api/admin/_lib/documents.js re-checks
// on Publish — change one, change all three.

export const FOUNDER_ID = 'tej-shah'
const BIO_WORDS = { founder: [70, 100], others: [50, 80] }
export const bioLimits = (id) => (id === FOUNDER_ID ? BIO_WORDS.founder : BIO_WORDS.others)
export const countWords = (s) => (s ? String(s).trim().split(/\s+/).filter(Boolean).length : 0)

// Not a build rule — guidance only. The site's own fallback intros are 15 and 40 words;
// much past this and the intro starts competing with the people under it.
export const INTRO_WORDS_SOFT_MAX = 60

export const CONTACTS = [
  { key: 'whatsapp', label: 'WhatsApp', example: '919106998434', inputMode: 'numeric' },
  { key: 'email', label: 'Email', example: 'name@nirmalstudio.com', inputMode: 'email' },
  { key: 'linkedin', label: 'LinkedIn', example: 'https://www.linkedin.com/in/…', inputMode: 'url' },
  { key: 'instagram', label: 'Instagram', example: 'https://www.instagram.com/…', inputMode: 'url' },
]

const isStr = (v) => typeof v === 'string' && v.trim().length > 0
const isHttps = (v) => {
  try {
    return new URL(v).protocol === 'https:'
  } catch {
    return false
  }
}

export function contactProblem(key, c) {
  if (!c?.on) return null
  if (!isStr(c.value)) return 'Switched on but empty — add it, or switch it off.'
  if ((key === 'linkedin' || key === 'instagram') && !isHttps(c.value)) return 'Use the full link, starting https://'
  if (key === 'whatsapp' && !/^\d{8,15}$/.test(c.value)) return 'Digits only, 8–15 of them, including the country code (e.g. 919106998434).'
  if (key === 'email' && !/^[^\s@?&]+@[^\s@?&]+\.[^\s@?&]+$/.test(c.value)) return 'That doesn’t look like an email address.'
  return null
}

// Too many words blocks Publish (the build would refuse it). Too few only warns.
export function bioState(person) {
  const [min, max] = bioLimits(person.id)
  const n = countWords(person.bio)
  if (n > max) return { n, min, max, level: 'error', text: `${n} words — ${n - max} over the ${max}-word limit. It can’t be published like this.` }
  if (n === 0) return { n, min, max, level: 'empty', text: `${min}–${max} words. Needed before the new founders section can go live.` }
  if (n < min) return { n, min, max, level: 'warn', text: `${n} words — ${min}–${max} keeps the cards even.` }
  return { n, min, max, level: 'ok', text: `${n} words · ${min}–${max}` }
}

// Every problem that would stop a publish, per person id ('intro' for the intros).
export function personProblems(person) {
  const out = []
  if (bioState(person).level === 'error') out.push('bio')
  for (const c of CONTACTS) if (contactProblem(c.key, person.contacts?.[c.key])) out.push(c.label)
  return out
}
