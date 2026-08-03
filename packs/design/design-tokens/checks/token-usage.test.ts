/**
 * Dead design-token guard — Tailwind v4 CSS-first.
 *
 * In Tailwind v4 a class referencing an undefined token generates NO css, so the
 * property silently falls back to inherited / currentColor. A "warning" cell with
 * no fill, a delete button with no hover. Nothing fails; the pixels are wrong.
 *
 * This test makes existence structural: every statically-written token class in
 * ship-path source must resolve to a `--color-*` declaration in a theme source.
 *
 * Scope note: only statically-written classes are checkable. A fully dynamic
 * fragment (`bg-brand-${hue}`) can't be resolved here and is skipped by design —
 * the token capture stops at the interpolation boundary rather than false-firing.
 *
 * From angelstack — https://github.com/davidangel-ch/angelstack
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ─── EDIT THIS ───────────────────────────────────────────────────────────────
const CONFIG = {
  /** Repo root, relative to this file. */
  root: join(__dirname, '../../..'),

  /**
   * Files declaring `--color-*` tokens. List every source — tokens bridged into
   * the theme from an app stylesheet count as defined, and omitting one produces
   * false positives that will get this test deleted.
   */
  themeSources: ['packages/config-tailwind/preset.css', 'app/globals.css'],

  /** Directories to scan for token usage. */
  sourceDirs: ['apps', 'packages', 'src'],

  /**
   * Your token namespaces — the segment right after the utility prefix.
   * `['brand', 'dt-new']` matches `bg-brand-red`, `text-dt-new-fg`.
   * Namespacing is what keeps this from firing on stock Tailwind colors.
   */
  namespaces: ['brand'],
};
// ─────────────────────────────────────────────────────────────────────────────

const NS = CONFIG.namespaces.join('|');

/**
 * A Tailwind color utility carrying one of our tokens. Variants (hover:, dark:,
 * md:) sit before the utility, so matching from the utility prefix still catches
 * them. The token is hyphen-joined alnum groups, which cannot start or end on a
 * hyphen; trailing opacity modifiers (`/50`) are naturally left out.
 */
const CLASS_RE = new RegExp(
  `(?:bg|text|border|ring|ring-offset|fill|stroke|from|via|to|outline|decoration|divide|accent|caret|placeholder|shadow)-((?:${NS})-[a-z0-9]+(?:-[a-z0-9]+)*)`,
  'g',
);

const DECL_RE = new RegExp(`--color-((?:${NS})-[\\w-]+)\\s*:`, 'g');

const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', 'build', 'out']);

const definedTokens = new Set(
  CONFIG.themeSources
    .map((rel) => join(CONFIG.root, rel))
    .filter(existsSync)
    .flatMap((source) => [...readFileSync(source, 'utf8').matchAll(DECL_RE)])
    .map((match) => match[1]),
);

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // Dot-dirs (.next, .turbo, .git, agent worktrees) and build output.
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    // Ship-path source only; test files may reference tokens as fixtures.
    else if (/\.tsx?$/.test(entry.name) && !/\.(?:test|spec)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const sourceFiles = CONFIG.sourceDirs.flatMap((dir) => walk(join(CONFIG.root, dir)));

describe('named color classes resolve to a declared theme token', () => {
  // Without this, a bad path silently scans nothing and the suite passes empty.
  it('the scan found source files and a populated token set', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
    expect(definedTokens.size).toBeGreaterThan(0);
  });

  it('every used namespaced color class has a definition', () => {
    const dead: string[] = [];
    for (const file of sourceFiles) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(CLASS_RE)) {
        if (!definedTokens.has(m[1])) {
          dead.push(`${file.slice(CONFIG.root.length + 1)} → ${m[1]}`);
        }
      }
    }
    // A non-empty list means a class references a token that emits no CSS.
    expect([...new Set(dead)]).toEqual([]);
  });
});
