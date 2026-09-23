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

echo "--- ADMIN_PIN_HASH validation (no server needed) ---"
node scripts/test-pin-hash.mjs || exit 1
echo

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
# otherwise lock this one out before it starts. The PIN row matters more: once the change-
# PIN tests below have run, a stored hash outranks ADMIN_PIN_HASH, so leaving it behind
# would make every later run sign in with the wrong PIN.
npx wrangler d1 execute nirmal-studio-admin --local --command "DELETE FROM login_attempts" -y >/dev/null 2>&1
npx wrangler d1 execute nirmal-studio-admin --local --command "DELETE FROM settings WHERE key = 'pin_hash'" -y >/dev/null 2>&1

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
check "garbage cookie"       "$(code -H "Cookie: __Host-nirmal_admin=nonsense" $BASE/me)" 401

echo "--- hostile cookie headers ---"
# A bare % is an invalid percent-escape. decodeURIComponent throws on it, and the
# offending cookie need not be ours — any third-party cookie on the domain would do.
# Unguarded this turned every session check into a 500 for that browser, permanently.
check "malformed escape alongside a real session" "$(code -H "Cookie: junk=%; $COOKIE" $BASE/me)" 200
check "malformed escape with no session"          "$(code -H "Cookie: junk=%" $BASE/me)" 401
check "truncated UTF-8 escape"                    "$(code -H "Cookie: junk=%E0%A4; $COOKIE" $BASE/me)" 200
# Duplicate names resolve first-wins, so a copy appended by something else cannot
# shadow the real session.
check "a shadowing duplicate cannot replace the session" "$(code -H "Cookie: $COOKIE; __Host-nirmal_admin=bogus" $BASE/me)" 200

echo "--- lockout after repeated failures ---"
npx wrangler d1 execute nirmal-studio-admin --local --command "DELETE FROM login_attempts" -y >/dev/null 2>&1
for i in 1 2 3 4; do code -X POST -H "$J" -d '{"pin":"000009"}' $BASE/login > /dev/null; done
check "5th wrong PIN locks out (429)" "$(code -X POST -H "$J" -d '{"pin":"000009"}' $BASE/login)" 429
check "correct PIN ALSO refused while locked" "$(code -X POST -H "$J" -d "{\"pin\":\"$TEST_PIN\"}" $BASE/login)" 429
npx wrangler d1 execute nirmal-studio-admin --local --command "DELETE FROM login_attempts" -y >/dev/null 2>&1
check "login works again once the lock is cleared" "$(code -X POST -H "$J" -d "{\"pin\":\"$TEST_PIN\"}" $BASE/login)" 200

echo "--- parallel guessing cannot outrun the counter ---"
# The counter used to be read, incremented in JavaScript and written back across two
# round-trips, so simultaneous attempts all read the same value and wrote the same
# value+1: a burst of N guesses advanced it by 1 and the lockout never tripped. The
# increment now happens inside a single SQL statement, so every attempt is counted.
npx wrangler d1 execute nirmal-studio-admin --local --command "DELETE FROM login_attempts" -y >/dev/null 2>&1
BURST=""
for _ in $(seq 1 10); do
  curl -s -o /dev/null -X POST -H "$J" -d '{"pin":"000009"}' $BASE/login &
  BURST="$BURST $!"
done
# Wait on these ten PIDs specifically. A bare `wait` would also wait on the dev server
# backgrounded above, which never exits — the whole script would hang there forever.
wait $BURST
COUNTED=$(npx wrangler d1 execute nirmal-studio-admin --local --json \
  --command "SELECT failures FROM login_attempts WHERE bucket LIKE 'ip:%'" -y 2>/dev/null \
  | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['results'][0]['failures'])" 2>/dev/null)
check "all 10 parallel failures were counted" "${COUNTED:-none}" 10
check "and the account is locked"  "$(code -X POST -H "$J" -d "{\"pin\":\"$TEST_PIN\"}" $BASE/login)" 429
npx wrangler d1 execute nirmal-studio-admin --local --command "DELETE FROM login_attempts" -y >/dev/null 2>&1

echo "--- signing out revokes server-side ---"
COOKIE2=$(grep -i '^set-cookie:' "$TMP/h" | sed 's/[Ss]et-[Cc]ookie: //' | cut -d';' -f1)
code -X POST -H "Cookie: $COOKIE2" $BASE/logout > /dev/null
check "cookie is dead after logout" "$(code -H "Cookie: $COOKIE2" $BASE/me)" 401

echo "--- changing the PIN ---"
NEW_PIN=735412
npx wrangler d1 execute nirmal-studio-admin --local --command "DELETE FROM login_attempts" -y >/dev/null 2>&1
check "changing the PIN needs a session" "$(code -X POST -H "$J" -d "{\"currentPin\":\"$TEST_PIN\",\"newPin\":\"$NEW_PIN\"}" $BASE/pin)" 401
code -D "$TMP/h3" -X POST -H "$J" -d "{\"pin\":\"$TEST_PIN\"}" $BASE/login > /dev/null
COOKIE3=$(grep -i '^set-cookie:' "$TMP/h3" | sed 's/[Ss]et-[Cc]ookie: //' | cut -d';' -f1)
PIN_POST() { code -X POST -H "$J" -H "Cookie: $COOKIE3" --data-binary "$1" "$BASE/pin"; }
# 403, not 401: a wrong CURRENT pin must not read as "your session ended" — the admin app
# bounces to the login screen on any 401.
check "wrong current PIN is refused (403, not 401)" "$(PIN_POST "{\"currentPin\":\"000001\",\"newPin\":\"$NEW_PIN\"}")" 403
check "a six-times-repeated new PIN is refused"     "$(PIN_POST "{\"currentPin\":\"$TEST_PIN\",\"newPin\":\"111111\"}")" 400
check "a straight run is refused"                   "$(PIN_POST "{\"currentPin\":\"$TEST_PIN\",\"newPin\":\"123456\"}")" 400
check "a 5-digit new PIN is refused"                "$(PIN_POST "{\"currentPin\":\"$TEST_PIN\",\"newPin\":\"12345\"}")" 400
check "the same PIN again is refused"               "$(PIN_POST "{\"currentPin\":\"$TEST_PIN\",\"newPin\":\"$TEST_PIN\"}")" 400
npx wrangler d1 execute nirmal-studio-admin --local --command "DELETE FROM login_attempts" -y >/dev/null 2>&1
# Run first, checked second. Called inline as check's argument, this request reported 200
# while the PIN had not changed and no session had been revoked — the three assertions
# after it then failed. Keep the assignment.
CHANGE_CODE=$(PIN_POST "{\"currentPin\":\"$TEST_PIN\",\"newPin\":\"$NEW_PIN\"}")
check "the PIN changes"                             "$CHANGE_CODE" 200
check "the session that changed it is dead"  "$(code -H "Cookie: $COOKIE3" $BASE/me)" 401
check "the session opened earlier is dead too" "$(code -H "Cookie: $COOKIE" $BASE/me)" 401
check "the old PIN no longer works"          "$(code -X POST -H "$J" -d "{\"pin\":\"$TEST_PIN\"}" $BASE/login)" 401
check "the new PIN works"                    "$(code -X POST -H "$J" -d "{\"pin\":\"$NEW_PIN\"}" $BASE/login)" 200
# The stored hash outranks ADMIN_PIN_HASH, which is what makes a changed PIN survive a
# redeploy. Removing the row puts the deployment's own secret back in force.
npx wrangler d1 execute nirmal-studio-admin --local --command "DELETE FROM settings WHERE key = 'pin_hash'" -y >/dev/null 2>&1
check "removing the stored PIN restores the deployment's own" "$(code -X POST -H "$J" -d "{\"pin\":\"$TEST_PIN\"}" $BASE/login)" 200

echo "--- the PIN form shares the lockout (no counter wiped first) ---"
# Deliberately NOT clearing login_attempts around these: the point is that a wrong current
# PIN in the change form counts toward the same lockout /login uses. Removing recordFailure
# from pin.js used to leave every check in this file passing.
npx wrangler d1 execute nirmal-studio-admin --local --command "DELETE FROM login_attempts" -y >/dev/null 2>&1
code -D "$TMP/h4" -X POST -H "$J" -d "{\"pin\":\"$TEST_PIN\"}" $BASE/login > /dev/null
COOKIE4=$(grep -i '^set-cookie:' "$TMP/h4" | sed 's/[Ss]et-[Cc]ookie: //' | cut -d';' -f1)
for _ in 1 2 3 4; do
  code -X POST -H "$J" -H "Cookie: $COOKIE4" --data-binary "{\"currentPin\":\"000001\",\"newPin\":\"$NEW_PIN\"}" "$BASE/pin" > /dev/null
done
FIFTH=$(code -X POST -H "$J" -H "Cookie: $COOKIE4" --data-binary "{\"currentPin\":\"000001\",\"newPin\":\"$NEW_PIN\"}" "$BASE/pin")
check "a 5th wrong current PIN is locked out (429)" "$FIFTH" 429
check "and /login is locked too — same buckets" "$(code -X POST -H "$J" -d "{\"pin\":\"$TEST_PIN\"}" $BASE/login)" 429
npx wrangler d1 execute nirmal-studio-admin --local --command "DELETE FROM login_attempts WHERE bucket LIKE 'ip:%'" -y >/dev/null 2>&1
check "signing in clears the global bucket its typos filled" "$(code -X POST -H "$J" -d "{\"pin\":\"$TEST_PIN\"}" $BASE/login)" 200
GLOBAL_LEFT=$(npx wrangler d1 execute nirmal-studio-admin --local --json --command "SELECT COUNT(*) c FROM login_attempts WHERE bucket = 'global'" -y 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['results'][0]['c'])" 2>/dev/null)
check "nothing left in the global bucket" "${GLOBAL_LEFT:-none}" 0

echo "--- a session in use renews itself ---"
code -D "$TMP/h5" -X POST -H "$J" -d "{\"pin\":\"$TEST_PIN\"}" $BASE/login > /dev/null
COOKIE5=$(grep -i '^set-cookie:' "$TMP/h5" | sed 's/[Ss]et-[Cc]ookie: //' | cut -d';' -f1)
SID=${COOKIE5#*=}; SID=${SID%.*}
EXPIRES_BEFORE=$(npx wrangler d1 execute nirmal-studio-admin --local --json --command "SELECT expires_at e FROM sessions WHERE id = '$SID'" -y 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['results'][0]['e'])" 2>/dev/null)
# Pretend the session was last used two hours ago — the renewal is hourly, so a fresh one
# would not renew and this check would prove nothing.
npx wrangler d1 execute nirmal-studio-admin --local --command "UPDATE sessions SET last_seen_at = last_seen_at - 7200000, expires_at = expires_at - 7200000 WHERE id = '$SID'" -y >/dev/null 2>&1
code -H "Cookie: $COOKIE5" $BASE/me > /dev/null
EXPIRES_AFTER=$(npx wrangler d1 execute nirmal-studio-admin --local --json --command "SELECT expires_at e FROM sessions WHERE id = '$SID'" -y 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['results'][0]['e'])" 2>/dev/null)
RENEWED=$([ "${EXPIRES_AFTER:-0}" -gt "${EXPIRES_BEFORE:-0}" ] && echo yes || echo no)
check "using it pushes the 30 days out again" "$RENEWED" yes

echo
echo "passed: $pass   failed: $fail"
[ "$fail" -eq 0 ] || exit 1
