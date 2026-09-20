#!/bin/bash
# Adversarial tests for the /admin auth endpoints. Run: npm run test:auth
#
# Why this swaps env files: `wrangler pages dev` ALWAYS loads .dev.vars, and a
# `--env-file` flag does NOT override it (verified 2026-09-20 — the runtime kept reading
# .dev.vars). Since .dev.vars holds Parth's real PIN, which nobody else knows by design,
# the only way to exercise the success path is to swap in a throwaway PIN for the
# duration and put the real file back afterwards. The trap below restores it on ANY
# exit, including Ctrl-C — losing that file would mean re-entering the GitHub token.
set -uo pipefail
cd "$(dirname "$0")/.."

PORT=8788
BASE="http://127.0.0.1:$PORT/api/admin"
TEST_PIN=428317
TMP=$(mktemp -d)

cleanup() {
  [ -f .dev.vars.real ] && mv -f .dev.vars.real .dev.vars && echo "• restored your real .dev.vars"
  pkill -f "wrangler pages dev" 2>/dev/null
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

if [ ! -f .dev.vars ]; then
  echo "✗ No .dev.vars — run 'npm run admin:secrets' first."
  exit 1
fi

# Build a throwaway hash for a known PIN, keeping every other real value (the GitHub
# token in particular, so publish tests keep working).
cp .dev.vars .dev.vars.real
node -e "
const { pbkdf2Sync, randomBytes } = require('crypto')
const fs = require('fs')
const salt = randomBytes(16)
const hash = ['pbkdf2','sha256',100000,salt.toString('base64'),pbkdf2Sync('$TEST_PIN',salt,100000,32,'sha256').toString('base64')].join('\$')
const kept = fs.readFileSync('.dev.vars.real','utf8').split('\n').filter(l => !/^(ADMIN_PIN_HASH|SESSION_SECRET)=/.test(l))
kept.push('ADMIN_PIN_HASH=' + hash, 'SESSION_SECRET=' + randomBytes(32).toString('base64'))
fs.writeFileSync('.dev.vars', kept.join('\n').replace(/\n+\$/,'') + '\n', { mode: 0o600 })
"

pkill -f "wrangler pages dev" 2>/dev/null; sleep 1
npx wrangler pages dev --port $PORT > "$TMP/dev.log" 2>&1 &
for _ in $(seq 1 60); do sleep 1; curl -sf --max-time 2 "http://127.0.0.1:$PORT/" >/dev/null 2>&1 && break; done
if ! curl -sf --max-time 2 "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
  echo "✗ dev server never came up:"; tail -20 "$TMP/dev.log"; exit 1
fi

# Lockout state persists in the local D1 between runs; a previous run's failures would
# otherwise lock this one out before it starts.
npx wrangler d1 execute nirmal-studio-admin --local --command "DELETE FROM login_attempts" -y >/dev/null 2>&1

pass=0; fail=0
check() {
  if [ "$2" = "$3" ]; then echo " PASS  $1"; pass=$((pass+1))
  else echo " FAIL  $1 — expected $3, got $2"; fail=$((fail+1)); fi
}
code() { curl -s -o "$TMP/body" -w "%{http_code}" "$@"; }
J='Content-Type: application/json'

echo "--- unauthenticated ---"
check "GET /me without a cookie is refused" "$(code $BASE/me)" 401

echo "--- rejecting bad input ---"
check "wrong PIN"        "$(code -X POST -H "$J" -d '{"pin":"000001"}' $BASE/login)" 401
check "non-numeric PIN"  "$(code -X POST -H "$J" -d '{"pin":"abcdef"}' $BASE/login)" 401
check "too-short PIN"    "$(code -X POST -H "$J" -d '{"pin":"1234"}'   $BASE/login)" 401
check "malformed body"   "$(code -X POST -H "$J" $BASE/login)" 400

echo "--- signing in ---"
check "correct PIN" "$(code -D "$TMP/h" -X POST -H "$J" -d "{\"pin\":\"$TEST_PIN\"}" $BASE/login)" 200
COOKIE=$(grep -i '^set-cookie:' "$TMP/h" | sed 's/[Ss]et-[Cc]ookie: //' | cut -d';' -f1)
for attr in HttpOnly "SameSite=Strict" Secure; do
  if grep -qi "$attr" "$TMP/h"; then echo " PASS  cookie is $attr"; pass=$((pass+1))
  else echo " FAIL  cookie missing $attr"; fail=$((fail+1)); fi
done
check "session is accepted" "$(code -H "Cookie: $COOKIE" $BASE/me)" 200

echo "--- forged cookies ---"
check "forged signature"     "$(code -H "Cookie: ${COOKIE%.*}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" $BASE/me)" 401
check "unsigned session id"  "$(code -H "Cookie: ${COOKIE%%.*}" $BASE/me)" 401
check "garbage cookie"       "$(code -H "Cookie: nirmal_admin=nonsense" $BASE/me)" 401

echo "--- lockout after repeated failures ---"
npx wrangler d1 execute nirmal-studio-admin --local --command "DELETE FROM login_attempts" -y >/dev/null 2>&1
for i in 1 2 3 4; do code -X POST -H "$J" -d '{"pin":"000009"}' $BASE/login > /dev/null; done
check "5th wrong PIN locks out (429)" "$(code -X POST -H "$J" -d '{"pin":"000009"}' $BASE/login)" 429
check "correct PIN ALSO refused while locked" "$(code -X POST -H "$J" -d "{\"pin\":\"$TEST_PIN\"}" $BASE/login)" 429
npx wrangler d1 execute nirmal-studio-admin --local --command "DELETE FROM login_attempts" -y >/dev/null 2>&1
check "login works again once the lock is cleared" "$(code -X POST -H "$J" -d "{\"pin\":\"$TEST_PIN\"}" $BASE/login)" 200

echo "--- signing out revokes server-side ---"
COOKIE2=$(grep -i '^set-cookie:' "$TMP/h" | sed 's/[Ss]et-[Cc]ookie: //' | cut -d';' -f1)
code -X POST -H "Cookie: $COOKIE2" $BASE/logout > /dev/null
check "cookie is dead after logout" "$(code -H "Cookie: $COOKIE2" $BASE/me)" 401

echo
echo "passed: $pass   failed: $fail"
[ "$fail" -eq 0 ] || exit 1
