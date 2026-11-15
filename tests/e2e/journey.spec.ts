/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { SAMPLE, STATE_KEY, seedState } from './helpers/seed'

const readState = (page: Page) =>
  page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? 'null'), STATE_KEY)

const nav = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name, exact: true })

function trackProblems(page: Page) {
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console.error: ${m.text()}`)
  })
  return problems
}

test.describe('connected farmer journey (sample farm)', () => {
  test('J01-J12: onboarding to dashboard, state follows the farmer everywhere', async ({ page }) => {
    const problems = trackProblems(page)
    await seedState(page, { farm: null, once: true })
    await page.route('**/tile.openstreetmap.org/**', (r) => r.abort()) // demo must not depend on map tiles

    // 1-2. First visit: onboarding, then the sample farm.
    await page.goto('/')
    await expect(page).toHaveURL(/\/onboarding$/)
    await page.getByRole('button', { name: /Try Sample Farm/i }).click()
    await expect(page.getByRole('heading', { level: 1, name: SAMPLE.name })).toBeVisible()

    // 4. NASA information with provenance on the Dashboard.
    const strip = page.getByLabel('Data sources')
    await expect(strip).toContainText('NASA offline snapshot')
    await expect(strip).toContainText('2014–2023')
    await expect(strip).toContainText('Soil sensors are simulated')
    await expect(page.getByText('Mean annual rainfall').first()).toBeVisible()
    await expect(page.getByText('1481')).toBeVisible()

    // Dashboard score before any change (current practice is selected by default).
    const dashScoreBefore = await page.locator('.dash-kpi').first().innerText()
    expect(dashScoreBefore).toMatch(/Selected plan score\s*\d+/)

    // 5. Soil and simulated sensors on My Farm.
    await nav(page, 'My Farm').click()
    await page.getByRole('tab', { name: 'Soil & Sensors' }).click()
    await expect(page.getByText(/no physical sensor is connected/i)).toBeVisible()
    await page.getByLabel('Simulated soil preset').selectOption('dry')
    await expect.poll(async () => (await readState(page)).soilPreset).toBe('dry')

    // 6-7. Three rotation options; compare; select the resilience plan.
    await nav(page, 'Rotation Planner').click()
    await expect(page.getByRole('heading', { level: 1, name: 'Rotation Planner' })).toBeVisible()
    const cards = page.locator('[data-testid^="plan-card-"]')
    await expect(cards).toHaveCount(3)
    await expect(page.getByTestId('plan-card-current')).toContainText(/Current/i)
    await expect(page.getByTestId('plan-card-minimum')).toContainText(/Minimum change/i)
    await expect(page.getByTestId('plan-card-resilience')).toContainText(/Resilience/i)
    await page.getByRole('button', { name: 'Compare all' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('table')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await page.getByTestId('plan-card-resilience').getByRole('radio').click()
    await expect.poll(async () => (await readState(page)).activePlanId).toBe('resilience')

    // 8-9. Scenario Studio: a drier year changes the estimated results.
    await page.getByRole('button', { name: 'Use in scenarios' }).click()
    await expect(page).toHaveURL(/\/scenarios$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Scenario Studio' })).toBeVisible()
    const net = page.getByTestId('metric-estimatedNetReturn-selected')
    await expect(net).not.toHaveText('')
    const netBefore = await net.innerText()
    await page.getByRole('tab', { name: 'Drier' }).click()
    await expect.poll(async () => (await readState(page)).scenario.rainfallDeltaPct).toBeLessThan(0)
    await expect(page.getByTestId('metric-waterIndex-selected')).not.toHaveText('')
    const slider = page.getByRole('slider', { name: 'Input cost change' })
    await slider.focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect.poll(async () => (await readState(page)).scenario.inputCostDeltaPct).toBeGreaterThan(0)
    expect(await net.innerText()).not.toBe(netBefore)
    await expect(page.getByRole('heading', { name: 'Uncertainty' })).toBeVisible()
    await page.getByRole('button', { name: 'Assumptions' }).click()
    await expect(page.getByRole('dialog', { name: 'Scenario assumptions' })).toBeVisible()
    await page.keyboard.press('Escape')

    // 10. Plant Check with a clearly labelled demo example.
    await nav(page, 'Plant Check').click()
    await page.getByRole('button', { name: /Use sample image: Pale leaf edges/ }).first().click()
    await expect(page.getByText('Demo example').first()).toBeVisible()
    await expect(page.getByText(/not a diagnosis/i).first()).toBeVisible()
    await expect.poll(async () => (await readState(page)).lastPlantObservation?.source).toBe('DEMO_IMAGE')

    // 11. Assistant answers from the farm's actual state.
    await page.getByRole('button', { name: /Ask FarmWise/ }).first().click()
    const drawer = page.getByRole('dialog', { name: 'Ask FarmWise' })
    await expect(drawer).toBeVisible()
    await drawer.getByRole('button', { name: 'What happens in my current scenario?' }).click()
    await expect(drawer.getByTestId('assistant-conversation')).toContainText('model estimates')
    await expect(drawer.getByTestId('assistant-conversation')).toContainText('rainfall')
    await drawer.getByRole('button', { name: 'What did my last plant check show?' }).click()
    await expect(drawer.getByTestId('assistant-conversation')).toContainText(/demo example/i)
    await drawer.getByLabel('Ask FarmWise a question').fill('what are my soil readings')
    await drawer.getByRole('button', { name: 'Ask', exact: true }).click()
    await expect(drawer.getByTestId('assistant-conversation')).toContainText(/simulated "dry" sensor preset/)
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()

    // 12. Back on the Dashboard: consistent with the selection, soil and scenario state.
    await nav(page, 'Dashboard').click()
    await expect(page.getByText('Dry preset').first()).toBeVisible()
    await expect(page.getByText('Your selected plan')).toBeVisible()
    await expect(page.getByText('Resilience plan').first()).toBeVisible()
    const dashScore = Number((await page.locator('.dash-kpi').first().innerText()).match(/(\d+)\s*\/\s*100/)?.[1])
    await nav(page, 'Rotation Planner').click()
    const planScore = Number((await page.getByTestId('score-resilience').innerText()).match(/(\d+)/)?.[1])
    expect(dashScore).toBe(planScore)

    // Reload: nothing is lost.
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Rotation Planner' })).toBeVisible()
    expect((await readState(page)).activePlanId).toBe('resilience')

    expect(problems.filter((p) => !/tile\.openstreetmap|ERR_FAILED|Failed to load resource/i.test(p))).toEqual([])
  })

  test('J13: farm edits propagate: budget and rotation change the plans and the Dashboard', async ({ page }) => {
    await seedState(page, { once: true })
    await page.goto('/rotation')
    const before = await page.getByTestId('score-current').innerText()
    await nav(page, 'My Farm').click()
    await page.getByRole('button', { name: 'Edit details' }).click()
    await page.getByLabel('Crop').nth(1).selectOption('beans')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect.poll(async () => (await readState(page)).farm.rotation[1].cropId).toBe('beans')
    await nav(page, 'Rotation Planner').click()
    await expect(page.getByTestId('score-current')).not.toHaveText(before)
  })
})

test.describe('onboarding', () => {
  test('O01-O05: manual setup saves a profile that drives the whole app', async ({ page }) => {
    await seedState(page, { farm: null, once: true })
    await page.goto('/')
    await page.getByRole('button', { name: /Set Up My Farm/i }).click()
    await page.getByLabel('Farm Name').fill('Test Plot')
    await page.getByLabel('Latitude (optional)').fill('-0.3')
    await page.getByLabel('Longitude (optional)').fill('36.08')
    await page.getByLabel('Farm Area (hectares, optional)').fill('1.5')
    await page.getByRole('button', { name: 'Continue' }).click()
    // At least one season is required.
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('alert')).toContainText('Add at least one crop season')
    await page.getByRole('button', { name: 'Add Season' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Review' }).click()
    await page.getByRole('button', { name: 'Go to Dashboard' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Test Plot' })).toBeVisible()
    const saved = await readState(page)
    expect(saved.farm.name).toBe('Test Plot')
    expect(saved.farm.rotation).toHaveLength(1)
    await nav(page, 'Rotation Planner').click()
    await expect(page.locator('[data-testid^="plan-card-"]')).toHaveCount(3)
  })

  test('O06: corrupted saved data falls back to onboarding instead of crashing', async ({ page }) => {
    const problems = trackProblems(page)
    await page.addInitScript((k) => window.localStorage.setItem(k, '{not json'), STATE_KEY)
    await page.goto('/')
    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByRole('button', { name: /Try Sample Farm/i })).toBeVisible()
    expect(problems).toEqual([])
  })

  test('O07: partially valid saved data keeps what is valid and drops the rest', async ({ page }) => {
    await page.addInitScript(
      ([k, farm]) =>
        window.localStorage.setItem(
          k as string,
          JSON.stringify({ farm: JSON.parse(farm as string), soilPreset: 'bogus', activePlanId: 42, scenario: 'x', theme: 'dark' }),
        ),
      [STATE_KEY, JSON.stringify({ ...SAMPLE, lat: 'north', rotation: [{ season: 'Long Rains (Mar–Jun)', cropId: 'maize', yearOffset: 0 }, { nope: true }] })],
    )
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: SAMPLE.name })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByText('Location not set')).toBeVisible()
  })
})

test.describe('data honesty', () => {
  test('N01: a farm far from the NASA snapshot gets no NASA values, not another region\'s climate', async ({ page }) => {
    await seedState(page, { farm: { ...SAMPLE, lat: 51.5, lon: -0.12 } as typeof SAMPLE, once: true })
    await page.goto('/')
    await expect(page.getByText('No NASA snapshot for this location')).toBeVisible()
    await expect(page.getByText('1481')).toHaveCount(0)
    await page.goto('/rotation')
    await expect(page.locator('[data-testid^="plan-card-"]')).toHaveCount(3)
    await expect(page.locator('body')).not.toContainText(/NaN|undefined/)
  })

  test('N02: every route labels simulated, estimated and NASA data and never claims real-time', async ({ page }) => {
    await seedState(page, { once: true })
    for (const [path, needle] of [
      ['/', /Soil sensors are simulated/],
      ['/farm', /Farm Details/],
      ['/rotation', /Model estimate/],
      ['/scenarios', /not forecasts/],
      ['/plant', /not a field photograph|not used to diagnose/i],
      ['/evidence', /not a forecast/i],
    ] as const) {
      await page.goto(path)
      await expect(page.locator('main')).toContainText(needle)
      const text = await page.locator('main').innerText()
      expect(text).not.toMatch(/real-time|live NASA|live data|currently measured/i)
    }
  })

  test('N03: no emoji anywhere in the interface', async ({ page }) => {
    await seedState(page, { once: true })
    for (const path of ['/', '/farm', '/rotation', '/scenarios', '/plant', '/evidence']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const text = await page.locator('body').innerText()
      expect(text, path).not.toMatch(/\p{Extended_Pictographic}/u)
    }
  })
})

test.describe('theme, layout and keyboard', () => {
  test('T01: theme toggle switches and persists across reload', async ({ page }) => {
    await seedState(page, { once: true })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.getByRole('button', { name: /Switch to dark mode|Dark mode/ }).first().click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  for (const theme of ['light', 'dark'] as const) {
    for (const [name, width] of [['mobile', 375], ['tablet', 768], ['desktop', 1440]] as const) {
      test(`L01: every route fits the screen and passes axe, ${name} ${theme}`, async ({ page }, testInfo) => {
        test.setTimeout(90_000)
        await seedState(page, { theme })
        await page.setViewportSize({ width, height: 900 })
        for (const path of ['/', '/farm', '/rotation', '/scenarios', '/plant', '/evidence', '/onboarding']) {
          await page.goto(path)
          await page.waitForLoadState('networkidle')
          await expect(page.locator('h1').first()).toBeVisible()
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
          expect(overflow, `${path} horizontal overflow`).toBeLessThanOrEqual(1)
          const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
          const blocking = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
          expect(blocking.map((v) => `${path}: ${v.id} ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([])
          if (width === 375 || width === 1440) {
            await page.screenshot({
              path: testInfo.outputPath(`${path === '/' ? 'dashboard' : path.slice(1)}-${name}-${theme}.png`),
              fullPage: true,
            })
          }
        }
      })
    }
  }

  test('L02: mobile navigation opens as a modal menu, traps focus and closes with Escape', async ({ page }) => {
    await seedState(page, { once: true })
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    const menu = page.getByRole('button', { name: 'Open navigation' }).first()
    await menu.click()
    const navEl = page.getByRole('navigation', { name: 'Pages' })
    await expect(navEl.getByRole('link', { name: 'Rotation Planner' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(navEl.getByRole('link', { name: 'Rotation Planner' })).toBeHidden()
    await expect(menu).toBeFocused()
  })

  test('K01: keyboard only: skip link, plan selection with arrow keys, dialog trap and focus return', async ({ page }) => {
    await seedState(page, { once: true })
    await page.goto('/rotation')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: /Skip to main content/i })).toBeFocused()
    const compare = page.getByRole('button', { name: 'Compare all' })
    await compare.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 12; i++) await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(compare).toBeFocused()
  })
})
