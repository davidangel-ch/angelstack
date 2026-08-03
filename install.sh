#!/usr/bin/env bash
# angelstack installer — copies skills and commands into ~/.claude/
# Touches nothing else. Prints every file it writes.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${CLAUDE_HOME:-$HOME/.claude}"

# Every packs/<pack>/<skill>/ directory containing a SKILL.md.
SKILLS=()
for d in "$SRC"/packs/*/*/; do
  [ -f "$d/SKILL.md" ] && SKILLS+=("$(basename "$d")")
done
COMMANDS=(guard timecheck)

echo "angelstack → $DEST"
echo

mkdir -p "$DEST/skills" "$DEST/commands"

for s in "${SKILLS[@]}"; do
  if [ -e "$DEST/skills/$s" ]; then
    echo "  skip  skills/$s (already exists — remove it first to reinstall)"
  else
    cp -R "$(dirname "$(find "$SRC/packs" -type d -name "$s" -print -quit)")/$s" "$DEST/skills/$s"
    echo "  add   skills/$s"
  fi
done

for c in "${COMMANDS[@]}"; do
  if [ -e "$DEST/commands/$c.md" ]; then
    echo "  skip  commands/$c.md (already exists)"
  else
    cp "$SRC/commands/$c.md" "$DEST/commands/$c.md"
    echo "  add   commands/$c.md"
  fi
done

echo
echo "Done. Start a new Claude Code session, then run /guard on a branch with changes."
echo "Uninstall instructions are at the bottom of the README."
