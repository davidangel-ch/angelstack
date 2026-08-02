---
description: Pre-ship safety sweep — audit changed code against every angelstack guard
argument-hint: "[path or git ref, defaults to the working diff]"
allowed-tools: Bash, Read, Grep, Glob
---

# /guard

Audit the code under review against every angelstack guard and report only what would actually break in production.

## Scope

$ARGUMENTS — if empty, review the working diff:

```bash
git diff --stat HEAD
git diff HEAD
```

If the diff is empty, review the last commit instead (`git show`). If a path was given, review that path. If a git ref was given, diff against it.

## Run every guard

Load and apply each of these skills to the changed code:

- **timezone-safety** — naive datetimes, server-local assumptions, DST arithmetic, weekday conventions crossing a language boundary
- **money-math** — floats on currency, unrounded division, precision loss, rounding in the middle of a calculation
- **tenant-isolation** — client-supplied IDs used without an ownership check, raw queries bypassing the scoped layer, background jobs without tenant context
- **migration-safety** — destructive changes without an archive, deploys where old and new code can't coexist, locking statements

Read the actual skill files rather than working from memory of them — they carry the specific checks and the reasoning.

## Judge before you report

For each candidate finding, ask three questions and drop it unless all three hold:

1. **Is it reachable?** Dead code, tests, and scripts are not production paths. A naive `new Date()` in a log line is fine; the same call in a billing path is a money bug.
2. **What actually breaks?** Name the concrete failure — the input, the state, and the wrong result. If you cannot describe how it fails, you have a style opinion, not a finding.
3. **Is the guard right here?** Every rule has legitimate exceptions. A migration that drops a column *is* correct once nothing reads it. Say so instead of flagging it.

Ranking: anything touching money, data loss, or cross-tenant access is blocking. Everything else is a warning.

## Report

```
✗ path/to/file.ts:42
  <One line naming the defect.>
  <Two or three sentences: the input or state that triggers it,
   and the wrong outcome. Concrete, not categorical.>
  → <The fix.> See skills/<guard-name>.
```

Blocking findings first, then warnings. Finish with a one-line count.

If nothing is wrong, say so plainly — "4 guards, 14 files, nothing blocking" — and stop. Do not pad the report to look thorough. A clean sweep that says nothing is the guard working correctly, and inventing a marginal finding to justify the run is how a reviewer gets ignored.

Never edit code as part of this command. Report; let the human decide.
