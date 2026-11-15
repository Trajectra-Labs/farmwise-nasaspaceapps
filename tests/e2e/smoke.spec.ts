import { test, expect } from '@playwright/test'
import { seedState } from './helpers/seed'

test('first-time visitor lands on onboarding', async ({ page }) => {
  await seedState(page, { farm: null })
  await page.goto('/')
  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(page.getByRole('button', { name: /Try Sample Farm/i })).toBeVisible()
})

test('app loads and navigates to Data & Evidence', async ({ page }) => {
  await seedState(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.goto('/evidence')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Data & Evidence')
})
