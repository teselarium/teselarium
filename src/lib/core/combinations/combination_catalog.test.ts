import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildTypeText,
  fetchTestFile,
  readRequestedUrl,
  testTexts,
} from "../../../test/test_files.ts";
import type { CatalogListing } from "../engine/index.ts";
import {
  buildCountKey,
  createCombinationCatalog,
  dropCollection,
  readCombinationSnapshot,
  refreshCatalog,
  requestCounts,
  requestSummaries,
  subscribeCombinations,
} from "./combination_catalog.ts";
import type { CombinationCatalog, Loadable } from "./combination_catalog.ts";
import type { TileCount } from "./tile_counts.ts";

const BASE = "https://example.org/combinations/";
const BOOK_MOD = `${BASE}book_mod/mod_conf.yaml`;
const BOOK_ENTRYPOINT = `${BASE}book_mod/main.js`;
const BOOK_LIBRARY = `${BASE}book_mod/vendor/helper.js`;
const UNTYPED_MOD = `${BASE}untyped_mod/mod_conf.yaml`;
const BOOK_TYPE = `${BASE}types/book.md`;
const PEOPLE = `${BASE}people/collection.yaml`;
const PERSON_TILES = [`${BASE}people/ada.md`, `${BASE}people/alan.md`];
const BOOK_TILE = `${BASE}books/kallocain.md`;
const MOSAIC = `${BASE}mosaics/people_books.yaml`;
const MISSING_MOD = `${BASE}missing/mod_conf.yaml`;

afterEach(function clearTexts(): void {
  testTexts.clear();
});

function serveFixtures(): void {
  testTexts.set(
    BOOK_MOD,
    [
      "mod:",
      '  title: "Book mod"',
      '  version: "1.2.0"',
      '  api: "^0.1.0"',
      '  entrypoint: "./main.js"',
      '  type_path: "../types/book.md"',
      "  libraries:",
      "    helper:",
      '      files: ["./vendor/helper.js"]',
    ].join("\n"),
  );
  testTexts.set(
    UNTYPED_MOD,
    [
      "mod:",
      '  title: "Untyped mod"',
      '  version: "0.1.0"',
      '  entrypoint: "./main.js"',
    ].join("\n"),
  );
  testTexts.set(
    BOOK_TYPE,
    buildTypeText([
      "schema:",
      "  definitions:",
      "    book:",
      "      properties:",
      "        title:",
      "          type: string",
      "        country:",
      "          type: string",
      "  ref: book",
    ]),
  );
  testTexts.set(
    PEOPLE,
    [
      "collection:",
      '  title: "People"',
      "  tiles:",
      '    - path: "./ada.md"',
      '    - path: "./alan.md"',
    ].join("\n"),
  );
  for (const tile of PERSON_TILES) {
    testTexts.set(tile, '---\nname: "Someone"\nbirth_country: "UK"\n---\n');
  }
  testTexts.set(BOOK_TILE, '---\ntitle: "Kallocain"\ncountry: "Sweden"\n---\n');
  testTexts.set(
    MOSAIC,
    [
      "mosaic:",
      '  title: "People as books"',
      '  mod: "../book_mod"',
      '  collection: "../people/collection.yaml"',
      "  aliases:",
      '    title: ["name"]',
      '    country: ["birth_country"]',
    ].join("\n"),
  );
}

const LISTING: CatalogListing = {
  mods: [{ source: BOOK_MOD }],
  collections: [{ source: PEOPLE }],
  mosaics: [{ source: MOSAIC, defaultOf: null }],
};

function readListing(): Promise<CatalogListing> {
  return Promise.resolve(LISTING);
}

/** Serves the fixtures and keeps each requested URL. */
function fetchRecorded(
  requested: string[],
  input: RequestInfo | URL,
): Promise<Response> {
  requested.push(readRequestedUrl(input));
  return fetchTestFile(input);
}

/** A combination catalog on the fixtures, with the requested URLs. */
function buildCatalog(): { catalog: CombinationCatalog; requested: string[] } {
  serveFixtures();
  const requested: string[] = [];
  const catalog = createCombinationCatalog({
    fetchOptions: {
      baseUrl: BASE,
      fetch: fetchRecorded.bind(undefined, requested),
      defaultModsFolder: `${BASE}default_mods/`,
    },
    readCatalog: readListing,
  });
  const built = { catalog, requested };
  return built;
}

function readCount(
  catalog: CombinationCatalog,
  mod: string,
  target: string,
): Loadable<TileCount> | undefined {
  return readCombinationSnapshot(catalog).counts[buildCountKey(mod, target)];
}

describe("requestCounts", function describeRequestCounts(): void {
  it("Laureates without aliases: no person tile is a book", async function countsNoMatch(): Promise<void> {
    const { catalog } = buildCatalog();

    await requestCounts(catalog, [BOOK_MOD], {
      kind: "collection",
      source: PEOPLE,
    });

    expect(readCount(catalog, BOOK_MOD, PEOPLE)).toEqual({
      state: "loaded",
      value: { matching: 0, total: 2 },
    });
  });

  it("Mod without a tile type: any, with no tile requested", async function countsAny(): Promise<void> {
    const { catalog, requested } = buildCatalog();

    await requestCounts(catalog, [UNTYPED_MOD], {
      kind: "collection",
      source: PEOPLE,
    });

    expect(readCount(catalog, UNTYPED_MOD, PEOPLE)).toEqual({
      state: "loaded",
      value: "any",
    });
    expect(requested).toEqual([UNTYPED_MOD]);
  });

  it("counts a tile target as one tile", async function countsTile(): Promise<void> {
    const { catalog } = buildCatalog();

    await requestCounts(catalog, [BOOK_MOD], {
      kind: "tile",
      source: BOOK_TILE,
    });
    await requestCounts(catalog, [BOOK_MOD], {
      kind: "tile",
      source: PERSON_TILES[0],
    });

    expect(readCount(catalog, BOOK_MOD, BOOK_TILE)).toEqual({
      state: "loaded",
      value: { matching: 1, total: 1 },
    });
    expect(readCount(catalog, BOOK_MOD, PERSON_TILES[0])).toEqual({
      state: "loaded",
      value: { matching: 0, total: 1 },
    });
  });

  it("requests the mod file, its type file, the collection and its tiles, and no entrypoint, library or mosaic", async function requestsOnlyCountFiles(): Promise<void> {
    const { catalog, requested } = buildCatalog();

    await requestCounts(catalog, [BOOK_MOD], {
      kind: "collection",
      source: PEOPLE,
    });

    expect([...requested].sort()).toEqual(
      [BOOK_MOD, BOOK_TYPE, PEOPLE, ...PERSON_TILES].sort(),
    );
    expect(requested).not.toContain(BOOK_ENTRYPOINT);
    expect(requested).not.toContain(BOOK_LIBRARY);
    expect(requested).not.toContain(MOSAIC);
  });

  it("Second opening: no file is requested again", async function keepsCounts(): Promise<void> {
    const { catalog, requested } = buildCatalog();
    const target = { kind: "collection", source: PEOPLE } as const;
    await requestCounts(catalog, [BOOK_MOD], target);
    const firstCount = requested.length;

    await requestCounts(catalog, [BOOK_MOD], target);

    expect(requested).toHaveLength(firstCount);
  });

  it("shows a loading mark until the count is known", function marksLoading(): void {
    const { catalog } = buildCatalog();

    void requestCounts(catalog, [BOOK_MOD], {
      kind: "collection",
      source: PEOPLE,
    });

    expect(readCount(catalog, BOOK_MOD, PEOPLE)).toEqual({ state: "loading" });
  });

  it("gives the reason of a mod file that cannot be loaded", async function failsMissingMod(): Promise<void> {
    const { catalog } = buildCatalog();

    await requestCounts(catalog, [MISSING_MOD], {
      kind: "collection",
      source: PEOPLE,
    });

    expect(readCount(catalog, MISSING_MOD, PEOPLE)).toMatchObject({
      state: "failed",
      reason: expect.stringContaining("404"),
    });
  });
});

describe("dropCollection", function describeDropCollection(): void {
  it("drops the collection's counts and tiles, so the next request measures again", async function dropsCounts(): Promise<void> {
    const { catalog, requested } = buildCatalog();
    const target = { kind: "collection", source: PEOPLE } as const;
    await requestCounts(catalog, [BOOK_MOD], target);
    requested.length = 0;

    dropCollection(catalog, PEOPLE);
    const dropped = readCount(catalog, BOOK_MOD, PEOPLE);
    await requestCounts(catalog, [BOOK_MOD], target);

    expect(dropped).toBeUndefined();
    expect([...requested].sort()).toEqual([PEOPLE, ...PERSON_TILES].sort());
  });
});

describe("requestSummaries", function describeRequestSummaries(): void {
  it("loads the summaries of mods, collections and mosaics once", async function loadsSummaries(): Promise<void> {
    const { catalog, requested } = buildCatalog();
    const request = {
      mods: [BOOK_MOD],
      collections: [PEOPLE],
      mosaics: [MOSAIC],
    };

    await requestSummaries(catalog, request);
    const firstCount = requested.length;
    await requestSummaries(catalog, request);

    const snapshot = readCombinationSnapshot(catalog);
    expect(snapshot.mods[BOOK_MOD]).toEqual({
      state: "loaded",
      value: {
        source: BOOK_MOD,
        title: "Book mod",
        version: "1.2.0",
        typeSource: BOOK_TYPE,
      },
    });
    expect(snapshot.collections[PEOPLE]).toEqual({
      state: "loaded",
      value: { source: PEOPLE, title: "People" },
    });
    expect(snapshot.mosaics[MOSAIC]).toEqual({
      state: "loaded",
      value: {
        source: MOSAIC,
        title: "People as books",
        mod: BOOK_MOD,
        collection: PEOPLE,
        aliases: { title: ["name"], country: ["birth_country"] },
      },
    });
    expect(requested).toHaveLength(firstCount);
    expect(requested).not.toContain(BOOK_ENTRYPOINT);
  });
});

describe("refreshCatalog", function describeRefreshCatalog(): void {
  it("keeps the catalog it read and notifies the listeners", async function readsCatalog(): Promise<void> {
    const { catalog } = buildCatalog();
    const listener = vi.fn<() => void>();
    subscribeCombinations(catalog, listener);

    await refreshCatalog(catalog);

    expect(readCombinationSnapshot(catalog).listing).toEqual(LISTING);
    expect(listener).toHaveBeenCalled();
  });
});
