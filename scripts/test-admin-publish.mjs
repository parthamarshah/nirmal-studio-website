// Driven by test-admin-publish.sh, which starts the dev server against a throwaway branch.
// Checks the API's answers AND what actually landed on GitHub — the second half is the
// point: "one commit, only content/, Undo restores the bytes exactly" is a claim about
// the repository, not about a JSON response.
import fs from 'node:fs'
import crypto from 'node:crypto'

const { BASE, PIN, BRANCH } = process.env
const REPO = 'parthamarshah/nirmal-studio-website'
const token = fs.readFileSync('.dev.vars.real', 'utf8').match(/^GITHUB_TOKEN=(.*)$/m)?.[1]?.trim()
if (!token) throw new Error('no GITHUB_TOKEN in .dev.vars')

let pass = 0
let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) {
    pass++
    console.log(` PASS  ${name}`)
  } else {
    failed++
    console.log(` FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

let cookie = ''
async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
  // Only a login sets the session; a 401 also sends a Set-Cookie, clearing it.
  const set = res.headers.get('set-cookie')
  if (set && path === 'login' && res.ok) cookie = set.split(';')[0]
  return { status: res.status, data: await res.json().catch(() => null) }
}

async function gh(path) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'nirmal-publish-test' },
  })
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${path}`)
  return res.json()
}
const head = async () => (await gh(`/git/ref/heads/${BRANCH}`)).object.sha
const blobAt = async (path, ref) => (await gh(`/contents/${path}?ref=${ref}`)).sha
const gitSha = (text) => {
  const b = Buffer.from(text)
  return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex')
}

console.log(`--- against branch ${BRANCH} ---`)
check('publish without a session is refused', (await call('publish')).status === 401)
check('signed in', (await call('login', { method: 'POST', body: { pin: PIN } })).status === 200)

const me = await call('me')
check('this server publishes to the throwaway branch', me.data?.publishBranch === BRANCH, me.data?.publishBranch)

const startHead = await head()
const startBlob = await blobAt('content/site.json', startHead)

console.log('--- the draft starts from GitHub, not the bundle ---')
const g = await call('draft?id=site')
check('no draft yet', g.data?.exists === false)
check('published copy comes with its blob sha', g.data?.published?.sha === startBlob, `${g.data?.published?.sha} vs ${startBlob}`)
const published = g.data.published.doc

console.log('--- validation blocks a bad draft ---')
const bad = structuredClone(published)
bad.contact.email = 'not-an-email'
let put = await call('draft', { method: 'PUT', body: { id: 'site', doc: bad, ifUpdatedAt: null, baseSha: startBlob } })
check('bad draft saves (drafts may be invalid)', put.status === 200)
let token1 = put.data.updatedAt
let ov = await call('publish')
check('one draft is pending', ov.data?.pending?.length === 1 && ov.data.pending[0].id === 'site')
let r = await call('publish', { method: 'POST', body: { drafts: [{ id: 'site', updatedAt: token1 }] } })
check('publishing it is refused with 422 + problems', r.status === 422 && r.data?.problems?.some((p) => p.includes('email')), JSON.stringify(r.data))
check('...and the branch did not move', (await head()) === startHead)

const bad2 = structuredClone(published)
bad2.sections.contact = !bad2.sections.contact
put = await call('draft', { method: 'PUT', body: { id: 'site', doc: bad2, ifUpdatedAt: token1 } })
r = await call('publish', { method: 'POST', body: { drafts: [{ id: 'site', updatedAt: put.data.updatedAt }] } })
check('changing a part no editor checks yet is refused', r.status === 422 && r.data?.problems?.some((p) => p.includes('sections')), JSON.stringify(r.data))
token1 = put.data.updatedAt

console.log('--- a valid publish ---')
const good = structuredClone(published)
const marker = `Test ${Date.now()}`
good.contact.addressShort = marker
put = await call('draft', { method: 'PUT', body: { id: 'site', doc: good, ifUpdatedAt: token1 } })
const goodToken = put.data.updatedAt
r = await call('publish', { method: 'POST', body: { drafts: [{ id: 'site', updatedAt: goodToken - 1 }] } })
check('a stale version list is refused with 409', r.status === 409 && Array.isArray(r.data?.pending), JSON.stringify(r.data))

const [a, b] = await Promise.all([
  call('publish', { method: 'POST', body: { drafts: [{ id: 'site', updatedAt: goodToken }] } }),
  call('publish', { method: 'POST', body: { drafts: [{ id: 'site', updatedAt: goodToken }] } }),
])
const won = [a, b].filter((x) => x.status === 200 && x.data?.commitSha)
check('a double-fired publish makes exactly one commit', won.length === 1, `${a.status} ${JSON.stringify(a.data).slice(0, 120)} | ${b.status} ${JSON.stringify(b.data).slice(0, 120)}`)
const commitSha = won[0]?.data?.commitSha

const afterHead = await head()
check('the branch now points at the new commit', afterHead === commitSha)
const commit = await gh(`/commits/${commitSha}`)
check('it has exactly one parent: the previous head', commit.parents.length === 1 && commit.parents[0].sha === startHead)
check('it touches exactly content/site.json', commit.files.length === 1 && commit.files[0].filename === 'content/site.json', commit.files.map((f) => f.filename).join(','))
const expected = JSON.stringify(good, null, 2) + '\n'
check('the file holds exactly the draft, byte for byte', (await blobAt('content/site.json', commitSha)) === gitSha(expected))
check('only the changed line differs', commit.files[0].additions === 1 && commit.files[0].deletions === 1, `+${commit.files[0].additions} -${commit.files[0].deletions}`)

ov = await call('publish')
check('the draft is cleared', ov.data?.pending?.length === 0)
check('the publish is recorded and undoable', ov.data?.latest?.commitSha === commitSha && ov.data?.canUndo === true)
check('a publish with nothing pending is refused', (await call('publish', { method: 'POST', body: { drafts: [] } })).status === 400)

console.log('--- recovering from a publish whose clean-up failed ---')
// The draft survives with its OLD base while the file already holds its bytes — what a
// D1 failure or dropped connection after the commit leaves behind. It must clear itself,
// not be refused as stale forever.
put = await call('draft', { method: 'PUT', body: { id: 'site', doc: good, ifUpdatedAt: null, baseSha: startBlob } })
r = await call('publish', { method: 'POST', body: { drafts: [{ id: 'site', updatedAt: put.data.updatedAt }] } })
check('a leftover draft identical to the file is cleared as "unchanged"', r.status === 200 && r.data?.unchanged === true && r.data?.pending?.length === 0, JSON.stringify(r.data).slice(0, 200))
check('...without a commit', (await head()) === commitSha)

console.log('--- a draft with no recorded base is refused, not trusted ---')
const baseless = structuredClone(good)
baseless.contact.hours = 'Mon–Sat'
put = await call('draft', { method: 'PUT', body: { id: 'site', doc: baseless, ifUpdatedAt: null } })
r = await call('publish', { method: 'POST', body: { drafts: [{ id: 'site', updatedAt: put.data.updatedAt }] } })
check('refused as stale (409)', r.status === 409 && r.data?.stale?.length === 1, JSON.stringify(r.data).slice(0, 200))
await call('draft', { method: 'DELETE', body: { id: 'site', ifUpdatedAt: put.data.updatedAt } })

console.log('--- the confirmation lists field-by-field changes ---')
const peek = structuredClone(good)
peek.contact.addressShort = 'Peek'
put = await call('draft', { method: 'PUT', body: { id: 'site', doc: peek, ifUpdatedAt: null, baseSha: await blobAt('content/site.json', commitSha) } })
ov = await call('publish')
const ch = ov.data?.pending?.[0]?.changes
check('GET publish lists old → new', Array.isArray(ch) && ch.length === 1 && ch[0].from === marker && ch[0].to === 'Peek', JSON.stringify(ch))
await call('draft', { method: 'DELETE', body: { id: 'site', ifUpdatedAt: put.data.updatedAt } })

console.log('--- a new draft starts from the NEW published version ---')
const g2 = await call('draft?id=site')
check('published copy is the one just published', g2.data?.published?.doc?.contact?.addressShort === marker)

console.log('--- a draft left behind by an undo is caught as stale ---')
const stale = structuredClone(good)
stale.contact.replyTime = 'Within a day'
put = await call('draft', { method: 'PUT', body: { id: 'site', doc: stale, ifUpdatedAt: null, baseSha: g2.data.published.sha } })
const staleToken = put.data.updatedAt

console.log('--- undo ---')
const preview = await call('publish?undo=1')
const back = preview.data?.undoChanges
check(
  'the Undo confirmation lists what it will put back',
  Array.isArray(back) && back.length === 1 && back[0].from === marker && back[0].to === (published.contact.addressShort ?? null),
  JSON.stringify(back),
)
check('a plain read does not include it', (await call('publish')).data?.undoChanges === undefined)
check('undoing an older/unknown publish is refused', (await call('undo', { method: 'POST', body: { id: -1 } })).status === 409)
r = await call('undo', { method: 'POST', body: { id: ov.data.latest.id } })
check('undo succeeds', r.status === 200 && r.data?.commitSha, JSON.stringify(r.data))
const undoSha = r.data?.commitSha
const undoCommit = await gh(`/commits/${undoSha}`)
check('undo is a new commit on top, not a rewind', undoCommit.parents[0]?.sha === commitSha)
check('undo touches exactly content/site.json', undoCommit.files.length === 1 && undoCommit.files[0].filename === 'content/site.json')
check('undo restores the original bytes exactly', (await blobAt('content/site.json', undoSha)) === startBlob)
check('undo cannot be repeated', (await call('undo', { method: 'POST', body: { id: ov.data.latest.id } })).status === 409)
ov = await call('publish')
check('the latest entry is the undo, and it is not undoable', ov.data?.latest?.kind === 'undo' && ov.data?.canUndo === false)

r = await call('publish', { method: 'POST', body: { drafts: [{ id: 'site', updatedAt: staleToken }] } })
check('the stale draft is refused, not published over the undo', r.status === 409 && r.data?.stale?.length === 1, JSON.stringify(r.data))
check('...and the branch did not move', (await head()) === undoSha)
await call('draft', { method: 'DELETE', body: { id: 'site', ifUpdatedAt: staleToken } })

console.log('--- images: upload, publish with a document, undo ---')
{
  const sharp = (await import('sharp')).default
  const jpeg = await sharp({ create: { width: 40, height: 50, channels: 3, background: { r: 120, g: 90, b: 60 } } }).jpeg().toBuffer()
  const b64 = jpeg.toString('base64')
  const up = (body, extra = {}) =>
    fetch(`${BASE}/upload`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...extra }, body: JSON.stringify(body) })

  const saved = cookie
  cookie = ''
  check('upload without a session is refused', (await up({ docId: 'founders', data: b64 })).status === 401)
  cookie = saved
  check('a cross-site upload is refused', (await up({ docId: 'founders', data: b64 }, { Origin: 'https://evil.example' })).status === 403)
  check('a non-image is refused', (await up({ docId: 'founders', data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64') })).status === 415)
  check('a truncated JPEG is refused', (await up({ docId: 'founders', data: jpeg.subarray(0, jpeg.length - 40).toString('base64') })).status === 422)
  check('a PNG is refused (the browser always sends JPEG)', (await up({ docId: 'founders', data: (await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).png().toBuffer()).toString('base64') })).status === 415)
  check('a size that does not match the file is refused', (await up({ docId: 'founders', data: b64, width: 400, height: 500 })).status === 422)
  check('an upload aimed at site.json is refused', (await up({ docId: 'site', data: b64 })).status === 400)
  check('a hint cannot steer the folder', (await (await up({ docId: 'founders', data: b64, hint: '../../projects/x' })).json()).path?.startsWith('content/media/founders/projects-x-'))

  const res = await up({ docId: 'founders', data: b64, width: 40, height: 50, hint: 'tej-shah' })
  const u = await res.json()
  const bytesSha = crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${jpeg.length}\0`), jpeg])).digest('hex')
  check('upload succeeds into the founders folder', res.status === 200 && /^content\/media\/founders\/tej-shah-[0-9a-f]{10}\.jpg$/.test(u.path), JSON.stringify(u))
  check('the blob GitHub stored is exactly the uploaded bytes', u.sha === bytesSha, `${u.sha} vs ${bytesSha}`)
  const pv = await fetch(`${BASE}/upload?path=${encodeURIComponent(u.path)}`, { headers: { Cookie: cookie } })
  check('the staged copy can be previewed', pv.status === 200 && Buffer.from(await pv.arrayBuffer()).equals(jpeg))
  // A published original (not staged) comes from GitHub — how a published photo is re-framed.
  const someProject = fs.readdirSync('content/media/projects').find((d) => !d.startsWith('.'))
  const someFile = fs.readdirSync(`content/media/projects/${someProject}`).find((f) => /\.(jpe?g|png|webp)$/i.test(f))
  const pub = await fetch(`${BASE}/upload?path=${encodeURIComponent(`content/media/projects/${someProject}/${someFile}`)}`, { headers: { Cookie: cookie } })
  const pubBytes = Buffer.from(await pub.arrayBuffer())
  const want = fs.readFileSync(`content/media/projects/${someProject}/${someFile}`)
  check('a published original can be previewed from the repo', pub.status === 200 && pubBytes.equals(want), `${pub.status} ${someProject}/${someFile} got ${pubBytes.length} bytes (${pub.headers.get('content-type')}), want ${want.length}: ${pubBytes.subarray(0, 80).toString()}`)
  const outside = await fetch(`${BASE}/upload?path=${encodeURIComponent('functions/api/admin/_lib/auth.js')}`, { headers: { Cookie: cookie } })
  check('a path outside content/media is refused', outside.status === 400, `${outside.status}`)

  const fg = await call('draft?id=founders')
  const fBase = fg.data?.published?.sha
  const fPub = fg.data?.published?.doc
  const tejAt = fPub.people.findIndex((p) => p.id === 'tej-shah')

  const ghost = structuredClone(fPub)
  ghost.people[tejAt].photo = { file: 'never-uploaded-0000000000.jpg', crop: { x: 0, y: 0, w: 1, h: 1 }, zoom: 1, filter: 'original' }
  let fp = await call('draft', { method: 'PUT', body: { id: 'founders', doc: ghost, ifUpdatedAt: null, baseSha: fBase } })
  let fr = await call('publish', { method: 'POST', body: { drafts: [{ id: 'founders', updatedAt: fp.data.updatedAt }] } })
  check('a photo that was never uploaded is refused before any commit', fr.status === 422 && fr.data?.problems?.some((p) => p.includes('isn’t uploaded')), JSON.stringify(fr.data))
  let fTok = fp.data.updatedAt

  // What the editor can't change, and what the build would refuse, is refused here too.
  const refusedFor = async (label, mutate, needle) => {
    const d = structuredClone(fPub)
    mutate(d)
    fp = await call('draft', { method: 'PUT', body: { id: 'founders', doc: d, ifUpdatedAt: fTok } })
    fTok = fp.data.updatedAt
    fr = await call('publish', { method: 'POST', body: { drafts: [{ id: 'founders', updatedAt: fTok }] } })
    check(label, fr.status === 422 && fr.data?.problems?.some((p) => p.includes(needle)), JSON.stringify(fr.data))
  }
  await refusedFor('a changed name is refused (names are locked)', (d) => (d.people[tejAt].name = 'Someone Else'), '“name”')
  await refusedFor('a bio over the word limit is refused', (d) => (d.people[1].bio = 'word '.repeat(81).trim()), '81 words')
  await refusedFor('a contact switched on but empty is refused', (d) => (d.people[1].contacts.linkedin = { value: null, on: true }), 'switched on but empty')
  await refusedFor('a non-https LinkedIn is refused', (d) => (d.people[1].contacts.linkedin = { value: 'http://linkedin.com/in/x', on: true }), 'https://')
  await refusedFor('a reordered people list is refused', (d) => d.people.reverse(), 'list of people')

  const withPhoto = structuredClone(fPub)
  withPhoto.people[tejAt].photo = { file: u.file, crop: { x: 0, y: 0.1, w: 1, h: 0.8 }, zoom: 1.2, filter: 'warm' }
  withPhoto.people[1].basedIn = 'Udaipur'
  withPhoto.people[1].contacts.linkedin = { value: 'https://www.linkedin.com/in/example', on: true }
  withPhoto.intro.fold = 'A test introduction.'
  fp = await call('draft', { method: 'PUT', body: { id: 'founders', doc: withPhoto, ifUpdatedAt: fTok } })
  ov = await call('publish')
  const fch = ov.data?.pending?.[0]?.changes ?? []
  const named = (field) => fch.find((c) => c.field === field)
  check('the confirmation names the new photo', named('Tej Shah’s photo')?.to === 'a photo' && named('Tej Shah’s photo')?.from === 'no photo', JSON.stringify(fch))
  check('...and the text, contact and intro changes, field by field', named(`${fPub.people[1].name}’s based in`)?.to === 'Udaipur' && named(`${fPub.people[1].name}’s LinkedIn`)?.from === 'off' && named('the FOLD introduction')?.to === 'A test introduction.' && fch.length === 4, JSON.stringify(fch))
  const beforeImg = await head()
  fr = await call('publish', { method: 'POST', body: { drafts: [{ id: 'founders', updatedAt: fp.data.updatedAt }] } })
  check('publishing the photo succeeds', fr.status === 200 && fr.data?.commitSha, JSON.stringify(fr.data))
  const ic = await gh(`/commits/${fr.data?.commitSha}`)
  const names = ic.files.map((f) => f.filename).sort()
  check('one commit with founders.json and the image, nothing else', names.length === 2 && names[0] === 'content/founders.json' && names[1] === u.path, names.join(','))
  check('...on top of the previous head', ic.parents[0]?.sha === beforeImg)
  check('the image in the repo is the uploaded blob', (await blobAt(u.path, fr.data.commitSha)) === u.sha)

  ov = await call('publish')
  r = await call('undo', { method: 'POST', body: { id: ov.data.latest.id } })
  check('undoing the photo publish succeeds', r.status === 200 && r.data?.commitSha, JSON.stringify(r.data))
  const uc = await gh(`/commits/${r.data?.commitSha}`)
  check('undo removes the image and restores founders.json', uc.files.length === 2 && uc.files.some((f) => f.filename === u.path && f.status === 'removed'), uc.files.map((f) => `${f.filename}:${f.status}`).join(','))
  check('founders.json is back to its original bytes', (await blobAt('content/founders.json', r.data.commitSha)) === fBase)

  console.log('--- projects: refusals, publish with a new image, undo ---')
  const PID = 'project:citadel-tower'
  const PPATH = 'content/projects/citadel-tower.json'
  const pg = await call(`draft?id=${PID}`)
  const pBase = pg.data?.published?.sha
  const pPub = pg.data?.published?.doc
  check('a project draft starts from the file on GitHub', !!pPub?.pool?.length && pg.data?.exists === false, JSON.stringify(pg.data).slice(0, 200))
  const pres = await up({ docId: PID, data: b64, width: 40, height: 50, hint: 'Test Shot' })
  const pu = await pres.json()
  check('upload lands in the project’s own folder', pres.status === 200 && /^content\/media\/projects\/citadel-tower\/test-shot-[0-9a-f]{10}\.jpg$/.test(pu.path), JSON.stringify(pu))
  let pTok = null
  let first = true
  const pRefused = async (label, mutate, needle) => {
    const d = structuredClone(pPub)
    mutate(d)
    const put2 = await call('draft', { method: 'PUT', body: { id: PID, doc: d, ifUpdatedAt: pTok, ...(first ? { baseSha: pBase } : {}) } })
    first = false
    pTok = put2.data.updatedAt
    const pr = await call('publish', { method: 'POST', body: { drafts: [{ id: PID, updatedAt: pTok }] } })
    check(label, pr.status === 422 && pr.data?.problems?.some((p) => p.includes(needle)), JSON.stringify(pr.data))
  }
  const share = pPub.pool.find((i) => i.id === 'exterior-landscape') ? 'exterior-landscape' : null
  await pRefused('an empty project name is refused', (d) => (d.name = ' '), 'needs a name')
  await pRefused('a changed link name (slug) is refused', (d) => (d.slug = 'citadel-two'), 'link name')
  await pRefused('hiding the project from here is refused (that is the project list’s job)', (d) => (d.hidden = !d.hidden), '“hidden”')
  await pRefused('a section using an image that is not in the project is refused', (d) => d.sections[0].images.push({ image: 'nope', shape: 'original' }), 'isn’t in this project')
  await pRefused('an unsafe link in a section’s text is refused', (d) => (d.sections[0].body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] }), 'must start with')
  await pRefused('text the site can’t render (an image node) is refused', (d) => (d.sections[0].body = { type: 'doc', content: [{ type: 'image', attrs: { src: 'x' } }] }), 'can’t show')
  await pRefused('a hidden cover is refused', (d) => (d.pool.find((i) => i.id === d.cover.image).hidden = true), 'hidden')
  await pRefused('an unknown image type is refused', (d) => (d.pool[0].type = 'sketch'), 'what kind of image')
  if (share) await pRefused('removing the image the homepage link preview uses is refused', (d) => { d.pool = d.pool.filter((i) => i.id !== share); for (const x of d.sections) x.images = x.images.filter((r) => r.image !== share); if (d.cover.image === share) Object.assign(d.cover, { image: d.pool[0].id, crop: null }); if (d.cover.phoneImage === share) Object.assign(d.cover, { phoneImage: null, phoneCrop: null }) }, 'link preview')
  else check('(skipped) homepage share image not in this project', true)

  const pGood = structuredClone(pPub)
  pGood.pool.push({ id: 'test-shot', file: pu.file, type: 'photograph', caption: 'A test photo', rotation: 90, crop: { x: 0, y: 0.1, w: 1, h: 0.8 }, hidden: false, showTag: true })
  pGood.sections[0].images.push({ image: 'test-shot', shape: '3:2' })
  pGood.sections[0].body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bold ', marks: [{ type: 'bold' }] }, { type: 'text', text: 'and a link', marks: [{ type: 'link', attrs: { href: 'https://example.com', target: '_blank', rel: 'noopener noreferrer nofollow', class: null } }] }] }, { type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: 'Sub' }] }] }
  pGood.facts.custom = [{ label: 'Client', value: 'Private' }]
  fp = await call('draft', { method: 'PUT', body: { id: PID, doc: pGood, ifUpdatedAt: pTok } })
  ov = await call('publish')
  const pch = ov.data?.pending?.[0]?.changes ?? []
  check('the confirmation lists the project changes', pch.some((c) => c.field === 'images' && /1 added/.test(c.to)) && pch.some((c) => c.field === 'extra facts') && pch.some((c) => /text$/.test(c.field)), JSON.stringify(pch))
  const beforeP = await head()
  fr = await call('publish', { method: 'POST', body: { drafts: [{ id: PID, updatedAt: fp.data.updatedAt }] } })
  check('publishing the project succeeds', fr.status === 200 && fr.data?.commitSha, JSON.stringify(fr.data))
  const pc = await gh(`/commits/${fr.data?.commitSha}`)
  const pnames = pc.files.map((f) => f.filename).sort()
  check('one commit: the project file and its new image, nothing else', pnames.length === 2 && pnames.includes(PPATH) && pnames.includes(pu.path), pnames.join(','))
  check('...on top of the previous head', pc.parents[0]?.sha === beforeP)
  check('the project file is exactly the draft', (await blobAt(PPATH, fr.data.commitSha)) === gitSha(JSON.stringify(pGood, null, 2) + '\n'))
  ov = await call('publish')
  r = await call('undo', { method: 'POST', body: { id: ov.data.latest.id } })
  check('undoing the project publish succeeds', r.status === 200 && r.data?.commitSha, JSON.stringify(r.data))
  check('the project file is back to its original bytes', (await blobAt(PPATH, r.data.commitSha)) === pBase)
}

console.log('--- status ---')
const st = await call(`status?commit=${undoSha}`)
check('status answers with a site and a live flag', st.status === 200 && typeof st.data?.live === 'boolean' && st.data?.site?.includes('admin-publish-test'), JSON.stringify(st.data))
check('status rejects a non-sha', (await call('status?commit=main')).status === 400)

console.log(`\npassed: ${pass}   failed: ${failed}`)
process.exit(failed ? 1 : 0)
