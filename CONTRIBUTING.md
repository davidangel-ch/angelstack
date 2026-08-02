# Contributing to angelstack

## The bar for a new guard

**A guard earns its place by having shipped a bug.**

Not "this is a bad practice." Not "the docs recommend against it." A specific failure that reached production, or would have if someone hadn't caught it late. That constraint is the entire value of this repo — anyone can generate a list of best practices, and those lists are why most rule collections get ignored.

So a guard proposal needs four things:

1. **The failure.** What broke, for whom, and how it was discovered. You can anonymize freely — no employer, customer, or system needs naming, and you should not include code you don't own.
2. **Why review missed it.** The interesting guards catch things that look correct. If a linter already catches it, a linter should catch it.
3. **The rule.** Stated so someone can apply it without your context.
4. **How to make it unrepeatable.** A CI check, a type, a test pattern. A guard that only works when someone remembers to run it is the weakest version of itself.

## Improving an existing guard

Very welcome, and lower-friction than a new one:

- A **false positive** it fires on — that's a bug in the guard, report it like one
- A **case it misses** — ideally with the code that slipped through
- A **stronger check** — a type-level or CI-level version of something currently enforced by review
- **Language or framework coverage** — the guards lean JS/TS and Postgres today

## Style

Skills are prose, not checklists. Written to be read once and remembered, in the voice of someone explaining a scar to a colleague. Keep the structure: the bug it came from → the rule → what to flag → how to make it unrepeatable → the tell.

Concrete beats categorical. "Sessions near midnight cross the cutoff and over-charge the customer" lands; "improper timezone handling may cause incorrect behavior" does not.

## Practical

- One guard per PR
- Test it against real code before proposing — including code that should *not* trigger it
- Issues are fine for discussing an idea before writing it up

## Not in scope

- Style, formatting, and architecture opinions — plenty of tools for those
- Generic security scanning — this is a curated list, not an OWASP checklist
- Anything you can't describe without disclosing someone's proprietary code

## License

Contributions are MIT, same as the project.
