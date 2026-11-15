import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/moen",
  timeout: 30_000,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled" } },
  reporter: [["list"], ["json", { outputFile: "test-results/moen-playwright.json" }]],
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  webServer: { command: "npm run build && npm run preview", url: "http://localhost:4173", reuseExistingServer: !process.env.CI, timeout: 180_000 },
  projects: [
    { name: "e2e", testMatch: /.*\.e2e\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "a11y", testMatch: /.*\.a11y\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "visual", testMatch: /.*\.visual\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
  ],
});
