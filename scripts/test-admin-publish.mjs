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

console.log('--- status ---')
const st = await call(`status?commit=${undoSha}`)
check('status answers with a site and a live flag', st.status === 200 && typeof st.data?.live === 'boolean' && st.data?.site?.includes('admin-publish-test'), JSON.stringify(st.data))
check('status rejects a non-sha', (await call('status?commit=main')).status === 400)

console.log(`\npassed: ${pass}   failed: ${failed}`)
process.exit(failed ? 1 : 0)
