// Interactive setup for the two secrets the /admin backend needs, written to a
// gitignored .dev.vars that `wrangler pages dev` reads. Run: npm run admin:secrets
//
// Nothing here is ever printed, echoed to the terminal, committed, or sent anywhere.
// The PIN in particular never leaves this machine even as a hash-input: it is hashed
// here and only the hash is stored, so the file could not be used to recover it.
//
// For the REAL deployment the same values go into Cloudflare (Pages → Settings →
// Environment variables, per environment). This file is for local development only.
import { createInterface } from 'node:readline'
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs'

const FILE = '.dev.vars'

// PBKDF2-SHA256. OWASP's 2023 floor for this construction is 210k, but **Cloudflare
// Workers refuses any iteration count above 100,000** — `crypto.subtle.deriveBits`
// throws "Pbkdf2 failed: iteration counts above 100000 are not supported". Measured on
// a real preview deployment on 2026-09-20: 100000 → HTTP 200, 100001 → HTTP 500. So
// 100k is not a tuning choice, it is the hard ceiling of the platform.
//
// The free-tier CPU worry that this number was originally hedged against turned out not
// to bite: the same measurement reported 23-38ms CPU at 100k iterations with outcome
// "ok", well past the 10ms figure the plan feared.
//
// The stored format carries its own parameters, so this can be raised again if the
// platform ever lifts the cap, without invalidating existing hashes. A 6-digit PIN is
// only a million possibilities anyway, so the real protection is the server-side lockout
// (5 attempts / 15 minutes) — the hash just ensures a leaked secret store doesn't hand
// over the PIN itself.
const ITERATIONS = 100_000
export const hashPin = (pin, salt = randomBytes(16)) =>
  `pbkdf2$sha256$${ITERATIONS}$${salt.toString('base64')}$${pbkdf2Sync(pin, salt, ITERATIONS, 32, 'sha256').toString('base64')}`

export function verifyPin(pin, stored) {
  const [scheme, algo, iterations, salt, hash] = String(stored).split('$')
  if (scheme !== 'pbkdf2' || algo !== 'sha256') return false
  const expected = Buffer.from(hash, 'base64')
  const actual = pbkdf2Sync(pin, Buffer.from(salt, 'base64'), Number(iterations), expected.length, 'sha256')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

// Hidden prompt — the terminal echo is switched off so nothing appears on screen or in
// scrollback. (readline's own `hidden` support is inconsistent across terminals.)
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    const stdin = process.stdin
    const onData = (char) => {
      // Re-write the prompt without the typed characters.
      if (![`\n`, `\r`, `\u0004`].includes(char.toString())) {
        process.stdout.clearLine(0)
        process.stdout.cursorTo(0)
        process.stdout.write(question)
      }
    }
    stdin.on('data', onData)
    rl.question(question, (answer) => {
      stdin.off('data', onData)
      rl.close()
      process.stdout.write('\n')
      resolve(answer.trim())
    })
  })
}

const readVars = () =>
  existsSync(FILE)
    ? Object.fromEntries(
        readFileSync(FILE, 'utf8')
          .split('\n')
          .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
          .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
      )
    : {}

function writeVars(vars) {
  const body = [
    '# Local development secrets for the /admin backend (v1 Phase 2).',
    '# Written by scripts/setup-admin-secrets.mjs. GITIGNORED — never commit this.',
    '# Regenerate any time with: npm run admin:secrets',
    '',
    ...Object.entries(vars).map(([k, v]) => `${k}=${v}`),
    '',
  ].join('\n')
  writeFileSync(FILE, body, { mode: 0o600 })
  chmodSync(FILE, 0o600) // readable only by this user, even if the file already existed
}

const vars = readVars()

console.log(`
Setting up local secrets for the /admin backend.
Nothing you type is shown on screen, saved to shell history, or sent anywhere.
`)

// ---- 1. the admin PIN -------------------------------------------------------
const pin = await askHidden('Choose a 6-digit PIN for /admin: ')
if (!/^\d{6}$/.test(pin)) {
  console.error('\n✗ That must be exactly 6 digits (0-9), nothing else. Nothing was saved — run it again.')
  process.exit(1)
}
if (/^(\d)\1{5}$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) {
  console.error('\n✗ That PIN is one of the first few anyone would try (all-same or sequential).')
  console.error('  Nothing was saved — run it again and pick something less guessable.')
  process.exit(1)
}
const confirm = await askHidden('Type it once more to confirm:        ')
if (confirm !== pin) {
  console.error('\n✗ Those did not match. Nothing was saved — run it again.')
  process.exit(1)
}
vars.ADMIN_PIN_HASH = hashPin(pin)
// Verify the round-trip now rather than discovering a bad hash at the login screen.
if (!verifyPin(pin, vars.ADMIN_PIN_HASH)) {
  console.error('\n✗ Internal error: the PIN hash did not verify. Nothing was saved.')
  process.exit(1)
}
console.log('✓ PIN saved as a hash (the PIN itself is not stored anywhere).')

// ---- 2. the GitHub token ----------------------------------------------------
console.log(`
Now the GitHub token — the one saved in Passwords as "nirmal-studio-backend-token".
It is what lets Publish commit your content changes. Paste it and press Return.
(Press Return on its own to skip; publishing just won't work locally until you add it.)`)
const token = await askHidden('GitHub token: ')
if (token) {
  if (!token.startsWith('github_pat_') && !token.startsWith('ghp_')) {
    console.error('\n✗ That does not look like a GitHub token (expected it to start with "github_pat_").')
    console.error('  Nothing was saved — check you copied the whole value and run it again.')
    process.exit(1)
  }
  vars.GITHUB_TOKEN = token
  console.log('✓ GitHub token saved locally.')
} else if (vars.GITHUB_TOKEN) {
  console.log('• Kept the GitHub token already in .dev.vars.')
} else {
  console.log('• Skipped — add it later by running this again.')
}

// Key used to sign the admin session cookie. Generated, never chosen — it is not a
// password and nobody needs to know it. Kept if one already exists, because rotating it
// signs everyone out.
if (!vars.SESSION_SECRET) {
  vars.SESSION_SECRET = randomBytes(32).toString('base64')
  console.log('\u2713 Session signing key generated.')
}

// Branch that local publishing commits to. Never `main` by default: a publish from a
// development machine must not be able to change the live site by accident.
vars.PUBLISH_BRANCH ??= 'admin-test'

writeVars(vars)
console.log(`
Saved to ${FILE} (permissions 600, gitignored).
Publishing from local development targets the "${vars.PUBLISH_BRANCH}" branch, never main.
`)
