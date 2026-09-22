#!/usr/bin/env bash
# Apply one migration to BOTH remote /admin databases — preview (`nirmal-studio-admin`) and
# production (`nirmal-studio-admin-production`) — then print each table's columns so the
# result is checked, not assumed. Usage: npm run admin:migrate:remote -- migrations/0003_x.sql
#
# Why a script: every test here runs --local, so a migration applied to only one remote
# database passes everything and then fails on the real site (see CLAUDE.md's incident
# list). Both databases were set up with `d1 execute --file`, not `d1 migrations apply`,
# and have no d1_migrations table — keep it that way for both, or migrations re-run.
set -euo pipefail
file="${1:-}"
if [[ -z "$file" || ! -f "$file" ]]; then
  echo "Usage: npm run admin:migrate:remote -- migrations/<file>.sql" >&2
  exit 1
fi
for db in nirmal-studio-admin nirmal-studio-admin-production; do
  echo "== $db"
  npx wrangler d1 execute "$db" --remote --file="$file" -y
  npx wrangler d1 execute "$db" --remote --command \
    "SELECT m.name AS tbl, group_concat(p.name) AS columns FROM sqlite_master m, pragma_table_info(m.name) p WHERE m.type = 'table' AND m.name NOT LIKE '\_%' ESCAPE '\\' AND m.name NOT LIKE 'sqlite_%' GROUP BY m.name"
done
