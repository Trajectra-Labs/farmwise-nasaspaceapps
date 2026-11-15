import { expect, test, type Page } from "@playwright/test";

const KEY = "farmwise:harness:v1";

async function open(page: Page, state: Record<string, unknown> = {}) {
  await page.addInitScript(([k, s]) => {
    if (!sessionStorage.getItem("fw-seeded")) {
      localStorage.setItem(k as string, JSON.stringify(s));
      sessionStorage.setItem("fw-seeded", "1");
    }
  }, [KEY, state] as const);
  await page.goto("/rotation");
  await expect(page.getByTestId("plan-card-current")).toBeVisible();
  await expect(page.getByLabel("Loading climate evidence")).toHaveCount(0);
}

const card = (page: Page, id: string) => page.getByTestId(`plan-card-${id}`);

test.describe("Rotation Planner journey", () => {
  test("R01/R02/R04/R03/R07/R06: select, explain, compare, keep current, use in scenarios", async ({ page }) => {
    await open(page);
    for (const id of ["current", "minimum", "resilience"]) {
      await expect(card(page, id).getByRole("list", { name: /crop sequence/i }).getByRole("listitem")).toHaveCount(4);
    }

    // R02 select
    await card(page, "minimum").getByRole("radio").click();
    await expect(card(page, "minimum").getByRole("radio")).toHaveAttribute("aria-checked", "true");
    await expect(card(page, "minimum")).toHaveClass(/fw-card--selected/);
    const title = (await card(page, "minimum").getByRole("heading", { level: 3 }).textContent()) ?? "";
    await expect(page.getByTestId("plan-details").getByRole("heading", { level: 2 })).toContainText(title);

    // R04 why drawer, focus returns
    const why = card(page, "resilience").getByRole("button", { name: /why this plan/i });
    await why.click();
    const drawer = page.getByRole("dialog", { name: /why this plan/i });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("heading", { name: /unknowns/i })).toBeVisible();
    await expect(drawer.getByRole("heading", { name: /score versus confidence/i })).toBeVisible();
    await expect(drawer.locator("[data-source]").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(why).toBeFocused();

    // R03 compare dialog
    const compare = page.getByRole("button", { name: "Compare all" });
    await compare.click();
    const dialog = page.getByRole("dialog", { name: /compare all plans/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("table")).toBeVisible();
    await expect(dialog.getByRole("rowheader", { name: /Input cost range \(KES\)/ })).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).last().click();
    await expect(dialog).toHaveCount(0);
    await expect(compare).toBeFocused();

    // R07 keep current
    await page.getByRole("button", { name: "Keep my current rotation" }).click();
    await expect(card(page, "current").getByRole("radio")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("status").filter({ hasText: /Keeping your current rotation/ })).toBeVisible();

    // R06 use in scenarios with a feasible non-current plan
    let target = "minimum";
    if (await card(page, "minimum").getByText("Not feasible").count()) target = "resilience";
    await card(page, target).getByRole("radio").click();
    await page.getByTestId("plan-details").getByRole("button", { name: "Use in scenarios" }).click();
    await expect(page).toHaveURL(/\/scenarios$/);
    const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "{}").activePlanId, KEY);
    expect(stored).toBe(target);
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Rotation Planner", exact: true }).click();
    await expect(card(page, target).getByRole("radio")).toHaveAttribute("aria-checked", "true");
  });

  test("Copy summary writes to the real clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page);
    await page.getByRole("button", { name: "Copy summary" }).click();
    await expect(page.getByText(/summary copied/i)).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text.length).toBeGreaterThan(40);
    expect(text).toMatch(/KES/);
  });

  test("Download JSON saves farmwise-rotations-<farmId>.json", async ({ page }) => {
    await open(page);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download JSON" }).click()]);
    expect(download.suggestedFilename()).toBe("farmwise-rotations-sample-nakuru-01.json");
  });

  test("R08: harness soil preset / irrigation change updates the cards", async ({ page }) => {
    await open(page);
    const snapshot = async () => (await page.getByRole("radiogroup").textContent()) ?? "";
    const before = await snapshot();
    await page.getByLabel("Soil preset (simulated)").selectOption("dry");
    await expect(page.getByTestId("prov-soil")).toContainText("11% moisture");
    await page.getByLabel("Irrigation").selectOption("rainfed");
    await expect(page.getByTestId("prov-farmer")).toContainText("Rainfed");
    expect(await snapshot()).not.toBe(before);
  });

  test("No farm shows the set-up empty state", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "No farm" }).click();
    await expect(page.getByRole("heading", { name: "Set up a farm first" })).toBeVisible();
    await page.getByRole("button", { name: "Set up a farm first" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
  });
});
