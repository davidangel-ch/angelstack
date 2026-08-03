---
name: a11y-public-sector
description: Use when building or reviewing UI that will be bought by schools, districts, universities, government, or healthcare — anywhere Section 508 / WCAG 2.1 AA is contractual. Catches keyboard traps, unreachable custom widgets, missing accessible names, unannounced async results, and animation that can't be stopped.
---

# Accessibility for public-sector software

## The bug this came from

An operations tool shipped a keyboard-shortcut legend across the bottom of a data grid — `Tab` to move, `⏎` to commit, `⌘V` to paste a column. It looked professional and it tested well with the people who built it.

None of those keys were wired. The legend was written while the feature was being designed and nobody removed it when the implementation landed differently. So the product advertised a keyboard workflow it did not have, to exactly the users who most needed one.

Underneath it was worse: the grid's custom dropdowns were `div`s with click handlers. A mouse user never noticed. A keyboard user could not reach the control at all, and a screen-reader user was told nothing was there.

This is not an edge case in this market. **Schools, districts, universities, and government agencies are legally bound to buy accessible software** — Section 508 in US federal and federally-funded procurement, WCAG 2.1 AA as the referenced standard, and increasingly a VPAT requested during the sale. An accessibility gap is not a polish item you fix after launch; it is a deal that stalls in procurement review, and the person who finds it is a district's compliance officer, not your QA.

## The rule

**Every interactive thing must be reachable, nameable, and operable without a mouse — and every state change must be perceivable without seeing it happen.**

1. **Keyboard reachability is non-negotiable.** Every control is in the tab order, focus is visible, and focus never gets trapped anywhere except a modal that deliberately traps it and releases on Escape. If you built a control from `div`s, it needs `role`, `tabIndex`, and key handlers — or it needs to be a `button`.
2. **Every control has an accessible name.** An icon-only button with no `aria-label` announces as "button." A form input whose label isn't programmatically associated announces as nothing. This is the single most common violation and the cheapest to fix.
3. **Async results must be announced.** A filter that silently rewrites a table, a save that shows a toast, a validation error that appears inline — all invisible to a screen reader unless they land in a live region. Operational software is mostly async state change, so this is where it fails most.
4. **Contrast is a number, not a taste.** 4.5:1 for body text, 3:1 for large text and for the non-text parts of controls (borders, focus rings, icons). Dense operational UIs fail this constantly because low-contrast grey reads as "refined" to designers.
5. **Motion must be capped and stoppable.** Respect `prefers-reduced-motion`. And under an alert or crisis state, cap how much moves at once — several things pulsing simultaneously is where "urgent" becomes "unusable," particularly for vestibular disorders and attention-related disabilities.
6. **Don't advertise what you didn't build.** A shortcut legend, a "press Enter to save" hint, an `aria-keyshortcuts` — each is a promise. An unimplemented affordance is worse than an absent one, because the user stops looking for another way.

## What to flag in review

- `<div onClick>` or `<span onClick>` without `role` + `tabIndex` + a key handler
- An icon-only button with no `aria-label` or visually-hidden text
- An input whose `<label>` has no `htmlFor`, or a placeholder used as the label
- `outline: none` without a replacement focus style
- A modal that doesn't move focus in on open, trap it, restore it on close, and close on Escape
- A table/list that rewrites after a fetch with no `aria-live` region reporting the result
- Any new animation with no `prefers-reduced-motion` branch
- A keyboard hint, shortcut legend, or `aria-keyshortcuts` added in the same PR as UI that doesn't implement it
- Custom dropdowns — see [`native-controls`](../native-controls/SKILL.md); a native `<select>` is inaccessible for other reasons but at least it's operable

## Make it unrepeatable

`checks/a11y.spec.ts` is a Playwright + axe-core template covering four things automation is genuinely good at:

- **axe scan** at WCAG 2.1 AA + Section 508 tags, per route
- **keyboard sweep** — tab through the page, assert every focused element has a visible focus indicator and an accessible name, and that focus doesn't get stuck
- **motion cap** — under your alert state, assert that no more than N elements report a non-`none` computed `animation`
- **reduced motion** — reload with `prefers-reduced-motion: reduce` and assert animations stop

Two hard-won details baked into the template:

**Verify motion by computed style, never by reading your CSS.** `getComputedStyle(el).animation` is the only thing that accounts for cascade, media queries, and specificity. A rule you wrote can be overridden by one you forgot.

**`scrollbar-color` is inherited, and setting it disables every `::-webkit-scrollbar` rule in Blink.** A single `html { scrollbar-color: … }` silently reverts custom scrollbars app-wide — the bar still looks *tinted*, so it ships unnoticed. Gate the Firefox fallback behind `@supports not selector(::-webkit-scrollbar)`, and verify by measuring `offsetWidth - clientWidth` against the width you authored. Reading the stylesheet proves nothing.

**Automation catches roughly a third of real accessibility problems.** The template says so out loud. Tab through the page yourself once per release, and if you're selling to public-sector buyers, budget for an audit — a clean axe run is not a VPAT.

## The tell

Unplug your mouse and do one real task in the product — create the thing, edit it, save it, dismiss the confirmation. Not a tour of the page; a task with a beginning and an end.

Whatever you can't finish is what your keyboard users can't finish either, and in this market they will be the ones filing the procurement complaint.
