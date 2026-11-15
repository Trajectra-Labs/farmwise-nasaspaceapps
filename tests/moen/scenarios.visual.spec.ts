// Moen · Scenario Studio visual QA (S14): 5 widths × 2 themes, no horizontal overflow, full-page
// screenshots saved to docs/qa/screenshots/moen/ for image-by-image review; plus the drawer.
import { expect, test, type Page } from "@playwright/test";
import { expectNoBadNumbers, openStudio, seed } from "./scenarios.helpers";

const WIDTHS = [320, 375, 768, 1024, 1440];
const DIR = "docs/qa/screenshots/moen";

async function expectNoHorizontalOverflow(page: Page) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(sw, "page must not scroll horizontally").toBeLessThanOrEqual(iw);
}

for (const theme of ["light", "dark"] as const) {
  for (const width of WIDTHS) {
    test(`scenarios ${theme} ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await seed(page, { theme });
      await openStudio(page);
      await page.locator(".recharts-surface").first().waitFor();
      await expectNoHorizontalOverflow(page);
      await expectNoBadNumbers(page);
      // Table keeps its own scroll container on narrow screens.
      const wrap = page.locator(".scn-table-wrap");
      const fits = await wrap.evaluate((el) => el.getBoundingClientRect().right <= window.innerWidth + 0.5);
      expect(fits).toBe(true);
      await page.screenshot({ path: `${DIR}/scenarios-${theme}-${width}.png`, fullPage: true, animations: "disabled" });
      if (width === 375 || width === 1440) {
        // Stable visual regression baseline (tests/moen/scenarios.visual.spec.ts-snapshots/).
        await expect(page).toHaveScreenshot(`scenarios-${theme}-${width}.png`, { fullPage: true });
      }
    });
  }
  for (const width of [375, 1440]) {
    test(`scenarios assumptions drawer ${theme} ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await seed(page, { theme });
      await openStudio(page);
      await page.getByRole("button", { name: "Assumptions" }).click();
      await expect(page.getByRole("dialog", { name: "Scenario assumptions" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `${DIR}/scenarios-drawer-${theme}-${width}.png`, animations: "disabled" });
      await expect(page).toHaveScreenshot(`scenarios-drawer-${theme}-${width}.png`);
    });
  }
}

test("scenarios custom scenario at 375 (dark)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await seed(page, { theme: "dark", scenario: { rainfallDeltaPct: -20, temperatureDeltaC: 1.5, irrigationPct: 40, inputCostDeltaPct: 10 } });
  await openStudio(page);
  await expect(page.getByTestId("scn-custom-label")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: `${DIR}/scenarios-custom-dark-375.png`, fullPage: true, animations: "disabled" });
});

for (const theme of ["light", "dark"] as const) {
  test(`scenarios climate error state ${theme} 375px`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await seed(page, { theme, farm: { id: "no-location", name: "Farm without location", lat: null, lon: null, areaHa: 2, irrigation: "limited",
      rotation: [{ season: "Long rains", cropId: "maize", yearOffset: 0 }, { season: "Short rains", cropId: "beans", yearOffset: 0 }],
      priorities: ["water"], budget: 120000, notes: "" } });
    await page.goto("/scenarios");
    await expect(page.getByRole("heading", { name: "Climate data unavailable" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoBadNumbers(page);
    await page.screenshot({ path: `${DIR}/scenarios-error-${theme}-375.png`, fullPage: true, animations: "disabled" });
  });

  test(`scenarios empty (no farm) state ${theme} 375px`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await seed(page, { theme, farm: null });
    await page.goto("/scenarios");
    await expect(page.getByRole("heading", { name: "No farm set up yet" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${DIR}/scenarios-empty-${theme}-375.png`, fullPage: true, animations: "disabled" });
  });

  test(`scenarios chart tooltip ${theme} 1024px`, async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await seed(page, { theme, activePlanId: "resilience" });
    await openStudio(page);
    const chart = page.locator(".scn-chart").nth(1);
    await chart.scrollIntoViewIfNeeded();
    await chart.locator(".recharts-bar-rectangle").first().hover();
    const tip = chart.locator(".recharts-tooltip-wrapper");
    await expect(tip).toBeVisible();
    await expect(tip).toContainText("KES");
    await page.screenshot({ path: `${DIR}/scenarios-tooltip-${theme}-1024.png`, animations: "disabled" });
  });
}
