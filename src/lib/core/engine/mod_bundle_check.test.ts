import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { buildMethodContext } from "../../../test/method_contexts.ts";
import { FIXTURES_BASE_URL } from "../../../test/sample_files.ts";
import {
  ALIASED_MOSAIC_SOURCE,
  COVER_BOOK_COLLECTION_SOURCE,
  HELPER_SCRIPT_SOURCE,
  LEAFLET_SCRIPT_SOURCE,
  LEAFLET_STYLE_SOURCE,
  LIBRARY_MOD_SOURCE,
  COVER_BOOK_IMAGE_URL,
  MISMATCHED_SAMPLE_MOD_SOURCE,
  MISSING_ENTRYPOINT_MOD_SOURCE,
  MISSING_ENTRYPOINT_SOURCE,
  MISSING_MOD_SOURCE,
  MISSING_TYPE_MOD_SOURCE,
  MISSING_TYPE_SOURCE,
  NO_API_BOOK_MOD_SOURCE,
  NAMED_BOOK_SOURCE,
  NAMED_BOOKS_SOURCE,
  NO_COUNTRY_TILE_SOURCE,
  OTHER_API_MOD_SOURCE,
  OTHER_API_RANGE,
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_DEFAULT_MOSAIC_SOURCE,
  SAMPLE_ENTRYPOINT,
  SAMPLE_MOD_SOURCE,
  SAMPLE_TILE_SOURCES,
  serveCoverBook,
  serveLibraryMod,
  serveMismatchedSampleMod,
  serveMissingEntrypointMod,
  serveAliasedMosaic,
  serveMissingTypeMod,
  serveNoApiBookMod,
  serveOtherApiMod,
  serveTwoBooks,
  serveUntypedMod,
  serveTestMod,
  serveTestMosaic,
  TEST_DEFAULTS,
  TEST_NPM_HOST,
  TWO_BOOKS_SOURCE,
  UNTYPED_MOD_SOURCE,
} from "../../../test/sample_mods.ts";
import {
  fetchTestFile,
  readRequestedUrl,
  testTexts,
} from "../../../test/test_files.ts";
import { createLibraryFileCache } from "./library_files.ts";
import { buildLibsMethods, SHIPPED_LIBRARIES } from "./libs_methods.ts";
import { describeMissingApiRange, MOD_API_VERSION } from "./mod_api_version.ts";
import { checkModBundle } from "./mod_bundle_check.ts";
import type { ModBundleCheck } from "./mod_bundle_check.ts";

/** A mod that declares `leaflet` with a file the npm host does not have. */
const MISSING_LIBRARY_MOD_SOURCE = `${FIXTURES_BASE_URL}mods/missing_library/mod_conf.yaml`;
const MISSING_LIBRARY_FILE_SOURCE = `${TEST_NPM_HOST}leaflet@1.9.4/dist/missing.js`;
const MISSING_LIBRARY_FILE_TEXT =
  "Couldn't find the requested file /dist/missing.js in leaflet.";

/** A mod whose default mosaic `mosaic.yaml` is served by the test, or not. */
const MOSAIC_MOD_SOURCE = `${FIXTURES_BASE_URL}mods/with_mosaic/mod_conf.yaml`;
const MOSAIC_MOD_MOSAIC_SOURCE = `${FIXTURES_BASE_URL}mods/with_mosaic/mosaic.yaml`;
const OTHER_MOD_SOURCE = `${FIXTURES_BASE_URL}mods/other_mod/mod_conf.yaml`;
const VIEWER_MOSAIC_SOURCE = `${FIXTURES_BASE_URL}mosaics/viewer/mosaic.yaml`;
const MISSING_MOSAIC_SOURCE = `${FIXTURES_BASE_URL}mosaics/missing/mosaic.yaml`;

/** Serves a mod with the book type, a config with `columns` and `map`, and `default_mosaic: "./mosaic.yaml"`. */
function serveMosaicMod(): void {
  serveTestMod(MOSAIC_MOD_SOURCE, [
    '  title: "with_mosaic"',
    '  version: "0.1.0"',
    '  entrypoint: "./main.js"',
    '  type_path: "../../types/book.md"',
    '  default_mosaic: "./mosaic.yaml"',
    "  config:",
    "    columns: 6",
    "    map:",
    "      zoom: 2",
    "      center: [0, 0]",
  ]);
}

/** Serves the default mosaic of `serveMosaicMod` with the lines after its `mod` and `collection`. */
function serveModMosaic(mosaicLines: string[]): void {
  serveTestMosaic(MOSAIC_MOD_MOSAIC_SOURCE, [
    'title: "With a mosaic"',
    'mod: "./"',
    'collection: "../../tiles/books_collection.yaml"',
    ...mosaicLines,
  ]);
}

function listFindingMessages(bundleCheck: ModBundleCheck): string[] {
  const messages: string[] = [];
  for (const finding of bundleCheck.findings) {
    messages.push(finding.message);
  }
  return messages;
}

function serveMissingLibraryMod(): void {
  serveTestMod(MISSING_LIBRARY_MOD_SOURCE, [
    '  title: "missing_library"',
    '  version: "0.1.0"',
    '  entrypoint: "./main.js"',
    "  libraries:",
    "    leaflet:",
    '      npm: "leaflet@1.9.4"',
    '      files: ["dist/missing.js"]',
  ]);
}

/** The test files, and the npm host's plain-text 404 for the missing library file. */
function fetchWithNpmHost(input: RequestInfo | URL): Promise<Response> {
  if (readRequestedUrl(input) !== MISSING_LIBRARY_FILE_SOURCE) {
    return fetchTestFile(input);
  }
  const response = new Response(MISSING_LIBRARY_FILE_TEXT, {
    status: 404,
    statusText: "Not Found",
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
  return Promise.resolve(response);
}

function serveLibraryFiles(): void {
  serveLibraryMod();
  testTexts.set(LEAFLET_SCRIPT_SOURCE, "globalThis.L = {};");
  testTexts.set(LEAFLET_STYLE_SOURCE, ".leaflet-container {}");
  testTexts.set(HELPER_SCRIPT_SOURCE, "globalThis.helper = {};");
}

afterEach(function clearTestTexts(): void {
  testTexts.clear();
});

function createTestFetch(): Mock<typeof fetch> {
  const testFetch = vi.fn<typeof fetch>(fetchTestFile);
  return testFetch;
}

function listRequestedUrls(testFetch: Mock<typeof fetch>): string[] {
  const requestedUrls: string[] = [];
  for (const call of testFetch.mock.calls) {
    requestedUrls.push(readRequestedUrl(call[0]));
  }
  return requestedUrls;
}

function listTileSources(bundleCheck: ModBundleCheck): string[] {
  const tileSources: string[] = [];
  for (const tile of bundleCheck.modTiles?.tiles ?? []) {
    tileSources.push(tile.source);
  }
  return tileSources;
}

describe("Check a mod", function describeCheckMod(): void {
  it("Check with another collection", async function usesGivenCollection(): Promise<void> {
    serveTwoBooks();
    const testFetch = createTestFetch();

    const bundleCheck = await checkModBundle(
      { source: SAMPLE_MOD_SOURCE, collection: TWO_BOOKS_SOURCE },
      TEST_DEFAULTS,
      { fetch: testFetch },
    );

    expect(bundleCheck.findings).toEqual([]);
    expect(bundleCheck.modTiles?.tilesSource).toBe(TWO_BOOKS_SOURCE);
    expect(listTileSources(bundleCheck)).toEqual([
      SAMPLE_TILE_SOURCES[1],
      SAMPLE_TILE_SOURCES[2],
    ]);
    expect(listRequestedUrls(testFetch)).not.toContain(
      SAMPLE_COLLECTION_SOURCE,
    );
    expect(listRequestedUrls(testFetch)).not.toContain(
      SAMPLE_DEFAULT_MOSAIC_SOURCE,
    );
    expect(bundleCheck.mosaicSource).toBeNull();
    expect(bundleCheck.mosaic).toBeNull();
  });

  it("Check with the default mosaic", async function usesDefaultMosaic(): Promise<void> {
    serveMosaicMod();
    serveModMosaic([
      "config:",
      "  columns: 4",
      "permissions:",
      "  show:",
      '    - host: "https://covers.example.net"',
      '      reason: "Shows the covers"',
    ]);

    const bundleCheck = await checkModBundle(
      { source: MOSAIC_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      { fetch: fetchTestFile },
    );

    expect(bundleCheck.findings).toEqual([]);
    expect(bundleCheck.source).toBe(MOSAIC_MOD_SOURCE);
    expect(bundleCheck.mosaicSource).toBe(MOSAIC_MOD_MOSAIC_SOURCE);
    expect(bundleCheck.mosaic?.config).toEqual({ columns: 4 });
    expect(bundleCheck.collection).toBe(SAMPLE_COLLECTION_SOURCE);
    expect(listTileSources(bundleCheck)).toEqual(SAMPLE_TILE_SOURCES);
  });

  it("Mount check gets the resolved tiles", async function resolvesCheckedTiles(): Promise<void> {
    serveCoverBook();

    const bundleCheck = await checkModBundle(
      { source: SAMPLE_MOD_SOURCE, collection: COVER_BOOK_COLLECTION_SOURCE },
      TEST_DEFAULTS,
      { fetch: fetchTestFile },
    );

    expect(bundleCheck.findings).toEqual([]);
    expect(bundleCheck.modTiles?.tiles).toHaveLength(1);
    expect(bundleCheck.modTiles?.tiles[0].metadata.image).toBe(
      COVER_BOOK_IMAGE_URL,
    );
  });

  it("Mod without a sample collection", async function checksWithoutCollection(): Promise<void> {
    serveUntypedMod();
    const testFetch = createTestFetch();

    const bundleCheck = await checkModBundle(
      { source: UNTYPED_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      {
        fetch: testFetch,
      },
    );

    expect(bundleCheck.findings).toEqual([]);
    expect(bundleCheck.mod?.source).toBe(UNTYPED_MOD_SOURCE);
    expect(bundleCheck.modTiles).toBeNull();
    expect(bundleCheck.mosaicSource).toBeNull();
    expect(listRequestedUrls(testFetch)).toEqual([
      UNTYPED_MOD_SOURCE,
      `${FIXTURES_BASE_URL}mods/untyped/main.js`,
    ]);
  });
});

describe("Bundle check", function describeBundleCheck(): void {
  it("Fixture mod", async function checksFixtureMod(): Promise<void> {
    const bundleCheck = await checkModBundle(
      { source: SAMPLE_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      {
        fetch: fetchTestFile,
      },
    );

    expect(bundleCheck.findings).toEqual([]);
    expect(bundleCheck.mod?.entrypoint).toBe(SAMPLE_ENTRYPOINT);
    expect(bundleCheck.modTiles?.tilesSource).toBe(SAMPLE_COLLECTION_SOURCE);
    expect(listTileSources(bundleCheck)).toEqual(SAMPLE_TILE_SOURCES);
    expect(bundleCheck.mosaicSource).toBe(SAMPLE_DEFAULT_MOSAIC_SOURCE);
  });

  it("Missing default mosaic", async function reportsMissingDefaultMosaic(): Promise<void> {
    serveMosaicMod();

    const bundleCheck = await checkModBundle(
      { source: MOSAIC_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      { fetch: fetchTestFile },
    );

    expect(bundleCheck.findings).toHaveLength(1);
    expect(bundleCheck.findings[0]).toMatchObject({
      step: "bundle",
      level: "error",
      source: MOSAIC_MOD_MOSAIC_SOURCE,
    });
    expect(bundleCheck.findings[0].message).toContain("404");
    expect(bundleCheck.mosaicSource).toBe(MOSAIC_MOD_MOSAIC_SOURCE);
    expect(bundleCheck.modTiles).toBeNull();
  });

  it("Missing mod file", async function reportsMissingModFile(): Promise<void> {
    const testFetch = createTestFetch();

    const bundleCheck = await checkModBundle(
      { source: MISSING_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      {
        fetch: testFetch,
      },
    );

    expect(bundleCheck.findings).toHaveLength(1);
    expect(bundleCheck.findings[0]).toMatchObject({
      step: "bundle",
      level: "error",
      source: MISSING_MOD_SOURCE,
    });
    expect(bundleCheck.findings[0].message).toContain("404");
    expect(bundleCheck.mod).toBeNull();
    expect(bundleCheck.modTiles).toBeNull();
    expect(listRequestedUrls(testFetch)).toEqual([MISSING_MOD_SOURCE]);
  });

  it("Missing entrypoint", async function reportsMissingEntrypoint(): Promise<void> {
    serveMissingEntrypointMod();

    const bundleCheck = await checkModBundle(
      { source: MISSING_ENTRYPOINT_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      { fetch: fetchTestFile },
    );

    expect(bundleCheck.findings).toHaveLength(1);
    expect(bundleCheck.findings[0]).toMatchObject({
      step: "bundle",
      level: "error",
      source: MISSING_ENTRYPOINT_SOURCE,
    });
    expect(bundleCheck.findings[0].message).toContain("404");
    expect(bundleCheck.mod).toBeNull();
  });

  it("Missing library file", async function reportsMissingLibraryFile(): Promise<void> {
    serveMissingLibraryMod();

    const bundleCheck = await checkModBundle(
      { source: MISSING_LIBRARY_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      { fetch: fetchWithNpmHost, npmHost: TEST_NPM_HOST },
      createLibraryFileCache(),
    );

    expect(bundleCheck.findings).toEqual([
      {
        step: "bundle",
        level: "error",
        source: MISSING_LIBRARY_FILE_SOURCE,
        message: `the library "leaflet" could not be loaded: Cannot load file "${MISSING_LIBRARY_FILE_SOURCE}": HTTP 404 Not Found: ${MISSING_LIBRARY_FILE_TEXT}`,
      },
    ]);
  });

  it("checks every declared library file after the entrypoint", async function fetchesLibraryFiles(): Promise<void> {
    serveLibraryFiles();
    const testFetch = createTestFetch();

    const bundleCheck = await checkModBundle(
      { source: LIBRARY_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      { fetch: testFetch, npmHost: TEST_NPM_HOST },
      createLibraryFileCache(),
    );

    expect(bundleCheck.findings).toEqual([]);
    expect(listRequestedUrls(testFetch)).toEqual([
      LIBRARY_MOD_SOURCE,
      `${FIXTURES_BASE_URL}mods/with_libraries/main.js`,
      LEAFLET_SCRIPT_SOURCE,
      LEAFLET_STYLE_SOURCE,
      HELPER_SCRIPT_SOURCE,
    ]);
  });

  it("serves the mount check's libs.load from the files it fetched", async function sharesLibraryFiles(): Promise<void> {
    serveLibraryFiles();
    const libraryFiles = createLibraryFileCache();
    const bundleCheck = await checkModBundle(
      { source: LIBRARY_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      { fetch: fetchTestFile, npmHost: TEST_NPM_HOST },
      libraryFiles,
    );
    const mountFetch = createTestFetch();
    const context = buildMethodContext([]);
    if (bundleCheck.mod === null) {
      throw new Error(
        `Expected the bundle check of "${LIBRARY_MOD_SOURCE}" to load the mod`,
      );
    }
    context.mod = bundleCheck.mod;
    context.fetchOptions = { ...context.fetchOptions, fetch: mountFetch };
    const methods = buildLibsMethods(SHIPPED_LIBRARIES, libraryFiles);

    const result = await methods["libs.load"](context, { name: "leaflet" });

    expect(result).toMatchObject({ name: "leaflet", version: "1.9.4" });
    expect(mountFetch).not.toHaveBeenCalled();
  });

  it("Failed tile type skips the collection", async function skipsCollectionWithoutType(): Promise<void> {
    serveMissingTypeMod();
    const testFetch = createTestFetch();

    const bundleCheck = await checkModBundle(
      { source: MISSING_TYPE_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      {
        fetch: testFetch,
      },
    );

    expect(bundleCheck.findings).toHaveLength(1);
    expect(bundleCheck.findings[0]).toMatchObject({
      step: "bundle",
      level: "error",
      source: MISSING_TYPE_SOURCE,
    });
    expect(bundleCheck.modTiles).toBeNull();
    expect(listRequestedUrls(testFetch)).not.toContain(
      SAMPLE_COLLECTION_SOURCE,
    );
  });

  it("Sample tile that does not match", async function reportsMismatchedTile(): Promise<void> {
    serveMismatchedSampleMod();

    const bundleCheck = await checkModBundle(
      { source: MISMATCHED_SAMPLE_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      { fetch: fetchTestFile },
    );

    expect(bundleCheck.findings).toHaveLength(1);
    expect(bundleCheck.findings[0]).toMatchObject({
      step: "bundle",
      level: "warning",
      source: NO_COUNTRY_TILE_SOURCE,
    });
    expect(listTileSources(bundleCheck)).toEqual(SAMPLE_TILE_SOURCES);
  });

  it("findings are plain data", async function keepsPlainData(): Promise<void> {
    serveMismatchedSampleMod(null);

    const bundleCheck = await checkModBundle(
      { source: MISMATCHED_SAMPLE_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      { fetch: fetchTestFile },
    );

    expect(structuredClone(bundleCheck.findings)).toEqual(bundleCheck.findings);
  });
});

describe("API range in the check", function describeApiRangeCheck(): void {
  it("Mod for another API", async function warnsAboutOtherApi(): Promise<void> {
    serveOtherApiMod();

    const bundleCheck = await checkModBundle(
      { source: OTHER_API_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      {
        fetch: fetchTestFile,
      },
    );

    expect(bundleCheck.findings).toHaveLength(1);
    expect(bundleCheck.findings[0]).toMatchObject({
      step: "bundle",
      level: "warning",
      source: OTHER_API_MOD_SOURCE,
    });
    expect(bundleCheck.findings[0].message).toContain(OTHER_API_RANGE);
    expect(bundleCheck.findings[0].message).toContain(MOD_API_VERSION);
    expect(bundleCheck.mod).not.toBeNull();
  });

  it("Missing range", async function warnsAboutMissingRange(): Promise<void> {
    serveNoApiBookMod();

    const bundleCheck = await checkModBundle(
      { source: NO_API_BOOK_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      {
        fetch: fetchTestFile,
      },
    );

    expect(bundleCheck.findings).toEqual([
      {
        step: "bundle",
        level: "warning",
        source: NO_API_BOOK_MOD_SOURCE,
        message: describeMissingApiRange(),
      },
    ]);
  });

  it("Range finding comes first", async function listsRangeFirst(): Promise<void> {
    serveMismatchedSampleMod(null);

    const bundleCheck = await checkModBundle(
      { source: MISMATCHED_SAMPLE_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      { fetch: fetchTestFile },
    );

    expect(bundleCheck.findings).toHaveLength(2);
    expect(bundleCheck.findings[0]).toEqual({
      step: "bundle",
      level: "warning",
      source: MISMATCHED_SAMPLE_MOD_SOURCE,
      message: describeMissingApiRange(),
    });
    expect(bundleCheck.findings[1].source).toBe(NO_COUNTRY_TILE_SOURCE);
  });
});

describe("A default mosaic names its mod", function describeDefaultMosaicMod(): void {
  it("Default mosaic of another mod", async function refusesForeignDefaultMosaic(): Promise<void> {
    serveMosaicMod();
    serveTestMosaic(MOSAIC_MOD_MOSAIC_SOURCE, [
      'title: "Another mod\'s mosaic"',
      'mod: "../other_mod"',
      'collection: "../../tiles/books_collection.yaml"',
    ]);

    const bundleCheck = await checkModBundle(
      { source: MOSAIC_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      { fetch: fetchTestFile },
    );

    expect(bundleCheck.findings).toHaveLength(1);
    expect(bundleCheck.findings[0]).toMatchObject({
      step: "bundle",
      level: "error",
      source: MOSAIC_MOD_MOSAIC_SOURCE,
    });
    expect(bundleCheck.findings[0].message).toContain(OTHER_MOD_SOURCE);
    expect(bundleCheck.findings[0].message).toContain(MOSAIC_MOD_SOURCE);
    expect(bundleCheck.modTiles).toBeNull();
  });
});

describe("Check a mosaic", function describeCheckMosaic(): void {
  it("Check the laureates' map", async function checksAliasedMosaic(): Promise<void> {
    serveAliasedMosaic();

    const bundleCheck = await checkModBundle(
      { mosaic: ALIASED_MOSAIC_SOURCE },
      TEST_DEFAULTS,
      { fetch: fetchTestFile },
    );

    expect(bundleCheck.findings).toEqual([]);
    expect(bundleCheck.source).toBe(SAMPLE_MOD_SOURCE);
    expect(bundleCheck.mosaicSource).toBe(ALIASED_MOSAIC_SOURCE);
    expect(bundleCheck.collection).toBe(NAMED_BOOKS_SOURCE);
    expect(listTileSources(bundleCheck)).toEqual([NAMED_BOOK_SOURCE]);
    expect(bundleCheck.modTiles?.tiles[0].metadata.title).toBe("Kallocain");
  });

  it("Missing mosaic file", async function reportsMissingMosaic(): Promise<void> {
    const testFetch = createTestFetch();

    const bundleCheck = await checkModBundle(
      { mosaic: MISSING_MOSAIC_SOURCE },
      TEST_DEFAULTS,
      { fetch: testFetch },
    );

    expect(bundleCheck.source).toBeNull();
    expect(bundleCheck.mosaicSource).toBe(MISSING_MOSAIC_SOURCE);
    expect(bundleCheck.mod).toBeNull();
    expect(bundleCheck.findings).toHaveLength(1);
    expect(bundleCheck.findings[0]).toMatchObject({
      step: "bundle",
      level: "error",
      source: MISSING_MOSAIC_SOURCE,
    });
    expect(bundleCheck.findings[0].message).toContain("404");
    expect(listRequestedUrls(testFetch)).toEqual([MISSING_MOSAIC_SOURCE]);
  });

  it("Mosaic of a switched-off mod", async function refusesSwitchedOffMod(): Promise<void> {
    const viewerSource = `${TEST_DEFAULTS.folder}mod_viewer/mod_conf.yaml`;
    serveTestMosaic(VIEWER_MOSAIC_SOURCE, [
      'title: "The viewer"',
      'mod: "mod_viewer"',
    ]);
    const testFetch = createTestFetch();

    const bundleCheck = await checkModBundle(
      { mosaic: VIEWER_MOSAIC_SOURCE },
      {
        folder: TEST_DEFAULTS.folder,
        switchedOff: [{ name: "mod_viewer", source: viewerSource }],
      },
      { fetch: testFetch },
    );

    expect(bundleCheck.source).toBe(viewerSource);
    expect(bundleCheck.mod).toBeNull();
    expect(bundleCheck.findings).toHaveLength(1);
    expect(bundleCheck.findings[0]).toMatchObject({
      step: "bundle",
      level: "error",
    });
    expect(bundleCheck.findings[0].message).toContain("mod_viewer");
    expect(bundleCheck.findings[0].message).toContain("switched off");
    expect(listRequestedUrls(testFetch)).toEqual([VIEWER_MOSAIC_SOURCE]);
  });
});

describe("Mosaic findings", function describeMosaicFindings(): void {
  it("Alias for an unknown field", async function warnsAboutUnknownAlias(): Promise<void> {
    serveMosaicMod();
    serveModMosaic(["aliases:", '  contry: ["birth_country"]']);

    const bundleCheck = await checkModBundle(
      { source: MOSAIC_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      { fetch: fetchTestFile },
    );

    expect(bundleCheck.findings).toHaveLength(1);
    expect(bundleCheck.findings[0]).toMatchObject({
      step: "bundle",
      level: "warning",
      source: MOSAIC_MOD_MOSAIC_SOURCE,
    });
    expect(bundleCheck.findings[0].message).toContain('"contry"');
  });

  it("Config key the mod does not have", async function warnsAboutUnknownKey(): Promise<void> {
    serveMosaicMod();
    serveModMosaic(["config:", "  colums: 4"]);

    const bundleCheck = await checkModBundle(
      { source: MOSAIC_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      { fetch: fetchTestFile },
    );

    expect(bundleCheck.findings).toHaveLength(1);
    expect(bundleCheck.findings[0]).toMatchObject({
      step: "bundle",
      level: "warning",
      source: MOSAIC_MOD_MOSAIC_SOURCE,
    });
    expect(bundleCheck.findings[0].message).toContain('"config.colums"');
  });

  it("Nested key", async function warnsAboutNestedKey(): Promise<void> {
    serveMosaicMod();
    serveModMosaic(["config:", "  map:", "    zom: 3"]);

    const bundleCheck = await checkModBundle(
      { source: MOSAIC_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      { fetch: fetchTestFile },
    );

    expect(listFindingMessages(bundleCheck)).toHaveLength(1);
    expect(bundleCheck.findings[0].message).toContain('"config.map.zom"');
  });

  it("replaces a list or a scalar without a finding", async function acceptsReplacements(): Promise<void> {
    serveMosaicMod();
    serveModMosaic(["config:", "  map:", "    center:", "      lat: 3"]);

    const bundleCheck = await checkModBundle(
      { source: MOSAIC_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      { fetch: fetchTestFile },
    );

    expect(bundleCheck.findings).toEqual([]);
  });

  it("Known keys", async function acceptsKnownKeys(): Promise<void> {
    serveMosaicMod();
    serveModMosaic([
      "config:",
      "  columns: 4",
      "  map:",
      "    zoom: 3",
      "aliases:",
      '  country: ["origin"]',
    ]);

    const bundleCheck = await checkModBundle(
      { source: MOSAIC_MOD_SOURCE, collection: null },
      TEST_DEFAULTS,
      { fetch: fetchTestFile },
    );

    expect(bundleCheck.findings).toEqual([]);
  });
});
