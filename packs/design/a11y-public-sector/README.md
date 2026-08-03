# a11y-public-sector — wiring it up

```bash
npm i -D @playwright/test @axe-core/playwright
npx playwright install chromium
cp checks/a11y.spec.ts <your-repo>/e2e/
npx playwright test a11y.spec.ts
```

Edit the `CONFIG` block: list the routes people actually work in, not just the home page. Set `alertState.trigger` if your app has a crisis/alert mode worth capping motion in, and `scrollbar.selector` if you author a custom scrollbar width.

## What it checks

| Test | Catches |
|---|---|
| **axe scan** | WCAG 2.1 AA + Section 508 rule violations — unnamed controls, contrast, structure |
| **keyboard sweep** | Tabs the page; flags any focused element with no visible focus indicator or no accessible name, and detects focus getting stuck |
| **reduced motion** | Reloads with `prefers-reduced-motion: reduce` and asserts nothing is still animating |
| **motion cap** | Under your alert state, asserts no more than N elements report a non-`none` computed animation |
| **scrollbar width** | Measures `offsetWidth - clientWidth` against the width you authored |

## Verified both directions

`checks/fixtures/` holds the pages this template was developed against.

- `bad.html` — all three applicable tests fail: axe reports `button-name` (critical) and two `color-contrast` (serious); the sweep reports missing focus indicators and missing accessible names; reduced-motion reports elements still animating.
- `good.html` — all three pass.

Run them yourself before trusting the template on your own app:

```bash
# point CONFIG.routes at file:///<abs-path>/fixtures/bad.html  → expect 3 failures
# point CONFIG.routes at file:///<abs-path>/fixtures/good.html → expect 3 passes
```

On Windows use a `C:/...` style path (`cygpath -m`); a `/c/...` MSYS path gives `ERR_FILE_NOT_FOUND`, which looks like a test failure and isn't.

## Known blind spots — read this one

**The most dangerous failure in `bad.html` is caught by nothing here.** It contains a `<div onclick>` styled as a Save button. axe doesn't flag it (a div with a click handler isn't a rule violation on its own) and the keyboard sweep never sees it (it isn't focusable, so Tab skips straight past). The control is completely unusable without a mouse, and every automated check reports clean.

That is the honest shape of a11y automation: **it verifies the things you built correctly enough to be visible to it.** Roughly a third of real problems are reachable this way.

So:

- **Tab through one real task per release.** Create the thing, edit it, save it, dismiss the confirmation — with the mouse unplugged. Whatever you can't finish, your keyboard users can't finish.
- Screen-reader behavior, focus *order* sanity, and whether announcements make sense are all human checks.
- A clean axe run is not a VPAT. If you're selling to public-sector buyers, budget for a real audit.

Other limits: contrast is only checked on rendered text (an animation that fades opacity will legitimately fail — that's not a false positive), the sweep only walks forward through `tabBudget` stops, and dynamically-mounted content is only seen if it's present at scan time.

## In CI

Worth running on PRs, but the browser download is slow — cache `~/.cache/ms-playwright`. If that's too heavy, run it nightly and keep the fast greps ([`native-controls`](../native-controls/SKILL.md)) on every PR.
