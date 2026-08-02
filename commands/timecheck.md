---
description: Deep timezone and money audit of date-handling code — the two guards that cost real money
argument-hint: "[path or git ref, defaults to the working diff]"
allowed-tools: Bash, Read, Grep, Glob
---

# /timecheck

A focused pass over the two guards that produce silent financial damage: **timezone-safety** and **money-math**. Use before shipping anything that touches scheduling, billing, invoicing, payroll, or cancellation policy.

Where `/guard` is a broad sweep, this one goes deep — it traces values rather than scanning for patterns.

## Scope

$ARGUMENTS, or the working diff (`git diff HEAD`) when empty.

Widen beyond the diff when a changed function is called from a money path — the bug is often in the caller. Say when you've done this.

## The audit

Read `skills/timezone-safety/SKILL.md` and `skills/money-math/SKILL.md`, then trace, don't grep.

**For every datetime in scope:**
1. Where did it enter the system — a client, the database, `now()`?
2. Is it an absolute instant or a wall-clock reading? Wall clocks crossing a process boundary are already suspect.
3. Whose timezone applies — the customer's, the venue's, the server's? Is that written down, or inferred?
4. Does any comparison, cutoff, or duration use it? That is where the money is.
5. What happens at 23:30 and 00:30 in the customer's timezone? Walk it concretely.

**For every currency value in scope:**
1. What type is it in the database, in transit, and in memory? A `NUMERIC` column read into a float is a correct schema quietly undone.
2. Count the arithmetic operations between input and stored result. Where is rounding applied — once at the end, or repeatedly?
3. Any division? Where does the remainder go?
4. Does an aggregate get computed two different ways in two places?

## Report

Group by severity, with the walk-through that proves it:

```
✗ BLOCKING — billing/cancellation.ts:42
  Cancellation cutoff computed in server time.

  Session starts 2026-03-14 20:00 tenant-local (UTC-5) = 01:00 UTC Mar 15.
  Customer cancels 2026-03-13 19:00 tenant-local — 25 hours ahead, inside
  the 24-hour policy. Code compares against 01:00 UTC Mar 15 minus 24h =
  01:00 UTC Mar 14 = 20:00 local Mar 13. Customer is one hour "late" and
  is charged.

  → Convert both sides through toTenantTime() before comparing.
    See skills/timezone-safety.
```

An assertion without a walk-through is a guess. If you cannot construct the failing case with real values, mark it "suspected" and say what you'd need to confirm.

Close with what you verified and found correct — that tells the reader what the audit actually covered, and it's the difference between a report they trust and one they skim.

Never edit code as part of this command.
