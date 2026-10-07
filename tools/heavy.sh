#!/bin/zsh
# Runs a heavy command (smoke test, QA tour, Blender) while holding one of a few global slots,
# so at most HEAVY_SLOTS heavy jobs run at a time across all teams (keeps the laptop cool).
# Usage: tools/heavy.sh <command...>
slots=${HEAVY_SLOTS:-2}
base=/private/tmp/claude-501/gta7-heavy.lock
lock=""
while [[ -z "$lock" ]]; do
  for i in $(seq 1 $slots); do
    l=$base; (( i > 1 )) && l="$base$i"
    if mkdir "$l" 2>/dev/null; then lock=$l; break; fi
    # stale slot (owner gone) -> free it
    owner=$(cat "$l/pid" 2>/dev/null)
    if [[ -n "$owner" ]] && ! kill -0 "$owner" 2>/dev/null; then rm -rf "$l"; fi
  done
  [[ -z "$lock" ]] && sleep 10
done
echo $$ > "$lock/pid"
trap 'rm -rf "$lock"' EXIT INT TERM
"$@"
