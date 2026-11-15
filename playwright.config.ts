import { defineConfig, devices } from "@playwright/test";

// Browser: Playwright's bundled Chromium download hangs during extraction under Node 26 on the
// dev machine, so the default here is the installed Google Chrome ("chrome" channel).
// CI / machines with a working bundled install: set PW_CHANNEL=bundled.
const channel = process.env.PW_CHANNEL === "bundled" ? undefined : (process.env.PW_CHANNEL ?? "chrome");
const browser = { ...devices["Desktop Chrome"], channel };
export default defineConfig({
  testDir: "./tests/moen",
  timeout: 30_000,
  // Visual baselines are platform-specific (committed: darwin). On a platform with no baseline yet
  // (e.g. Linux CI first run) write it instead of failing; later runs compare against it.
  updateSnapshots: "missing",
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
