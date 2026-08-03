# angelstack

**For the engineer who is also the PM, the designer, and the on-call.**

If you own the whole thing — discovery, design, schema, code, launch, and the 2am page — nobody downstream is going to catch what you missed. angelstack puts a guard at every handoff, built from failures that actually reached production.

Your agent writes code faster than you can review it. It will tell you it looks good. It always says it looks good.

---

## See it work

```
$ /guard

Scanning 14 changed files…

  ✗ billing/cancellation.ts:42
    Naive datetime in a billing path.
    `new Date(session.start)` uses server-local time. A session at
    11pm in a UTC-5 tenant lands on the wrong calendar day, which
    moves it across the cancellation cutoff. This is a money bug.
    → Route through toTenantTime(). See packs/build/timezone-safety.

  ✗ api/cohorts.ts:15
    Handler reads `req.body.cohortId` and never checks tenant
    ownership. Any authenticated user can address another
    tenant's cohort.
    → See packs/build/tenant-isolation.

2 blocking, 1 warning.
```

## Install

```bash
git clone https://github.com/davidangel-ch/angelstack ~/.claude/angelstack && ~/.claude/angelstack/install.sh
```

Windows: `.\install.ps1`. Both copy the skills and commands into `~/.claude/`, print every file they write, and skip anything already there. Nothing else on your machine is touched. Uninstall is one line at the bottom.

## The packs

### `build/` — guards for code that moves money or data

| Guard | Catches | The bug it came from |
|---|---|---|
| **timezone-safety** | Naive datetimes, server-local assumptions, DST arithmetic, weekday conventions crossing a language boundary | A cancellation window computed in server time. Sessions near midnight crossed the cutoff and customers were charged for cancellations they made in time. |
| **money-math** | Floats on currency, unrounded division, rounding at the wrong step | Per-unit rates multiplied as floats. Invisible per row; across a payroll run the total stopped reconciling. |
| **tenant-isolation** | Handlers trusting client-supplied IDs, authorization scattered per-endpoint | A reschedule endpoint took a cohort ID from the request body and never checked who owned it. Cross-tenant write, reachable by any logged-in user. |
| **migration-safety** | Destructive one-step migrations, deploys where old and new code can't coexist | A column dropped in the same deploy that stopped writing to it. Old pods were still running. |
| **guard-integrity** | Guards that pass vacuously, allowlists hiding violations, checks pinned to one bug's exact shape | An AST guard stayed green while the money bug it existed to prevent shipped again — twice — in shapes the matcher never enumerated. |

### `design/` — guards for the layer users actually see

| Guard | Catches | The bug it came from |
|---|---|---|
| **design-tokens** | Classes referencing tokens that don't exist; dark-mode overrides covering only some tokens | In Tailwind v4 an undefined token emits **no CSS**. A warning cell with no fill, a delete button with no hover. Nothing failed; the pixels were just wrong. |
| **native-controls** | `window.confirm`/`alert`/`prompt`, raw `<select>`, and value-vs-action control confusion | Native dialogs block the thread, can't be styled or tested, and are suppressed outright in some embedded contexts — so a confirm you believe guards a destructive action may never appear. |
| **a11y-public-sector** | Keyboard traps, unreachable custom widgets, unnamed controls, unannounced async results, uncappable motion | A product shipped a keyboard-shortcut legend for shortcuts that were never wired, over custom dropdowns a keyboard user couldn't reach at all. Section 508 / WCAG 2.1 AA is contractual when schools and government are the buyers. |

## Runnable checks, not just prompts

Every guard ships a `checks/` directory with something you actually run in CI — a Vitest test, a shell script — alongside the skill that explains why it exists. Copy it, edit the `CONFIG` block at the top, wire it up.

And because a guard nobody has watched fail is a decoration, `packs/build/guard-integrity/checks/mutation-harness.sh` runs any guard against fixtures of known-bad code and asserts it goes red for each one:

```
$ mutation-harness.sh "bash ./no-native-controls.sh" ./fixtures

  ok    clean              exit 0
  ok    01-window-confirm  exit 1
  ok    02-native-select   exit 1
  ok    03-window-prompt   exit 1

  4/4 — guard trips on every known shape
```

That harness found a real bug in the guard it was testing, the first time it ran: `git grep` skips untracked files, so a brand-new file containing a banned construct was invisible until it was committed.

## Why a guard and not a lint rule

Lint rules match syntax. These failures are semantic: `new Date()` is correct in a log line and a bug in a billing path. The guard reads what the code is *for*, which is the one thing a language model is genuinely better at than a regex.

Where a static check *is* possible, the skills tell you how to build it. The goal is for each guard to eventually make itself redundant.

## What this does not do

- It is not a security scanner. It catches a specific list of failures, not the OWASP top ten.
- It does not replace review by a person who knows the domain.
- It has no opinion on your framework, formatting, or architecture.
- It will produce false positives. A guard that never fires on correct code is tuned too loose to catch the real thing.

## Uninstall

```bash
rm -rf ~/.claude/skills/{timezone-safety,money-math,tenant-isolation,migration-safety,guard-integrity,design-tokens,native-controls} \
       ~/.claude/commands/{guard,timecheck}.md \
       ~/.claude/angelstack
```

Nothing is left behind and no settings are modified.

## Contributing

Guards earn their place by having shipped a bug. If you've got one — the failure, how it reached production, and the rule that prevents it — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).

---

Built by [David Angel](https://davidangel.dev), a product engineer in Lima who has shipped every one of these bugs personally and would prefer you didn't.
