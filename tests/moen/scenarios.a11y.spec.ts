// Moen · Scenario Studio accessibility: axe (page + assumptions drawer, light & dark) and a
// keyboard-only path.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { openStudio, seed, slider } from "./scenarios.helpers";

// @axe-core/playwright is typed against its own playwright-core copy; the runtime object is identical.
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];

for (const theme of ["light", "dark"] as const) {
  test.describe(`Scenario Studio · axe · ${theme}`, () => {
    test.beforeEach(async ({ page }) => { await seed(page, { theme }); });

    test(`page has no axe violations (${theme})`, async ({ page }) => {
      await openStudio(page);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const res = await new AxeBuilder({ page: page as unknown as AxePage }).include("#main").analyze();
      expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });

    test(`assumptions drawer has no axe violations (${theme})`, async ({ page }) => {
      await openStudio(page);
      await slider(page, "Rainfall change").focus();
      await page.keyboard.press("Home");
      await page.getByRole("button", { name: "Assumptions" }).click();
      const drawer = page.getByRole("dialog", { name: "Scenario assumptions" });
      await expect(drawer).toBeVisible();
      const res = await new AxeBuilder({ page: page as unknown as AxePage }).include(".fw-drawer").analyze();
      expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });
  });
}

const violations = (res: { violations: { id: string; nodes: { target: unknown[] }[] }[] }) =>
  res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);

for (const theme of ["light", "dark"] as const) {
  test(`375px: page and open drawer have no axe violations (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await seed(page, { theme });
    await openStudio(page);
    expect(violations(await new AxeBuilder({ page: page as unknown as AxePage }).include("#main").analyze())).toEqual([]);
    await page.getByRole("button", { name: "Assumptions" }).click();
    await expect(page.getByRole("dialog", { name: "Scenario assumptions" })).toBeVisible();
    expect(violations(await new AxeBuilder({ page: page as unknown as AxePage }).include(".fw-drawer").analyze())).toEqual([]);
  });
}

test("keyboard-only path: preset, slider, plan, assumptions, reset", async ({ page }) => {
  await openStudio(page);
  // Tab until the Typical preset tab receives focus (no mouse).
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    if (await page.getByRole("tab", { name: "Typical" }).evaluate((el) => el === document.activeElement)) break;
  }
  await expect(page.getByRole("tab", { name: "Typical" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Drier" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Drier" })).toHaveAttribute("aria-selected", "true");
  // Into the tab panel, then the first slider.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(slider(page, "Rainfall change")).toBeFocused();
  const v = await slider(page, "Rainfall change").inputValue();
  await page.keyboard.press("ArrowRight");
  await expect(slider(page, "Rainfall change")).not.toHaveValue(v);
  // Focus ring is visible on the focused slider.
  const shadow = await slider(page, "Rainfall change").evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).not.toBe("none");

  // Assumptions drawer: opens from keyboard, Escape closes, focus returns.
  const btn = page.getByRole("button", { name: "Assumptions" });
  await btn.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Scenario assumptions" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(btn).toBeFocused();

  // Reset via keyboard.
  const reset = page.getByRole("button", { name: "Reset" });
  await reset.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: "Typical" })).toBeFocused();
});

test("interactive targets are at least 44px tall", async ({ page }) => {
  await openStudio(page);
  const small = await page.locator("#main").evaluate((root) =>
    Array.from(root.querySelectorAll<HTMLElement>(".scn-page button, .scn-page a, .scn-page select, .scn-page input"))
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ t: el.textContent?.trim() || el.getAttribute("aria-label") || el.tagName, h: el.getBoundingClientRect().height }))
      .filter((x) => x.h < 44));
  expect(small).toEqual([]);
});
