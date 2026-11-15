import { vi } from "vitest";
import type { Mock } from "vitest";
import type { AppAction } from "../lib/core/engine/app_actions.ts";
import { ModMethodError } from "../lib/core/engine/engine_errors.ts";
import { buildTileBodies } from "../lib/core/engine/mod_tile_bodies.ts";
import type {
  ModCheckRequest,
  ModMethodContext,
  OpenLinkOutcome,
} from "../lib/core/engine/mod_methods.ts";
import type { SiteDecision } from "../lib/core/permissions/index.ts";
import type { LoadedMod, ModPermission } from "../lib/mod/index.ts";
import { createMemoryStorage } from "./memory_storage.ts";
import { APP_BASE_URL } from "./sample_files.ts";
import {
  APP_ORIGIN,
  TEST_DEFAULTS,
  TEST_MOD_API_RANGE,
  TEST_NPM_HOST,
} from "./sample_mods.ts";
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
    api: TEST_MOD_API_RANGE,
    description: "",
    entrypoint: `${APP_BASE_URL}default_mods/mod_explorer/main.js`,
    typeSource: null,
    sampleCollection: null,
    testSource: null,
    config: {},
    permissions,
    theme: "default",
    libraries: [],
    code: "",
  };
  return mod;
}

/** Calls `calling` and returns the `ModMethodError` it throws or rejects with. */
export async function catchMethodError(
  calling: () => unknown,
): Promise<ModMethodError> {
  try {
    await calling();
  } catch (error) {
    if (error instanceof ModMethodError) {
      return error;
    }
    throw error;
  }
  throw new Error("Expected a ModMethodError, but nothing was thrown");
}

/** The `readSiteDecisions` of tests where the user remembered nothing. */
export function readNoSiteDecisions(): SiteDecision[] {
  const decisions: SiteDecision[] = [];
  return decisions;
}

function acceptOpenLink(): OpenLinkOutcome {
  return "opened";
}

function acceptAction(): Promise<boolean> {
  return Promise.resolve(true);
}

/** The default `onCheckMod` of handler tests: a test that checks a mod sets its own. */
function failOnCheckMod(request: ModCheckRequest): never {
  throw new Error(
    `onCheckMod was called for "${request.source}", but the test does not expect a check`,
  );
}

function ignoreNotification(): void {
  // Handler tests that read notifications set their own `onNotify`.
}

/**
 * A method context for a mod on the app's origin with the given granted
 * permissions, a `Map`-backed storage, `fetchTestFile`, `TEST_NPM_HOST` and no remembered
 * site decision. The mod is
 * visible, and the user accepts every action.
 */
export function buildMethodContext(granted: ModPermission[]): ModMethodContext {
  const context: ModMethodContext = {
    mod: buildRequestingMod(granted),
    grants: { granted, denied: [] },
    storage: createMemoryStorage(),
    appOrigin: APP_ORIGIN,
    defaults: TEST_DEFAULTS,
    fetchOptions: {
      baseUrl: APP_BASE_URL,
      fetch: fetchTestFile,
      npmHost: TEST_NPM_HOST,
    },
    tileBodies: buildTileBodies([]),
    readSiteDecisions: readNoSiteDecisions,
    onOpenLink: acceptOpenLink,
    onRequestAction: acceptAction,
    onCheckMod: failOnCheckMod,
    onNotify: ignoreNotification,
  };
  return context;
}

export type RequestActionSpy = Mock<
  (action: AppAction) => Promise<boolean> | null
>;

/**
 * A method context whose `onRequestAction` is a spy: the user answers
 * `answer`, or `null` plays a mod whose sandbox is not the visible one.
 */
export function buildAskingContext(answer: boolean | null): {
  context: ModMethodContext;
  requestSpy: RequestActionSpy;
} {
  const context = buildMethodContext([]);
  const requestSpy: RequestActionSpy =
    vi.fn<(action: AppAction) => Promise<boolean> | null>();
  requestSpy.mockReturnValue(answer === null ? null : Promise.resolve(answer));
  context.onRequestAction = requestSpy;
  const askingContext = { context, requestSpy };
  return askingContext;
}
