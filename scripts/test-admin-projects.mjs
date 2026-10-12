// The project editor in real Chrome, run by scripts/test-admin-projects.sh
// (npm run test:projects): list → editor, details, uploads, the image panel (address,
// Esc, Back, rotate, caption, hide/remove guards), story sections with formatted text and
// images, cover framing, problems holding Publish, and the Publish confirmation.
// Screenshots land next to the fixtures.
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
const tab = (name) => ev(`(() => { const t = [...document.querySelectorAll('[role=tab]')].find((t) => (t.querySelector('.admin-tab-name')?.textContent === ${JSON.stringify(name)} || t.querySelector('.admin-tab-name')?.textContent.startsWith(${JSON.stringify(name)} + ' '))); if (!t) throw new Error('no tab ' + ${JSON.stringify(name)}); t.click(); return true })()`)
const SP = process.env.FIXTURES // test images and screenshots (made by the .sh)
const draft = async () => (await ev("fetch('/api/admin/draft?id=project:citadel-tower').then((r) => r.json())"))
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
  await ev("location.hash = '#/projects'; location.reload()"); await sleep(2000)
  check('list shows nine projects as buttons', await waitFor("document.querySelectorAll('.admin-plist-open').length === 9", 15000))
  check('state line asks to choose a project', (await text()).includes('Choose a project to edit'))
  await ev("[...document.querySelectorAll('.admin-plist-open')].find((b) => b.textContent.includes('Citadel Tower')).click()")
  check('editor opens on Details with the name', await waitFor("document.getElementById('pj-name')?.value === 'The Citadel Tower'", 20000), String(await ev("document.getElementById('pj-name')?.value")) + ' | ' + (await ev("document.querySelector('.admin-main')?.innerText.slice(0, 300)")))
  check('URL names the project', await ev("location.hash === '#/projects/citadel-tower'"))
  check('no problems on an untouched project', !(await text()).includes('to fix'), (await text()).slice(0, 800))
  await shot('p-1440-details', 1440, 1000)

  // Details
  await ev("(() => { const el = document.getElementById('pj-status'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(el, 'under-construction'); el.dispatchEvent(new Event('change', { bubbles: true })) })()")
  await click('+ Add a fact')
  await ev("document.querySelector('[aria-label=\"Extra fact 1 label\"]').focus()"); await cdp('Input.insertText', { text: 'Client' })
  await ev("document.querySelector('[aria-label=\"Extra fact 1 value\"]').focus()"); await cdp('Input.insertText', { text: 'Private' })
  await sleep(1800)
  let d = await draft()
  check('status and extra fact saved', d.doc?.facts?.status === 'under-construction' && d.doc.facts.custom?.[0]?.label === 'Client', JSON.stringify(d.doc?.facts))
  // Empty name holds Publish
  await ev("(() => { const el = document.getElementById('pj-name'); el.focus(); el.select() })()"); await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 })
  await sleep(1500)
  check('empty name: Details tab flagged and Publish disabled', (await text()).includes('1 thing to fix') && (await ev("document.querySelector('.admin-publish').disabled")))
  await ev("document.getElementById('pj-name').focus()"); await cdp('Input.insertText', { text: 'The Citadel Tower' })
  await sleep(1500)

  // Images
  await tab('Images')
  check('images tab lists the pool', await waitFor("document.querySelectorAll('.admin-image-card').length === 5"))
  await setFile(SP + '/portrait.jpg')
  check('upload adds a sixth image marked Not used', await waitFor("document.querySelectorAll('.admin-image-card').length === 6 && document.querySelectorAll('.admin-image-card')[5].textContent.includes('Not used')", 25000), (await text()).slice(0, 800))
  await sleep(1500)
  d = await draft()
  const added = d.doc.pool[5]
  check('new pool entry saved with a clean id', /^portrait(-\d+)?$/.test(added?.id ?? '') && added.type === 'render' && added.hidden === false, JSON.stringify(added))
  await shot('p-1440-images', 1440, 1000)

  // Panel
  await ev("document.querySelectorAll('.admin-image-card')[5].click()")
  check('panel opens with its own address', await waitFor(`location.hash === '#/projects/citadel-tower/images/${added.id}' && !!document.querySelector('.admin-panel')`))
  // Typed one key at a time, with saves landing in between: focus must stay in the box.
  await ev("document.getElementById('img-caption').focus()")
  for (const ch of 'Test caption') { await cdp('Input.insertText', { text: ch }); await sleep(ch === ' ' ? 1300 : 60) }
  check('typing a caption keeps focus in the caption box', await ev("document.activeElement?.id === 'img-caption' && document.getElementById('img-caption').value === 'Test caption'"), await ev("document.activeElement?.outerHTML.slice(0, 80) + ' / ' + document.getElementById('img-caption').value"))
  check('the page behind the panel is inert', await ev("document.getElementById('admin-root').inert === true"))
  await click('↻ Right')
  await click('Drawing')
  await sleep(1600)
  d = await draft()
  const a2 = d.doc.pool.find((i) => i.id === added.id)
  check('caption, rotation and type saved', a2.caption === 'Test caption' && a2.rotation === 90 && a2.type === 'drawing', JSON.stringify(a2))
  await ev("[...document.querySelectorAll('.admin-panel [role=radio]')].find((b) => b.textContent === '16:9').click()")
  await sleep(1600)
  d = await draft()
  const c = d.doc.pool.find((i) => i.id === added.id).crop
  // Rotated 90°, the 1600x2400 fixture is 2400x1600: a centred 16:9 trim is the full width.
  check('16:9 trim saved against the rotated image', c && Math.abs((c.w * 2400) / (c.h * 1600) - 16 / 9) < 0.01, JSON.stringify(c))
  await shot('p-1440-panel', 1440, 1000)
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  check('Esc closes the panel and the address', await waitFor("!document.querySelector('.admin-panel') && location.hash === '#/projects/citadel-tower/images'"))
  check('...the page is usable again and focus is back on the image card', await waitFor(`document.getElementById('admin-root').inert === false && document.activeElement?.dataset.imageId === '${added.id}'`))
  // The cover / homepage image can't be hidden or removed
  await ev("[...document.querySelectorAll('.admin-image-card')].find((c) => c.textContent.includes('Cover')).click()")
  await waitFor("!!document.querySelector('.admin-panel')")
  check('cover image: Show on site is locked with a reason', await ev("[...document.querySelectorAll('.admin-panel .admin-switch')].find((l) => l.textContent.includes('Show on the site')).querySelector('input').disabled") && (await text()).includes('It’s the cover'))
  check('homepage image: Remove is blocked with a reason', (await text()).includes('Can’t be removed') && (await text()).includes('homepage'))
  await click('×')
  await waitFor("!document.querySelector('.admin-panel')")
  // Back closes a panel opened by a click (it pushed an address)
  await ev("document.querySelectorAll('.admin-image-card')[1].click()")
  await waitFor("!!document.querySelector('.admin-panel')")
  await ev('history.back()')
  check('Back closes the panel and stays in the editor', await waitFor("!document.querySelector('.admin-panel') && location.hash.startsWith('#/projects/citadel-tower')"))

  // Story
  await tab('Story')
  check('story shows five sections with a text editor each', await waitFor("document.querySelectorAll('.admin-section-card').length === 5 && document.querySelectorAll('.admin-rich-content').length === 5", 10000))
  await ev("document.querySelectorAll('.admin-rich-content')[0].focus()")
  await ev("(() => { const el = document.querySelectorAll('.admin-rich-content')[0]; const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r) })()")
  await cdp('Input.insertText', { text: ' Added sentence.' })
  await sleep(300)
  await ev("(() => { const el = document.querySelectorAll('.admin-rich-content')[0]; const t = [...el.querySelectorAll('p')].pop(); const n = t.lastChild; const r = document.createRange(); r.setStart(n, n.textContent.length - 9); r.setEnd(n, n.textContent.length - 1); const s = getSelection(); s.removeAllRanges(); s.addRange(r) })()")
  await sleep(200)
  await ev("document.querySelector('.admin-rt-btn[aria-label=Bold]').click()")
  await sleep(1800)
  d = await draft()
  const body = JSON.stringify(d.doc.sections[0].body)
  check('typed text and bold saved as editor JSON', body.includes('Added') && body.includes('"bold"'), body.slice(0, 300))
  // Add the new image to section 1, frame 3:2
  await ev("document.querySelectorAll('.admin-ref-add')[0].click()")
  await ev(`document.querySelector('.admin-pick--add [aria-label="Add Test caption"]').click()`)
  await sleep(300)
  await ev("(() => { const card = document.querySelectorAll('.admin-section-card')[0]; const sel = [...card.querySelectorAll('.admin-ref select')].pop(); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(sel, '3:2'); sel.dispatchEvent(new Event('change', { bubbles: true })) })()")
  // Add a section, then delete it (with confirm)
  await click('+ Add a section')
  await sleep(300)
  check('a sixth section appears', (await ev("document.querySelectorAll('.admin-section-card').length")) === 6)
  await ev("[...document.querySelectorAll('.admin-section-card')].pop().querySelector('.admin-link--danger').click()")
  check('delete asks first', (await text()).includes('Delete “Section 6”'))
  await click('Delete section')
  await sleep(1800)
  d = await draft()
  const refs = d.doc.sections[0].images
  check('image added to section 1 with a 3:2 frame; temp section gone', refs.some((r) => r.image === added.id && r.shape === '3:2') && d.doc.sections.length === 5, JSON.stringify(refs))
  // Move section 2 up
  const second = d.doc.sections[1].id
  await ev("document.querySelectorAll('.admin-section-card')[1].querySelector('[aria-label=\"Move section up\"]').click()")
  await sleep(1600)
  d = await draft()
  check('moving a section up reorders it', d.doc.sections[0].id === second)
  await shot('p-1440-story', 1440, 1100)

  // Cover: pick the new image, framer shows at 16:9
  await tab('Cover')
  await ev(`document.querySelector('.admin-pick [aria-label="Test caption"]').click()`)
  check('cover framer shows at 16:9', await waitFor("(() => { const f = document.querySelector('.admin-cover-frame .admin-framer-frame'); if (!f) return false; const r = f.getBoundingClientRect(); return Math.abs(r.width / r.height - 16 / 9) < 0.02 && f.querySelector('img')?.naturalWidth > 0 })()", 15000))
  await sleep(1500)
  d = await draft()
  check('cover saved', d.doc.cover.image === added.id && d.doc.cover.crop === null, JSON.stringify(d.doc.cover))
  check('state: saved and publishable', (await text()).includes('Saved as a draft · not on the site'), await ev("document.querySelector('.admin-state').textContent"))
  await shot('p-1000-cover', 1000, 760)
  const clipped = "(() => { const m = document.querySelector('.admin-main').getBoundingClientRect(); return [...document.querySelectorAll('.admin-main input, .admin-main select, .admin-main textarea, [role=tab]')].filter((e) => e.type !== 'file' && e.getBoundingClientRect().right > m.right + 1).length })()"
  check('1000px: nothing runs past the pane', (await ev(clipped)) === 0)
  await tab('Story')
  await shot('p-390-story', 390, 844)
  check('phone: nothing runs past the screen', (await ev("[...document.querySelectorAll('.admin-main *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length")) === 0)
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })

  // Preview: the site's own page, drawn from the draft
  await click('Preview')
  check('preview shows the project page from the draft', await waitFor("!!document.querySelector('.admin-preview .project-detail-name') && document.querySelector('.admin-preview').innerText.includes('Added sentence')", 20000), (await ev("document.querySelector('.admin-preview')?.innerText.slice(0, 300)")) || '')
  check('...with its images made from the originals', await waitFor("(() => { const imgs = [...document.querySelectorAll('.admin-preview img')]; return imgs.length > 3 && imgs.every((i) => i.complete && i.naturalWidth > 0) })()", 30000), String(await ev("[...document.querySelectorAll('.admin-preview img')].map((i) => i.naturalWidth).join(',')")))
  await shot('p-1440-preview', 1440, 1000)
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  check('Esc closes the preview', await waitFor("!document.querySelector('.admin-preview') && document.getElementById('admin-root').inert === false"))

  // Publish confirmation lists the changes
  await sleep(1000)
  await ev("document.querySelector('.admin-publish').click()")
  check('confirmation lists fact, image, cover and section changes', await waitFor("['extra facts', '6 (1 added)', 'cover', 'section “concept” text', 'section order'].every((w) => document.querySelector('.admin-pubbar-changes')?.innerText.toLowerCase().includes(w))", 10000), ((await ev("document.querySelector('.admin-pubbar-changes')?.innerText")) || '').replace(/\n/g, ' | '))
  await shot('p-1440-confirm', 1440, 1000)
  await click('Cancel')

  // ---- the list (step 4)
  const dr = (slug) => ev(`fetch('/api/admin/draft?id=project:${slug}').then((r) => r.json())`)
  await ev("location.hash = '#/projects'")
  check('list loads from the server with Citadel marked Changed', await waitFor("[...document.querySelectorAll('.admin-plist li')].find((l) => l.textContent.includes('The Citadel Tower'))?.textContent.includes('Unpublished changes')", 15000), (await text()).slice(0, 600))
  const names = () => ev("[...document.querySelectorAll('.admin-plist-open strong')].map((x) => x.textContent)")
  const before = await names()
  await ev("document.querySelectorAll('.admin-plist li')[0].querySelector('[aria-label^=\"Move\"][aria-label$=\"down\"]').click()")
  check('moving the first project down swaps the first two', await waitFor(`JSON.stringify([...document.querySelectorAll('.admin-plist-open strong')].map((x) => x.textContent).slice(0, 2)) === ${JSON.stringify(JSON.stringify([before[1], before[0]]))}`, 15000), JSON.stringify(await names()))
  const t1 = await dr('terra-row-houses')
  check('...as drafts with swapped order numbers', t1.exists && t1.doc.order === 1, JSON.stringify(t1).slice(0, 200))
  // Hide a project the homepage doesn't use
  const agr = "[...document.querySelectorAll('.admin-plist li')].find((l) => l.textContent.includes('Agrawal'))"
  await ev(`${agr}.querySelector('.admin-plist-show input').click()`)
  check('hiding saves a draft with hidden: true', await waitFor("fetch('/api/admin/draft?id=project:agrawals-office').then((r) => r.json()).then((d) => d.exists && d.doc.hidden === true)", 15000))
  check('a homepage project can’t be hidden or trashed', await ev("(() => { const l = [...document.querySelectorAll('.admin-plist li')].find((l) => l.textContent.includes('The Citadel Tower')); return l.querySelector('.admin-plist-show input').disabled && l.querySelector('.admin-link--danger').disabled })()"))
  // Trash and restore
  await waitFor(`${agr}?.querySelector('.admin-link--danger')?.disabled === false`, 15000)
  await ev(`${agr}.querySelector('.admin-link--danger').click()`)
  check('Trash asks first', (await text()).includes('Move to Trash?'))
  await ev(`[...document.querySelectorAll('.admin-confirm--inline .admin-btn')][0].click()`)
  check('the project moves to Trash', await waitFor("document.querySelector('.admin-trash summary')?.textContent === 'Trash (1)'", 15000))
  await ev("document.querySelector('.admin-trash').open = true")
  await waitFor("document.querySelector('.admin-trash-row .admin-link')?.disabled === false", 15000)
  await ev("[...document.querySelectorAll('.admin-trash-row .admin-link')][0].click()")
  check('Restore brings it back', await waitFor("!document.querySelector('.admin-trash') && [...document.querySelectorAll('.admin-plist li')].some((l) => l.textContent.includes('Agrawal'))", 15000))
  // New project
  await waitFor("[...document.querySelectorAll('button')].find((b) => b.textContent === '+ New project')?.disabled === false", 15000)
  await click('+ New project')
  await ev("document.getElementById('new-project-name').focus()"); await cdp('Input.insertText', { text: 'Test Villa' })
  check('the new link name is shown', (await text()).includes('/projects/test-villa/'))
  await click('Create')
  check('a new project opens in the editor', await waitFor("location.hash === '#/projects/test-villa' && document.getElementById('pj-name')?.value === 'Test Villa'", 15000), await ev('location.hash'))
  const nv = await dr('test-villa')
  check('...as a hidden draft with a Concept section and no file yet', nv.exists && nv.doc.hidden === true && nv.doc.sections[0].id === 'concept' && nv.baseSha == null, JSON.stringify(nv).slice(0, 300))
  // Duplicate (Law Office has published images in the repo)
  await ev("location.hash = '#/projects'")
  await waitFor("document.querySelectorAll('.admin-plist li').length >= 10", 15000)
  await waitFor("[...document.querySelectorAll('.admin-plist li')].find((l) => l.textContent.includes('Law'))?.querySelector('.admin-plist-actions .admin-link')?.disabled === false", 15000)
  await ev("[...document.querySelectorAll('.admin-plist li')].find((l) => l.textContent.includes('Law')).querySelector('.admin-plist-actions .admin-link').click()")
  check('Duplicate opens the copy', await waitFor("location.hash === '#/projects/law-office-copy' && document.getElementById('pj-name')?.value.startsWith('Copy of')", 20000), (await ev('location.hash')) + ' ' + (await text()).slice(0, 700).replace(/\n/g, ' | '))
  await tab('Images')
  check('the copy’s images show (served from the original blobs)', await waitFor("document.querySelectorAll('.admin-image-card img').length > 0 && [...document.querySelectorAll('.admin-image-card img')].every((i) => i.complete && i.naturalWidth > 0)", 30000), String(await ev("[...document.querySelectorAll('.admin-image-card img')].map((i) => i.naturalWidth).join(',')")))
  await ev("location.hash = '#/projects'")
  await waitFor("document.querySelectorAll('.admin-plist li').length >= 11", 15000)
  await shot('p-1440-list', 1440, 1000)
  await shot('p-1000-list', 1000, 760)
  await shot('p-390-list', 390, 844)
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })

  // ---- Settings (step 5)
  const site = () => ev("fetch('/api/admin/draft?id=site').then((r) => r.json())")
  await ev("location.hash = '#/settings'")
  check('settings shows contact, social, homepage and advanced', await waitFor("!!document.getElementById('f-replyTime') && document.body.innerText.includes('Social links') && document.body.innerText.includes('Homepage images') && !!document.querySelector('.admin-advanced')", 15000))
  await ev("document.getElementById('f-replyTime').focus()"); await cdp('Input.insertText', { text: 'Usually replies within a few hours' })
  await ev("document.querySelector('[aria-label=\"Instagram link\"]').focus()"); await cdp('Input.insertText', { text: 'http://instagram.com/nirmal' })
  await sleep(400)
  check('a non-https social link is flagged and switched on', (await text()).includes('Must be a full link starting https://') && (await ev("[...document.querySelectorAll('.admin-switch')].find((l) => l.textContent.includes('Instagram')).querySelector('input').checked")))
  await ev("(() => { const el = document.querySelector('[aria-label=\"Instagram link\"]'); el.focus(); el.select() })()"); await cdp('Input.insertText', { text: 'https://www.instagram.com/nirmalstudio' })
  // Hero → Terra Row Houses, its second image
  await ev("(() => { const el = document.getElementById('spot-hero'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(el, 'terra-row-houses'); el.dispatchEvent(new Event('change', { bubbles: true })) })()")
  await sleep(300)
  await ev("document.querySelector('[aria-label=\"Image for Hero — the first image on the homepage\"]').querySelectorAll('[role=radio]')[2].click()")
  // Advanced: turning a section off asks first
  await ev("document.querySelector('.admin-advanced').open = true")
  await ev("[...document.querySelectorAll('.admin-section-switches .admin-switch')].find((l) => l.textContent.includes('Process')).querySelector('input').click()")
  check('turning a section off asks first', (await text()).includes('Hide “Process” from the homepage?'))
  await click('Hide it')
  await sleep(1800)
  const sd = await site()
  check('settings draft has reply time, Instagram, hero and Process off', sd.doc?.contact?.replyTime === 'Usually replies within a few hours' && sd.doc.socials.instagram.on === true && sd.doc.socials.instagram.url === 'https://www.instagram.com/nirmalstudio' && sd.doc.homepage.hero.project === 'terra-row-houses' && !!sd.doc.homepage.hero.image && sd.doc.sections.process === false, JSON.stringify(sd.doc && { c: sd.doc.contact.replyTime, s: sd.doc.socials.instagram, h: sd.doc.homepage.hero, p: sd.doc.sections.process }))
  await shot('p-1000-settings', 1000, 1400)
  await shot('p-390-settings', 390, 844)
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await sleep(500)
  await ev("document.querySelector('.admin-publish').click()")
  check('the confirmation lists the settings changes', await waitFor("['reply time', 'instagram link', 'homepage hero', 'process section'].every((w) => document.querySelector('.admin-pubbar-changes')?.innerText.toLowerCase().includes(w))", 15000), ((await ev("document.querySelector('.admin-pubbar-changes')?.innerText")) || '').replace(/\n/g, ' | '))
  await click('Cancel')
  check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 600))
} catch (e) { console.log('✗ crashed', e.message); fails++ }
finally { ws.close(); chrome.kill() }
console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0)
