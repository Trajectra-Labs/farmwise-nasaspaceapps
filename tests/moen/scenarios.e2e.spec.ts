// Moen · Scenario Studio end-to-end journeys (S01–S06, S09–S11, S13 in a real browser).
import { expect, test } from "@playwright/test";
import { expectNoBadNumbers, metric, openStudio, slider } from "./scenarios.helpers";

test.describe("Scenario Studio · e2e", () => {
  test("S01 presets change sliders and results", async ({ page }) => {
    await openStudio(page);
    const net = metric(page, "estimatedNetReturn", "selected");
    const typicalNet = await net.innerText();
    for (const name of ["Drier", "Hotter", "Higher costs"]) {
      await page.getByRole("tab", { name }).click();
      await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
      await expect(net).not.toHaveText(typicalNet);
    }
    await page.getByRole("tab", { name: "Drier" }).click();
    await expect(slider(page, "Rainfall change")).not.toHaveValue("0");
    await page.getByRole("tab", { name: "Typical" }).click();
    await expect(slider(page, "Rainfall change")).toHaveValue("0");
    await expect(net).toHaveText(typicalNet);
  });

  test("S02 rainfall slider works with keyboard and pointer", async ({ page }) => {
    await openStudio(page);
    const rain = slider(page, "Rainfall change");
    const water = metric(page, "waterIndex", "selected");
    const before = await rain.inputValue();
    await rain.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(rain).not.toHaveValue(before);
    await page.keyboard.press("Home");
    const min = await rain.getAttribute("min");
    await expect(rain).toHaveValue(min!);
    await expect(page.getByTestId("scn-custom-label")).toHaveText("Custom (modified from Typical)");
    const lowWater = await water.innerText();
    await page.keyboard.press("End");
    await expect(rain).toHaveValue((await rain.getAttribute("max"))!);
    await expect(water).not.toHaveText(lowWater);
    // pointer: click near the left end of the track
    const box = (await rain.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.1, box.y + box.height / 2);
    expect(Number(await rain.inputValue())).toBeLessThan(Number(await rain.getAttribute("max")));
  });

  test("S06 plan selector preserves scenario inputs", async ({ page }) => {
    await openStudio(page);
    await page.getByRole("tab", { name: "Hotter" }).click();
    const temp = slider(page, "Temperature change");
    await temp.focus();
    await page.keyboard.press("ArrowRight");
    const values = await Promise.all(["Rainfall change", "Temperature change", "Irrigation availability", "Input cost change"].map((n) => slider(page, n).inputValue()));
    const select = page.getByLabel("Compare current rotation with");
    const options = await select.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    expect(options).toHaveLength(3);
    for (const v of options) {
      await select.selectOption(v);
      const after = await Promise.all(["Rainfall change", "Temperature change", "Irrigation availability", "Input cost change"].map((n) => slider(page, n).inputValue()));
      expect(after).toEqual(values);
    }
  });

  test("S09 reset returns to the Typical baseline deterministically", async ({ page }) => {
    await openStudio(page);
    const reset = page.getByRole("button", { name: "Reset" });
    await expect(reset).toBeDisabled();
    const tableText = () => page.locator(".scn-table").evaluate((t) => t.textContent ?? "");
    const baseline = await tableText();
    await page.getByRole("tab", { name: "Drier" }).click();
    await slider(page, "Input cost change").focus();
    await page.keyboard.press("End");
    await expect(reset).toBeEnabled();
    await reset.click();
    await expect(page.getByText("Scenario reset to Typical")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Typical" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Typical" })).toBeFocused();
    await expect(reset).toBeDisabled();
    expect(await tableText()).toBe(baseline);
  });

  test("S10 copy summary puts usable text on the clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openStudio(page);
    await page.getByRole("tab", { name: "Drier" }).click();
    await page.getByRole("button", { name: "Copy summary" }).click();
    await expect(page.getByText("Scenario summary copied")).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/estimate/i);
    expect(text).toMatch(/Drier/);
    expect(text).not.toMatch(/NaN|Infinity|undefined/);
  });

  test("Download .txt produces a file", async ({ page }) => {
    await openStudio(page);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download .txt" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^farmwise-scenario-.*\.txt$/);
  });

  test("inputs persist when navigating to Rotation Planner and back", async ({ page }) => {
    await openStudio(page);
    await page.getByRole("tab", { name: "Higher costs" }).click();
    await slider(page, "Rainfall change").focus();
    await page.keyboard.press("ArrowRight");
    const rain = await slider(page, "Rainfall change").inputValue();
    const cost = await slider(page, "Input cost change").inputValue();
    await page.getByRole("button", { name: /Back to Rotation Planner/ }).click();
    await expect(page).toHaveURL(/\/rotation$/);
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Scenario Studio" }).click();
    await expect(page).toHaveURL(/\/scenarios$/);
    await expect(slider(page, "Rainfall change")).toHaveValue(rain);
    await expect(slider(page, "Input cost change")).toHaveValue(cost);
  });

  test("S11 extremes never show NaN or Infinity", async ({ page }) => {
    await openStudio(page);
    const names = ["Rainfall change", "Temperature change", "Irrigation availability", "Input cost change"];
    for (const key of ["Home", "End"]) {
      for (const n of names) { await slider(page, n).focus(); await page.keyboard.press(key); }
      await expectNoBadNumbers(page);
    }
    for (const n of names) { await slider(page, n).focus(); await page.keyboard.press("Home"); }
    await slider(page, "Input cost change").focus();
    await page.keyboard.press("End");
    await expectNoBadNumbers(page);
  });
});
