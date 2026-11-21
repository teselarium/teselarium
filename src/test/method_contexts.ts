import { vi } from "vitest";
import type { Mock } from "vitest";
import type { AppAction } from "../lib/core/engine/app_actions.ts";
import type { Catalog } from "../lib/core/engine/catalog.ts";
import { ModMethodError } from "../lib/core/engine/engine_errors.ts";
import { checkModBundle } from "../lib/core/engine/mod_bundle_check.ts";
import { buildModCheckReport } from "../lib/core/engine/mod_check_report.ts";
import type { ModCheckReport } from "../lib/core/engine/mod_check_report.ts";
import { buildTileBodies } from "../lib/core/engine/mod_tile_bodies.ts";
import { isMosaicCheckTarget } from "../lib/core/engine/mod_methods.ts";
import type {
  ModCheckRequest,
  ModMethodContext,
  OpenLinkOutcome,
} from "../lib/core/engine/mod_methods.ts";
import type { SiteDecision } from "../lib/core/permissions/index.ts";
import type { LoadedMod, ModPermission } from "../lib/mod/index.ts";
import type { UserCatalogEntry } from "../lib/user_catalog/index.ts";
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
    title: "Mods",
    version: "0.1.0",
    api: TEST_MOD_API_RANGE,
    description: "",
    entrypoint: `${APP_BASE_URL}default_mods/mod_explorer/main.js`,
    typeSource: null,
    defaultMosaic: null,
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

/** The `readCatalog` of handler and session tests: an empty catalog. A test that reads the catalog sets its own. */
export function readEmptyCatalog(): Promise<Catalog> {
  const catalog: Catalog = { mods: [], collections: [], mosaics: [] };
  return Promise.resolve(catalog);
}

/** The `readUserCatalog` of handler tests: an empty user catalog. A test that reads it sets its own. */
export function readEmptyUserCatalog(): readonly UserCatalogEntry[] {
  const entries: UserCatalogEntry[] = [];
  return entries;
}

function acceptOpenLink(): OpenLinkOutcome {
  return "opened";
}

function acceptAction(): Promise<boolean> {
  return Promise.resolve(true);
}

/** The file a check request names: its mosaic, or its mod. */
export function describeCheckRequest(request: ModCheckRequest): string {
  return isMosaicCheckTarget(request) ? request.mosaic : request.source;
}

/** A passing report of the request's mod or mosaic, as a spied `onCheckMod` answers it. */
export function resolvePassingReport(
  request: ModCheckRequest,
): Promise<ModCheckReport> {
  const checkedFiles = isMosaicCheckTarget(request)
    ? { source: null, mosaic: request.mosaic }
    : { source: request.source, mosaic: null };
  const report = buildModCheckReport(checkedFiles, [], true, null);
  return Promise.resolve(report);
}

/** An `onCheckMod` that runs only the bundle check, as the stage does before mounting. */
export async function checkBundleOnly(
  context: ModMethodContext,
  request: ModCheckRequest,
): Promise<ModCheckReport> {
  const bundleCheck = await checkModBundle(
    request,
    context.defaults,
    context.fetchOptions,
  );
  const report = buildModCheckReport(
    { source: bundleCheck.source, mosaic: bundleCheck.mosaicSource },
    bundleCheck.findings,
    false,
    null,
  );
  return report;
}

/** The default `onCheckMod` of handler tests: a test that checks a mod sets its own. */
function failOnCheckMod(request: ModCheckRequest): never {
  throw new Error(
    `onCheckMod was called for "${describeCheckRequest(request)}", but the test does not expect a check`,
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
    storageSlot: { mod: REQUESTING_MOD_SOURCE, context: "" },
    appOrigin: APP_ORIGIN,
    defaults: TEST_DEFAULTS,
    fetchOptions: {
      baseUrl: APP_BASE_URL,
      fetch: fetchTestFile,
      npmHost: TEST_NPM_HOST,
    },
    tileBodies: buildTileBodies([]),
    readSiteDecisions: readNoSiteDecisions,
    readCatalog: readEmptyCatalog,
    readUserCatalog: readEmptyUserCatalog,
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
