import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT ?? "3413";
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
const useWebServer = process.env.E2E_SKIP_WEBSERVER !== "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 7_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  webServer: useWebServer
    ? {
        command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
  use: {
    baseURL,
    launchOptions: {
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
