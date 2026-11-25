import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  buildMethodContext,
  buildOpenPermission,
  catchMethodError,
  checkBundleOnly,
  resolvePassingReport,
} from "../../../test/method_contexts.ts";
import { APP_BASE_URL, FIXTURES_BASE_URL } from "../../../test/sample_files.ts";
import {
  ALIASED_MOSAIC_REFERENCE,
  APP_ORIGIN,
  NAMED_BOOKS_SOURCE,
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_MOD_SOURCE,
  serveNamedBooks,
  serveTestMosaic,
} from "../../../test/sample_mods.ts";
import {
  fetchTestFile,
  readRequestedUrl,
  testTexts,
} from "../../../test/test_files.ts";
import type { SiteDecision } from "../permissions/index.ts";
import type { ModCheckReport } from "./mod_check_report.ts";
import type { RunLink } from "./mod_launch.ts";
import {
  INVALID_PARAMS,
  LOAD_FAILED,
  PERMISSION_DENIED,
} from "./mod_messages.ts";
import type {
  ModCheckRequest,
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
      content: testTexts.get(MAP_MOSAIC_SOURCE),
    });
    expect(readRequestedUrls(fetchSpy)).toEqual([MAP_MOSAIC_SOURCE]);
  });

  it("Text of the file", async function answersContent(): Promise<void> {
    const commentedText = `# My own map.\nmosaic:\n  title: "Map"\n  mod: "${SAMPLE_MOD_SOURCE}"\n`;
    testTexts.set(MAP_MOSAIC_SOURCE, commentedText);
    const { context } = buildSpiedContext(["*"]);

    const inspection = await callMosaicMethod("mosaics.inspect", context, {
      mosaic: MAP_MOSAIC_REFERENCE,
    });

    expect(inspection).toMatchObject({ content: commentedText });
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

  it("Sites is a reserved parameter", async function refusesSitesParam(): Promise<void> {
    const { context, onOpenLink } = buildSpiedContext(["*"]);

    const error = await catchMethodError(function openWithSites() {
      return callMosaicMethod("mosaics.open", context, {
        mosaic: "./m.yaml",
        params: { sites: "./n.yaml" },
      });
    });

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe('mosaics.open: "params.sites" is reserved');
    expect(onOpenLink).not.toHaveBeenCalled();
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

const MISSING_MOSAIC_SOURCE = `${FIXTURES_BASE_URL}mosaics/missing/mosaic.yaml`;

/** A context granted `open` for `hosts`, whose `onCheckMod` is a spy answering a passing report, or `null` for a hidden mod. */
function buildCheckingContext(
  hosts: string[],
  isVisible: boolean = true,
): {
  context: ModMethodContext;
  fetchSpy: Mock<typeof fetch>;
  checkSpy: Mock<(request: ModCheckRequest) => Promise<ModCheckReport> | null>;
} {
  const { context, fetchSpy } = buildSpiedContext(hosts);
  const checkSpy =
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

describe("Check a mosaic", function describeCheckMosaic(): void {
  it("asks the stage with the resolved mosaic and answers the report", async function checksMosaic(): Promise<void> {
    const { context, fetchSpy, checkSpy } = buildCheckingContext(["*"]);

    const report = await callMosaicMethod("mosaics.check", context, {
      mosaic: MAP_MOSAIC_REFERENCE,
    });

    expect(checkSpy).toHaveBeenCalledExactlyOnceWith({
      mosaic: MAP_MOSAIC_SOURCE,
    });
    expect(report).toMatchObject({ mosaic: MAP_MOSAIC_SOURCE, status: "pass" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Missing mosaic file", async function reportsMissingMosaic(): Promise<void> {
    const { context } = buildSpiedContext([APP_ORIGIN]);
    context.onCheckMod = checkBundleOnly.bind(undefined, context);

    const report = await callMosaicMethod("mosaics.check", context, {
      mosaic: "./fixtures/mosaics/missing",
    });

    expect(report).toMatchObject({
      source: null,
      mosaic: MISSING_MOSAIC_SOURCE,
      status: "fail",
      mountChecked: false,
      testsChecked: false,
    });
    const findings = (report as ModCheckReport).findings;
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      step: "bundle",
      level: "error",
      source: MISSING_MOSAIC_SOURCE,
    });
    expect(findings[0].message).toContain("404");
  });
});

describe("Mosaic check requests follow the open rules", function describeMosaicCheckRules(): void {
  it("Mod without the open permission", async function refusesWithoutOpen(): Promise<void> {
    const { context, fetchSpy, checkSpy } = buildCheckingContext([]);

    const error = await catchMethodError(function checkForeign() {
      return callMosaicMethod("mosaics.check", context, {
        mosaic: "https://mosaics.example.net/maps/",
      });
    });

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toContain("https://mosaics.example.net");
    expect(error.message).toContain("permissions.open");
    expect(checkSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("accepts a grant for the mosaic file's origin", async function checksWithOriginGrant(): Promise<void> {
    const { context, checkSpy } = buildCheckingContext([
      "https://mosaics.example.net",
    ]);

    await callMosaicMethod("mosaics.check", context, {
      mosaic: FOREIGN_MOSAIC_SOURCE,
    });

    expect(checkSpy).toHaveBeenCalledExactlyOnceWith({
      mosaic: FOREIGN_MOSAIC_SOURCE,
    });
  });

  it("refuses a hidden mod", async function refusesHidden(): Promise<void> {
    const { context } = buildCheckingContext(["*"], false);

    const error = await catchMethodError(function checkHidden() {
      return callMosaicMethod("mosaics.check", context, {
        mosaic: MAP_MOSAIC_REFERENCE,
      });
    });

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toBe(
      "mosaics.check: only the visible mod can check mosaics",
    );
  });

  it("refuses a mosaic that is not a non-empty string", async function refusesBadMosaic(): Promise<void> {
    const { context, checkSpy } = buildCheckingContext(["*"]);

    for (const mosaic of ["", 3, undefined]) {
      const error = await catchMethodError(function checkBadMosaic() {
        return callMosaicMethod("mosaics.check", context, { mosaic });
      });

      expect(error.code).toBe(INVALID_PARAMS);
    }
    expect(checkSpy).not.toHaveBeenCalled();
  });
});

const NAMED_BOOKS_DRAFT = [
  "mosaic:",
  '  title: "Named books"',
  `  mod: "${SAMPLE_MOD_SOURCE}"`,
  `  collection: "${NAMED_BOOKS_SOURCE}"`,
  "  aliases:",
  '    title: ["name"]',
  '    country: ["origin"]',
  "",
].join("\n");

describe("mosaics.validate", function describeMosaicsValidate(): void {
  it("Valid draft", async function validatesDraft(): Promise<void> {
    serveNamedBooks();
    const { context } = buildSpiedContext(["*"]);

    const validation = await callMosaicMethod("mosaics.validate", context, {
      content: NAMED_BOOKS_DRAFT,
      mosaic: ALIASED_MOSAIC_REFERENCE,
    });

    expect(validation).toMatchObject({
      errors: [],
      warnings: [],
      tiles: { matching: 1, total: 1 },
    });
    expect(validation).toHaveProperty(
      "typeFields",
      expect.arrayContaining([{ name: "title", required: true }]),
    );
  });

  it("caches the loads of the session", async function cachesLoads(): Promise<void> {
    serveNamedBooks();
    const { context, fetchSpy } = buildSpiedContext(["*"]);
    const params = { content: NAMED_BOOKS_DRAFT };

    await callMosaicMethod("mosaics.validate", context, params);
    const firstCount = fetchSpy.mock.calls.length;
    await callMosaicMethod("mosaics.validate", context, params);

    expect(firstCount).toBeGreaterThan(0);
    expect(fetchSpy).toHaveBeenCalledTimes(firstCount);
  });

  it("Not allowed to open the mod's site", async function refusesModSite(): Promise<void> {
    const { context, fetchSpy } = buildSpiedContext([APP_ORIGIN]);
    const draft = NAMED_BOOKS_DRAFT.replace(
      SAMPLE_MOD_SOURCE,
      "https://mods.example.net/map/mod_conf.yaml",
    );

    const error = await catchMethodError(function validateForeignMod() {
      return callMosaicMethod("mosaics.validate", context, { content: draft });
    });

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toContain("https://mods.example.net");
    expect(error.message).toContain("permissions.open");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses the collection's site without open", async function refusesCollectionSite(): Promise<void> {
    const { context, fetchSpy } = buildSpiedContext([APP_ORIGIN]);
    const draft = NAMED_BOOKS_DRAFT.replace(
      NAMED_BOOKS_SOURCE,
      "https://tiles.example.net/books/collection.yaml",
    );

    const error = await catchMethodError(function validateForeignCollection() {
      return callMosaicMethod("mosaics.validate", context, { content: draft });
    });

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toContain("https://tiles.example.net");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses a missing content", async function refusesMissingContent(): Promise<void> {
    const { context } = buildSpiedContext(["*"]);

    const error = await catchMethodError(function validateNothing() {
      return callMosaicMethod("mosaics.validate", context, { content: "" });
    });

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'mosaics.validate: "content" must be a non-empty string',
    );
  });

  it("refuses a mosaic that is not a string", async function refusesWrongMosaic(): Promise<void> {
    const { context } = buildSpiedContext(["*"]);

    const error = await catchMethodError(function validateWrongMosaic() {
      return callMosaicMethod("mosaics.validate", context, {
        content: NAMED_BOOKS_DRAFT,
        mosaic: 3,
      });
    });

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'mosaics.validate: "mosaic" must be a non-empty string',
    );
  });
});

describe("mosaics.edit", function describeMosaicsEdit(): void {
  it("Title edit", async function editsTitle(): Promise<void> {
    const { context, fetchSpy } = buildSpiedContext([]);

    const result = await callMosaicMethod("mosaics.edit", context, {
      content: NAMED_BOOKS_DRAFT,
      edits: { title: "Laureates, my way" },
    });

    expect(result).toEqual({
      content: NAMED_BOOKS_DRAFT.replace(
        '"Named books"',
        '"Laureates, my way"',
      ),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Unknown edit", async function refusesUnknownEdit(): Promise<void> {
    const { context } = buildSpiedContext([]);

    const error = await catchMethodError(function editColour() {
      return callMosaicMethod("mosaics.edit", context, {
        content: NAMED_BOOKS_DRAFT,
        edits: { colour: "red" },
      });
    });

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'mosaics.edit: "edits.colour" is not a draft edit',
    );
  });

  it("refuses a draft that does not parse", async function refusesBrokenDraft(): Promise<void> {
    const { context } = buildSpiedContext([]);

    const error = await catchMethodError(function editBroken() {
      return callMosaicMethod("mosaics.edit", context, {
        content: 'mosaic:\n  title: "Clock\n',
        edits: { title: "Clock" },
      });
    });

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toMatch(/^mosaics\.edit: the draft cannot be read: /);
  });

  it("refuses missing edits", async function refusesMissingEdits(): Promise<void> {
    const { context } = buildSpiedContext([]);

    const error = await catchMethodError(function editWithoutEdits() {
      return callMosaicMethod("mosaics.edit", context, {
        content: NAMED_BOOKS_DRAFT,
      });
    });

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe('mosaics.edit: "edits" must be a mapping');
  });
});
