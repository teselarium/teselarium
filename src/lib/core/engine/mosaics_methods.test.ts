import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  buildMethodContext,
  buildOpenPermission,
  catchMethodError,
} from "../../../test/method_contexts.ts";
import { APP_BASE_URL, FIXTURES_BASE_URL } from "../../../test/sample_files.ts";
import {
  APP_ORIGIN,
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_MOD_SOURCE,
  serveTestMosaic,
} from "../../../test/sample_mods.ts";
import {
  fetchTestFile,
  readRequestedUrl,
  testTexts,
} from "../../../test/test_files.ts";
import type { SiteDecision } from "../permissions/index.ts";
import type { RunLink } from "./mod_launch.ts";
import {
  INVALID_PARAMS,
  LOAD_FAILED,
  PERMISSION_DENIED,
} from "./mod_messages.ts";
import type {
  ModMethodContext,
  OpenLinkOptions,
  OpenLinkOutcome,
} from "./mod_methods.ts";
import { MOSAICS_METHODS } from "./mosaics_methods.ts";

const MAP_MOSAIC_REFERENCE = "./fixtures/mosaics/nobel_map";
const MAP_MOSAIC_SOURCE = `${FIXTURES_BASE_URL}mosaics/nobel_map/mosaic.yaml`;
const MAP_MOSAIC_FILE_REFERENCE = "./fixtures/mosaics/nobel_map/mosaic.yaml";
const FOREIGN_MOSAIC_SOURCE = "https://mosaics.example.net/maps/mosaic.yaml";
const COVERS_LINE = {
  category: "show",
  host: "https://covers.openlibrary.org",
  reason: "Shows the book covers",
} as const;

const MAP_MOSAIC_LINES = [
  'title: "Laureates on the map"',
  'description: "Where each laureate was born."',
  'mod: "../../mods/book_list"',
  'collection: "../../tiles/books_collection.yaml"',
  "config:",
  "  show_covers: false",
  "aliases:",
  '  title: ["name"]',
  "permissions:",
  "  show:",
  `    - host: "${COVERS_LINE.host}"`,
  `      reason: "${COVERS_LINE.reason}"`,
];

afterEach(function clearTestTexts(): void {
  testTexts.clear();
});

function callMosaicMethod(
  method: string,
  context: ModMethodContext,
  params: object,
): Promise<unknown> {
  return MOSAICS_METHODS[method](context, params as never);
}

/** A context granted `open` for `hosts`, whose fetch and `onOpenLink` are spies. */
function buildSpiedContext(
  hosts: string[],
  outcome: OpenLinkOutcome = "opened",
): {
  context: ModMethodContext;
  fetchSpy: Mock<typeof fetch>;
  onOpenLink: Mock<
    (link: RunLink, options: OpenLinkOptions) => OpenLinkOutcome
  >;
} {
  const permissions = [];
  for (const host of hosts) {
    permissions.push(buildOpenPermission(host));
  }
  const context = buildMethodContext(permissions);
  const fetchSpy = vi.fn<typeof fetch>(fetchTestFile);
  context.fetchOptions = { baseUrl: APP_BASE_URL, fetch: fetchSpy };
  const onOpenLink =
    vi.fn<(link: RunLink, options: OpenLinkOptions) => OpenLinkOutcome>();
  onOpenLink.mockReturnValue(outcome);
  context.onOpenLink = onOpenLink;
  const spiedContext = { context, fetchSpy, onOpenLink };
  return spiedContext;
}

function readRequestedUrls(fetchSpy: Mock<typeof fetch>): string[] {
  const requestedUrls: string[] = [];
  for (const call of fetchSpy.mock.calls) {
    requestedUrls.push(readRequestedUrl(call[0]));
  }
  return requestedUrls;
}

/** The user remembered Allow for the covers line of the foreign mosaic. */
function readForeignMosaicAllow(): SiteDecision[] {
  const decisions: SiteDecision[] = [
    {
      mosaic: FOREIGN_MOSAIC_SOURCE,
      title: "Covers",
      category: COVERS_LINE.category,
      host: COVERS_LINE.host,
      allowed: true,
    },
  ];
  return decisions;
}

describe("mosaics.inspect", function describeMosaicsInspect(): void {
  it("Inspect the laureates' map", async function inspectsMosaic(): Promise<void> {
    serveTestMosaic(MAP_MOSAIC_SOURCE, MAP_MOSAIC_LINES);
    const { context, fetchSpy } = buildSpiedContext(["*"]);

    const inspection = await callMosaicMethod("mosaics.inspect", context, {
      mosaic: MAP_MOSAIC_REFERENCE,
    });

    expect(inspection).toEqual({
      source: MAP_MOSAIC_SOURCE,
      title: "Laureates on the map",
      description: "Where each laureate was born.",
      mod: SAMPLE_MOD_SOURCE,
      collection: SAMPLE_COLLECTION_SOURCE,
      config: { show_covers: false },
      aliases: { title: ["name"] },
      permissions: { granted: [COVERS_LINE], denied: [] },
    });
    expect(readRequestedUrls(fetchSpy)).toEqual([MAP_MOSAIC_SOURCE]);
  });

  it("Same mosaic from two references", async function sharesSource(): Promise<void> {
    serveTestMosaic(MAP_MOSAIC_SOURCE, MAP_MOSAIC_LINES);
    const { context } = buildSpiedContext(["*"]);

    const fromFolder = await callMosaicMethod("mosaics.inspect", context, {
      mosaic: MAP_MOSAIC_REFERENCE,
    });
    const fromFile = await callMosaicMethod("mosaics.inspect", context, {
      mosaic: MAP_MOSAIC_FILE_REFERENCE,
    });

    expect(fromFolder).toMatchObject({ source: MAP_MOSAIC_SOURCE });
    expect(fromFile).toMatchObject({ source: MAP_MOSAIC_SOURCE });
  });

  it("Show lines of a mosaic from the app's origin", async function grantsAppOriginLines(): Promise<void> {
    serveTestMosaic(MAP_MOSAIC_SOURCE, MAP_MOSAIC_LINES);
    const { context } = buildSpiedContext([APP_ORIGIN]);

    const inspection = await callMosaicMethod("mosaics.inspect", context, {
      mosaic: MAP_MOSAIC_REFERENCE,
    });

    expect(inspection).toMatchObject({
      permissions: { granted: [COVERS_LINE], denied: [] },
    });
  });

  it("Inspect a foreign mosaic without decisions", async function deniesForeignLines(): Promise<void> {
    serveTestMosaic(FOREIGN_MOSAIC_SOURCE, [
      ...MAP_MOSAIC_LINES.slice(0, 2),
      `mod: "${SAMPLE_MOD_SOURCE}"`,
      ...MAP_MOSAIC_LINES.slice(8),
    ]);
    const { context } = buildSpiedContext(["*"]);

    const inspection = await callMosaicMethod("mosaics.inspect", context, {
      mosaic: FOREIGN_MOSAIC_SOURCE,
    });

    expect(inspection).toMatchObject({
      permissions: { granted: [], denied: [COVERS_LINE] },
    });
  });

  it("grants a foreign mosaic's line the user allowed for it", async function grantsRememberedLine(): Promise<void> {
    serveTestMosaic(FOREIGN_MOSAIC_SOURCE, [
      'title: "Covers"',
      `mod: "${SAMPLE_MOD_SOURCE}"`,
      ...MAP_MOSAIC_LINES.slice(8),
    ]);
    const { context } = buildSpiedContext(["*"]);
    context.readSiteDecisions = readForeignMosaicAllow;

    const inspection = await callMosaicMethod("mosaics.inspect", context, {
      mosaic: FOREIGN_MOSAIC_SOURCE,
    });

    expect(inspection).toMatchObject({
      permissions: { granted: [COVERS_LINE], denied: [] },
    });
  });

  it("Missing mosaic", async function failsMissingMosaic(): Promise<void> {
    const { context } = buildSpiedContext(["*"]);

    const error = await catchMethodError(function inspectMissing() {
      return callMosaicMethod("mosaics.inspect", context, {
        mosaic: "./fixtures/mosaics/missing.yaml",
      });
    });

    expect(error.code).toBe(LOAD_FAILED);
    expect(error.message).toContain(`${FIXTURES_BASE_URL}mosaics/missing.yaml`);
    expect(error.message).toContain("404");
  });

  it("Missing reference", async function refusesMissingReference(): Promise<void> {
    const { context, fetchSpy } = buildSpiedContext(["*"]);

    const error = await catchMethodError(function inspectWithoutMosaic() {
      return callMosaicMethod("mosaics.inspect", context, {});
    });

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'mosaics.inspect: "mosaic" must be a non-empty string',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Mod without the open permission", async function refusesWithoutOpen(): Promise<void> {
    const { context, fetchSpy } = buildSpiedContext([]);

    const error = await catchMethodError(function inspectForeign() {
      return callMosaicMethod("mosaics.inspect", context, {
        mosaic: "https://mosaics.example.net/maps/",
      });
    });

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toContain("https://mosaics.example.net");
    expect(error.message).toContain("permissions.open");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("mosaics.open", function describeMosaicsOpen(): void {
  it("Open the laureates' map", async function opensMosaic(): Promise<void> {
    const { context, fetchSpy, onOpenLink } = buildSpiedContext(["*"]);

    const result = await callMosaicMethod("mosaics.open", context, {
      mosaic: "./fixtures/mosaics/nobel_map.yaml",
      params: { from: "x" },
    });

    expect(result).toBeNull();
    expect(onOpenLink).toHaveBeenCalledExactlyOnceWith(
      {
        mod: "",
        collection: null,
        tile: null,
        mosaic: `${FIXTURES_BASE_URL}mosaics/nobel_map.yaml`,
        params: { from: "x" },
      },
      { replace: false },
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("The mosaic's mod is on another site", async function opensWithOriginOnly(): Promise<void> {
    const { context, onOpenLink } = buildSpiedContext([APP_ORIGIN]);

    const result = await callMosaicMethod("mosaics.open", context, {
      mosaic: `${APP_BASE_URL}m.yaml`,
    });

    expect(result).toBeNull();
    expect(onOpenLink).toHaveBeenCalledOnce();
  });

  it("Replace the requester", async function opensInPlace(): Promise<void> {
    const { context, onOpenLink } = buildSpiedContext(["*"]);

    await callMosaicMethod("mosaics.open", context, {
      mosaic: "./fixtures/mosaics/nobel_map.yaml",
      replace: true,
    });

    expect(onOpenLink.mock.calls[0][1]).toEqual({ replace: true });
  });

  it("Hidden mod", async function refusesHidden(): Promise<void> {
    const { context } = buildSpiedContext(["*"], "not-visible");

    const error = await catchMethodError(function openHidden() {
      return callMosaicMethod("mosaics.open", context, {
        mosaic: "./m.yaml",
      });
    });

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toBe(
      "mosaics.open: only the visible mod can open mosaics",
    );
  });

  it("Home mod replacing itself", async function refusesHomeMod(): Promise<void> {
    const { context } = buildSpiedContext(["*"], "home-mod");

    const error = await catchMethodError(function replaceHome() {
      return callMosaicMethod("mosaics.open", context, {
        mosaic: "./m.yaml",
        replace: true,
      });
    });

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toBe("mosaics.open: the home mod cannot be replaced");
  });

  it("Reserved parameter", async function refusesReservedParam(): Promise<void> {
    const { context, onOpenLink } = buildSpiedContext(["*"]);

    const error = await catchMethodError(function openWithMod() {
      return callMosaicMethod("mosaics.open", context, {
        mosaic: "./m.yaml",
        params: { mod: "x" },
      });
    });

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe('mosaics.open: "params.mod" is reserved');
    expect(onOpenLink).not.toHaveBeenCalled();
  });

  it("Missing reference", async function refusesMissingReference(): Promise<void> {
    const { context, onOpenLink } = buildSpiedContext(["*"]);

    const error = await catchMethodError(function openWithoutMosaic() {
      return callMosaicMethod("mosaics.open", context, { params: {} });
    });

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'mosaics.open: "mosaic" must be a non-empty string',
    );
    expect(onOpenLink).not.toHaveBeenCalled();
  });

  it("refuses a replace that is not a boolean", async function refusesReplaceText(): Promise<void> {
    const { context, onOpenLink } = buildSpiedContext(["*"]);

    const error = await catchMethodError(function openWithReplaceText() {
      return callMosaicMethod("mosaics.open", context, {
        mosaic: "./m.yaml",
        replace: "yes",
      });
    });

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe('mosaics.open: "replace" must be a boolean');
    expect(onOpenLink).not.toHaveBeenCalled();
  });

  it("refuses a mod without the open permission before opening", async function refusesWithoutOpen(): Promise<void> {
    const { context, onOpenLink } = buildSpiedContext([]);

    const error = await catchMethodError(function openForeign() {
      return callMosaicMethod("mosaics.open", context, {
        mosaic: "https://mosaics.example.net/maps/",
      });
    });

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toContain("https://mosaics.example.net");
    expect(onOpenLink).not.toHaveBeenCalled();
  });
});
