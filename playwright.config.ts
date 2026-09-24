import { defineConfig, devices } from "@playwright/test";

// Browser checks against a production build on a fresh, empty database.
// Run `npm run build` first, then `npm run test:e2e`.
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // Menus and dialogs fade in; without this, axe can catch them half
    // transparent and report contrast the finished page doesn't have.
    reducedMotion: "reduce",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // A new database every run, so the app starts in setup mode.
    command:
      "node -e \"require('fs').rmSync('prisma/e2e.db',{force:true});require('fs').rmSync('e2e-data',{recursive:true,force:true})\"" +
      ` && npx prisma db push --skip-generate && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: "file:./e2e.db",
      TRACKR_DATA_DIR: "./e2e-data",
      AUTH_SECRET: "e2e-only-secret-e2e-only-secret-e2e-only-secret",
    },
  },
});
