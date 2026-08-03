---
name: design-tokens
description: Use when writing or reviewing UI that uses design tokens — Tailwind v4 @theme, CSS custom properties, or any named-color system. Catches classes referencing tokens that don't exist (which emit no CSS and silently inherit), and dark-mode overrides that cover only some tokens.
---

# Design token integrity

## The bug this came from

Two classes shipped referencing color tokens that had never been defined: a warning cell painted with a `yellow` token that didn't exist, and a delete button with a `red-hover` token that didn't exist.

In Tailwind v4, **a class referencing an undefined token generates no CSS at all.** Not an error, not a warning, not a fallback to some default — no declaration is emitted, so the element keeps whatever it inherited. The warning cell had no fill. The delete button had no hover. Every build was green, every test passed, and the pixels were quietly wrong.

The trap has a second floor. The obvious fix for `hover:bg-brand-red-hover` is to drop to `hover:bg-brand-red` — but if the base state is *already* `bg-brand-red`, you've now made hover identical to rest and there is still no visible hover. You fixed the token and kept the bug.

A parallel failure lived in dark mode. Dark theming had been done token by token as people noticed problems, so `.dark` overrode some `-light` accent fills and not others. Nobody owned parity. It surfaced when a QA error banner rendered as a pale pastel on a dark surface and was effectively unreadable.

## The rule

**A token reference must resolve to a declaration, and a themed token must be themed in every mode.** Both are structural properties of the stylesheet, so both are checkable — don't leave them to review.

1. **Every statically-written token class resolves.** Scan ship-path source for token-bearing utility classes and assert each one has a matching `--color-*` declaration.
2. **Every themed token has an override in every mode you ship.** If a `-light` accent exists, dark must define it. If a palette is themed, the whole palette is themed — not the three colors someone happened to look at.
3. **The override block may only redefine tokens that exist.** A `.dark` entry for a token no name in the codebase uses is a typo that will never be noticed otherwise.
4. **Indirections are exempt, explicitly.** A token defined as `var(--color-other)` follows its target's override automatically. List those in an allowlist so the exemption is a decision on the record, not an accident.
5. **Fully dynamic classes are out of scope, by design.** `bg-brand-${hue}` cannot be resolved statically. Stop the capture at the interpolation boundary rather than false-firing — a guard that cries wolf gets deleted.

## What to flag in review

- A new token class in a diff whose token isn't in the theme file
- A `.dark` (or any mode) block touched without the corresponding `@theme` entry, or vice versa
- A hover/active/focus variant whose token differs from the base by a suffix that may not exist
- A fix that makes hover equal to base — the token now resolves and the interaction is still invisible
- Raw hex or a stock palette class (`blue-500`) anywhere a semantic token should be

## Make it unrepeatable

`checks/token-usage.test.ts` and `checks/token-parity.test.ts` in this directory are the working versions, written for **Tailwind v4 CSS-first**. Edit the `CONFIG` block at the top and drop them into a Vitest project.

The principle generalizes past Tailwind — any system where a name is resolved at build time and silently produces nothing when unresolved has this failure — but these two files are honest about what they were written against.

**Prove the check is non-vacuous.** Delete a token from the theme file and confirm the usage test goes red; remove one `.dark` entry and confirm parity goes red. A guard nobody has ever seen fail is a guard nobody knows works. See [`guard-integrity`](../../build/guard-integrity/SKILL.md).

## The tell

"It looks fine on my machine but wrong in the deployed build," or a state that simply doesn't render — no hover, no highlight, no background. Before debugging the component, check that every token it names actually exists. The absence of an error is not evidence the class worked.
