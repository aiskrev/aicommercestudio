import { defineConfig, devices } from "@playwright/test";

/** Screenshot capture for visual review (see visual/screenshots.spec.ts). Not part of `npx playwright test`. */
export default defineConfig({
  testDir: "./visual",
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "bg-BG",
    extraHTTPHeaders: { "X-Forwarded-For": `10.96.${Math.floor(Math.random() * 250) + 1}.1` },
  },
});
