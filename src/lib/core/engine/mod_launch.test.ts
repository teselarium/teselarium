import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  APP_BASE_URL,
  FIXTURES_BASE_URL,
  FIXTURES_REFERENCE,
} from "../../../test/sample_files.ts";
import {
  APP_ORIGIN,
  FOUR_BOOKS_SOURCE,
  MISSING_MOD_REFERENCE,
  NO_COUNTRY_TILE_SOURCE,
  OTHER_APP_ORIGIN,
  SAMPLE_COLLECTION_REFERENCE,
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_COVERS_PERMISSION,
  SAMPLE_MOD_REFERENCE,
  SAMPLE_MOD_SOURCE,
  SAMPLE_TILE_SOURCES,
  serveFourBooks,
  serveTestMod,
  serveUntypedMod,
  TEST_DEFAULTS,
  UNTYPED_MOD_SOURCE,
} from "../../../test/sample_mods.ts";
import {
  fetchTestFile,
  readRequestedUrl,
  testTexts,
} from "../../../test/test_files.ts";
import { FileFetchError, YamlParseError } from "../../files/index.ts";
import { ModFormatError } from "../../mod/index.ts";
import { CollectionFormatError, TileTypeError } from "../../tile/index.ts";
import { resolveDefaultModSettings } from "./default_mod_settings.ts";
import { ModSwitchedOffError } from "./engine_errors.ts";
import { loadModTiles, prepareModLaunch } from "./mod_launch.ts";
import type { ModLaunch, ModLaunchRequest, RunLink } from "./mod_launch.ts";

const SAMPLE_LINK: RunLink = {
  mod: SAMPLE_MOD_REFERENCE,
  collection: SAMPLE_COLLECTION_REFERENCE,
  params: {},
};

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

function buildLaunchRequest(
  link: RunLink,
  appOrigin: string = APP_ORIGIN,
): ModLaunchRequest {
  const request: ModLaunchRequest = {
    link,
    appOrigin,
    defaults: TEST_DEFAULTS,
  };
  return request;
}

function launchMod(
  link: RunLink,
  appOrigin: string = APP_ORIGIN,
  testFetch: typeof fetch = fetchTestFile,
): Promise<ModLaunch> {
  return prepareModLaunch(buildLaunchRequest(link, appOrigin), {
    baseUrl: APP_BASE_URL,
    fetch: testFetch,
  });
}

function listTileTypes(launch: ModLaunch): string[][] {
  const tileTypes: string[][] = [];
  for (const tile of launch.context.tiles) {
    tileTypes.push(tile.types);
  }
  return tileTypes;
}

describe("prepareModLaunch", function describePrepareModLaunch(): void {
  it("Sample mount context", async function buildsSampleContext(): Promise<void> {
    const launch = await launchMod(SAMPLE_LINK);

    expect(launch.context.mod).toEqual({
      source: SAMPLE_MOD_SOURCE,
      name: "book_list",
      title: "Book List",
      version: "1.0.0",
      description: "A very simple list of books with their covers.",
    });
    expect(launch.context.config).toEqual(launch.mod.config);
    expect(launch.context.params).toEqual({});
    expect(launch.context.permissions).toEqual({
      granted: [SAMPLE_COVERS_PERMISSION],
      denied: [],
    });
    expect(launch.contentHosts).toEqual(["https://example.org"]);
    expect(launch.collectionSource).toBe(SAMPLE_COLLECTION_SOURCE);
    expect(launch.issues).toEqual([]);
  });

  it("Sample tiles are books", async function givesBookTiles(): Promise<void> {
    const launch = await launchMod(SAMPLE_LINK);

    expect(listTileTypes(launch)).toEqual([["book"], ["book"], ["book"]]);
    expect(launch.context.issues).toEqual([]);
  });

  it("Foreign mod sees its denied permissions", async function deniesForeignMod(): Promise<void> {
    const launch = await launchMod(SAMPLE_LINK, OTHER_APP_ORIGIN);

    expect(launch.context.permissions).toEqual({
      granted: [],
      denied: [SAMPLE_COVERS_PERMISSION],
    });
    expect(launch.issues).toHaveLength(1);
    expect(launch.issues[0].level).toBe("warning");
    expect(launch.issues[0].source).toBe(SAMPLE_MOD_SOURCE);
    expect(launch.issues[0].message).toContain(
      'show content from https://upload.wikimedia.org ("Shows the book covers")',
    );
  });

  it("Link parameters", async function copiesParams(): Promise<void> {
    const params = { target: SAMPLE_MOD_SOURCE };

    const launch = await launchMod({ ...SAMPLE_LINK, params });

    expect(launch.context.params).toEqual(params);
    expect(launch.context.params).not.toBe(params);
  });

  it("Mod opened without a collection", async function launchesWithoutCollection(): Promise<void> {
    const testFetch = createTestFetch();

    const launch = await launchMod(
      { ...SAMPLE_LINK, collection: null },
      APP_ORIGIN,
      testFetch,
    );

    expect(launch.context.tiles).toEqual([]);
    expect(launch.context.issues).toEqual([]);
    expect(launch.collectionSource).toBeNull();
    expect(listRequestedUrls(testFetch)).not.toContain(
      SAMPLE_COLLECTION_SOURCE,
    );
  });

  it("Tile of another type is left out", async function leavesOutOtherType(): Promise<void> {
    serveFourBooks();

    const launch = await launchMod({
      ...SAMPLE_LINK,
      collection: FOUR_BOOKS_SOURCE,
    });

    const tileSources: string[] = [];
    for (const tile of launch.context.tiles) {
      tileSources.push(tile.source);
    }
    expect(tileSources).toEqual(SAMPLE_TILE_SOURCES);
    expect(launch.context.issues).toHaveLength(1);
    expect(launch.context.issues[0].level).toBe("warning");
    expect(launch.context.issues[0].source).toBe(NO_COUNTRY_TILE_SOURCE);
  });

  it("Mod without a tile type", async function givesEveryTile(): Promise<void> {
    serveUntypedMod();

    const launch = await launchMod({ ...SAMPLE_LINK, mod: UNTYPED_MOD_SOURCE });

    expect(listTileTypes(launch)).toEqual([[], [], []]);
  });

  it("refuses a switched-off mod before any request", async function refusesSwitchedOff(): Promise<void> {
    const testFetch = createTestFetch();
    const defaults = resolveDefaultModSettings(
      {
        folder: `${FIXTURES_REFERENCE}mods/`,
        switchedOff: ["book_list"],
      },
      APP_BASE_URL,
    );

    const launching = prepareModLaunch(
      { link: SAMPLE_LINK, appOrigin: APP_ORIGIN, defaults },
      { baseUrl: APP_BASE_URL, fetch: testFetch },
    );

    await expect(launching).rejects.toThrow(ModSwitchedOffError);
    await expect(launching).rejects.toThrow(
      'The default mod "book_list" is switched off.',
    );
    expect(testFetch).not.toHaveBeenCalled();
  });

  it("names the covers host in the policy only when granted", async function buildsPolicy(): Promise<void> {
    const grantedLaunch = await launchMod(SAMPLE_LINK);
    const deniedLaunch = await launchMod(SAMPLE_LINK, OTHER_APP_ORIGIN);

    expect(grantedLaunch.sandboxDocument).toContain(
      "https://upload.wikimedia.org",
    );
    expect(deniedLaunch.sandboxDocument).not.toContain(
      "https://upload.wikimedia.org",
    );
    expect(deniedLaunch.sandboxDocument).toContain(
      "img-src data: blob: https://example.org;",
    );
  });

  it("builds the frame document with the mod's theme setting", async function passesTheme(): Promise<void> {
    const plainSource = `${APP_BASE_URL}mods/plain/mod_conf.yaml`;
    serveTestMod(plainSource, [
      '  name: "plain"',
      '  version: "0.1.0"',
      '  entrypoint: "./main.js"',
      '  theme: "none"',
    ]);

    const sampleLaunch = await launchMod(SAMPLE_LINK);
    const plainLaunch = await launchMod({
      mod: plainSource,
      collection: null,
      params: {},
    });

    expect(sampleLaunch.sandboxDocument).toContain("<style>");
    expect(plainLaunch.sandboxDocument).not.toContain("<style");
  });

  it("Structured clone of the mount context", async function clonesContext(): Promise<void> {
    const launch = await launchMod(SAMPLE_LINK);

    expect(structuredClone(launch.context)).toEqual(launch.context);
    expect(structuredClone(launch)).toEqual(launch);
  });

  it("propagates mod file errors with their classes", async function propagatesModErrors(): Promise<void> {
    testTexts.set(
      `${FIXTURES_BASE_URL}mods/no_mod/mod_conf.yaml`,
      'name: "no mod mapping"',
    );
    testTexts.set(
      `${FIXTURES_BASE_URL}mods/bad_yaml/mod_conf.yaml`,
      "mod: [unclosed",
    );

    await expect(
      launchMod({ ...SAMPLE_LINK, mod: MISSING_MOD_REFERENCE }),
    ).rejects.toThrow(FileFetchError);
    await expect(
      launchMod({ ...SAMPLE_LINK, mod: `${FIXTURES_REFERENCE}mods/no_mod` }),
    ).rejects.toThrow(ModFormatError);
    await expect(
      launchMod({ ...SAMPLE_LINK, mod: `${FIXTURES_REFERENCE}mods/bad_yaml` }),
    ).rejects.toThrow(YamlParseError);
  });

  it("propagates type file errors with their classes", async function propagatesTypeErrors(): Promise<void> {
    const brokenTypeSource = `${FIXTURES_BASE_URL}mods/broken_type/mod_conf.yaml`;
    serveTestMod(brokenTypeSource, [
      '  name: "broken_type"',
      '  version: "0.1.0"',
      '  entrypoint: "./main.js"',
      '  type_path: "./type.md"',
    ]);
    testTexts.set(
      `${FIXTURES_BASE_URL}mods/broken_type/type.md`,
      "---\ntitle: no schema\n---\n",
    );

    await expect(
      launchMod({ ...SAMPLE_LINK, mod: brokenTypeSource }),
    ).rejects.toThrow(TileTypeError);
  });

  it("propagates collection errors with their classes", async function propagatesCollectionErrors(): Promise<void> {
    testTexts.set(
      `${FIXTURES_BASE_URL}tiles/not_a_collection.yaml`,
      'name: "no collection mapping"',
    );

    await expect(
      launchMod({
        ...SAMPLE_LINK,
        collection: `${FIXTURES_REFERENCE}tiles/missing.yaml`,
      }),
    ).rejects.toThrow(
      `Cannot load file "${FIXTURES_BASE_URL}tiles/missing.yaml": HTTP 404`,
    );
    await expect(
      launchMod({
        ...SAMPLE_LINK,
        collection: `${FIXTURES_REFERENCE}tiles/not_a_collection.yaml`,
      }),
    ).rejects.toThrow(CollectionFormatError);
  });
});

describe("loadModTiles", function describeLoadModTiles(): void {
  it("gives the same tiles when called again", async function reloadsTiles(): Promise<void> {
    const launch = await launchMod(SAMPLE_LINK);
    const options = { baseUrl: APP_BASE_URL, fetch: fetchTestFile };

    const firstTiles = await loadModTiles(
      launch.mod,
      SAMPLE_COLLECTION_SOURCE,
      options,
    );
    const secondTiles = await loadModTiles(
      launch.mod,
      SAMPLE_COLLECTION_SOURCE,
      options,
    );

    expect(firstTiles).toEqual(secondTiles);
    expect(firstTiles.collectionSource).toBe(SAMPLE_COLLECTION_SOURCE);
    expect(firstTiles.tiles).toEqual(launch.context.tiles);
    expect(firstTiles.issues).toEqual([]);
  });
});
