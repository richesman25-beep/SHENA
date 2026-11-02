import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  outputDir:
    process.env.SHENA_E2E_MODE === "live"
      ? "test-results/live"
      : "test-results/demo",
  testIgnore:
    process.env.SHENA_E2E_MODE === "live"
      ? ["**/location.spec.ts", "**/storefront.spec.ts"]
      : ["**/production.spec.ts"],
  workers: 2,
  use: {
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    },
  },
  webServer: {
    command: "npm run start",
    env: { SHENA_CATALOG_MODE: process.env.SHENA_E2E_MODE || "demo" },
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
});
