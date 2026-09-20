// Unit tests for verifyPin's handling of a malformed ADMIN_PIN_HASH. Run by
// `npm run test:auth` before it starts the dev server — these need no wrangler, no D1
// and no network, so they stay fast and always run.
//
// Every case here is a way the stored hash can be WRONG rather than the PIN. That
// distinction matters more than it looks: the derived length is read from the stored
// hash, so a hash that was truncated when it was pasted into a dashboard silently
// weakens the comparison — and a zero-length one made every possible PIN verify.
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { verifyPin, PinHashUnusable, MAX_PBKDF2_ITERATIONS } from '../functions/api/admin/_lib/auth.js'

const PIN = '428317'
const salt = randomBytes(16)
const at = (rounds, bytes = 32) =>
  ['pbkdf2', 'sha256', rounds, salt.toString('base64'), pbkdf2Sync(PIN, salt, rounds, bytes, 'sha256').toString('base64')].join('$')

let pass = 0
let fail = 0
const check = (name, ok) => {
  if (ok) { pass++; console.log(` PASS  ${name}`) } else { fail++; console.log(` FAIL  ${name}`) }
}

const refuses = async (name, stored) => {
  try {
    const result = await verifyPin('000000', stored)
    check(name, false)
    if (result === true) console.log('       ^ it ACCEPTED a wrong PIN')
  } catch (err) {
    check(name, err instanceof PinHashUnusable)
  }
}

console.log('--- a usable hash still works ---')
check('correct PIN verifies', await verifyPin(PIN, at(MAX_PBKDF2_ITERATIONS)))
check('wrong PIN does not', !(await verifyPin('000000', at(MAX_PBKDF2_ITERATIONS))))

console.log('--- an unusable hash is reported, never treated as a wrong PIN ---')
const full = at(MAX_PBKDF2_ITERATIONS)
await refuses('empty hash segment', full.slice(0, full.lastIndexOf('$') + 1))
await refuses('one-byte hash segment', at(MAX_PBKDF2_ITERATIONS, 1))
await refuses('three-byte hash segment', at(MAX_PBKDF2_ITERATIONS, 3))
await refuses('hash segment is not base64', `${full.slice(0, full.lastIndexOf('$') + 1)}!!!!`)
await refuses('too few fields', 'pbkdf2$sha256$100000$abc')
await refuses('unsupported scheme', at(MAX_PBKDF2_ITERATIONS).replace('pbkdf2$sha256', 'scrypt$sha512'))
await refuses('empty string', '')
await refuses('iterations above the Workers ceiling', at(210_000))
await refuses('iterations not a number', at(MAX_PBKDF2_ITERATIONS).replace('$100000$', '$lots$'))
await refuses('zero iterations', at(MAX_PBKDF2_ITERATIONS).replace('$100000$', '$0$'))

console.log(`\nhash tests — passed: ${pass}   failed: ${fail}`)
process.exit(fail === 0 ? 0 : 1)
