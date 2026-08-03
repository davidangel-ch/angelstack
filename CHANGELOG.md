# Changelog

## 0.3.0 - 2026-08-02

**New - `packs/design/a11y-public-sector`**

Section 508 / WCAG 2.1 AA for software sold to schools, districts and government,
where accessibility is contractual rather than aspirational. Ships a Playwright +
axe-core template covering the four things automation is genuinely good at: a rule
scan, a keyboard sweep (focus visibility and accessible names), reduced-motion, and
a motion cap verified through computed style rather than the stylesheet.

Includes the `scrollbar-color` trap: it is inherited and disables every
`::-webkit-scrollbar` rule in Blink, so a custom scrollbar silently reverts to
default width while still looking tinted. Verify by measuring, never by reading CSS.

Verified in both directions against shipped fixtures - `bad.html` fails all three
applicable tests, `good.html` passes all three. The README documents the limitation
those fixtures exposed: a `<div onclick>` styled as a button is caught by neither
axe nor the tab sweep, because it is not focusable and not a rule violation. The
most dangerous failure is the one automation cannot see.

## 0.2.0 - 2026-08-02

Restructured into packs, and every guard now ships a runnable check.

**New - `packs/design/`**
- **design-tokens** - a class naming an undefined token emits no CSS in Tailwind v4, so the element silently inherits. Ships `token-usage.test.ts` (existence) and `token-parity.test.ts` (dark-mode coverage).
- **native-controls** - no `window.confirm`/`alert`/`prompt` or raw `<select>` in product UI, plus the distinction between a control that holds a value and one that fires an action. Ships a two-tier grep check.

**New - `packs/build/`**
- **guard-integrity** - a green guard proves the shapes you enumerated are absent, not that the bug is absent. Ships `mutation-harness.sh`, which runs any guard against known-bad fixtures and asserts it goes red for each.

**Changed**
- The four original guards moved to `packs/build/`. Installers now discover skills by walking `packs/`, so adding a guard needs no installer edit.
- README reframed: guards are the first layer of a stack for engineers who own discovery through launch.
- CI validates pack structure, checks installer completeness against the repo, and runs the mutation harness.

**Fixed**
- The native-controls check used `git grep` without `--untracked`, so a brand-new file containing a banned construct was invisible until it was committed. Found by the mutation harness on its first run.

## 0.1.0 — 2026-08-02

First release. Four guards, each from a bug that shipped to production:

- **timezone-safety** — naive datetimes, server-local assumptions, DST-unsafe arithmetic, weekday conventions crossing a language boundary
- **money-math** — floats on currency, unrounded division, precision loss, rounding at the wrong step
- **tenant-isolation** — client-supplied IDs used without an ownership check, authorization scattered per-endpoint, background jobs without tenant context
- **migration-safety** — destructive one-step migrations, deploys where old and new code can't coexist, locking statements

Commands: `/guard` (sweep) and `/timecheck` (deep audit of the two money guards).
