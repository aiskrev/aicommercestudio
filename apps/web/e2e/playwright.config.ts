import { defineConfig, devices } from "@playwright/test";

/**
 * Critical user journeys against a running stack (docker compose up).
 *   docker compose --profile test run --rm e2e
 * or locally: E2E_BASE_URL=http://localhost:3000 npx playwright test
 */
const runId = Math.floor(Math.random() * 250) + 1;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1, // the API applies rate limits per client
  retries: 0,
  timeout: 45_000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "bg-BG",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Local stacks have no reverse proxy, so each run identifies as a distinct client for the
    // per-IP rate limiter. Behind the production reverse proxy this header is overwritten.
    extraHTTPHeaders: { "X-Forwarded-For": `10.99.${runId}.${Math.floor(Math.random() * 250) + 1}` },
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
});
