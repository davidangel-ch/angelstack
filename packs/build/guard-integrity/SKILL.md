---
name: guard-integrity
description: Use when writing, reviewing, or trusting an automated guard — a CI check, lint rule, AST scan, or convention test. Catches guards that pass vacuously, allowlists that hide real violations, and checks written to the last bug's exact shape instead of the bug's class.
---

# Guard integrity

## The bug this came from

A team shipped an AST guard to kill a whole class of timezone bugs that had already cost real money. It scanned every source file and failed the build on two specific anti-patterns. It worked — it caught them, it stayed green, everyone moved on.

Then the same money bug shipped again, live, while the guard was green.

The new instance rebuilt a timestamp from a **dict subscript** rather than an attribute, and borrowed a `tzinfo=` from another object rather than naming the constant. Semantically identical. Structurally different. The matcher required both halves to look the way they had looked the first time, and this one matched neither — so the guard reported success on code containing exactly the bug it existed to prevent.

Widening one half wasn't enough; the case only tripped once *both* conditions were relaxed. And then it happened a **third** time — new code, after the widening, in a shape that was about a date boundary rather than a construction call.

The lesson, paid for three times: **a green guard proves the shapes you enumerated are absent. It does not prove the bug is absent.**

## The rule

**Ship every guard with an adversarial case that should trip it.** A guard nobody has ever watched fail is not a guard; it's a decoration with a green checkmark.

1. **Write the mutation before you write the matcher.** Take the real bug, then write two or three variants a competent engineer might plausibly type — a different accessor, a borrowed value, an equivalent call through a helper. If your matcher only catches the one you already fixed, you've pinned a fix, not prevented a class.
2. **Assert the guard goes red.** Automate it: reintroduce each banned shape into a fixture and assert non-zero exit. This test protects the guard the way the guard protects the code.
3. **Assert the scan is non-empty.** The most common vacuous pass is a scan that found no files — a moved directory, a renamed glob, a changed marker string. One assertion (`files.length > 0`, `tokens.size > 0`) costs nothing and catches a whole failure mode.
4. **Keep the allowlist empty, and document every rejection.** When someone proposes an exemption and it's declined, record it in the allowlist file with the reason. An empty allowlist full of comments is a strong artifact: it proves the exemptions were considered rather than never requested.
5. **Prefer AST over regex where the language has one** — but know that AST matching has the same failure mode, one level up. You're still enumerating shapes.
6. **When a guard misses a real instance, widen the guard in the same commit as the fix.** Otherwise the next instance is already being typed.

## What to flag in review

- A new CI check with no accompanying failing-case test
- A guard whose matcher references a specific variable name, module path, or call signature from the bug that prompted it
- An allowlist entry with no comment, or one added in the same PR as the code it exempts
- A scan with no assertion that it found anything
- A guard that has never failed in CI history — either the codebase is perfect or the guard is broken, and one is far more likely
- A bug fix in a class some guard supposedly covers, with no corresponding guard change. The guard missed it; that's a second defect.

## Make it unrepeatable

`checks/mutation-harness.sh` runs a guard against a fixture directory containing known-bad cases and asserts it exits non-zero for each, then against a clean fixture and asserts zero.

The shape is language-agnostic:

```
guard-name/
  checks/
    guard.sh                  the check itself
    fixtures/
      clean/                  must exit 0
      mutations/
        01-original-bug/      the case that caused this guard
        02-variant-accessor/  same bug, different access pattern
        03-variant-borrowed/  same bug, value from elsewhere
```

Every mutation directory is a claim: *"this is a way the bug could come back."* When a real instance escapes, it becomes mutation `NN` before the guard is widened.

## The tell

Ask of any guard: **"what would I have to write for this to fail?"** If the answer is "the exact code we already deleted," it protects history, not the future.

And when a guard has been green for months on a codebase where that class of bug keeps appearing in review — trust the reviews, not the checkmark.
