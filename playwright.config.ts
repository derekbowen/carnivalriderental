import { defineConfig } from "@playwright/test";

const PORT = 3100;
export const E2E_INTERNAL = { username: "team", password: "e2e-internal-password" };

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" },
  },
  webServer: {
    // Isolated database with fictional demo suppliers; production build of this app.
    command: `rm -f data/e2e.sqlite* && tsx scripts/seed-demo.ts && next start -p ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      APP_ENV: "development",
      DATABASE_PATH: "data/e2e.sqlite",
      INTERNAL_USER: E2E_INTERNAL.username,
      INTERNAL_PASSWORD: E2E_INTERNAL.password,
      REQUEST_TOKEN_SECRET: "e2e-token-secret-e2e-token-secret",
      SITE_URL: `http://localhost:${PORT}`,
      ALLOW_DEMO_CONTENT: "true",
      PUBLIC_INDEXING: "false",
      // Keep e2e offline: never call the real Sharetribe marketplace from tests.
      CATALOG_SOURCE_FILE: "data/e2e-catalog.json",
      SHARETRIBE_INTEGRATION_CLIENT_ID: "",
      SHARETRIBE_CLIENT_ID: "",
      SHARETRIBE_INTEGRATION_CLIENT_SECRET: "",
    },
  },
});
