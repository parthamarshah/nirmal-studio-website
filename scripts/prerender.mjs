// Runs after `vite build`: writes dist/projects/<slug>/index.html for every
// visible project — the real page content plus its own title, description,
// canonical link and link-preview image, so WhatsApp, Facebook, LinkedIn and
// Google see a proper page without running JavaScript. The browser then
// hydrates it (src/main.jsx).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { build } from 'vite'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const SSR_OUT = path.join(ROOT, 'node_modules', '.cache', 'nirmal-prerender')
const SITE_URL = 'https://nirmalstudio.com'

await build({
  root: ROOT,
  logLevel: 'warn',
  build: { ssr: path.join(ROOT, 'src/entry-server.jsx'), outDir: SSR_OUT, emptyOutDir: true, copyPublicDir: false },
})
const entry = fs.readdirSync(SSR_OUT).find((f) => /^entry-server\.m?js$/.test(f))
const { renderProject, visibleProjects } = await import(pathToFileURL(path.join(SSR_OUT, entry)).href)

const template = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')
const escapeAttr = (s) => String(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
const escapeText = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;')

// Replace the content="…" of one <meta>/<link> tag, matched by its identifying
// attribute; fails loudly if the template ever loses the tag.
function setTag(html, attr, value, contentAttr = 'content') {
  const re = new RegExp(`(<(?:meta|link)\\s+[^>]*${attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*?\\s${contentAttr}=")[^"]*(")`, 's')
  const re2 = new RegExp(`(<(?:meta|link)\\s+[^>]*?\\s${contentAttr}=")[^"]*("[^>]*${attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 's')
  if (re.test(html)) return html.replace(re, (_, a, b) => `${a}${escapeAttr(value)}${b}`)
  if (re2.test(html)) return html.replace(re2, (_, a, b) => `${a}${escapeAttr(value)}${b}`)
  throw new Error(`prerender: index.html has no tag matching ${attr}`)
}

const plain = (doc) =>
  (doc?.content || [])
    .flatMap(function walk(n) {
      return n.text ? [n.text] : (n.content || []).flatMap(walk)
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

let count = 0
for (const p of visibleProjects) {
  const where = [p.facts.type, p.facts.city].filter(Boolean).join(' in ')
  const title = `${p.name}${where ? ` — ${where}` : ''} | Nirmal Studio`
  const firstText = p.sections.map((s) => plain(s.body)).find(Boolean)
  const description = (firstText || `${p.name}, a Nirmal Studio project${p.facts.city ? ` in ${p.facts.city}` : ''}.`).slice(0, 200)
  const url = `${SITE_URL}/projects/${p.slug}/`

  let html = template.replace(/<title>[^<]*<\/title>/, `<title>${escapeText(title)}</title>`)
  html = setTag(html, 'name="description"', description)
  html = setTag(html, 'rel="canonical"', url, 'href')
  html = setTag(html, 'property="og:url"', url)
  html = setTag(html, 'property="og:type"', 'article')
  html = setTag(html, 'property="og:title"', title)
  html = setTag(html, 'property="og:description"', description)
  html = setTag(html, 'name="twitter:title"', title)
  html = setTag(html, 'name="twitter:description"', description)
  if (p.shareImage) {
    html = setTag(html, 'property="og:image"', p.shareImage)
    html = setTag(html, 'name="twitter:image"', p.shareImage)
  }
  if (!html.includes('<div id="root"></div>')) throw new Error('prerender: index.html has no empty <div id="root"></div>')
  html = html.replace('<div id="root"></div>', () => `<div id="root">${renderProject(p.slug)}</div>`)

  const out = path.join(DIST, 'projects', p.slug, 'index.html')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, html)
  count++
}

fs.rmSync(SSR_OUT, { recursive: true, force: true })
console.log(`✓ Pre-rendered ${count} project page${count === 1 ? '' : 's'}`)

// Which commit this build is. The /admin status check reads it to answer "is my publish
// live yet?" by looking at the site itself (functions/api/admin/status.js explains why
// not the Cloudflare API). Cloudflare's Git builds set CF_PAGES_COMMIT_SHA; a local or
// direct-upload build falls back to the checked-out commit.
let commit = process.env.CF_PAGES_COMMIT_SHA || null
if (!commit) {
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
  } catch {
    commit = null
  }
}
fs.writeFileSync(path.join(DIST, '_version.json'), JSON.stringify({ commit }) + '\n')
