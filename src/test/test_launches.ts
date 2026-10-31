import {
  buildModLaunch,
  loadModLaunchInputs,
} from "../lib/core/engine/index.ts";
import type {
  ModLaunch,
  ResolvedDefaultModSettings,
  RunLink,
} from "../lib/core/engine/index.ts";
import type { FileFetchOptions } from "../lib/files/index.ts";
import { grantModPermissions } from "../lib/core/permissions/index.ts";
import type { SiteDecision } from "../lib/core/permissions/index.ts";
import { APP_BASE_URL } from "./sample_files.ts";
import { APP_ORIGIN, TEST_DEFAULTS } from "./sample_mods.ts";
import { fetchTestFile } from "./test_files.ts";

/** How a test launch differs from the sample defaults. Every field is optional. */
export interface TestLaunchOptions {
  appOrigin?: string;
  defaults?: ResolvedDefaultModSettings;
  decisions?: SiteDecision[];
  loadsTileLinkedMedia?: boolean;
  fetchOptions?: FileFetchOptions;
}

/**
 * Loads a mod as the stage does and builds its launch with the grants of
 * `decisions`: by default on `APP_ORIGIN`, with `TEST_DEFAULTS`, no decision,
 * "Load media linked by tiles" on and `fetchTestFile` at `APP_BASE_URL`.
 */
export async function launchTestMod(
  link: RunLink,
  options: TestLaunchOptions = {},
): Promise<ModLaunch> {
  const inputs = await loadModLaunchInputs(
    { link, defaults: options.defaults ?? TEST_DEFAULTS },
    options.fetchOptions ?? { baseUrl: APP_BASE_URL, fetch: fetchTestFile },
  );
  const grants = grantModPermissions(
    inputs.mod,
    options.appOrigin ?? APP_ORIGIN,
    options.decisions ?? [],
  );
  const launch = buildModLaunch(
    inputs.mod,
    inputs.link,
    inputs.modTiles,
    grants,
    options.loadsTileLinkedMedia ?? true,
  );
  return launch;
}
