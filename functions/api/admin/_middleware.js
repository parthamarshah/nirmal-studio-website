// Runs before every /api/admin/* handler, login and logout included.
//
// Refuses any request that changes something (anything but GET/HEAD) when the browser
// says it came from another origin. The session cookie is SameSite=Strict, but "site"
// means the whole registrable domain: erp.nirmalstudio.com (a separate app on Render)
// counts as the same site, so a compromised page there could send a text/plain POST —
// no CORS preflight — with the admin cookie attached, and e.g. Undo the latest publish.
//
// Browsers always say where a write came from (Origin, and Sec-Fetch-Site in every
// current one). A request carrying neither isn't from a browser page, so it has no
// cookie to borrow — the test scripts' plain fetch() calls are that case.
const READS = new Set(['GET', 'HEAD', 'OPTIONS'])

export async function onRequest(context) {
  const { request } = context
  if (!READS.has(request.method)) {
    const origin = request.headers.get('Origin')
    const fetchSite = request.headers.get('Sec-Fetch-Site')
    const crossOrigin =
      (origin !== null && origin !== new URL(request.url).origin) ||
      (fetchSite !== null && fetchSite !== 'same-origin' && fetchSite !== 'none')
    if (crossOrigin) {
      return new Response(JSON.stringify({ error: 'This request came from another site, so it was refused.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }
  }
  return context.next()
}
