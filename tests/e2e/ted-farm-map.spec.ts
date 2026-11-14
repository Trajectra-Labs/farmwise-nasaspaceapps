/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import { registerCommonChecks } from './helpers/ted-common'
import { waitForRoute } from './helpers/ted-helpers'

registerCommonChecks({ name: 'farm', path: '/farm' })

const lat = (p: import('@playwright/test').Page) => p.getByLabel(/^Latitude/)
const lon = (p: import('@playwright/test').Page) => p.getByLabel(/^Longitude/)

test.describe('/farm map picker checks', () => {
  test('F09 tiles blocked: notice shows, manual entry works, invalid lat shows error', async ({
    page,
  }) => {
    await page.route('**/tile.openstreetmap.org/**', (r) => r.abort())
    await waitForRoute(page, '/farm')
    await expect(page.getByText('Map tiles could not be loaded.')).toBeVisible()
    await expect(page.getByText(/Entering latitude and longitude below still works/)).toBeVisible()

    await lat(page).fill('-1.2')
    await lon(page).fill('36.8')
    await expect(page.getByText('Selected location: -1.2, 36.8')).toBeVisible()

    await lat(page).fill('95')
    await expect(page.getByText('Latitude must be between -90 and 90.')).toBeVisible()
    await expect(lat(page)).toHaveAttribute('aria-invalid', 'true')
  })

  test('F08 map click sets coordinates, Clear empties them, sample fills Nakuru', async ({ page }) => {
    await waitForRoute(page, '/farm')
    await expect(lat(page)).toHaveValue('')

    const map = page.locator('.leaflet-container')
    const box = (await map.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(lat(page)).not.toHaveValue('')
    await expect(lon(page)).not.toHaveValue('')
    const la = Number(await lat(page).inputValue())
    const lo = Number(await lon(page).inputValue())
    expect(Number.isFinite(la) && Math.abs(la) <= 90).toBe(true)
    expect(Number.isFinite(lo) && Math.abs(lo) <= 180).toBe(true)
    await expect(page.getByText(`Selected location: ${la}, ${lo}`)).toBeVisible()

    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(lat(page)).toHaveValue('')
    await expect(lon(page)).toHaveValue('')
    await expect(page.getByText(/No location selected/)).toBeVisible()

    await page.getByRole('button', { name: 'Use sample location' }).click()
    await expect(lat(page)).toHaveValue('-0.3031')
    await expect(lon(page)).toHaveValue('36.08')
  })

  test('X01 keyboard: fields and buttons are reachable with a visible focus ring', async ({ page }) => {
    await waitForRoute(page, '/farm')
    for (const el of [lat(page), lon(page), page.getByRole('button', { name: 'Use sample location' })]) {
      await el.focus()
      await expect(el).toBeFocused()
      const outline = await el.evaluate((n) => getComputedStyle(n).outlineStyle)
      expect(outline).not.toBe('none')
    }
    await lat(page).focus()
    await page.keyboard.type('-0.3031')
    await page.keyboard.press('Tab')
    await page.keyboard.type('36.08')
    await expect(page.getByText('Selected location: -0.3031, 36.08')).toBeVisible()
  })
})
