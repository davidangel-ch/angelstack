# design-tokens — wiring it up

Two Vitest tests. Both read files off disk; neither needs a browser, a build, or a running app.

```bash
cp checks/token-usage.test.ts  <your-repo>/lib/
cp checks/token-parity.test.ts <your-repo>/lib/
```

Edit the `CONFIG` block at the top of each, then `pnpm test`.

## Configuring

**`token-usage.test.ts`** — set `root`, list **every** file that declares `--color-*` tokens in `themeSources`, and set `namespaces` to your token prefixes.

`namespaces` is what keeps the check from firing on stock Tailwind colors. If your tokens aren't namespaced (`--color-primary` rather than `--color-brand-primary`), this check can't tell yours from Tailwind's — namespace them first, or the test is unusable.

Missing a theme source produces false positives on tokens that really exist. That's the failure mode that gets a guard deleted, so check this before trusting a red run.

**`token-parity.test.ts`** — the block markers (`themeStart`, `themeEnd`, `darkStart`) are string offsets into your stylesheet. If you reorganize the file, update them. The first assertion exists to catch exactly that: a moved marker slices an empty block, and every later assertion would pass vacuously.

Put `var()` indirections in `indirections` with a comment naming the target. Every entry is a decision on the record — if that set is growing, the theme has a structural problem the allowlist is hiding.

## Known blind spots

- **Dynamic classes are invisible.** `bg-brand-${hue}` is skipped by design. If you build class names at runtime, keep the token list in one array and unit-test that array against the theme separately.
- **`@apply` in CSS isn't scanned.** The walker reads `.ts`/`.tsx` only. Add `.css` if you use `@apply` with tokens.
- **Existence is not correctness.** A token that resolves can still be the wrong color, and hover can still equal base. These catch silence, not bad taste.
- **One dark mode only.** Multiple themes need the parity test parameterized over each block.

## Proving it works

Both tests can pass vacuously — an empty scan, a mis-sliced block — so prove non-vacuity once when you install them:

```bash
# usage: delete a token from your theme file, expect red
# parity: remove one .dark override, expect red
```

If either stays green, the config is wrong. See [`guard-integrity`](../../build/guard-integrity/SKILL.md).
