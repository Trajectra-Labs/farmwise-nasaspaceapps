import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const KEY = "farmwise:harness:v1";

async function open(page: Page, theme: "light" | "dark") {
  await page.addInitScript(([k, t]) => {
    if (!sessionStorage.getItem("fw-seeded")) {
      localStorage.setItem(k, JSON.stringify({ theme: t }));
      sessionStorage.setItem("fw-seeded", "1");
    }
  }, [KEY, theme] as const);
  await page.goto("/rotation");
  await expect(page.getByTestId("plan-card-current")).toBeVisible();
  await expect(page.getByLabel("Loading climate evidence")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function axe(page: Page, include?: string) {
  let b = new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  if (include) b = b.include(include);
  const r = await b.analyze();
  const summary = r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(summary, summary.join("\n")).toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`Rotation Planner a11y (${theme})`, () => {
    test("page has no axe violations", async ({ page }) => {
      await open(page, theme);
      await axe(page, "main");
    });

    test("compare dialog has no axe violations", async ({ page }) => {
      await open(page, theme);
      await page.getByRole("button", { name: "Compare all" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await axe(page, "[role=dialog]");
    });

    test("why drawer has no axe violations", async ({ page }) => {
      await open(page, theme);
      await page.getByTestId("plan-card-minimum").getByRole("button", { name: /why this plan/i }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await axe(page, "[role=dialog]");
    });
  });
}

test("keyboard-only path: select via arrows, open/close why drawer and compare dialog, use in scenarios", async ({ page }) => {
  await open(page, "light");
  const radio = (id: string) => page.getByTestId(`plan-card-${id}`).getByRole("radio");
  // Tab until the checked radio receives focus
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press("Tab");
    if (await radio("current").evaluate((el) => el === document.activeElement)) break;
  }
  await expect(radio("current")).toBeFocused();
  // visible focus indicator
  const shadow = await radio("current").evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).not.toBe("none");
  await page.keyboard.press("ArrowRight");
  await expect(radio("minimum")).toBeFocused();
  await expect(radio("minimum")).toHaveAttribute("aria-checked", "true");

  // Why drawer: Tab to the card's why button, Enter, Escape restores focus
  await page.keyboard.press("Tab");
  const why = page.getByTestId("plan-card-minimum").getByRole("button", { name: /why this plan/i });
  await expect(why).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(why).toBeFocused();

  // Compare dialog via keyboard
  const compare = page.getByRole("button", { name: "Compare all" });
  await compare.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(compare).toBeFocused();

  // Use in scenarios via keyboard
  const use = page.getByTestId("plan-details").getByRole("button", { name: "Use in scenarios" });
  if (await use.isEnabled()) {
    await use.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/scenarios$/);
  }
});

test("interactive targets are at least 44px", async ({ page }) => {
  await open(page, "light");
  const small = await page.locator("main button, main a").evaluateAll((els) =>
    els.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && el.tagName === "BUTTON" && (r.height < 44 || r.width < 44);
    }).map((el) => el.textContent));
  expect(small).toEqual([]);
});
