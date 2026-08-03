---
name: native-controls
description: Use when writing or reviewing UI that needs a dropdown, confirmation, or alert. Catches raw <select>, window.confirm, window.alert and window.prompt in product surfaces, and enforces the distinction between a control that holds a value and one that fires an action.
---

# Native controls in product UI

## The bug this came from

An audit of a production app found raw `<select>` elements, two `window.confirm` calls, and three `alert()` calls scattered across seven files. Each had been written in a hurry, each worked on the developer's machine, and together they made a product feel like a prototype.

The problem isn't aesthetics. `window.confirm` and `alert()` block the main thread, cannot be styled, cannot be tested without stubbing a global, render inconsistently across browsers, and are suppressed entirely in some embedded contexts — so a confirmation you believe is protecting a destructive action may simply never appear. A raw `<select>` cannot render a custom option row, cannot show an icon or a secondary line, and on mobile hands the user an OS picker that ignores your design entirely.

They also lie in review. A native confirm reads as "the destructive action is guarded" in a diff, and nobody notices it's a different guard than every other destructive action in the product.

## The rule

**No native dialog or picker in a product surface.** Use the design system's components.

Then the part that's easy to get wrong — and that the audit above got wrong on two of seven files:

**A control that holds a value you read back is not the same component as one that fires an action.**

- **Select** — bound to state. It has a current value, that value is rendered when closed, and something later reads it. A filter, a status field, a row-count picker.
- **ActionSelect** — a menu. Choosing an item *does* something. It has no persistent value and shows a fixed label when closed. "Export as…", a row's overflow menu, a bulk-action trigger.

Classifying a Select as an action produces a control that forgets what you picked. Classifying an action as a Select produces one that displays the last thing you did as though it were a setting. Both look plausible in a screenshot; both are wrong on the second interaction.

**The Escape contract.** A dropdown consumes Escape *only* when its own menu is open. If it swallows Escape while closed, a dialog containing it can't be dismissed; if it never consumes Escape, one keypress closes both the menu and the dialog around it. Getting this wrong is invisible to mouse users and immediately obvious to anyone on a keyboard.

## What to flag in review

- `window.confirm`, `window.alert`, `window.prompt`, or bare `confirm(`/`alert(` in product code
- `<select`, `<option` written directly rather than through the design system
- A new dropdown whose "value" is only ever passed to a handler and never rendered — that's an action menu wearing a Select
- A dropdown that renders its last chosen action as its label
- A dropdown inside a modal with no Escape handling, or with unconditional `stopPropagation` on Escape
- A confirmation whose copy doesn't name what actually changes (see [`money-math`](../../build/money-math/SKILL.md) — a confirm that describes a money action backwards is worse than none)

## Make it unrepeatable

`checks/no-native-controls.sh` greps ship-path source for the banned constructs. It is deliberately a grep, not an AST pass: the constructs are unambiguous and a grep survives any framework.

Wire it into CI or a pre-commit hook. Keep the allowlist empty if you can; when you can't, put the exemption in the file with the reason next to it — a dev-only debug surface is a legitimate exemption, "we'll fix it later" is not.

## The tell

Ask: *"what happens on mobile, and what happens with a keyboard?"* Native pickers answer both badly, and they're the two paths nobody clicks through before shipping. If a control was only ever exercised with a mouse on a desktop browser, assume it's broken in one of those two directions until proven otherwise.
