# Changelog

## 0.1.0 — 2026-08-02

First release. Four guards, each from a bug that shipped to production:

- **timezone-safety** — naive datetimes, server-local assumptions, DST-unsafe arithmetic, weekday conventions crossing a language boundary
- **money-math** — floats on currency, unrounded division, precision loss, rounding at the wrong step
- **tenant-isolation** — client-supplied IDs used without an ownership check, authorization scattered per-endpoint, background jobs without tenant context
- **migration-safety** — destructive one-step migrations, deploys where old and new code can't coexist, locking statements

Commands: `/guard` (sweep) and `/timecheck` (deep audit of the two money guards).
