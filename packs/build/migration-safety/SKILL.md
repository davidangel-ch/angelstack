---
name: migration-safety
description: Use when writing, reviewing, or deploying database migrations — adding, renaming, or dropping columns and tables, changing types, adding constraints or indexes. Catches destructive one-step migrations, deploys where old and new code can't both run, and locks that take production down.
---

# Migration safety

## The bug this came from

A column was dropped in the same deploy that stopped writing to it. Clean diff, obviously correct, reviewed and approved.

During a rolling deploy, both versions run at once. Old pods were still selecting that column. They started throwing on every request, for the length of the rollout — and there was no way back, because rolling the code back didn't bring the column back. The data was gone.

The mistake wasn't the drop. It was assuming a deploy is a moment. A deploy is an interval, and during that interval **both versions of your code are talking to one database.** Every migration has to be correct for both.

## The rule

**Expand → migrate → contract.** Three deploys, never one.

| Phase | Database | Code | Safe to roll back? |
|---|---|---|---|
| **Expand** | Add the new column/table. Nullable, no constraint. | Write to both old and new. Read old. | Yes — new column is unused |
| **Migrate** | Backfill in batches. | Read new, keep writing both. | Yes — old column still current |
| **Contract** | Drop the old column, add constraints. | New only. | Yes — nothing reads old |

Each phase ships and soaks separately. The gap between them is where you find out you were wrong, while it's still cheap.

Rules that follow:

1. **Archive before you drop.** `CREATE TABLE x_archive AS SELECT * FROM x` first, drop in a later migration once you're sure. Storage is cheap; a restore from last night's backup during business hours is not.
2. **Renames are not atomic operations, they're expand/contract.** `ALTER TABLE ... RENAME COLUMN` breaks every running instance of the old code the instant it commits. Add new, dual-write, backfill, drop old.
3. **Every migration needs a tested down path.** Not a stub. If you cannot write the reverse, that's the signal that this migration is one-way and needs its own deploy with nothing else in it.
4. **Lock awareness.** In Postgres, adding a nullable column without a default is instant. Adding `NOT NULL` to a populated table, changing a type, or adding a foreign key takes a lock that will queue every query behind it. `CREATE INDEX CONCURRENTLY`, and add constraints as `NOT VALID` then `VALIDATE` separately.
5. **Backfill in batches, outside the migration.** A single `UPDATE` over ten million rows holds one transaction open long enough to bloat the table and block replication. Batch it, throttle it, make it resumable.
6. **Migrations run once, forever.** Never edit a merged migration. It has already run in someone's environment and will never run again there — the two databases have silently diverged.

## What to flag in review

- `DROP COLUMN`, `DROP TABLE`, or `RENAME` in the same PR as the code change that stops using it
- Any destructive statement with no archive step preceding it
- `NOT NULL` added without a default, on a table with rows
- `CREATE INDEX` without `CONCURRENTLY` on a large table
- A single unbatched `UPDATE` with no `WHERE`
- A migration with an empty or throwing `down()`
- A migration touching more than one logical change — bundle a rename with an index and rollback becomes all-or-nothing
- Model/entity changes with no corresponding migration, or the reverse. The two drift, and the failure appears on the next machine that provisions from scratch.

## Make it unrepeatable

**CI guard** — block destructive statements unless the migration is explicitly marked:

```bash
# destructive migrations must declare themselves
for f in $(git diff --name-only origin/main -- migrations/); do
  if rg -qi "drop (column|table)|rename" "$f" && ! rg -q "@destructive" "$f"; then
    echo "$f: destructive change without @destructive marker — see skills/migration-safety"
    exit 1
  fi
done
```

The marker isn't bureaucracy — it forces the author to state intent, and it gives review a place to look.

**Test-level:** run the full suite against a database migrated from empty *and* against one migrated from the previous release's schema. The second catches the drift the first can't see.

**Deploy-level:** the strongest check is running the previous version's test suite against the new schema. If it passes, both versions can coexist and your rollout is safe.

## The tell

Ask: *"if this deploy fails halfway, what does the system look like?"* If the answer requires a database restore, it isn't one migration — it's three, and they haven't been separated yet.
