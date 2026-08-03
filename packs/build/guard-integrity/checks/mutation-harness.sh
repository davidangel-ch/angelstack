#!/usr/bin/env bash
# Mutation harness — proves a guard actually trips.
#
# A guard nobody has watched fail is a decoration with a green checkmark. This
# runs your guard against a clean fixture (must pass) and against each mutation
# fixture (must fail). Every mutation directory is a claim: "this is a way the
# bug could come back."
#
#   ./mutation-harness.sh <guard-command> <fixtures-dir>
#
# Example:
#   ./mutation-harness.sh "bash ../no-native-controls.sh" ./fixtures
#
# Fixture layout:
#   fixtures/clean/                 guard must exit 0
#   fixtures/mutations/01-name/     guard must exit non-zero
#   fixtures/mutations/02-name/     ...
#
# The guard runs with the fixture directory as CWD.
#
# From angelstack — https://github.com/davidangel-ch/angelstack
set -uo pipefail

GUARD=${1:-}
FIXTURES=${2:-./fixtures}

if [ -z "$GUARD" ]; then
  echo "usage: $0 <guard-command> [fixtures-dir]" >&2
  exit 2
fi

GUARD_ABS_DIR=$(pwd)
pass=0
fail=0

run_in() {
  local dir="$1"
  ( cd "$dir" && PATH="$GUARD_ABS_DIR:$PATH" eval "$GUARD" >/dev/null 2>&1 )
  echo $?
}

echo "mutation harness: $GUARD"
echo

# ── clean fixture must pass ──────────────────────────────────────────────────
if [ -d "$FIXTURES/clean" ]; then
  code=$(run_in "$FIXTURES/clean")
  if [ "$code" -eq 0 ]; then
    echo "  ok    clean            exit 0"
    pass=$((pass + 1))
  else
    echo "  FAIL  clean            exit $code, expected 0 — the guard fires on good code"
    fail=$((fail + 1))
  fi
else
  echo "  WARN  no clean/ fixture — cannot prove the guard doesn't fire on good code"
fi

# ── every mutation must trip ─────────────────────────────────────────────────
if [ ! -d "$FIXTURES/mutations" ]; then
  echo
  echo "  no mutations/ directory found at $FIXTURES/mutations" >&2
  echo "  A guard with no mutation cases is untested. Add the bug that caused it." >&2
  exit 2
fi

found=0
for dir in "$FIXTURES"/mutations/*/; do
  [ -d "$dir" ] || continue
  found=$((found + 1))
  name=$(basename "$dir")
  code=$(run_in "$dir")
  if [ "$code" -ne 0 ]; then
    printf '  ok    %-18s exit %s\n' "$name" "$code"
    pass=$((pass + 1))
  else
    printf '  FAIL  %-18s exit 0, expected non-zero — this shape escapes the guard\n' "$name"
    fail=$((fail + 1))
  fi
done

if [ "$found" -eq 0 ]; then
  echo "  no mutation fixtures found — nothing was proven" >&2
  exit 2
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "  $pass/$((pass + fail)) — guard trips on every known shape"
  exit 0
fi

cat <<EOF
  $fail of $((pass + fail)) checks failed.

  A mutation that exits 0 is a shape your matcher does not cover. Widen the
  guard in the same commit as the fix, or the next instance is already being
  typed. See packs/build/guard-integrity/SKILL.md
EOF
exit 1
