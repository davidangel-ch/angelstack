---
name: tenant-isolation
description: Use when writing or reviewing API handlers, database queries, or background jobs in any multi-tenant system (SaaS, B2B platforms, anything with organizations, workspaces, schools, or accounts). Catches handlers that trust client-supplied IDs, authorization scattered per-endpoint, and cross-tenant read/write holes (IDOR).
---

# Tenant isolation

## The bug this came from

A reschedule endpoint accepted a cohort ID in the request body, loaded that cohort, and rewrote its schedule.

It checked that the caller was authenticated. It never checked that the cohort belonged to the caller's organization.

Any logged-in user of any tenant could change any other tenant's schedule by editing one number in a request. Not read — *write*. The endpoint had been reviewed and shipped; nothing about it looked wrong, because the missing code is invisible. You cannot see an absent ownership check while reading a handler that otherwise reads correctly.

This is IDOR — insecure direct object reference — and it is the single most common serious flaw in multi-tenant applications. It survives review precisely because reviewers check what the code does, and the bug is what it doesn't do.

## The rule

**Authorization lives in one place. Never "each endpoint remembers."**

Any rule enforced by developer discipline across N endpoints fails at endpoint N+1, and N+1 is always written at 6pm before a launch. The fix is structural: make the unscoped query impossible or automatically wrong.

In descending order of strength:

1. **Row-level security in the database.** Postgres RLS with a session variable for the current tenant. Even a query that forgets the filter returns nothing. This is the only defense that survives a developer bypassing your ORM.
2. **A scoped repository layer.** No handler ever calls the ORM directly. It receives a repository already bound to the tenant, and there is no method to escape that binding.
3. **Framework middleware** that resolves tenant from the session (never from the request body) and injects it into a request-scoped context.

Rules that follow:

1. **The tenant comes from the session, never from the request.** A tenant ID in a body or query string is an attacker-controlled value. If a client can send it, a client can change it.
2. **Ownership is verified on the way in, not filtered on the way out.** Load-then-check leaks existence and timing; scope the query itself.
3. **Background jobs need the same context.** A worker processing a queue has no session. It is the most commonly forgotten path, and it usually runs with the widest privileges in the system.
4. **A 404 beats a 403** for a resource in another tenant. "Forbidden" confirms the resource exists, which is itself a disclosure.
5. **Admin/internal tooling is where isolation goes to die.** Cross-tenant access is a *deliberate, audited* capability with its own code path — not an `if (user.isAdmin) skipTheCheck()` sprinkled into normal handlers.

## What to flag in review

- Any ID read from `req.body`, `req.params`, or `req.query` and used to load a record without a tenant-scoped `WHERE`
- A raw ORM/query-builder call inside a request handler, bypassing the scoped layer
- `findById(id)` where the model is tenant-owned — the signature itself is the smell
- New tables without a tenant column, or with one that has no foreign key and no index
- Background jobs, webhooks, cron tasks, and CSV/bulk imports — every path that isn't a normal authenticated request
- Bulk endpoints taking an array of IDs, where the check runs on the first element only
- Any comment resembling "we validate this upstream"

## Make it unrepeatable

**The real fix is RLS.** Everything else is a stopgap:

```sql
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cohorts
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

**Test-level — the highest-value test in a multi-tenant system.** For every endpoint that takes a resource ID, one test: authenticate as tenant A, request tenant B's resource, assert 404. Write it once as a table-driven test over every route and it costs nothing to extend.

```ts
test.each(TENANT_SCOPED_ROUTES)('%s rejects cross-tenant access', async (route) => {
  const res = await asUser(tenantA).request(route, { id: resourceOwnedBy(tenantB) })
  expect(res.status).toBe(404)
})
```

A route added without a corresponding entry fails the suite. That turns "remember to check" into "the build won't go green."

**Schema-level:** a migration guard that rejects new tables lacking a tenant column and index.

## The tell

Ask: *"if I change this ID to another tenant's, what stops me?"* If the answer names a line of code inside this specific handler rather than a mechanism that applies to every handler, the system is one forgotten line from a breach. It is not a question of whether someone forgets — only which endpoint.
