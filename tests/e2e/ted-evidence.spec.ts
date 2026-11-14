/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import { registerCommonChecks } from './helpers/ted-common'
import { waitForRoute } from './helpers/ted-helpers'

registerCommonChecks({ name: 'evidence', path: '/evidence' })

test.describe('/evidence specific checks', () => {
  test('X01 keyboard: skip link, contents links, section jump, data table toggle, focus ring', async ({
    page,
  }) => {
    await waitForRoute(page, '/evidence')

    // Skip link is the first tab stop.
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: /skip to main content/i })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()

    // Tab until the "Climate history" contents link is focused; every contents link must be reachable.
    const toc = page.getByRole('navigation', { name: 'On this page' })
    const labels = await toc.getByRole('link').allInnerTexts()
    expect(labels).toContain('Climate history')
    const reached = new Set<string>()
    for (let i = 0; i < 40 && reached.size < labels.length; i++) {
      await page.keyboard.press('Tab')
      const t = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        return el?.closest('nav[aria-label="On this page"]') ? el.innerText : null
      })
      if (t) {
        reached.add(t)
        if (t === 'Climate history') {
          // Focus ring: computed outline is not none.
          const ring = await page.evaluate(() => {
            const cs = getComputedStyle(document.activeElement as Element)
            return { style: cs.outlineStyle, width: cs.outlineWidth }
          })
          expect(ring.style).not.toBe('none')
          expect(parseFloat(ring.width)).toBeGreaterThan(0)
          await page.keyboard.press('Enter')
          break
        }
      }
    }
    expect(reached.has('Climate history')).toBe(true)
    // Activating the link moves the hash and brings the section into view.
    await expect(page).toHaveURL(/#ev-climate$/)
    const box = await page.locator('#ev-climate').boundingBox()
    const vh = page.viewportSize()!.height
    expect(box).not.toBeNull()
    expect(box!.y).toBeLessThan(vh)
    expect(box!.y + box!.height).toBeGreaterThan(0)

    // Every contents link is reachable by Tab.
    for (let i = 0; i < 40 && reached.size < labels.length; i++) {
      await page.keyboard.press('Tab')
      const t = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        return el?.closest('nav[aria-label="On this page"]') ? el.innerText : null
      })
      if (t) reached.add(t)
    }

    // Data table toggle, keyboard only.
    const toggle = page.getByRole('button', { name: /show data table/i }).first()
    await toggle.focus()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    const ring = await toggle.evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(ring).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: /hide data table/i }).first()).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await expect(page.locator('table.ev-table').first()).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.locator('table.ev-table')).toHaveCount(0)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('X01 every contents link is reachable by Tab', async ({ page }) => {
    await waitForRoute(page, '/evidence')
    const toc = page.getByRole('navigation', { name: 'On this page' })
    const labels = await toc.getByRole('link').allInnerTexts()
    const reached = new Set<string>()
    for (let i = 0; i < 40 && reached.size < labels.length; i++) {
      await page.keyboard.press('Tab')
      const t = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        return el?.closest('nav[aria-label="On this page"]') ? el.innerText : null
      })
      if (t) reached.add(t)
    }
    expect([...reached].sort()).toEqual([...labels].sort())
  })

  test('E04 external links: https, descriptive text, noopener on _blank', async ({ page }) => {
    await waitForRoute(page, '/evidence')
    const links = await page.locator('main a[href^="http"]').evaluateAll((as) =>
      as.map((a) => ({
        href: (a as HTMLAnchorElement).href,
        text: (a.textContent ?? '').trim(),
        target: a.getAttribute('target'),
        rel: a.getAttribute('rel') ?? '',
      })),
    )
    expect(links.length).toBeGreaterThan(0)
    for (const l of links) {
      expect(l.href, l.text).toMatch(/^https:\/\//)
      expect(l.text.length, l.href).toBeGreaterThan(3)
      expect(l.text, l.href).not.toMatch(/^(click )?here$|^link$|^more$|^read more$/i)
      expect(l.text.split(/\s+/).length, `${l.href} text "${l.text}"`).toBeGreaterThanOrEqual(2)
      if (l.target === '_blank') expect(l.rel, l.href).toContain('noopener')
    }
  })

  test('E09 offline: charts still render from the snapshot', async ({ page, context }) => {
    await waitForRoute(page, '/evidence')
    await context.setOffline(true)
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))
    // Re-open the page content without a network: client-side navigation to /farm and back.
    await page.getByRole('link', { name: 'My Farm', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'My Farm' })).toBeVisible()
    await page.getByRole('link', { name: 'Data & Evidence' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Data & Evidence' })).toBeVisible()
    await expect(page.locator('.recharts-surface').first()).toBeVisible()
    expect(await page.locator('.recharts-surface').count()).toBeGreaterThanOrEqual(3)
    await expect(page.getByText(/NASA snapshot/i).first()).toBeVisible()
    // A data table still opens offline and holds real rows.
    await page.getByRole('button', { name: /show data table/i }).first().click()
    expect(await page.locator('table.ev-table tbody tr').count()).toBeGreaterThan(5)
  })
})
