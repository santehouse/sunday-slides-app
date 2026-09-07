import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// This sandbox pre-installs a Chromium build at a stable path that doesn't always match
// the revision the installed `@playwright/test` package expects under its own cache
// (`~/.cache/ms-playwright` style versioned folders) — point at it directly when present
// so `pnpm test:e2e` doesn't require a network browser download in this environment.
const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium";
const launchOptions = existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  // One worker: every spec shares a single mock-data process (CP_MOCK_DATA=1 keeps the
  // store in memory), so specs that mutate global state — the Settings spec rotates the
  // Sunday PIN, the Sunday specs sign in with it — must not run against each other.
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 1024 },
    // The 250ms `cp-page-enter` soft-transition (Dialog/Popover/Toast/page nav) honours
    // `prefers-reduced-motion` and turns itself off under it — set it suite-wide so specs
    // never race a CSS transition/animation instead of the real app state.
    reducedMotion: "reduce",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          CP_MOCK_DATA: "1",
          // Keep e2e deterministic and offline even when .env.local has real keys.
          OPENAI_API_KEY: "",
          RESEND_INBOUND_WEBHOOK_SECRET: "",
          // No object store in e2e: uploads take the in-process fallback path instead of a
          // browser PUT to R2 (which needs real network access from the test browser).
          R2_ACCOUNT_ID: "",
          R2_ACCESS_KEY_ID: "",
          R2_SECRET_ACCESS_KEY: "",
          R2_BUCKET: "",
        },
      },
});
