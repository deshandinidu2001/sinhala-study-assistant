import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", globalSetup: "./e2e/setup.ts", workers: 1, timeout: 90_000,
  expect: { timeout: 15_000 }, reporter: "list",
  use: { baseURL: "http://localhost:3000", screenshot: "only-on-failure", trace: "off" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
});
