// Moen · shared Playwright helpers for Scenario Studio specs.
import { expect, type Page } from "@playwright/test";

export const STORE_KEY = "farmwise:harness:v1";

/** Seed the harness store before the app boots (theme, scenario, etc.). Runs once per test page. */
export async function seed(page: Page, state: Record<string, unknown>) {
  await page.addInitScript(([key, value]) => {
    if (!sessionStorage.getItem("scn-seeded")) {
      localStorage.setItem(key, value);
      sessionStorage.setItem("scn-seeded", "1");
    }
  }, [STORE_KEY, JSON.stringify(state)] as const);
}

export async function openStudio(page: Page) {
  await page.goto("/scenarios");
  await expect(page.getByRole("heading", { level: 1, name: "Scenario Studio" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Observed inputs" })).toBeVisible();
}

export const slider = (page: Page, name: string) => page.getByRole("slider", { name });
export const metric = (page: Page, key: string, which: "current" | "selected" | "delta") => page.getByTestId(`metric-${key}-${which}`);

export async function expectNoBadNumbers(page: Page) {
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/NaN|Infinity|undefined/);
}
