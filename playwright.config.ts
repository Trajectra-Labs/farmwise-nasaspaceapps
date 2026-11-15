import { defineConfig, devices } from "@playwright/test";
import { readdirSync } from "node:fs";

const hasBaselinesForPlatform = (() => {
  try {
    return readdirSync("tests/moen", { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.endsWith("-snapshots"))
      .some((d) => readdirSync(`tests/moen/${d.name}`).some((f) => f.endsWith(`-${process.platform}.png`)));
  } catch { return false; }
})();
if (!hasBaselinesForPlatform) console.warn(`[visual] No committed baselines for ${process.platform}: screenshot comparisons skipped.`);

// Browser: Playwright's bundled Chromium download hangs during extraction under Node 26 on the
// dev machine, so the default here is the installed Google Chrome ("chrome" channel).
// CI / machines with a working bundled install: set PW_CHANNEL=bundled.
const channel = process.env.PW_CHANNEL === "bundled" ? undefined : (process.env.PW_CHANNEL ?? "chrome");
const browser = { ...devices["Desktop Chrome"], channel };
export default defineConfig({
  testDir: "./tests/moen",
  timeout: 30_000,
  // Visual baselines are platform-specific (committed: darwin only). On a platform with no committed
  // baselines, screenshot COMPARISONS are skipped (all other assertions, incl. overflow checks, still run)
  // instead of failing on "snapshot doesn't exist". Generate & commit baselines in the CI image with
  // `npx playwright test --project=visual --update-snapshots` to enable comparison there.
  ignoreSnapshots: !hasBaselinesForPlatform,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled" } },
  reporter: [["list"], ["json", { outputFile: "test-results/moen-playwright.json" }]],
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  webServer: { command: "npm run build && npm run preview", url: "http://localhost:4173", reuseExistingServer: !process.env.CI, timeout: 180_000 },
  projects: [
    { name: "e2e", testMatch: /.*\.e2e\.spec\.ts/, use: browser },
    { name: "a11y", testMatch: /.*\.a11y\.spec\.ts/, use: browser },
    { name: "visual", testMatch: /.*\.visual\.spec\.ts/, use: browser },
  ],
});
