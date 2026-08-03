#!/usr/bin/env bash
# Native-control guard — fails when a product surface uses a native dialog or picker.
#
# Deliberately a grep, not an AST pass: these constructs are unambiguous enough,
# and a grep keeps working across frameworks, bundlers and language versions.
#
# Two tiers, on purpose:
#   BLOCKING  window.alert/confirm/prompt and <select> — unambiguous.
#   REVIEW    bare alert(/confirm(/prompt( — a codebase may define its own
#             helper with that name, which a grep cannot distinguish from the
#             global. Reported, never fails the build. A guard that cries wolf
#             gets deleted, and then it catches nothing at all.
#
# From angelstack — https://github.com/davidangel-ch/angelstack
set -uo pipefail

# ─── EDIT THIS ───────────────────────────────────────────────────────────────
SCAN_DIRS=${SCAN_DIRS:-"src apps packages"}

# Paths exempt from the rule. Keep this empty if you can. Every entry needs a
# reason in the comment beside it — a dev-only debug surface qualifies,
# "we'll fix it later" does not.
EXCLUDES=(
  ':!*.test.*' ':!*.spec.*' ':!*/node_modules/*' ':!*/dist/*' ':!*/.next/*'
  # ':!src/devtools/*'   # dev-only panel, never shipped to users
)
# ─────────────────────────────────────────────────────────────────────────────

TAB=$(printf '\t')
blocking=0

existing=""
for d in $SCAN_DIRS; do [ -d "$d" ] && existing="$existing $d"; done
if [ -z "$existing" ]; then
  echo "no scan directories found (looked for: $SCAN_DIRS)" >&2
  exit 2
fi

# Emit "<code>TAB<original hit>" so the caller re-matches against the code half
# only. Drops line comments, block-comment bodies, and local definitions of a
# same-named helper. (awk -v mangles ERE escapes, so matching happens in grep.)
strip_noise() {
  awk '{
      content = $0;
      code = $0;
      sub(/^[^:]*:[^:]*:/, "", code);          # drop file:line prefix
      trimmed = code; sub(/^[[:space:]]+/, "", trimmed);
      if (trimmed ~ /^(\*|\/\*)/) next;        # block-comment body or opener
      gsub(/:\/\//, "\001", code);             # protect URLs
      sub(/\/\/.*$/, "", code);                # drop line comment
      gsub(/\001/, "://", code);
      # a local definition is not a call to the global
      if (code ~ /(function|const|let|var)[[:space:]]+(alert|confirm|prompt)\b/) next;
      gsub(/\t/, " ", code);
      print code "\t" content;
    }'
}

scan() {
  local raw
  if git rev-parse --git-dir >/dev/null 2>&1; then
    # --untracked is load-bearing: without it a brand-new file containing a
    # banned construct is invisible until it is committed, which is exactly
    # when you least want to find out.
    raw=$(git grep -nE --untracked "$1" -- $existing "${EXCLUDES[@]}" 2>/dev/null)
  else
    raw=$(grep -rnE "$1" $existing \
      --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
      --exclude='*.test.*' --exclude='*.spec.*' \
      --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next 2>/dev/null)
  fi
  [ -z "$raw" ] && return 0
  printf '%s\n' "$raw" | strip_noise | grep -E "^[^${TAB}]*$1" | cut -f2-
}

report() {
  printf '\n  [%s] %s\n' "$1" "$2"
  printf '%s\n' "$3" | sed 's/^/    /'
  [ "$1" = "BLOCKING" ] && blocking=1
  return 0
}

echo "native-control guard: scanning$existing"

hits=$(scan 'window\.(confirm|alert|prompt)[[:space:]]*\(')
[ -n "$hits" ] && report BLOCKING \
  "Native dialog. Blocks the thread, can't be styled or tested, and is suppressed outright in some embedded contexts — so a confirm you think guards a destructive action may never appear." \
  "$hits"

hits=$(scan '<select[[:space:]>]')
[ -n "$hits" ] && report BLOCKING \
  "Native <select>. No custom option rows, no icons, and on mobile the OS picker ignores your design entirely." \
  "$hits"

hits=$(scan '(^|[^.[:alnum:]_$])(confirm|alert|prompt)[[:space:]]*\(')
[ -n "$hits" ] && report REVIEW \
  "Bare alert()/confirm()/prompt() call. If this resolves to the global, replace it. If your codebase defines its own helper with that name, this is noise a grep can't resolve — rename the helper or exclude the path." \
  "$hits"

if [ "$blocking" -eq 0 ]; then
  echo
  echo "  no blocking findings"
  exit 0
fi

cat <<'EOF'

  Use the design system's components instead.
  A control that HOLDS a value you read back is a Select.
  A control that FIRES an action is an ActionSelect. They are not the same
  component, and swapping them produces a control that forgets what you picked
  — or one that displays your last action as though it were a setting.

  See packs/design/native-controls/SKILL.md
EOF
exit 1
