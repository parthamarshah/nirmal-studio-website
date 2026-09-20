// TEMPORARY — delete once the Phase 2 plan's risk #1 is settled.
//
// Why this exists: Workers' free tier caps CPU per request, and PBKDF2 at 210k
// iterations is the one thing in /admin that might exceed it. `wrangler pages dev`
// enforces no limit, so the question can ONLY be answered on a real deployment.
// This endpoint runs exactly the derivation the login does, at a chosen iteration
// count, so `wrangler pages deployment tail` reports the real cpuTime — without
// needing ADMIN_PIN_HASH or SESSION_SECRET to exist on any deployment.
//
// It refuses to run wherever PUBLISH_BRANCH is main, so even if this file were ever
// merged by accident it stays inert on the live site rather than handing visitors a
// CPU burner. Iterations are clamped for the same reason.
const MAX_ITERATIONS = 250_000

export async function onRequestGet({ request, env }) {
  if (env.PUBLISH_BRANCH === 'main') return new Response('Not found', { status: 404 })

  const url = new URL(request.url)
  const iterations = Math.min(MAX_ITERATIONS, Math.max(1, Number(url.searchParams.get('i')) || 210_000))
  const started = Date.now()

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('123456'), 'PBKDF2', false, ['deriveBits'])
  await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(16), iterations },
    key,
    256,
  )

  return new Response(JSON.stringify({ iterations, wallMs: Date.now() - started }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
