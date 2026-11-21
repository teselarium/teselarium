import { defineConfig, devices } from "@playwright/test";
import type { Project } from "@playwright/test";
import {
  EXPLORER_OFF_PREVIEW_URL,
  HOME_MOD_PREVIEW_URL,
  PREVIEW_URL,
  TEST_CATALOG_PREVIEW_URL,
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

/** The e2e runs `E2E_RUN` chooses; unset means `default`. */
const E2E_RUNS = ["default", "samples", "full"] as const;

type E2eRun = (typeof E2E_RUNS)[number];

/** The tests whose result depends on how the engine treats frames. */
const FRAMES_TAG = /@frames/;

/** The shipped samples' own tests. */
const SAMPLE_TAG = /@sample/;

/** The tests whose result depends on the device: touch, or a pointer that cannot hover. */
const MOBILE_TAG = /@mobile/;

/** The tests a desktop project of the default run leaves out. */
const NOT_IN_DEFAULT_DESKTOP = /@sample|@mobile/;

/** The filters of one project: the tests it runs, minus the ones it skips. */
interface ProjectFilters {
  grep?: RegExp;
  grepInvert?: RegExp;
}

/** Reads the run from `E2E_RUN`, and throws for a value that names no run. */
function readE2eRun(value: string | undefined): E2eRun {
  const name = value ?? "default";
  for (const run of E2E_RUNS) {
    if (run === name) {
      return run;
    }
  }
  throw new Error(
    `Unknown E2E_RUN "${name}": expected one of ${E2E_RUNS.join(", ")}.`,
  );
}

/**
 * The filters of a desktop engine's project in a run. `runsEveryTest` is
 * true for the engine that runs every test of the default run, false for the
 * engines that run only the `@frames` tests in it. Desktop projects never
 * run the `@mobile` tests, which need a phone.
 */
function buildProjectFilters(
  run: E2eRun,
  runsEveryTest: boolean,
): ProjectFilters {
  let filters: ProjectFilters = { grepInvert: MOBILE_TAG };
  if (run === "samples") {
    filters = { grep: SAMPLE_TAG, grepInvert: MOBILE_TAG };
  } else if (run === "default" && runsEveryTest) {
    filters = { grepInvert: NOT_IN_DEFAULT_DESKTOP };
  } else if (run === "default") {
    filters = { grep: FRAMES_TAG, grepInvert: NOT_IN_DEFAULT_DESKTOP };
  }
  return filters;
}

/** The phone project: the `@mobile` tests, in the default and full runs. */
function buildMobileProjects(run: E2eRun): Project[] {
  const projects: Project[] = [];
  if (run !== "samples") {
    projects.push({
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      grep: MOBILE_TAG,
    });
  }
  return projects;
}

const e2eRun = readE2eRun(process.env.E2E_RUN);

export default defineConfig({
  testDir: "e2e",
  // Each test opens its own page, so the tests of one file can run in
  // different workers, which spreads the long files over the run.
  fullyParallel: true,
  use: { baseURL: PREVIEW_URL },
  // Engines: every test needs a real browser, but only the tests tagged
  // `@frames` depend on the engine, because mods rely on frame behavior that
  // differs between engines (design.md of add-mod-ui-capabilities, Browser
  // differences). `E2E_RUN` chooses the run (package.json scripts):
  // - default: every test but `@sample` in Chromium, and the `@frames` tests
  //   but `@sample` in Firefox and WebKit
  // - samples: the shipped samples' own tests (`@sample`) in all three
  // - full: every test in all three, before a release (docs/releasing.md)
  // Phone: the tests tagged `@mobile` depend on the device (touch, a pointer
  // that cannot hover), so they run only in the `mobile` project, a Pixel 7
  // in Chromium, in the default and full runs, never in the desktop ones.
  // Tests that depend only on the viewport's size run in the desktop
  // projects with `page.setViewportSize` (design.md of
  // fix-app-shell-on-phones, D9).
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      ...buildProjectFilters(e2eRun, true),
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      ...buildProjectFilters(e2eRun, false),
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      ...buildProjectFilters(e2eRun, false),
    },
    ...buildMobileProjects(e2eRun),
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
    buildInstantiationServer(
      "e2e-test-catalog",
      4176,
      TEST_CATALOG_PREVIEW_URL,
    ),
  ],
});
