import type { ModMethodContext } from "../lib/core/engine/mod_methods.ts";
import type { LoadedMod, ModPermission } from "../lib/mod/index.ts";
import { createMemoryStorage } from "./memory_storage.ts";
import { APP_BASE_URL } from "./sample_files.ts";
import { APP_ORIGIN, TEST_DEFAULTS } from "./sample_mods.ts";
import { fetchTestFile } from "./test_files.ts";

/** Source of the mod that sends requests in handler tests. */
export const REQUESTING_MOD_SOURCE = `${APP_BASE_URL}default_mods/mod_explorer/mod_conf.yaml`;

export function buildOpenPermission(host: string): ModPermission {
  const permission: ModPermission = {
    category: "open",
    host,
    reason: "Opens the mods you pick",
  };
  return permission;
}

/** A loaded mod with only the fields the handlers read filled in. */
export function buildRequestingMod(permissions: ModPermission[]): LoadedMod {
  const mod: LoadedMod = {
    source: REQUESTING_MOD_SOURCE,
    name: "mod_explorer",
    title: "Mods",
    version: "0.1.0",
    description: "",
    entrypoint: `${APP_BASE_URL}default_mods/mod_explorer/main.js`,
    typeSource: null,
    sampleCollection: null,
    config: {},
    permissions,
    theme: "default",
    code: "",
  };
  return mod;
}

function acceptOpenLink(): boolean {
  return true;
}

/**
 * A method context for a mod on the app's origin with the given granted
 * permissions, a `Map`-backed storage and `fetchTestFile`.
 */
export function buildMethodContext(granted: ModPermission[]): ModMethodContext {
  const context: ModMethodContext = {
    mod: buildRequestingMod(granted),
    grants: { granted, denied: [] },
    storage: createMemoryStorage(),
    appOrigin: APP_ORIGIN,
    defaults: TEST_DEFAULTS,
    fetchOptions: { baseUrl: APP_BASE_URL, fetch: fetchTestFile },
    onOpenLink: acceptOpenLink,
  };
  return context;
}
