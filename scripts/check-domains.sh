#!/usr/bin/env bash
# Confirms every public hostname serves the real site through Cloudflare.
# Run after any DNS, custom-domain, or deploy change: `npm run check:domains`.
#
# Why: apex and www are separate DNS records. In Sept 2026 www was still pointing at
# an old GitHub Pages placeholder months after the apex moved to Cloudflare Pages,
# and nobody noticed because only the apex was ever checked.

HOSTS=("nirmalstudio.com" "www.nirmalstudio.com")
EXPECTED_TITLE="Nirmal Studio — Architects"

failed=0
for host in "${HOSTS[@]}"; do
  headers=$(curl -sS -D - -o /dev/null --max-time 30 "https://$host/" 2>&1)
  body=$(curl -sS --max-time 30 "https://$host/" 2>/dev/null)
  status=$(printf '%s\n' "$headers" | awk '/^HTTP/ {code=$2} END {print code}')
  server=$(printf '%s\n' "$headers" | awk -F': ' 'tolower($1)=="server" {print $2}' | tr -d '\r')
  title=$(printf '%s' "$body" | grep -o '<title>[^<]*</title>' | head -1)

  problems=()
  [ "$status" = "200" ] || problems+=("status=${status:-none}")
  [ "$server" = "cloudflare" ] || problems+=("server=${server:-none} (expected cloudflare)")
  case "$title" in *"$EXPECTED_TITLE"*) ;; *) problems+=("title=${title:-none}") ;; esac

  if [ ${#problems[@]} -eq 0 ]; then
    echo "OK    $host"
  else
    echo "FAIL  $host — ${problems[*]}"
    failed=1
  fi
done

exit $failed
