# angelstack

**Your agent writes code faster than you can review it.**

That's the deal you made, and mostly it's a good one. But somewhere in the diff it just handed you is a `datetime.now()` that should have been timezone-aware, a float where money lives, or a query that forgot which tenant it belongs to. Your agent will tell you it looks good. It always says it looks good.

angelstack is the review it can't talk its way out of.

Every guard in here exists because the bug it catches actually shipped — to production, in a system that bills real customers. None of them are hypothetical.

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
    → Route through toTenantTime(). See skills/timezone-safety.

  ✗ invoices/total.ts:88
    Float arithmetic on currency.
    0.1 + 0.2 !== 0.3. Over a 900-row payroll this drifts.
    → Use integer minor units or Decimal. See skills/money-math.

  ⚠ api/cohorts.ts:15
    Handler reads `req.body.cohortId` and never checks tenant
    ownership. Any authenticated user can address another
    tenant's cohort.
    → See skills/tenant-isolation.

2 blocking, 1 warning.
```

## Install

```bash
git clone https://github.com/davidangel-ch/angelstack ~/.claude/angelstack && ~/.claude/angelstack/install.sh
```

That copies the skills and commands into `~/.claude/` and prints what it added. Nothing else on your machine is touched. Uninstall is one line, documented at the bottom.

## The guards

| Guard | Catches | The bug it came from |
|---|---|---|
| **timezone-safety** | Naive datetimes, server-local assumptions, DST-unsafe arithmetic | A cancellation window computed in server time instead of the customer's. Sessions near midnight crossed the cutoff and customers were charged for cancellations they made in time. |
| **money-math** | Floats on currency, unrounded division, silent precision loss | Per-unit rates multiplied as floats. Individually invisible; across a full payroll run it drifted by real money. |
| **tenant-isolation** | Handlers trusting client-supplied IDs, authorization scattered per-endpoint | A reschedule endpoint took a cohort ID from the request body and never checked who owned it. Cross-tenant write, reachable by any logged-in user. |
| **migration-safety** | Destructive one-step migrations, drops without archives, incompatible deploys | A column dropped in the same deploy that stopped writing to it. Old pods were still running. Both versions have to work at once, always. |

Each skill file explains the failure, the rule, and how to wire the check so the class of bug can't come back — not just how to fix today's instance.

## Why a guard and not a lint rule

Lint rules match syntax. These failures are semantic: `new Date()` is correct in a log line and a bug in a billing path. The guard reads what the code is *for*, which is the one thing a language model is genuinely better at than a regex.

Where a static check *is* possible, the skills tell you how to build it — a CI guard that fails the build on raw datetime construction outside your one conversion helper is worth more than any amount of reviewing. The goal is for each guard to eventually make itself redundant.

## What this does not do

- It is not a security scanner. It catches a specific list of failures, not the OWASP top ten.
- It does not replace review by a person who knows the domain.
- It has no opinion on your framework, formatting, or architecture.
- It will produce false positives. A guard that never fires on correct code is a guard tuned too loose to catch the real thing.

## Uninstall

```bash
rm -rf ~/.claude/skills/{timezone-safety,money-math,tenant-isolation,migration-safety} \
       ~/.claude/commands/{guard,timecheck}.md \
       ~/.claude/angelstack
```

Nothing is left behind and no settings are modified.

## Contributing

Guards earn their place by having shipped a bug. If you've got one — the failure, how it reached production, and the rule that prevents it — open an issue or a PR. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).

---

Built by [David Angel](https://davidangel.dev), a product engineer in Lima who has shipped all four of these bugs personally and would prefer you didn't.
