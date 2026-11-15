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
