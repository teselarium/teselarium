import { defineConfig, devices } from "@playwright/test";
import {
  EXPLORER_OFF_PREVIEW_URL,
  HOME_MOD_PREVIEW_URL,
  PREVIEW_URL,
} from "./e2e/app_servers.ts";

/** Builds the app in an e2e mode (vite.config.ts) and previews it on its own port. */
function buildInstantiationServer(
  mode: string,
  port: number,
  url: string,
): { command: string; url: string; reuseExistingServer: boolean } {
  const outDir = `dist-${mode}`;
  const server = {
    command: `npx vite build --mode ${mode} --outDir ${outDir} && npx vite preview --outDir ${outDir} --port ${port} --strictPort`,
    url,
    reuseExistingServer: false,
  };
  return server;
}

export default defineConfig({
  testDir: "e2e",
  // Each test opens its own page, so the tests of one file can run in
  // different workers, which spreads the long files over the run.
  fullyParallel: true,
  use: { baseURL: PREVIEW_URL },
  // Mods rely on frame behavior that differs between engines (design.md of
  // add-mod-ui-capabilities, Browser differences), so every test runs in all three.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: [
    {
      command: "npm run build && npm run preview -- --strictPort",
      url: PREVIEW_URL,
      reuseExistingServer: false,
    },
    // Instantiations the vanilla app cannot show (src/test/registries/).
    buildInstantiationServer("e2e-home-mod", 4174, HOME_MOD_PREVIEW_URL),
    buildInstantiationServer(
      "e2e-explorer-off",
      4175,
      EXPLORER_OFF_PREVIEW_URL,
    ),
  ],
});
