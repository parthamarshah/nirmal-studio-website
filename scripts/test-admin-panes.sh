#!/bin/bash
# Browser tests for the admin's pane switching: run `npm run test:panes`.
#
# Needs Google Chrome (headless) and the same .dev.vars swap as test-admin-publish.sh, so
# the real PIN is never used. PUBLISH_BRANCH is only read from here — nothing publishes —
# but it must be a branch that exists, since a draft GET reads its published version.
set -uo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d); PROFILE="$TMP/chrome"
cleanup() { [ -f .dev.vars.real ] && mv -f .dev.vars.real .dev.vars && echo "• restored .dev.vars"; pkill -f "wrangler pages dev" 2>/dev/null; pkill -f "$PROFILE" 2>/dev/null; rm -rf "$TMP"; }
trap cleanup EXIT INT TERM
cp .dev.vars .dev.vars.real
node -e "
const { pbkdf2Sync, randomBytes } = require('crypto'); const fs = require('fs'); const salt = randomBytes(16)
const hash = ['pbkdf2','sha256',100000,salt.toString('base64'),pbkdf2Sync('428317',salt,100000,32,'sha256').toString('base64')].join('\$')
const kept = fs.readFileSync('.dev.vars.real','utf8').split('\n').filter(l => !/^(ADMIN_PIN_HASH|SESSION_SECRET|PUBLISH_BRANCH)=/.test(l))
kept.push('ADMIN_PIN_HASH=' + hash, 'SESSION_SECRET=' + randomBytes(32).toString('base64'), 'PUBLISH_BRANCH=admin-test')
fs.writeFileSync('.dev.vars', kept.join('\n').replace(/\n+\$/,'') + '\n', { mode: 0o600 })"
pkill -f "wrangler pages dev" 2>/dev/null; sleep 1
npx wrangler pages dev --port 8788 > "$TMP/dev.log" 2>&1 &
for _ in $(seq 1 60); do sleep 1; curl -sf --max-time 2 http://127.0.0.1:8788/ >/dev/null 2>&1 && break; done
D1() { npx wrangler d1 execute nirmal-studio-admin --local --command "$1" -y >/dev/null 2>&1; }
D1 "DELETE FROM login_attempts"; D1 "DELETE FROM drafts"; D1 "DELETE FROM publishes WHERE branch = 'admin-test'"
# One past publish, so the publish strip ("Last published …") is on screen like it is in
# real use. Without it the unsaved-edit bar is the only strip, and the layout bug it is
# checked against — a second strip pushed below the panes — cannot appear at all.
D1 "INSERT INTO publishes (commit_sha, branch, summary, files, parent_sha, created_at, kind) VALUES ('1111111111111111111111111111111111111111', 'admin-test', 'Studio settings — short address', '[]', '2222222222222222222222222222222222222222', $(( $(date +%s) * 1000 - 600000 )), 'publish')"
PROFILE="$PROFILE" node scripts/test-admin-panes.mjs; rc=$?
D1 "DELETE FROM drafts"
exit $rc
