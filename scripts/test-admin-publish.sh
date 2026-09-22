#!/bin/bash
# End-to-end tests for Publish / Undo / status. Run: npm run test:publish
#
# These make REAL commits, so they never point at admin-test or main: PUBLISH_BRANCH is
# swapped to a throwaway branch (default admin-publish-test) that must already exist on
# GitHub. Create it from admin-test first, and delete it afterwards:
#   git push git@github.com:parthamarshah/nirmal-studio-website.git admin-test:refs/heads/admin-publish-test
#   git push git@github.com:parthamarshah/nirmal-studio-website.git :refs/heads/admin-publish-test
# Same .dev.vars swap as test-admin-auth.sh (see there for why), with PUBLISH_BRANCH too.
set -uo pipefail
cd "$(dirname "$0")/.."

PORT=8788
TEST_PIN=428317
BRANCH="${1:-admin-publish-test}"
TMP=$(mktemp -d)

case "$BRANCH" in main|admin-test) echo "✗ Refusing to run publish tests against $BRANCH."; exit 1 ;; esac

cleanup() {
  [ -f .dev.vars.real ] && mv -f .dev.vars.real .dev.vars && echo "• restored your real .dev.vars"
  pkill -f "wrangler pages dev" 2>/dev/null
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

[ -f .dev.vars ] || { echo "✗ No .dev.vars — run 'npm run admin:secrets' first."; exit 1; }

cp .dev.vars .dev.vars.real
node -e "
const { pbkdf2Sync, randomBytes } = require('crypto')
const fs = require('fs')
const salt = randomBytes(16)
const hash = ['pbkdf2','sha256',100000,salt.toString('base64'),pbkdf2Sync('$TEST_PIN',salt,100000,32,'sha256').toString('base64')].join('\$')
const kept = fs.readFileSync('.dev.vars.real','utf8').split('\n').filter(l => !/^(ADMIN_PIN_HASH|SESSION_SECRET|PUBLISH_BRANCH)=/.test(l))
kept.push('ADMIN_PIN_HASH=' + hash, 'SESSION_SECRET=' + randomBytes(32).toString('base64'), 'PUBLISH_BRANCH=$BRANCH')
fs.writeFileSync('.dev.vars', kept.join('\n').replace(/\n+\$/,'') + '\n', { mode: 0o600 })
"

pkill -f "wrangler pages dev" 2>/dev/null; sleep 1
npx wrangler pages dev --port $PORT > "$TMP/dev.log" 2>&1 &
for _ in $(seq 1 60); do sleep 1; curl -sf --max-time 2 "http://127.0.0.1:$PORT/" >/dev/null 2>&1 && break; done
curl -sf --max-time 2 "http://127.0.0.1:$PORT/" >/dev/null 2>&1 || { echo "✗ dev server never came up:"; tail -20 "$TMP/dev.log"; exit 1; }

D1() { npx wrangler d1 execute nirmal-studio-admin --local --command "$1" -y >/dev/null 2>&1; }
D1 "DELETE FROM login_attempts"
D1 "DELETE FROM drafts"
D1 "DELETE FROM publishes WHERE branch = '$BRANCH'"

BASE="http://127.0.0.1:$PORT/api/admin" PIN=$TEST_PIN BRANCH=$BRANCH node scripts/test-admin-publish.mjs
