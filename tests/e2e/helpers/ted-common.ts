/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import { describeViolations, runAxe, setTheme, THEMES, waitForRoute, WIDTHS } from './ted-helpers'

type Route = { name: string; path: string }

/** Checks 2a, 2b, 2c and 2h, shared by both of Ted's routes. */
export function registerCommonChecks(route: Route) {
  test.describe(`${route.path} common checks`, () => {
    for (const theme of THEMES) {
      test(`axe wcag2a/2aa/21aa, ${theme}`, async ({ page }, testInfo) => {
        await setTheme(page, theme)
        await waitForRoute(page, route.path)
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        const { results, blocking } = await runAxe(page, testInfo, `${route.name}-${theme}`)
        // Counts are read by the report; they appear in the test output.
        console.log(
          `AXE ${route.name} ${theme}: violations=${results.violations.length} blocking=${blocking.length} passes=${results.passes.length} incomplete=${results.incomplete.length}`,
        )
        expect(blocking, describeViolations(blocking)).toEqual([])
      })
    }

    test('no console errors or page errors on load', async ({ page }) => {
      const problems: string[] = []
      page.on('console', (m) => {
        if (m.type() === 'error') problems.push(`console.error: ${m.text()}`)
      })
      page.on('response', (r) => {
        if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`)
      })
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
      await waitForRoute(page, route.path)
      expect(problems).toEqual([])
    })

    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        test(`no horizontal overflow at ${width}px, ${theme}`, async ({ page }) => {
          await page.setViewportSize({ width, height: 900 })
          await setTheme(page, theme)
          await waitForRoute(page, route.path)
          const m = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            bodyScrollWidth: document.body.scrollWidth,
          }))
          await page.screenshot({
            path: `docs/qa/screenshots/ted/${route.name}-${width}-${theme}.png`,
            fullPage: true,
          })
          expect(m.scrollWidth, JSON.stringify(m)).toBeLessThanOrEqual(m.innerWidth)
          expect(m.bodyScrollWidth, JSON.stringify(m)).toBeLessThanOrEqual(m.innerWidth)
        })
      }
    }

    test('X12: no real-time / live data / forecast wording', async ({ page }) => {
      await waitForRoute(page, route.path)
      const text = await page.locator('main').innerText()
      expect(text).not.toMatch(/real[- ]?time/i)
      expect(text).not.toMatch(/live data/i)
      // "forecast" is allowed only in a negation such as "not a forecast" or "no forecast".
      const sentences = text.split(/(?<=[.!?])\s+|\n+/)
      const bad = sentences.filter(
        (s) => /forecast/i.test(s) && !/\b(not|no|never|isn't|aren't|cannot|can't|without|nor)\b/i.test(s),
      )
      expect(bad).toEqual([])
    })
  })
}
