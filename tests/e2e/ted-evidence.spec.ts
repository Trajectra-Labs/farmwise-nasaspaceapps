/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import { registerCommonChecks } from './helpers/ted-common'
import { waitForRoute } from './helpers/ted-helpers'
import { seedState } from './helpers/seed'

test.beforeEach(async ({ page }) => { await seedState(page) })

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

    // Tab until the "A typical year" contents link is focused; every contents link must be reachable.
    const toc = page.getByRole('navigation', { name: 'On this page' })
    const labels = await toc.getByRole('link').allInnerTexts()
    expect(labels).toContain('A typical year')
    const reached = new Set<string>()
    for (let i = 0; i < 40 && reached.size < labels.length; i++) {
      await page.keyboard.press('Tab')
      const t = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        return el?.closest('nav[aria-label="On this page"]') ? el.innerText : null
      })
      if (t) {
        reached.add(t)
        if (t === 'A typical year') {
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
    expect(reached.has('A typical year')).toBe(true)
    // Activating the link moves the hash and brings the section into view.
    await expect(page).toHaveURL(/#ev-climate$/)
    // The app scrolls smoothly, so wait for the scroll animation to bring the section into view.
    const vh = page.viewportSize()!.height
    await expect
      .poll(async () => (await page.locator('#ev-climate').boundingBox())?.y ?? Infinity)
      .toBeLessThan(vh)
    const box = await page.locator('#ev-climate').boundingBox()
    expect(box).not.toBeNull()
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

  test('X02 chart tabs work with arrow keys and keep a data table toggle', async ({ page }) => {
    await waitForRoute(page, '/evidence')
    const typical = page.getByRole('tab', { name: 'Typical year' })
    await expect(typical).toHaveAttribute('aria-selected', 'true')
    await typical.focus()
    await page.keyboard.press('ArrowRight')
    const every = page.getByRole('tab', { name: 'Every year' })
    await expect(every).toBeFocused()
    await expect(every).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { level: 3, name: 'Monthly rainfall' })).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('heading', { level: 3, name: 'Monthly temperature' })).toBeVisible()
    await page.getByRole('button', { name: /show data table/i }).click()
    await expect(page.locator('table.ev-table tbody tr').first()).toBeVisible()
  })

  test('X03 a contents link to a reference section opens its disclosure', async ({ page }) => {
    await waitForRoute(page, '/evidence')
    await expect(page.locator('details').first()).not.toHaveAttribute('open', '')
    const toc = page.getByRole('navigation', { name: 'On this page' })
    await toc.getByRole('link', { name: 'Limitations' }).click()
    await expect(page).toHaveURL(/#ev-limits$/)
    const limits = page.locator('details', { has: page.locator('#ev-limits') })
    await expect(limits).toHaveAttribute('open', '')
    await expect(limits.getByText('Known limits of this data')).toBeVisible()
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

  test('E09 offline: charts still render from the snapshot, on every tab', async ({ page, context }) => {
    await waitForRoute(page, '/evidence')
    await context.setOffline(true)
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))
    // Re-open the page content without a network: client-side navigation to /farm and back.
    await page.getByRole('link', { name: 'My Farm', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'My Farm' })).toBeVisible()
    await page.getByRole('link', { name: 'Data & Evidence' }).click()
    await expect(page.getByText(/^Your climate, /)).toBeVisible()
    await expect(page.locator('.recharts-surface').first()).toBeVisible()
    await expect(page.getByText(/NASA snapshot/i).first()).toBeVisible()
    // The other chart tabs also render from the snapshot without a network.
    await page.getByRole('tab', { name: 'Every year' }).click()
    await expect(page.locator('.recharts-surface').first()).toBeVisible()
    expect(await page.locator('.recharts-surface').count()).toBeGreaterThanOrEqual(2)
    await page.getByRole('tab', { name: 'Temperature' }).click()
    await expect(page.locator('.recharts-surface').first()).toBeVisible()
    await page.getByRole('tab', { name: 'Typical year' }).click()
    // A data table still opens offline and holds real rows.
    await page.getByRole('button', { name: /show data table/i }).first().click()
    expect(await page.locator('table.ev-table tbody tr').count()).toBeGreaterThan(5)
  })
})
