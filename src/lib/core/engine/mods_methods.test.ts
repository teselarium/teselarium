import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  buildMethodContext,
  buildOpenPermission,
  checkBundleOnly,
  resolvePassingReport,
} from "../../../test/method_contexts.ts";
import { APP_BASE_URL } from "../../../test/sample_files.ts";
import {
  APP_ORIGIN,
  buildSampleCoversDecision,
  MISSING_MOD_REFERENCE,
  MISSING_MOD_SOURCE,
  OTHER_API_MOD_SOURCE,
  OTHER_API_RANGE,
  OTHER_APP_ORIGIN,
  SAMPLE_COLLECTION_REFERENCE,
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_DEFAULT_MOSAIC_SOURCE,
  SAMPLE_COVERS_PERMISSION,
  SAMPLE_MOD_REFERENCE,
  SAMPLE_MOD_SOURCE,
  serveOtherApiMod,
  serveUntypedMod,
  UNTYPED_MOD_SOURCE,
} from "../../../test/sample_mods.ts";
import { fetchTestFile, testTexts } from "../../../test/test_files.ts";
import type { SiteDecision } from "../permissions/index.ts";
import { resolveDefaultModSettings } from "./default_mod_settings.ts";
import { ModMethodError } from "./engine_errors.ts";
import type { ModCheckReport } from "./mod_check_report.ts";
import type { RunLink } from "./mod_launch.ts";
import {
  INVALID_PARAMS,
  LOAD_FAILED,
  MOD_SWITCHED_OFF,
  PERMISSION_DENIED,
} from "./mod_messages.ts";
import type {
  ModCheckRequest,
  ModMethodContext,
  OpenLinkOptions,
  OpenLinkOutcome,
} from "./mod_methods.ts";
import { MODS_METHODS } from "./mods_methods.ts";

const VIEWER_TARGET = SAMPLE_MOD_SOURCE;
const CLOCK_MOD_SOURCE = "https://example.org/mods/clock/mod_conf.yaml";
const CLOCK_TEST_SOURCE = "https://example.org/mods/clock/test.js";

afterEach(function clearTestTexts(): void {
  testTexts.clear();
});

function inspect(context: ModMethodContext, params: object): Promise<unknown> {
  return MODS_METHODS["mods.inspect"](context, params as never);
}

function open(context: ModMethodContext, params: object): Promise<unknown> {
  return MODS_METHODS["mods.open"](context, params as never);
}

function check(context: ModMethodContext, params: object): Promise<unknown> {
  return MODS_METHODS["mods.check"](context, params as never);
}

async function catchMethodError(
  calling: Promise<unknown>,
): Promise<ModMethodError> {
  try {
    await calling;
  } catch (error) {
    if (error instanceof ModMethodError) {
      return error;
    }
    throw error;
  }
  throw new Error("Expected the request to fail, but it passed");
}

type OpenLinkSpy = Mock<
  (link: RunLink, options: OpenLinkOptions) => OpenLinkOutcome
>;

/** A context whose fetch and `onOpenLink` are spies. `onOpenLink` gives `outcome`. */
function buildSpiedContext(
  hosts: string[],
  outcome: OpenLinkOutcome = "opened",
): {
  context: ModMethodContext;
  fetchSpy: Mock<typeof fetch>;
  openLinkSpy: OpenLinkSpy;
} {
  const permissions = [];
  for (const host of hosts) {
    permissions.push(buildOpenPermission(host));
  }
  const context = buildMethodContext(permissions);
  const fetchSpy = vi.fn<typeof fetch>(fetchTestFile);
  const openLinkSpy: OpenLinkSpy =
    vi.fn<(link: RunLink, options: OpenLinkOptions) => OpenLinkOutcome>();
  openLinkSpy.mockReturnValue(outcome);
  context.fetchOptions = { baseUrl: APP_BASE_URL, fetch: fetchSpy };
  context.onOpenLink = openLinkSpy;
  const spiedContext = { context, fetchSpy, openLinkSpy };
  return spiedContext;
}

/** The `readSiteDecisions` of a user who remembered Allow for the sample mod's covers. */
function readCoversAllow(): SiteDecision[] {
  const decisions = [buildSampleCoversDecision(true)];
  return decisions;
}

function switchViewerOff(context: ModMethodContext): void {
  context.defaults = resolveDefaultModSettings(
    {
      folder: "./default_mods/",
      switchedOff: ["mod_viewer"],
    },
    APP_BASE_URL,
  );
}

type CheckModSpy = Mock<
  (request: ModCheckRequest) => Promise<ModCheckReport> | null
>;

/** A context whose `onCheckMod` is a spy: it answers a passing report, or `null` for a hidden mod. */
function buildCheckingContext(
  hosts: string[],
  isVisible: boolean = true,
): {
  context: ModMethodContext;
  fetchSpy: Mock<typeof fetch>;
  checkSpy: CheckModSpy;
} {
  const { context, fetchSpy } = buildSpiedContext(hosts);
  const checkSpy: CheckModSpy =
    vi.fn<(request: ModCheckRequest) => Promise<ModCheckReport> | null>();
  if (isVisible) {
    checkSpy.mockImplementation(resolvePassingReport);
  } else {
    checkSpy.mockReturnValue(null);
  }
  context.onCheckMod = checkSpy;
  const checkingContext = { context, fetchSpy, checkSpy };
  return checkingContext;
}

describe("mods.inspect", function describeModsInspect(): void {
  it("Inspect the sample mod", async function inspectsSampleMod(): Promise<void> {
    const { context } = buildSpiedContext(["https://example.org"]);

    const inspection = await inspect(context, {
      mod: SAMPLE_MOD_REFERENCE,
    });

    expect(inspection).toMatchObject({
      source: SAMPLE_MOD_SOURCE,
      title: "Book List",
      defaultMosaic: SAMPLE_DEFAULT_MOSAIC_SOURCE,
      permissions: { granted: [SAMPLE_COVERS_PERMISSION], denied: [] },
      api: "^0.1.0",
      apiCompatible: true,
    });
  });

  it("Inspect a mod with tests", async function inspectsModWithTests(): Promise<void> {
    const { context, fetchSpy } = buildSpiedContext(["https://example.org"]);
    testTexts.set(
      CLOCK_MOD_SOURCE,
      'mod:\n  title: "clock"\n  version: "1.0.0"\n  entrypoint: "./main.js"\n  test_path: "./test.js"',
    );

    const inspection = await inspect(context, { mod: CLOCK_MOD_SOURCE });

    expect(inspection).toMatchObject({ testSource: CLOCK_TEST_SOURCE });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("Inspect a mod without tests", async function inspectsModWithoutTests(): Promise<void> {
    const { context } = buildSpiedContext(["https://example.org"]);
    serveUntypedMod();

    const inspection = await inspect(context, { mod: UNTYPED_MOD_SOURCE });

    expect(inspection).toMatchObject({ testSource: null });
  });

  it("Inspect a mod for another API", async function inspectsOtherApiMod(): Promise<void> {
    const { context, openLinkSpy } = buildSpiedContext(["https://example.org"]);
    serveOtherApiMod();

    const inspection = await inspect(context, { mod: OTHER_API_MOD_SOURCE });

    expect(inspection).toMatchObject({
      api: OTHER_API_RANGE,
      apiCompatible: false,
    });
    expect(openLinkSpy).not.toHaveBeenCalled();
  });

  it("Inspect a mod without a range", async function inspectsModWithoutRange(): Promise<void> {
    const { context } = buildSpiedContext(["https://example.org"]);
    serveUntypedMod(null);

    const inspection = await inspect(context, { mod: UNTYPED_MOD_SOURCE });

    expect(inspection).toMatchObject({ api: null, apiCompatible: null });
  });

  it("Same reference from two mods", async function resolvesAgainstApp(): Promise<void> {
    const { context } = buildSpiedContext(["*"]);
    context.mod = {
      ...context.mod,
      source: `${APP_BASE_URL}default_mods/mod_viewer/mod_conf.yaml`,
    };

    const inspection = await inspect(context, {
      mod: SAMPLE_MOD_REFERENCE,
    });

    expect(inspection).toMatchObject({ source: SAMPLE_MOD_SOURCE });
  });

  it("Inspect a missing mod", async function reportsMissingMod(): Promise<void> {
    const { context } = buildSpiedContext(["https://example.org"]);

    const error = await catchMethodError(
      inspect(context, { mod: MISSING_MOD_REFERENCE }),
    );

    expect(error.code).toBe(LOAD_FAILED);
    expect(error.message).toContain(MISSING_MOD_SOURCE);
    expect(error.message).toContain("404");
  });

  it("Mod without the open permission", async function refusesWithoutGrant(): Promise<void> {
    const { context, fetchSpy } = buildSpiedContext([]);

    const error = await catchMethodError(
      inspect(context, { mod: "https://mods.example.net/clock/" }),
    );

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toContain("https://mods.example.net");
    expect(error.message).toContain("permissions.open");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Any site", async function inspectsAnySite(): Promise<void> {
    const { context, fetchSpy } = buildSpiedContext(["*"]);
    testTexts.set(
      "https://mods.example.net/clock/mod_conf.yaml",
      'mod:\n  title: "clock"\n  version: "1.0.0"\n  entrypoint: "./main.js"',
    );

    const inspection = await inspect(context, {
      mod: "https://mods.example.net/clock/",
    });

    expect(inspection).toMatchObject({ title: "clock" });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("Inspect a foreign mod with a remembered allow", async function inspectsRememberedAllow(): Promise<void> {
    const { context } = buildSpiedContext(["*"]);
    context.appOrigin = OTHER_APP_ORIGIN;
    context.readSiteDecisions = readCoversAllow;

    const inspection = await inspect(context, { mod: SAMPLE_MOD_SOURCE });

    expect(inspection).toMatchObject({
      permissions: { granted: [SAMPLE_COVERS_PERMISSION], denied: [] },
    });
  });

  it("refuses a foreign mod's denied grant before any request", async function refusesDeniedGrant(): Promise<void> {
    const { context, fetchSpy } = buildSpiedContext([]);
    context.grants = { granted: [], denied: [buildOpenPermission("*")] };

    const error = await catchMethodError(
      inspect(context, { mod: SAMPLE_MOD_REFERENCE }),
    );

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toContain("the permission was not granted");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses a switched-off mod before any request", async function refusesSwitchedOff(): Promise<void> {
    const { context, fetchSpy } = buildSpiedContext(["*"]);
    switchViewerOff(context);

    const error = await catchMethodError(
      inspect(context, { mod: "mod_viewer" }),
    );

    expect(error.code).toBe(MOD_SWITCHED_OFF);
    expect(error.message).toContain("mod_viewer");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a missing mod reference", async function rejectsMissingReference(): Promise<void> {
    const { context } = buildSpiedContext(["*"]);

    const error = await catchMethodError(inspect(context, {}));

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'mods.inspect: "mod" must be a non-empty string',
    );
  });
});

describe("mods.open", function describeModsOpen(): void {
  it("passes the link to onOpenLink and answers null", async function opensLink(): Promise<void> {
    const { context, openLinkSpy } = buildSpiedContext(["*"]);

    const result = await open(context, {
      mod: "mod_viewer",
      collection: SAMPLE_COLLECTION_REFERENCE,
      params: { target: VIEWER_TARGET },
    });

    expect(result).toBeNull();
    expect(openLinkSpy).toHaveBeenCalledExactlyOnceWith(
      {
        mod: "mod_viewer",
        collection: SAMPLE_COLLECTION_REFERENCE,
        tile: null,
        params: { target: VIEWER_TARGET },
      },
      { replace: false },
    );
  });

  it("defaults the collection and the tile to null, the params to {} and replace to false", async function defaultsLink(): Promise<void> {
    const { context, openLinkSpy } = buildSpiedContext(["*"]);

    await open(context, { mod: SAMPLE_MOD_REFERENCE });

    expect(openLinkSpy).toHaveBeenCalledExactlyOnceWith(
      { mod: SAMPLE_MOD_REFERENCE, collection: null, tile: null, params: {} },
      { replace: false },
    );
  });

  it("Collection viewer opens a tile", async function opensTile(): Promise<void> {
    const { context, openLinkSpy } = buildSpiedContext(["*"]);

    const result = await open(context, {
      mod: "tile_viewer",
      tile: "https://example.org/fixtures/tiles/books/kallocain.md",
      params: { from: SAMPLE_COLLECTION_SOURCE },
    });

    expect(result).toBeNull();
    expect(openLinkSpy).toHaveBeenCalledExactlyOnceWith(
      {
        mod: "tile_viewer",
        collection: null,
        tile: "https://example.org/fixtures/tiles/books/kallocain.md",
        params: { from: SAMPLE_COLLECTION_SOURCE },
      },
      { replace: false },
    );
  });

  it("passes replace to onOpenLink", async function passesReplace(): Promise<void> {
    const { context, openLinkSpy } = buildSpiedContext(["*"]);

    await open(context, { mod: "tile_viewer", tile: "./a.md", replace: true });

    expect(openLinkSpy).toHaveBeenCalledExactlyOnceWith(
      { mod: "tile_viewer", collection: null, tile: "./a.md", params: {} },
      { replace: true },
    );
  });

  it("accepts an explicit null tile and replace false", async function acceptsNullTile(): Promise<void> {
    const { context, openLinkSpy } = buildSpiedContext(["*"]);

    await open(context, { mod: "mod_viewer", tile: null, replace: false });

    expect(openLinkSpy.mock.calls[0][0].tile).toBeNull();
    expect(openLinkSpy.mock.calls[0][1]).toEqual({ replace: false });
  });

  it("Collection and tile", async function rejectsCollectionAndTile(): Promise<void> {
    const { context, openLinkSpy } = buildSpiedContext(["*"]);

    const error = await catchMethodError(
      open(context, {
        mod: "tile_viewer",
        collection: SAMPLE_COLLECTION_REFERENCE,
        tile: "./a.md",
      }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'mods.open: a link cannot have both "collection" and "tile"',
    );
    expect(openLinkSpy).not.toHaveBeenCalled();
  });

  it("Reserved parameter", async function rejectsReservedParams(): Promise<void> {
    const { context, openLinkSpy } = buildSpiedContext(["*"]);

    for (const name of ["mod", "collection", "tile"]) {
      const error = await catchMethodError(
        open(context, { mod: "tile_viewer", params: { [name]: "./a.md" } }),
      );

      expect(error.code).toBe(INVALID_PARAMS);
      expect(error.message).toBe(`mods.open: "params.${name}" is reserved`);
    }
    expect(openLinkSpy).not.toHaveBeenCalled();
  });

  it("Mosaic is a reserved parameter", async function rejectsMosaicParam(): Promise<void> {
    const { context, openLinkSpy } = buildSpiedContext(["*"]);

    const error = await catchMethodError(
      open(context, { mod: "tile_viewer", params: { mosaic: "./m.yaml" } }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe('mods.open: "params.mosaic" is reserved');
    expect(openLinkSpy).not.toHaveBeenCalled();
  });

  it("Replace that is not a boolean", async function rejectsReplaceText(): Promise<void> {
    const { context, openLinkSpy } = buildSpiedContext(["*"]);

    const error = await catchMethodError(
      open(context, { mod: "tile_viewer", replace: "yes" }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe('mods.open: "replace" must be a boolean');
    expect(openLinkSpy).not.toHaveBeenCalled();
  });

  it("rejects an empty tile", async function rejectsEmptyTile(): Promise<void> {
    const { context } = buildSpiedContext(["*"]);

    const error = await catchMethodError(
      open(context, { mod: "tile_viewer", tile: "" }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'mods.open: "tile" must be null or a non-empty string',
    );
  });

  it("Home mod cannot be replaced", async function refusesHomeMod(): Promise<void> {
    const { context } = buildSpiedContext(["*"], "home-mod");

    const error = await catchMethodError(
      open(context, { mod: "tile_viewer", replace: true }),
    );

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toBe("mods.open: the home mod cannot be replaced");
  });

  it("Hidden mod cannot replace itself", async function refusesHiddenReplace(): Promise<void> {
    const { context } = buildSpiedContext(["*"], "not-visible");

    const error = await catchMethodError(
      open(context, { mod: "tile_viewer", replace: true }),
    );

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toBe("mods.open: only the visible mod can open mods");
  });

  it("accepts an explicit null collection", async function acceptsNullCollection(): Promise<void> {
    const { context, openLinkSpy } = buildSpiedContext(["*"]);

    await open(context, { mod: "mod_viewer", collection: null });

    expect(openLinkSpy.mock.calls[0][0].collection).toBeNull();
  });

  it("makes no request", async function opensWithoutFetch(): Promise<void> {
    const { context, fetchSpy } = buildSpiedContext(["*"]);

    await open(context, { mod: MISSING_MOD_REFERENCE });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Missing mod reference", async function rejectsMissingMod(): Promise<void> {
    const { context, openLinkSpy } = buildSpiedContext(["*"]);

    const error = await catchMethodError(
      open(context, { collection: SAMPLE_COLLECTION_REFERENCE }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe('mods.open: "mod" must be a non-empty string');
    expect(openLinkSpy).not.toHaveBeenCalled();
  });

  it("Parameter that is not a string", async function rejectsNumberParam(): Promise<void> {
    const { context } = buildSpiedContext(["*"]);

    const error = await catchMethodError(
      open(context, { mod: "mod_viewer", params: { target: 3 } }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe('mods.open: "params.target" must be a string');
  });

  it("rejects params that are not a mapping", async function rejectsParamsList(): Promise<void> {
    const { context } = buildSpiedContext(["*"]);

    const error = await catchMethodError(
      open(context, { mod: "mod_viewer", params: ["x"] }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe('mods.open: "params" must be a mapping');
  });

  it("rejects an empty collection", async function rejectsEmptyCollection(): Promise<void> {
    const { context } = buildSpiedContext(["*"]);

    const error = await catchMethodError(
      open(context, { mod: "mod_viewer", collection: "" }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'mods.open: "collection" must be null or a non-empty string',
    );
  });

  it("Hidden mod tries to open a mod", async function refusesHiddenMod(): Promise<void> {
    const { context } = buildSpiedContext(["*"], "not-visible");

    const error = await catchMethodError(open(context, { mod: "mod_viewer" }));

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toBe("mods.open: only the visible mod can open mods");
  });

  it("refuses a mod without the grant", async function refusesWithoutGrant(): Promise<void> {
    const { context, openLinkSpy } = buildSpiedContext([]);

    const error = await catchMethodError(
      open(context, { mod: "https://mods.example.net/clock/" }),
    );

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(openLinkSpy).not.toHaveBeenCalled();
  });

  it("Foreign mod declares open", async function refusesForeignMod(): Promise<void> {
    const { context, openLinkSpy } = buildSpiedContext([]);
    context.grants = { granted: [], denied: [buildOpenPermission("*")] };

    const error = await catchMethodError(open(context, { mod: "mod_viewer" }));

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toContain("the permission was not granted");
    expect(openLinkSpy).not.toHaveBeenCalled();
  });

  it("Viewer switched off", async function refusesSwitchedOff(): Promise<void> {
    const { context, openLinkSpy } = buildSpiedContext(["*"]);
    switchViewerOff(context);

    const error = await catchMethodError(
      open(context, { mod: "./default_mods/mod_viewer/mod_conf.yaml" }),
    );

    expect(error.code).toBe(MOD_SWITCHED_OFF);
    expect(error.message).toContain("mod_viewer");
    expect(openLinkSpy).not.toHaveBeenCalled();
  });
});

describe("Check a mod", function describeCheckMod(): void {
  it("asks the stage with the resolved source and answers the report", async function checksMod(): Promise<void> {
    const { context, checkSpy } = buildCheckingContext(["*"]);

    const report = await check(context, {
      mod: SAMPLE_MOD_REFERENCE,
      collection: SAMPLE_COLLECTION_REFERENCE,
    });

    expect(checkSpy).toHaveBeenCalledExactlyOnceWith({
      source: SAMPLE_MOD_SOURCE,
      collection: SAMPLE_COLLECTION_REFERENCE,
    });
    expect(report).toEqual({
      source: SAMPLE_MOD_SOURCE,
      mosaic: null,
      status: "pass",
      mountChecked: true,
      testsChecked: false,
      tests: [],
      findings: [],
    });
  });

  it("defaults the collection to null", async function defaultsCollection(): Promise<void> {
    const { context, checkSpy } = buildCheckingContext(["*"]);

    await check(context, { mod: SAMPLE_MOD_REFERENCE, collection: null });

    expect(checkSpy).toHaveBeenCalledExactlyOnceWith({
      source: SAMPLE_MOD_SOURCE,
      collection: null,
    });
  });
});

describe("Check requests follow the inspect rules", function describeCheckRules(): void {
  it("Mod without the open permission", async function refusesWithoutGrant(): Promise<void> {
    const { context, fetchSpy, checkSpy } = buildCheckingContext([]);

    const error = await catchMethodError(
      check(context, { mod: "https://mods.example.net/clock/" }),
    );

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toContain("https://mods.example.net");
    expect(error.message).toContain("permissions.open");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(checkSpy).not.toHaveBeenCalled();
  });

  it("Hidden mod asks for a check", async function refusesHiddenMod(): Promise<void> {
    const { context } = buildCheckingContext(["*"], false);

    const error = await catchMethodError(
      check(context, { mod: SAMPLE_MOD_REFERENCE }),
    );

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toBe(
      "mods.check: only the visible mod can check mods",
    );
  });

  it("Switched-off mod", async function refusesSwitchedOff(): Promise<void> {
    const { context, fetchSpy, checkSpy } = buildCheckingContext(["*"]);
    switchViewerOff(context);

    const error = await catchMethodError(
      check(context, { mod: "./default_mods/mod_viewer/" }),
    );

    expect(error.code).toBe(MOD_SWITCHED_OFF);
    expect(error.message).toContain("mod_viewer");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(checkSpy).not.toHaveBeenCalled();
  });

  it("Missing mod reference", async function rejectsMissingReference(): Promise<void> {
    const { context, checkSpy } = buildCheckingContext(["*"]);

    const error = await catchMethodError(check(context, {}));

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe('mods.check: "mod" must be a non-empty string');
    expect(checkSpy).not.toHaveBeenCalled();
  });

  it("rejects a collection that is not a non-empty string", async function rejectsBadCollection(): Promise<void> {
    const { context, checkSpy } = buildCheckingContext(["*"]);

    const emptyError = await catchMethodError(
      check(context, { mod: SAMPLE_MOD_REFERENCE, collection: "" }),
    );
    const numberError = await catchMethodError(
      check(context, { mod: SAMPLE_MOD_REFERENCE, collection: 3 }),
    );

    for (const error of [emptyError, numberError]) {
      expect(error.code).toBe(INVALID_PARAMS);
      expect(error.message).toBe(
        'mods.check: "collection" must be null or a non-empty string',
      );
    }
    expect(checkSpy).not.toHaveBeenCalled();
  });
});

describe("Bundle check", function describeBundleCheck(): void {
  it("Missing mod file", async function reportsMissingModFile(): Promise<void> {
    const context = buildMethodContext([buildOpenPermission(APP_ORIGIN)]);
    context.onCheckMod = checkBundleOnly.bind(undefined, context);

    const report = await check(context, { mod: MISSING_MOD_REFERENCE });

    expect(report).toMatchObject({
      source: MISSING_MOD_SOURCE,
      status: "fail",
      mountChecked: false,
    });
    const findings = (report as ModCheckReport).findings;
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      step: "bundle",
      level: "error",
      source: MISSING_MOD_SOURCE,
    });
    expect(findings[0].message).toContain("404");
  });
});
