import { defineConfig, devices } from "@playwright/test";

const PREVIEW_URL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: PREVIEW_URL },
  // Mods rely on frame behavior that differs between engines (design.md of
  // add-mod-ui-capabilities, Browser differences), so every test runs in all three.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --strictPort",
    url: PREVIEW_URL,
    reuseExistingServer: false,
  },
});
