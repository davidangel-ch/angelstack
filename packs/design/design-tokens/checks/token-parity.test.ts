/**
 * Dark-mode token parity guard — Tailwind v4 CSS-first.
 *
 * Dark theming done ad-hoc, token by token, leaves gaps nobody owns. An error
 * banner shipped unreadable in dark mode because its `-light` accent fill never
 * got a `.dark` override — the pale fill stayed pale on a dark surface.
 *
 * This makes the contract structural: accent fills and themed palettes MUST be
 * dark-themed, and the dark block may only override tokens that actually exist.
 *
 * From angelstack — https://github.com/davidangel-ch/angelstack
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ─── EDIT THIS ───────────────────────────────────────────────────────────────
const CONFIG = {
  /** The stylesheet holding both the theme block and the dark overrides. */
  themeFile: join(__dirname, '../../../packages/config-tailwind/preset.css'),

  /** Where the light/base theme block starts, and what follows it. */
  themeStart: '@theme',
  themeEnd: '@custom-variant',

  /** The dark override block's opening selector. */
  darkStart: '.dark {',

  /** Suffix marking an accent fill that must be dark-themed. */
  accentSuffix: '-light',

  /** Prefixes of palettes that must be themed as a whole, not piecemeal. */
  themedPalettes: ['--color-score-'],

  /**
   * Tokens defined as var() indirections to another themed token: they follow
   * their target's dark override automatically and need no entry of their own.
   * Every entry here is a decision on the record — not a place to silence noise.
   */
  indirections: new Set<string>([
    // '--color-warning',      // var(--color-brand-amber)
  ]),
};
// ─────────────────────────────────────────────────────────────────────────────

const css = readFileSync(CONFIG.themeFile, 'utf8');

const themeBlock = css.slice(css.indexOf(CONFIG.themeStart), css.indexOf(CONFIG.themeEnd));
const darkIndex = css.indexOf(CONFIG.darkStart);
const darkBlock = css.slice(darkIndex, css.indexOf('\n}', darkIndex));

const tokenNames = (block: string): Set<string> =>
  new Set([...block.matchAll(/(--color-[\w-]+)\s*:/g)].map((m) => m[1]));

const lightTokens = tokenNames(themeBlock);
const darkTokens = tokenNames(darkBlock);

describe('dark-mode token parity', () => {
  // Guards against a moved marker slicing an empty block and passing vacuously.
  it('both blocks were located and are populated', () => {
    expect(darkIndex).toBeGreaterThan(-1);
    expect(lightTokens.size).toBeGreaterThan(0);
    expect(darkTokens.size).toBeGreaterThan(0);
  });

  it('every accent fill has a dark override', () => {
    const accents = [...lightTokens].filter(
      (name) => name.endsWith(CONFIG.accentSuffix) && !CONFIG.indirections.has(name),
    );
    expect(accents.filter((name) => !darkTokens.has(name))).toEqual([]);
  });

  it('themed palettes are dark-themed in full', () => {
    for (const prefix of CONFIG.themedPalettes) {
      const palette = [...lightTokens].filter((name) => name.startsWith(prefix));
      expect(palette.length).toBeGreaterThan(0);
      expect(palette.filter((name) => !darkTokens.has(name))).toEqual([]);
    }
  });

  it('dark overrides only redefine tokens that exist in the theme', () => {
    // Catches typos: a dark entry for a token no call site ever uses.
    expect([...darkTokens].filter((name) => !lightTokens.has(name))).toEqual([]);
  });
});
