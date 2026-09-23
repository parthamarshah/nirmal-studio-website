// Leaving a pane mid-edit must never lose the edit — run by scripts/test-admin-panes.sh.
//
// The editor unmounts on a pane switch and flushes its debounced save on the way out. If
// that save then fails (a 409 because the other person saved first, or the network), there
// is no editor left to show it, so the edit is parked in memory and handed back when the
// editor reopens. These drive real Chrome because that is the only way to exercise mount,
// unmount and remount — the bug lives in the gap between them, and no unit test has one.
//
// Against the code before the fix, case B fails: the edit vanished with no trace.
// `localhost`, not 127.0.0.1: the session cookie is Secure, and Chrome then drops it.
import { spawn } from 'node:child_process'
const BASE = 'http://localhost:8788'
const PIN = process.env.PIN || '428317'
const PROFILE = process.env.PROFILE || '/tmp/nirmal-admin-pane-test-chrome'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : '  ' + extra}`); if (!ok) fails++ }

// Second "person": its own session, via plain fetch.
let other = ''
async function api(path, opts = {}) {
  const res = await fetch(`${BASE}/api/admin/${path}`, { method: opts.method || 'GET', headers: { 'Content-Type': 'application/json', ...(other ? { Cookie: other } : {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined })
  const set = res.headers.get('set-cookie'); if (set && path === 'login' && res.ok) other = set.split(';')[0]
  return { status: res.status, data: await res.json().catch(() => null) }
}

const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9333', '--user-data-dir=' + PROFILE, '--no-first-run', 'about:blank'], { stdio: 'ignore' })
let wsUrl
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(250); try { wsUrl = (await (await fetch('http://127.0.0.1:9333/json/list')).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl } catch {} }
if (!wsUrl) throw new Error('no chrome'); const ws = new WebSocket(wsUrl); await new Promise((r) => ws.addEventListener('open', r))
let n = 0; const pending = new Map()
const events = new Map() // method -> handler
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data)
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
  else if (d.method && events.has(d.method)) events.get(d.method)(d.params)
})
const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
const ev = async (expr) => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result?.result?.value }
const waitFor = async (expr, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return true; await sleep(100) } return false }
const text = () => ev('document.body.innerText')
const fieldVal = () => ev(`document.getElementById('f-addressShort')?.value ?? null`)
async function typeShort(value) {
  await ev(`(() => { const el = document.getElementById('f-addressShort'); el.focus(); el.select(); })()`)
  await cdp('Input.insertText', { text: value })
}
const click = (label) => ev(`(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().replace(/[0-9]+$/, '') === ${JSON.stringify(label)}); if (!b) throw new Error('no button ' + ${JSON.stringify(label)}); b.click(); return true })()`)

try {
  await cdp('Page.enable'); await cdp('Runtime.enable')
  await cdp('Page.navigate', { url: BASE + '/admin/' }); await sleep(1500)
  await ev(`fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '${PIN}' }) }).then((r) => r.status)`)
  check('other person signed in', (await api('login', { method: 'POST', body: { pin: PIN } })).status === 200)

  // ── A: switch panes mid-debounce, no conflict → saves, no notice, value there on return
  const login = await ev(`fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '' }) }).then((r) => r.status)`)
  const st = await ev(`fetch('/api/admin/me').then((r) => r.status)`)
  check('signed in in the browser', st === 200, 'login=' + login + ' me=' + st)
  await ev(`location.hash = '#/settings'; location.reload()`); await sleep(1500)
  check('A: settings loaded', await waitFor(`!!document.getElementById('f-addressShort')`), 'me=' + st + ' ' + (await text()).slice(0, 300))
  await typeShort('Pane test A')
  await click('Projects')
  check('A: really left the pane', !(await ev(`!!document.getElementById('f-addressShort')`)))
  await sleep(1500)
  check('A: no unsaved notice after a clean flush', !(await text()).includes('didn’t finish saving'))
  let d = await api('draft?id=site')
  check('A: flushed save reached the server', d.data?.doc?.contact?.addressShort === 'Pane test A', JSON.stringify(d.data?.doc?.contact?.addressShort))
  await click('Settings')
  check('A: reopened editor shows the saved value', await waitFor(`document.getElementById('f-addressShort')?.value === 'Pane test A'`))

  // ── A2: reopen immediately while the flush is still in flight → no false conflict
  await typeShort('Pane test A2')
  await click('Projects'); await click('Settings')
  check('A2: fast reopen shows the latest value', await waitFor(`document.getElementById('f-addressShort')?.value === 'Pane test A2'`))
  await sleep(500)
  check('A2: no conflict from its own flushed save', !(await text()).includes('changed somewhere else'))
  await typeShort('Pane test A3'); await sleep(1500)
  check('A2: a later edit still saves', (await api('draft?id=site')).data?.doc?.contact?.addressShort === 'Pane test A3')

  // ── B: someone else saves, then I edit and leave mid-debounce → 409 → parked, not lost
  const cur = (await api('draft?id=site')).data
  await sleep(300)
  const theirs = structuredClone(cur.doc); theirs.contact.addressShort = 'Theirs B'
  check('B: other person saved', (await api('draft', { method: 'PUT', body: { id: 'site', doc: theirs, ifUpdatedAt: cur.updatedAt } })).status === 200)
  await typeShort('Mine B')
  await click('Projects')
  check('B: notice appears on the other pane', await waitFor(`document.body.innerText.includes('didn’t finish saving')`), (await text()).slice(0, 400))
  check('B: Publish held while an edit is parked', await ev(`document.querySelector('.admin-publish').disabled`))
  check('B: server kept their version (nothing overwritten)', (await api('draft?id=site')).data?.doc?.contact?.addressShort === 'Theirs B')
  // Phone width, with the publish strip present: the bar used to be laid out after the
  // panes and land hundreds of pixels below the fold.
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  // It must sit ABOVE the panes, not after them: with the publish strip also present it
  // used to be auto-placed into a row below the panes — hundreds of pixels off the bottom
  // of a phone screen. Checked by position, not just by being in the DOM.
  const where = await ev(`(() => {
    window.scrollTo(0, 0)
    const el = document.querySelector('.admin-pubbar--unsaved')
    if (!el) return 'no bar'
    const r = el.getBoundingClientRect()
    const panes = document.querySelector('.admin-panes').getBoundingClientRect()
    return { top: Math.round(r.top), panesTop: Math.round(panes.top), vh: innerHeight }
  })()`)
  check('B: the notice is above the panes and on screen at phone width',
    typeof where === 'object' && where.top >= 0 && where.top < where.vh && where.top < where.panesTop,
    JSON.stringify(where))
  await cdp('Emulation.clearDeviceMetricsOverride')
  await click('Open Settings')
  check('B: reopened editor shows MY unsaved edit', await waitFor(`document.getElementById('f-addressShort')?.value === 'Mine B'`), String(await fieldVal()))
  const bConflictText = await text()
  check('B: and asks which to keep', bConflictText.includes('changed somewhere else'))
  check('B: notice gone once back on the pane', !(await ev(`!!document.querySelector('.admin-pubbar--unsaved')`)))
  await click('Keep mine and overwrite it')
  check('B: keep mine saves it', await waitFor(`document.body.innerText.includes('Saved as a draft')`) && (await api('draft?id=site')).data?.doc?.contact?.addressShort === 'Mine B')
  check('B: the conflict block says the edit was the one left behind', bConflictText.includes('didn’t finish saving when you left this pane'), bConflictText.slice(0, 200))

  // ── C: leave while already in conflict → parked as-is
  const c2 = (await api('draft?id=site')).data
  const t2 = structuredClone(c2.doc); t2.contact.addressShort = 'Theirs C'
  await api('draft', { method: 'PUT', body: { id: 'site', doc: t2, ifUpdatedAt: c2.updatedAt } })
  await typeShort('Mine C'); await sleep(1500)
  check('C: conflict shown in place', (await text()).includes('changed somewhere else'))
  await click('Founders')
  check('C: leaving a conflict parks it', await waitFor(`document.body.innerText.includes('didn’t finish saving')`))
  await click('Settings')
  check('C: reopened shows mine + conflict', await waitFor(`document.getElementById('f-addressShort')?.value === 'Mine C'`) && (await text()).includes('changed somewhere else'))
  await click('Use the other version — discard my change')
  check('C: use theirs loads theirs', await waitFor(`document.getElementById('f-addressShort')?.value === 'Theirs C'`))
  check('C: no notice left', !(await ev(`!!document.querySelector('.admin-pubbar--unsaved')`)))

  // ── D: reopen the parked pane, then leave again WHILE THE LOAD IS IN FLIGHT. The draft
  // GET is held open at the network layer so the unmount is guaranteed to land inside it —
  // timing two clicks a few milliseconds apart is a coin flip, and a passing coin flip
  // proves nothing. The late-landing response must not consume the parked edit.
  const c3 = (await api('draft?id=site')).data
  const t3 = structuredClone(c3.doc); t3.contact.addressShort = 'Theirs D'
  await api('draft', { method: 'PUT', body: { id: 'site', doc: t3, ifUpdatedAt: c3.updatedAt } })
  await typeShort('Mine D')
  await click('Projects')
  check('D: parked', await waitFor(`document.body.innerText.includes('didn’t finish saving')`))
  let release = null
  events.set('Fetch.requestPaused', ({ requestId, request }) => {
    if (request.url.includes('/api/admin/draft?id=site')) release = () => cdp('Fetch.continueRequest', { requestId })
    else cdp('Fetch.continueRequest', { requestId })
  })
  await cdp('Fetch.enable', { patterns: [{ urlPattern: '*/api/admin/draft*', requestStage: 'Request' }] })
  await click('Settings')
  for (let i = 0; i < 40 && !release; i++) await sleep(50)
  check('D: the reopen\u2019s load is held mid-flight', !!release)
  await click('Projects')   // unmount while that GET is still open
  await release()
  await cdp('Fetch.disable')
  events.delete('Fetch.requestPaused')
  await sleep(1500)
  check('D: still parked after an interrupted reopen', await ev(`!!document.querySelector('.admin-pubbar--unsaved')`))
  check('D: Publish still held', await ev(`document.querySelector('.admin-publish').disabled`))
  check('D: the top line says why Publish is held', (await ev(`document.querySelector('.admin-state').textContent`)).includes('Can’t publish yet'))
  await click('Open Settings')
  check('D: the edit is still there', await waitFor(`document.getElementById('f-addressShort')?.value === 'Mine D'`), String(await fieldVal()))
  // Reopening hands the edit back to the editor, so nothing is parked any more — the
  // strip and the publish hold must both clear, or they would never clear at all.
  check('D: reopening clears the strip and the hold', await waitFor(`!document.querySelector('.admin-pubbar--unsaved') && !document.querySelector('.admin-state').textContent.includes('Can’t publish yet')`))

  // ── E: sign-out is refused while an edit is parked, and "Discard it" is the way out.
  await click('Projects')
  check('E: parked again on leaving the conflict', await waitFor(`document.body.innerText.includes('didn’t finish saving')`))
  await click('Sign out')
  check('E: sign-out refused', await waitFor(`document.body.innerText.includes('Signing out would throw it away')`))
  check('E: still signed in', (await ev(`fetch('/api/admin/me').then((r) => r.status)`)) === 200)
  await click('Discard it')
  await click('Yes, throw it away')
  check('E: notice gone', await waitFor(`!document.body.innerText.includes('didn’t finish saving')`))
  check('E: Publish no longer held by it', await waitFor(`!document.querySelector('.admin-publish').disabled`))
  await click('Settings')
  check('E: the pane now shows the saved version, not the discarded edit', await waitFor(`document.getElementById('f-addressShort')?.value === 'Theirs D'`), String(await fieldVal()))

  // ── F: discard a draft whose parked edit never had a version (a create collision).
  await api('draft', { method: 'DELETE', body: { id: 'site', ifUpdatedAt: (await api('draft?id=site')).data.updatedAt } })
  await click('Projects'); await click('Settings')
  check('F: back to the published version', await waitFor(`!!document.getElementById('f-addressShort')`))
  const pub0 = (await api('draft?id=site')).data
  const theirsF = structuredClone(pub0.published?.doc ?? pub0.doc); theirsF.contact.addressShort = 'Theirs F'
  await typeShort('Mine F')
  await api('draft', { method: 'PUT', body: { id: 'site', doc: theirsF, ifUpdatedAt: null, baseSha: pub0.published?.sha ?? null } })
  await click('Projects')
  check('F: create collision parks the edit', await waitFor(`document.body.innerText.includes('didn’t finish saving')`))
  await click('Open Settings')
  check('F: shows my edit', await waitFor(`document.getElementById('f-addressShort')?.value === 'Mine F'`), String(await fieldVal()))
  // Discarding with no version of its own used to 400 and strand the editor in `error`.
  const publishedShort = pub0.published?.doc?.contact?.addressShort ?? ''
  await click('Discard them')
  check('F: discard works with no version of its own', await waitFor(`document.getElementById('f-addressShort')?.value === ${JSON.stringify(publishedShort)}`, 10000), String(await fieldVal()) + ' | ' + (await text()).slice(0, 200))
  check('F: nothing left parked', !(await ev(`!!document.querySelector('.admin-pubbar--unsaved')`)))
} catch (e) { console.log('✗ threw', e.message); fails++ }
finally { ws?.close(); chrome.kill('SIGKILL') }
console.log(fails ? `\n${fails} failed` : '\nall passed'); process.exit(fails ? 1 : 0)
