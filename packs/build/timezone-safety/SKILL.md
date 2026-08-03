---
name: timezone-safety
description: Use when reviewing or writing code that handles dates, times, scheduling, billing windows, cancellation cutoffs, or anything where "what day is it" affects money or user obligations. Catches naive datetimes, server-local assumptions, DST-unsafe arithmetic, and weekday-convention mismatches.
---

# Timezone safety

## The bug this came from

A cancellation policy said: cancel more than 24 hours before your session and you aren't charged.

The code computed that window with the server's local clock. The server ran UTC. Customers were in UTC-5.

For most sessions this was invisible — a five-hour offset doesn't cross a 24-hour boundary. But a session at 8pm customer-time is 1am UTC *the next calendar day*. A customer cancelling at 7pm the day before, comfortably inside the policy, computed as inside the cutoff and got charged.

Nobody noticed for months, because the bug only fires near midnight and only in one direction: it over-charges. Customers who are wrongly charged complain to support, who issue a refund and close the ticket. The pattern never reaches engineering.

An audit found ten date-handling defects across the codebase. Four of them touched money.

## The rule

**One door.** Every conversion between an absolute instant and a human calendar goes through a single helper. Not "usually." Every one.

```ts
// the only place a timezone is applied
export function toTenantTime(instant: Date, tenantTz: string): ZonedDateTime
export function toInstant(local: LocalDateTime, tenantTz: string): Date
```

Rules that follow from it:

1. **Store instants, not wall clocks.** `timestamptz` in Postgres. UTC in the application. A bare `timestamp` column is a bug waiting for a customer in a different timezone.
2. **Convert at the edges only** — once on the way in, once on the way out. Business logic operates on absolute instants and never sees a timezone string.
3. **Whose timezone?** Name it explicitly. `tenantTz`, `userTz`, `venueTz` — never a bare `tz`. Most timezone bugs are actually *which* timezone bugs: correct conversion, wrong subject.
4. **Never add 24 hours to mean "tomorrow."** DST days are 23 or 25 hours long. Calendar arithmetic uses a calendar library.
5. **Weekday conventions must match at the boundary.** Postgres `EXTRACT(DOW)` is Sunday=0. JavaScript `getDay()` is Sunday=0. Python `weekday()` is **Monday=0**. ISO-8601 is **Monday=1**. Crossing a language boundary without converting silently shifts every schedule by a day.

## What to flag in review

- `new Date()`, `datetime.now()`, `Date.now()` inside anything that computes a deadline, cutoff, window, or charge
- Date arithmetic in raw milliseconds where days are meant
- A date formatted for display without an explicit target timezone
- `timestamp` (not `timestamptz`) columns
- Any weekday integer crossing a language or database boundary
- Tests that pass only because the CI runner is UTC

## Make it unrepeatable

Reviewing for this forever does not scale. Build the check:

**CI guard** — fail the build when raw datetime construction appears outside the one helper.

```bash
# ban naive datetime construction outside the conversion module
rg -n "new Date\(|Date\.now\(|datetime\.now\(" src/ \
  --glob '!src/lib/time/**' \
  --glob '!**/*.test.*' \
  && echo "Use the helper in src/lib/time — see skills/timezone-safety" && exit 1
```

Add the allowlist path deliberately and keep it to one directory. The moment there are three exempt paths, the guard is decorative.

**Test at the edges.** Every scheduling test should have a case at 23:30 and 00:30 tenant-local, and one on a DST transition date. If the suite only runs at noon, it proves nothing.

## The tell

When someone says "it works on my machine but QA sees a different day," this is always what it is. Ask what timezone the two machines are in before reading any code.
