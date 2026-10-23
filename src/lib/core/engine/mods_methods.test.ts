import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  buildMethodContext,
  buildOpenPermission,
} from "../../../test/method_contexts.ts";
import { APP_BASE_URL } from "../../../test/sample_files.ts";
import {
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_COVERS_PERMISSION,
  SAMPLE_MOD_SOURCE,
} from "../../../test/sample_mods.ts";
import { fetchTestFile, testTexts } from "../../../test/test_files.ts";
import { resolveDefaultModSettings } from "./default_mod_settings.ts";
import { ModMethodError } from "./engine_errors.ts";
import type { RunLink } from "./mod_launch.ts";
import {
  INVALID_PARAMS,
  LOAD_FAILED,
  MOD_SWITCHED_OFF,
  PERMISSION_DENIED,
} from "./mod_messages.ts";
import type { ModMethodContext } from "./mod_methods.ts";
import { MODS_METHODS } from "./mods_methods.ts";

const VIEWER_TARGET = SAMPLE_MOD_SOURCE;

afterEach(function clearTestTexts(): void {
  testTexts.clear();
});

function inspect(context: ModMethodContext, params: object): Promise<unknown> {
  return MODS_METHODS["mods.inspect"](context, params as never);
}

function open(context: ModMethodContext, params: object): Promise<unknown> {
  return MODS_METHODS["mods.open"](context, params as never);
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

/** A context whose fetch and `onOpenLink` are spies. */
function buildSpiedContext(
  hosts: string[],
  isVisible: boolean = true,
): {
  context: ModMethodContext;
  fetchSpy: Mock<typeof fetch>;
  openLinkSpy: Mock<(link: RunLink) => boolean>;
} {
  const permissions = [];
  for (const host of hosts) {
    permissions.push(buildOpenPermission(host));
  }
  const context = buildMethodContext(permissions);
  const fetchSpy = vi.fn<typeof fetch>(fetchTestFile);
  const openLinkSpy = vi.fn<(link: RunLink) => boolean>();
  openLinkSpy.mockReturnValue(isVisible);
  context.fetchOptions = { baseUrl: APP_BASE_URL, fetch: fetchSpy };
  context.onOpenLink = openLinkSpy;
  const spiedContext = { context, fetchSpy, openLinkSpy };
  return spiedContext;
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

describe("mods.inspect", function describeModsInspect(): void {
  it("Inspect the sample mod", async function inspectsSampleMod(): Promise<void> {
    const { context } = buildSpiedContext(["https://example.org"]);

    const inspection = await inspect(context, {
      mod: "./samples/mods/book_list",
    });

    expect(inspection).toMatchObject({
      source: SAMPLE_MOD_SOURCE,
      title: "Book List",
      sampleCollection: SAMPLE_COLLECTION_SOURCE,
      permissions: { granted: [SAMPLE_COVERS_PERMISSION], denied: [] },
    });
  });

  it("Same reference from two mods", async function resolvesAgainstApp(): Promise<void> {
    const { context } = buildSpiedContext(["*"]);
    context.mod = {
      ...context.mod,
      source: `${APP_BASE_URL}default_mods/mod_viewer/mod_conf.yaml`,
    };

    const inspection = await inspect(context, {
      mod: "./samples/mods/book_list",
    });

    expect(inspection).toMatchObject({ source: SAMPLE_MOD_SOURCE });
  });

  it("Inspect a missing mod", async function reportsMissingMod(): Promise<void> {
    const { context } = buildSpiedContext(["https://example.org"]);

    const error = await catchMethodError(
      inspect(context, { mod: "./samples/mods/missing" }),
    );

    expect(error.code).toBe(LOAD_FAILED);
    expect(error.message).toContain(
      "https://example.org/samples/mods/missing/mod_conf.yaml",
    );
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
      'mod:\n  name: "clock"\n  version: "1.0.0"\n  entrypoint: "./main.js"',
    );

    const inspection = await inspect(context, {
      mod: "https://mods.example.net/clock/",
    });

    expect(inspection).toMatchObject({ name: "clock" });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("refuses a foreign mod's denied grant before any request", async function refusesDeniedGrant(): Promise<void> {
    const { context, fetchSpy } = buildSpiedContext([]);
    context.grants = { granted: [], denied: [buildOpenPermission("*")] };

    const error = await catchMethodError(
      inspect(context, { mod: "./samples/mods/book_list" }),
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
      collection: "./samples/tiles/books_collection.yaml",
      params: { target: VIEWER_TARGET },
    });

    expect(result).toBeNull();
    expect(openLinkSpy).toHaveBeenCalledExactlyOnceWith({
      mod: "mod_viewer",
      collection: "./samples/tiles/books_collection.yaml",
      params: { target: VIEWER_TARGET },
    });
  });

  it("defaults the collection to null and the params to {}", async function defaultsLink(): Promise<void> {
    const { context, openLinkSpy } = buildSpiedContext(["*"]);

    await open(context, { mod: "./samples/mods/book_list" });

    expect(openLinkSpy).toHaveBeenCalledExactlyOnceWith({
      mod: "./samples/mods/book_list",
      collection: null,
      params: {},
    });
  });

  it("accepts an explicit null collection", async function acceptsNullCollection(): Promise<void> {
    const { context, openLinkSpy } = buildSpiedContext(["*"]);

    await open(context, { mod: "mod_viewer", collection: null });

    expect(openLinkSpy.mock.calls[0][0].collection).toBeNull();
  });

  it("makes no request", async function opensWithoutFetch(): Promise<void> {
    const { context, fetchSpy } = buildSpiedContext(["*"]);

    await open(context, { mod: "./samples/mods/missing" });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Missing mod reference", async function rejectsMissingMod(): Promise<void> {
    const { context, openLinkSpy } = buildSpiedContext(["*"]);

    const error = await catchMethodError(
      open(context, { collection: "./samples/tiles/books_collection.yaml" }),
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
    const { context } = buildSpiedContext(["*"], false);

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
