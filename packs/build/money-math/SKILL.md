---
name: money-math
description: Use when writing or reviewing code that computes prices, invoices, payroll, rates, totals, taxes, discounts, or any arithmetic on currency. Catches floating-point money, unrounded division, silent precision loss, and rounding applied at the wrong step.
---

# Money math

## The bug this came from

A payroll system multiplied an hourly rate by a session duration. Standard floating-point multiplication, the way anyone writes it the first time.

Per row, the error was fractions of a cent — invisible. Across a payroll run of nine hundred people, the totals stopped reconciling with the sum of the line items. Finance found it, not engineering, and they found it by hand.

The underlying fact is not exotic: `0.1 + 0.2 === 0.30000000000000004`. Binary floating point cannot represent most decimal fractions. Every currency value stored as a float is already slightly wrong; arithmetic compounds it, and the error only becomes visible at the aggregate — which is exactly where someone is checking.

## The rule

**Money is never a float.** Two acceptable representations:

1. **Integer minor units** — store cents, not dollars. `1050` is $10.50. All arithmetic is integer arithmetic. Format only at the display edge.
2. **A decimal type** — `Decimal`/`BigDecimal`, Postgres `NUMERIC(12,2)`. Slower, exact, and self-documenting.

Pick one per codebase and never mix. Mixing is worse than either.

Rules that follow:

1. **`NUMERIC`, never `FLOAT`/`REAL`/`DOUBLE`, for a currency column.** This is the one that outlives every refactor — fix the schema and the application follows.
2. **Round once, at the end, deliberately.** Rounding intermediate results compounds error. Rounding at the boundary and never in between is the whole discipline.
3. **Name the rounding mode.** Half-up, half-even (banker's), floor — they produce different totals at scale, and finance has an opinion. Write it down where the code is, not in a ticket.
4. **Division always leaves a remainder — decide where it goes.** Splitting $10.00 three ways is not three payments of $3.33. Someone gets the extra cent. Choose who, deliberately, and test it.
5. **Currency is part of the value.** An amount without a currency is not a price. If the system will ever cross borders, an amount and a currency code travel together or neither is trustworthy.
6. **Percentages are not money until applied.** Keep rates at full precision, round only the resulting amount.

## What to flag in review

- `float`, `double`, `real`, or JS `number` anywhere near a price, rate, total, or balance
- `NUMERIC` in the database read into a float in the application — this quietly undoes a correct schema
- `Math.round`/`toFixed` in the middle of a calculation rather than at the end
- Division on currency without a documented remainder rule
- Equality comparison on two computed amounts (`totalA === totalB`) — even with decimals this is fragile; compare with an explicit tolerance or compare minor units
- A sum computed two different ways in two places — sooner or later they disagree and both look right
- Tests that only use amounts like `10.00` and `5.00`. The bug lives at `0.1`, `1/3`, and `999999.99`.

## Make it unrepeatable

**Type-level:** a branded `Money` type is the strongest guard — make it structurally impossible to pass a bare number where an amount belongs.

```ts
type Money = { minor: number; currency: 'USD' | 'PEN' }  // never a bare number
```

**Schema-level:** grep migrations for float columns whose names look like money.

```bash
rg -i "(float|double|real)" migrations/ | rg -i "(price|amount|total|rate|cost|fee|balance|salary)" \
  && echo "Currency columns must be NUMERIC — see skills/money-math" && exit 1
```

**Test-level:** every money module gets a reconciliation test — the sum of line items must equal the computed total, using awkward values. `0.1`, `1/3`, and a number with more decimals than your rounding allows.

## The tell

"The totals are off by a few cents" is never a display bug, and it is never worth "just rounding it." It means the arithmetic is wrong somewhere upstream and this is the first place it grew large enough to see.
