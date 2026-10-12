// The founders editor in real Chrome, run by scripts/test-admin-founders.sh
// (npm run test:founders). Uploads (JPEG and iPhone HEIC), framing by drag/keys/zoom,
// filters, word limits, contact switches, the Publish confirmation, and an upload that
// finishes after its pane was left. Screenshots land next to the fixtures.
import { spawn } from 'node:child_process'
const BASE = 'http://localhost:8788'
const PIN = process.env.PIN || '428317'
const PROFILE = process.env.PROFILE || '/tmp/nirmal-admin-pane-test-chrome'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : '  ' + extra}`); if (!ok) fails++ }

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
const click = (label) => ev(`(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().replace(/[0-9]+$/, '') === ${JSON.stringify(label)}); if (!b) throw new Error('no button ' + ${JSON.stringify(label)}); b.click(); return true })()`)
const tab = (name) => ev(`(() => { const t = [...document.querySelectorAll('[role=tab]')].find((t) => t.querySelector('.admin-tab-name')?.textContent === ${JSON.stringify(name)}); if (!t) throw new Error('no tab ' + ${JSON.stringify(name)}); t.click(); return true })()`)
const SP = process.env.FIXTURES // test images and screenshots (made by the .sh)
const draft = async () => (await ev("fetch('/api/admin/draft?id=founders').then((r) => r.json())"))
const shot = async (name, w, h) => {
  await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 })
  await sleep(600)
  const r = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const fs = await import('node:fs'); fs.writeFileSync(SP + '/' + name + '.png', Buffer.from(r.result.data, 'base64'))
}
const setFile = async (path) => {
  const doc = await cdp('DOM.getDocument', { depth: -1 })
  const q = await cdp('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type=file]' })
  await cdp('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: [path] })
}
const errors = []
events.set('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description || 'exception'))
events.set('Runtime.consoleAPICalled', (p) => { if (p.type === 'error') errors.push(p.args.map((a) => a.value ?? a.description).join(' ')) })
try {
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('DOM.enable')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await cdp('Page.navigate', { url: BASE + '/admin/' }); await sleep(1500)
  await ev(`fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '${PIN}' }) }).then((r) => r.status)`)
  await ev("location.hash = '#/founders'; location.reload()"); await sleep(2000)
  check('tabs render, Tej first and selected', await waitFor("document.querySelector('[role=tab][aria-selected=true]')?.textContent.startsWith('Tej Shah')"), (await text()).slice(0, 400))
  check('existing bio is in the box with a count', await waitFor("document.getElementById('p-bio')?.value.length > 50") && (await text()).includes('words'))
  check('status line says the section is off', (await text()).includes('older Tej + FOLD section'))
  check('Tej’s tab says he needs a photo', await ev("document.querySelector('[role=tab][aria-selected=true] .admin-tab-status')?.textContent === 'Needs photo'"))
  await shot('f-1440-empty', 1440, 1000)
  await shot('f-1000-empty', 1000, 760)
  // A ~1000px laptop window (the review that prompted the 2026-10-12 relayout): nothing in
  // the form may run past the pane's right edge, and every tab is on screen.
  const clipped = "(() => { const m = document.querySelector('.admin-main').getBoundingClientRect(); return [...document.querySelectorAll('.admin-main input, .admin-main textarea, [role=tab]')].filter((e) => e.type !== 'file' && e.getBoundingClientRect().right > m.right + 1).length })()"
  check('1000px: no field or tab runs past the pane', (await ev(clipped)) === 0, String(await ev(clipped)))

  // Upload a JPEG for Tej
  await setFile(SP + '/portrait.jpg')
  check('upload lands and the framer shows it', await waitFor("document.querySelector('.admin-framer-frame img')?.complete && document.querySelector('.admin-framer-frame img').naturalWidth > 0", 20000), (await text()).slice(0, 600))
  await sleep(1500)
  let d = await draft()
  const ph = d.doc?.people?.[0]?.photo
  check('draft saved with the uploaded photo and a 4:5 crop', !!ph?.file && Math.abs((ph.crop.w * 1600) / (ph.crop.h * 2400) - 0.8) < 0.002, JSON.stringify(ph))
  check('state line back to saved', (await text()).includes('Saved as a draft'), (await ev("document.querySelector('.admin-state').textContent")))

  // Zoom with + key, then drag
  await ev("document.querySelector('.admin-framer-frame').focus()")
  for (let i = 0; i < 10; i++) await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: '+', text: '+' })
  const box = await ev("(() => { const r = document.querySelector('.admin-framer-frame').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()")
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 })
  for (let i = 1; i <= 5; i++) await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x + i * 15, y: box.y + i * 12, button: 'left', buttons: 1 })
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x + 75, y: box.y + 60, button: 'left', clickCount: 1 })
  await click('B&W')
  await sleep(1800)
  d = await draft()
  const ph2 = d.doc.people[0].photo
  check('zoom saved (about 2)', ph2.zoom > 1.9 && ph2.zoom < 2.1, JSON.stringify(ph2))
  check('drag moved the framing up-left (crop x/y smaller than centred)', ph2.crop.x < 0.25 && ph2.crop.y < 0.083 + 0.21, JSON.stringify(ph2.crop))
  check('crop still inside the image', ph2.crop.x >= 0 && ph2.crop.y >= 0 && ph2.crop.x + ph2.crop.w <= 1.0001 && ph2.crop.y + ph2.crop.h <= 1.0001)
  check('filter saved', ph2.filter === 'bw')
  check('B&W preview applied', (await ev("document.querySelector('.admin-framer-frame img').style.filter")).includes('grayscale'))
  await shot('f-1440-photo', 1440, 1000)

  // Bhumika: HEIC upload, long bio, bad contact
  await tab('Bhumika Tak')
  check('tab switch updates the URL', await waitFor("location.hash === '#/founders/bhumika-tak'"))
  await setFile(SP + '/portrait.heic')
  check('HEIC converts and uploads', await waitFor("document.querySelector('.admin-framer-frame img')?.naturalWidth > 0", 30000), (await text()).slice(0, 800))
  await ev("document.getElementById('p-bio').focus()")
  await cdp('Input.insertText', { text: Array.from({ length: 85 }, (_, i) => 'word' + i).join(' ') })
  await sleep(300)
  check('over-limit bio shows an error', (await text()).includes('5 over the 80-word limit'))
  check('the tab is flagged', await ev("document.querySelector('[role=tab][aria-selected=true] .admin-tab-status')?.textContent === 'Needs fixing'"))
  await ev("[...document.querySelectorAll('.admin-switch')].find((l) => l.textContent.includes('LinkedIn')).querySelector('input').click()")
  await sleep(1500)
  check('switched-on empty contact shows an error', (await text()).includes('Ticked but empty'))
  check('Publish is disabled with problems', await ev("document.querySelector('.admin-publish').disabled"))
  check('problem note names who and what', (await text()).includes('Bhumika Tak’s bio and LinkedIn need fixing'), (await text()).slice(0, 1500))
  check('FOLD role example does not suggest Nirmal Studio founder', (await ev("document.getElementById('p-role').placeholder")) === 'e.g. Architect, FOLD')
  check('status line still says the older section is live', (await text()).includes('older Tej + FOLD section'))
  await shot('f-1440-problems', 1440, 1100)
  await shot('f-390-problems', 390, 844)
  check('phone: all five tabs visible without scrolling', await ev("[...document.querySelectorAll('[role=tab]')].every((t) => { const r = t.getBoundingClientRect(); return r.right <= innerWidth && r.left >= 0 })"))

  // Fix them, check readiness counts
  await ev("(() => { const el = document.getElementById('p-bio'); el.focus(); el.select() })()")
  await cdp('Input.insertText', { text: Array.from({ length: 60 }, (_, i) => 'word' + i).join(' ') })
  await ev("[...document.querySelectorAll('.admin-switch')].find((l) => l.textContent.includes('LinkedIn')).querySelector('input').click()")
  await sleep(1800)
  check('Publish enabled again', !(await ev("document.querySelector('.admin-publish').disabled")), await ev("document.querySelector('.admin-state').textContent"))
  check('Bhumika’s tab: Ready', await ev("document.querySelector('[role=tab][aria-selected=true] .admin-tab-status')?.textContent === 'Ready'"))
  // Rachit: start a slow upload, leave the pane, come back — the photo must be there
  await tab('Rachit Sinvhal')
  await cdp('Network.enable')
  await cdp('Network.emulateNetworkConditions', { offline: false, latency: 200, downloadThroughput: 1e6, uploadThroughput: 15000 })
  await setFile(SP + '/portrait.jpg')
  check('upload in progress', await waitFor("document.body.innerText.includes('Uploading…')", 8000))
  check('Discard is held while uploading', await ev("[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Discard all founders changes'))?.disabled === true"))
  await click('Settings')
  await sleep(500)
  await cdp('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  await sleep(6000)
  await click('Founders')
  await sleep(1500)
  await tab('Rachit Sinvhal')
  check('photo uploaded while away is added on return', await waitFor("document.body.innerText.includes('finished uploading while you were away') && document.querySelector('.admin-framer-frame img')?.naturalWidth > 0", 10000), (await text()).slice(0, 800))
  await sleep(1500)
  check('...and saved to the draft', !!(await draft()).doc.people.find((p) => p.id === 'rachit-sinvhal').photo?.file)
  // Reload: photos come back from the server copy
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await ev("location.reload()"); await sleep(2500)
  check('after reload, the open tab (Rachit) is restored from the URL with his photo', await waitFor("document.querySelector('[role=tab][aria-selected=true]')?.textContent.startsWith('Rachit') && document.querySelector('.admin-framer-frame img')?.naturalWidth > 0", 10000))
  // Drag and drop: a file dropped on Hardik's empty frame uploads; a second one dropped on
  // the photo he now has is refused (it would replace it with no way back).
  await tab('Hardik Maheshwari')
  const dropJpeg = (sel, colour) => ev(`(async () => {
    const c = Object.assign(document.createElement('canvas'), { width: 1000, height: 1250 }); const g = c.getContext('2d'); g.fillStyle = '${colour}'; g.fillRect(0, 0, 1000, 1250)
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9)); const dt = new DataTransfer(); dt.items.add(new File([blob], 'drop.jpg', { type: 'image/jpeg' }))
    const el = document.querySelector('${sel}'); el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
    const ev = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }); el.dispatchEvent(ev); return ev.defaultPrevented })()`)
  check('drop on the empty frame is taken (default prevented)', await dropJpeg('.admin-dropzone', '#336699'))
  check('dropped photo uploads into the framer', await waitFor("document.querySelector('.admin-framer-frame img')?.naturalWidth > 0", 20000))
  await sleep(1500)
  const hardikFile = (await draft()).doc.people.find((p) => p.id === 'hardik-maheshwari').photo?.file
  check('drop on an existing photo still prevents the browser opening the file', await dropJpeg('.admin-framer-frame', '#993333'))
  await sleep(2500)
  check('...but does not replace the photo', (await draft()).doc.people.find((p) => p.id === 'hardik-maheshwari').photo?.file === hardikFile && !(await text()).includes('Uploading…'))
  await tab('Introductions')
  check('intro tab shows the fallback as placeholder', await waitFor("document.getElementById('intro-fold')?.placeholder.startsWith('An informal network')"))
  // Publish confirmation lists the changes
  await click('Publish')
  check('confirmation lists Tej photo and Bhumika bio', await waitFor("document.body.innerText.includes('Tej Shah’s photo') && document.body.innerText.includes('Bhumika Tak’s bio')", 10000), (await text()).slice(0, 900))
  await shot('f-1440-confirm', 1440, 1000)
  await click('Cancel')
  check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 600))
} catch (e) { console.log('✗ crashed', e.message); fails++ }
finally { ws.close(); chrome.kill() }
console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0)
