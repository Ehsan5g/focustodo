import { readFileSync } from "node:fs";

import { defineConfig } from "@playwright/test";

// Load .env into process.env for the test process (E2E specs read
// DATABASE_URL directly; Next loads .env only for the dev server it spawns,
// and Playwright does not export it to the test runner). Never overrides
// already-set variables.
try {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // No .env file — Playwright env-only runs keep working.
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 0,
  // One worker: all specs share the single Next dev server spawned by
  // webServer, and parallel browser churn against that dev process has
  // dropped server-action responses in dev ("stream closed early") — the
  // toggles and auth flows must be validated against a settled server (D12).
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
