# native-controls — wiring it up

```bash
cp checks/no-native-controls.sh <your-repo>/scripts/
chmod +x scripts/no-native-controls.sh
SCAN_DIRS="apps packages" ./scripts/no-native-controls.sh
```

Exit 1 on blocking findings, 0 otherwise. Drop it in a pre-commit hook or a CI step.

## Two tiers, deliberately

**BLOCKING** — `window.alert/confirm/prompt` and `<select>`. Unambiguous; these fail the build.

**REVIEW** — bare `alert(` / `confirm(` / `prompt(`. A grep cannot tell a call to the global from a call to a local helper someone named `alert`. Rather than guess, these are printed and never fail the build. If your codebase has such a helper, rename it or exclude the path — the name is confusing to readers too, not just to the guard.

## The one exemption you'll actually need

Your design system's own `Select` component almost certainly wraps a native `<select>` internally — that's correct, and it's the whole point of having the component. Exclude it:

```bash
EXCLUDES+=( ':!packages/ui/src/Select.tsx' )   # the DS component IS the wrapper
```

Exclude the specific file, never the whole package. `packages/ui` is exactly where a second raw `<select>` would hide.

## Known blind spots

- **Aliased globals.** `const c = window.confirm; c()` slips through. Rare, and an AST pass is the answer if you have one.
- **Runtime-built markup.** `React.createElement('select')` or `innerHTML` isn't matched.
- **Says nothing about quality.** A component-based dropdown with no keyboard support is worse than a native one. This guard gets you to the starting line; [`a11y-public-sector`](../a11y-public-sector/SKILL.md) is what checks it works.
- **Block comments** are skipped by trimmed-line heuristic (`*` / `/*` openers). A banned call sharing a line with the end of a block comment would be missed.

## Proving it works

Drop a `window.confirm('x')` into any scanned file and confirm the run goes red, then remove it. Both were verified against a fixture and a real monorepo when this was written — the real repo is what surfaced the block-comment and local-helper false positives in the first place.
