/// <reference lib="dom" />
import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, type TestInfo } from '@playwright/test'

export type Theme = 'light' | 'dark'
export const THEMES: Theme[] = ['light', 'dark']
export const ROUTES = [
  { name: 'evidence', path: '/evidence' },
  { name: 'farm', path: '/farm' },
] as const
export const WIDTHS = [320, 375, 768, 1024, 1440]

/** Sets the stored theme before any page script runs. */
export async function setTheme(page: Page, theme: Theme) {
  await page.addInitScript((t) => {
    try {
      window.localStorage.setItem('farmwise-theme', t)
    } catch {
      /* storage unavailable */
    }
  }, theme)
}

/** Waits until the route's main content (including the lazy map) has settled. */
export async function waitForRoute(page: Page, path: string) {
  await page.goto(path)
  await expect(page.locator('h1')).toBeVisible()
  if (path === '/evidence') {
    await expect(page.getByRole('button', { name: /show data table/i }).first()).toBeVisible()
    await page.waitForSelector('.recharts-surface')
  } else {
    await expect(page.locator('.leaflet-container')).toBeVisible()
  }
  await page.waitForLoadState('networkidle')
}

export async function runAxe(page: Page, testInfo: TestInfo, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  await testInfo.attach(`axe-${label}.json`, {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  })
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  return { results, blocking }
}

export function describeViolations(
  v: { id: string; impact?: string | null; nodes: { target: unknown }[] }[],
) {
  return v
    .map((x) => `${x.id} [${x.impact}] ${x.nodes.map((n) => JSON.stringify(n.target)).join(' | ')}`)
    .join('\n')
}
