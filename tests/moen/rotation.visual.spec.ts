import { expect, test, type Page } from "@playwright/test";

const KEY = "farmwise:harness:v1";
const DIR = "docs/qa/screenshots/moen";
const WIDTHS = [320, 375, 768, 1024, 1440];
const THEMES = ["light", "dark"] as const;

async function open(page: Page, theme: (typeof THEMES)[number], width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(([k, t]) => {
    if (!sessionStorage.getItem("fw-seeded")) {
      localStorage.setItem(k, JSON.stringify({ theme: t }));
      sessionStorage.setItem("fw-seeded", "1");
    }
  }, [KEY, theme] as const);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/rotation");
  await expect(page.getByTestId("plan-card-current")).toBeVisible();
  await expect(page.getByLabel("Loading climate evidence")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function noHorizontalOverflow(page: Page) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(sw, `scrollWidth ${sw} > innerWidth ${iw}`).toBeLessThanOrEqual(iw);
}

/** Elements whose text is clipped horizontally inside the rotation page (not inside scroll containers). */
async function clippedText(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll<HTMLElement>(".rot-page *, [role=dialog] *").forEach((el) => {
      if (el.closest(".rot-table-scroll") || el.closest(".fw-overlay__body") === el) return;
      const cs = getComputedStyle(el);
      if (cs.overflowX === "auto" || cs.overflowX === "scroll") return;
      if (el.children.length === 0 && el.textContent?.trim() && el.scrollWidth > el.clientWidth + 1 && cs.overflow !== "visible") out.push(el.textContent.trim().slice(0, 40));
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > window.innerWidth + 1 && !el.closest(".fw-skeleton")) out.push(`offscreen: ${el.tagName}.${el.className} ${el.textContent?.trim().slice(0, 30)}`);
    });
    return out.slice(0, 10);
  });
}

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test(`page ${theme} ${width}px`, async ({ page }) => {
      await open(page, theme, width);
      await noHorizontalOverflow(page);
      expect(await clippedText(page)).toEqual([]);
      await page.screenshot({ path: `${DIR}/rotation-${theme}-${width}.png`, fullPage: true });
    });
  }
  for (const width of [375, 1440]) {
    test(`compare dialog ${theme} ${width}px`, async ({ page }) => {
      await open(page, theme, width);
      await page.getByRole("button", { name: "Compare all" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await noHorizontalOverflow(page);
      const box = await dialog.boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= width + 1).toBeTruthy();
      expect(await clippedText(page)).toEqual([]);
      await page.screenshot({ path: `${DIR}/rotation-compare-${theme}-${width}.png` });
    });
    test(`why drawer ${theme} ${width}px`, async ({ page }) => {
      await open(page, theme, width);
      await page.getByTestId("plan-card-resilience").getByRole("button", { name: /why this plan/i }).click();
      const drawer = page.getByRole("dialog");
      await expect(drawer).toBeVisible();
      await noHorizontalOverflow(page);
      const box = await drawer.boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= width + 1).toBeTruthy();
      await page.screenshot({ path: `${DIR}/rotation-why-${theme}-${width}.png` });
    });
  }
}

test("no-farm empty state at 375px", async ({ page }) => {
  await open(page, "light", 375);
  await page.getByRole("button", { name: "No farm" }).click();
  await expect(page.getByRole("heading", { name: "Set up a farm first" })).toBeVisible();
  await noHorizontalOverflow(page);
  await page.screenshot({ path: `${DIR}/rotation-empty-light-375.png`, fullPage: true });
});
