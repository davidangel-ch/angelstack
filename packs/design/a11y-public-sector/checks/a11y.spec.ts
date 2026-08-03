/**
 * Accessibility guard — Playwright + axe-core, WCAG 2.1 AA + Section 508.
 *
 * Automation catches roughly a third of real accessibility problems. This
 * covers the part machines are genuinely good at: rule violations, keyboard
 * reachability, focus visibility, and motion. It does not replace tabbing
 * through the product yourself, and a clean run is not a VPAT.
 *
 *   npm i -D @playwright/test @axe-core/playwright
 *   npx playwright install chromium
 *   npx playwright test a11y.spec.ts
 *
 * From angelstack — https://github.com/davidangel-ch/angelstack
 */

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ─── EDIT THIS ───────────────────────────────────────────────────────────────
const CONFIG = {
  /** Routes to audit. Add the screens people actually work in, not just the home page. */
  routes: ['/'],

  /**
   * Selector that puts the app into its alert / crisis state, if it has one,
   * plus how many elements may animate at once while it is active.
   * Set `trigger` to null to skip the motion-cap test.
   */
  alertState: { trigger: null as string | null, maxAnimating: 1 },

  /** Container whose scrollbar width you author, and the width you authored. */
  scrollbar: { selector: null as string | null, expectedWidthPx: 10 },

  /** Max Tab presses when sweeping. Raise for dense pages. */
  tabBudget: 60,
};
// ─────────────────────────────────────────────────────────────────────────────

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'section508'];

/** axe output is verbose; collapse to something a reviewer can act on. */
function summarize(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) {
  return violations.flatMap((v) =>
    v.nodes.map((n) => `[${v.impact}] ${v.id}: ${n.target.join(' ')} — ${v.help}`),
  );
}

/** Name a control the way assistive tech would: label, aria-label, or text. */
async function accessibleName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return '';
    const labelled = el.getAttribute('aria-labelledby');
    const byId = labelled
      ? labelled
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
      : '';
    return (
      el.getAttribute('aria-label') ||
      byId ||
      (el as HTMLInputElement).labels?.[0]?.textContent ||
      el.getAttribute('title') ||
      el.textContent ||
      ''
    ).trim();
  });
}

for (const route of CONFIG.routes) {
  test.describe(`a11y ${route}`, () => {
    test('no WCAG 2.1 AA or Section 508 violations', async ({ page }) => {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(summarize(results.violations)).toEqual([]);
    });

    test('every focusable control is reachable, visible and named', async ({ page }) => {
      await page.goto(route);
      await page.keyboard.press('Tab');

      const problems: string[] = [];
      const seen = new Set<string>();
      let stuck = 0;

      for (let i = 0; i < CONFIG.tabBudget; i++) {
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          const s = getComputedStyle(el);
          return {
            id: `${el.tagName}#${el.id}.${el.className}`.slice(0, 120),
            tag: el.tagName,
            role: el.getAttribute('role'),
            // A focus ring can come from outline, box-shadow or a border change.
            hasRing:
              (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) ||
              s.boxShadow !== 'none',
          };
        });
        if (!info) break;

        // The same element twice running means focus is not advancing.
        if (seen.has(info.id)) {
          if (++stuck >= 2) {
            problems.push(`focus appears trapped on ${info.id}`);
            break;
          }
        } else {
          stuck = 0;
          seen.add(info.id);
        }

        if (!info.hasRing) problems.push(`no visible focus indicator: ${info.id}`);
        const name = await accessibleName(page);
        if (!name) problems.push(`no accessible name: ${info.id}`);

        await page.keyboard.press('Tab');
      }

      // A page where Tab reaches nothing is a failure, not a pass.
      expect(seen.size, 'Tab reached no focusable element').toBeGreaterThan(0);
      expect(problems).toEqual([]);
    });

    test('animations stop under prefers-reduced-motion', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(route);
      const animating = await page.evaluate(
        () =>
          [...document.querySelectorAll('*')].filter(
            (el) => getComputedStyle(el).animationName !== 'none',
          ).length,
      );
      expect(animating, 'elements still animating with reduced motion requested').toBe(0);
    });

    if (CONFIG.alertState.trigger) {
      test('motion stays capped in the alert state', async ({ page }) => {
        await page.goto(route);
        await page.click(CONFIG.alertState.trigger!);
        // Computed style is the only source of truth here: the CSS you wrote
        // can be overridden by cascade, media query or specificity you forgot.
        const animating = await page.evaluate(
          () =>
            [...document.querySelectorAll('*')]
              .filter((el) => getComputedStyle(el).animationName !== 'none')
              .map((el) => el.tagName + '.' + (el.className || '')),
        );
        expect(animating.length, `animating: ${animating.join(', ')}`).toBeLessThanOrEqual(
          CONFIG.alertState.maxAnimating,
        );
      });
    }

    if (CONFIG.scrollbar.selector) {
      test('custom scrollbar width is actually applied', async ({ page }) => {
        await page.goto(route);
        // `scrollbar-color` is INHERITED and disables every ::-webkit-scrollbar
        // rule in Blink — the bar stays default-width but tinted, which looks
        // close enough to ship. Measure; never read the stylesheet.
        const measured = await page.evaluate((sel) => {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (!el) return null;
          return el.offsetWidth - el.clientWidth;
        }, CONFIG.scrollbar.selector!);
        expect(measured, 'scroll container not found').not.toBeNull();
        expect(measured).toBe(CONFIG.scrollbar.expectedWidthPx);
      });
    }
  });
}
