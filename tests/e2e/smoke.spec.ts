import { test, expect } from '@playwright/test'

test('app loads and navigates to Data & Evidence', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.goto('/evidence')
  await expect(page.getByRole('heading', { name: 'Data & Evidence' })).toBeVisible()
})
