import { afterEach, describe, expect, it } from "vitest";
import { fetchFixture, FIXTURES_BASE_URL } from "../../test/sample_files.ts";
import {
  buildBookMetadata,
  buildBookTileWithout,
  buildTestTile,
  buildTypeText,
  fetchTestFile,
  SIMPLE_EVENT_TYPE_TEXT,
  testTexts,
} from "../../test/test_files.ts";
import {
  buildTileValidator,
  loadTileCollection,
  validateTileCollection,
} from "./index.ts";
import type { Tile, TileCollection, TileValidator } from "./index.ts";

const SAMPLE_COLLECTION_URL = `${FIXTURES_BASE_URL}tiles/books_collection.yaml`;
const BOOK_TYPE_URL = `${FIXTURES_BASE_URL}types/book.md`;
const TYPES_URL = "https://example.org/types/";
const TILES_URL = "https://example.org/tiles/";
const TEST_COLLECTION_URL = `${TILES_URL}test_collection.yaml`;
const NO_COUNTRY_URL = `${TILES_URL}no_country.md`;

const COUNTRY_LOCATION_TYPE_TEXT = buildTypeText([
  "schema:",
  "  definitions:",
  "    country_location:",
  "      properties:",
  "        title:",
  "          type: string",
  "        country:",
  "          type: string",
  "  ref: country_location",
]);

function serveTestFile(url: string, text: string): void {
  testTexts.set(url, text);
}

function buildBookValidator(): Promise<TileValidator> {
  return buildTileValidator(BOOK_TYPE_URL, { fetch: fetchFixture });
}

/** Serves a type file at `<TYPES_URL><fileName>` and builds a validator from it. */
async function buildTestValidator(
  fileName: string,
  typeText: string,
): Promise<TileValidator> {
  const typeUrl = `${TYPES_URL}${fileName}`;
  serveTestFile(typeUrl, typeText);
  const tileValidator = await buildTileValidator(typeUrl, {
    fetch: fetchTestFile,
  });
  return tileValidator;
}

function loadSampleCollection(): Promise<TileCollection> {
  return loadTileCollection(SAMPLE_COLLECTION_URL, { fetch: fetchFixture });
}

function buildTestCollection(tiles: Tile[]): TileCollection {
  const tileCollection: TileCollection = {
    source: TEST_COLLECTION_URL,
    title: "Test collection",
    description: "",
    tiles,
    issues: [],
  };
  return tileCollection;
}

function buildBookTile(fileName: string, types: string[]): Tile {
  const tile = buildTestTile(`${TILES_URL}${fileName}`, buildBookMetadata());
  tile.types = types;
  return tile;
}

function readTypes(tileCollection: TileCollection): string[][] {
  const typeLists: string[][] = [];
  for (const tile of tileCollection.tiles) {
    typeLists.push(tile.types);
  }
  return typeLists;
}

function readSources(tiles: Tile[]): string[] {
  const sources: string[] = [];
  for (const tile of tiles) {
    sources.push(tile.source);
  }
  return sources;
}

describe("validateTileCollection", function describeValidateTileCollection(): void {
  afterEach(function resetTestFiles(): void {
    testTexts.clear();
  });

  describe("validated collection", function describeValidatedCollection(): void {
    it("Validate the sample collection", async function validatesSampleCollection(): Promise<void> {
      const tileCollection = await loadSampleCollection();
      const bookValidator = await buildBookValidator();

      const validatedCollection = validateTileCollection(
        tileCollection,
        bookValidator,
      );

      expect(validatedCollection.source).toBe(SAMPLE_COLLECTION_URL);
      expect(validatedCollection.title).toBe(tileCollection.title);
      expect(validatedCollection.description).toBe(tileCollection.description);
      expect(readSources(validatedCollection.tiles)).toEqual(
        readSources(tileCollection.tiles),
      );
      expect(readTypes(validatedCollection)).toEqual([
        ["book"],
        ["book"],
        ["book"],
      ]);
      expect(validatedCollection.issues).toEqual([]);
    });

    it("Collection without tiles", async function validatesEmptyCollection(): Promise<void> {
      const bookValidator = await buildBookValidator();

      const validatedCollection = validateTileCollection(
        buildTestCollection([]),
        bookValidator,
      );

      expect(validatedCollection.tiles).toEqual([]);
      expect(validatedCollection.issues).toEqual([]);
    });
  });

  describe("type names", function describeTypeNames(): void {
    it("Tile already has another type", async function appendsTypeName(): Promise<void> {
      const bookValidator = await buildBookValidator();
      const tileCollection = buildTestCollection([
        buildBookTile("event_book.md", ["simple_event"]),
      ]);

      const validatedCollection = validateTileCollection(
        tileCollection,
        bookValidator,
      );

      expect(validatedCollection.tiles[0].types).toEqual([
        "simple_event",
        "book",
      ]);
    });

    it("Tile already has the type", async function keepsTypeName(): Promise<void> {
      const bookValidator = await buildBookValidator();
      const tileCollection = buildTestCollection([
        buildBookTile("book.md", ["book"]),
      ]);

      const validatedCollection = validateTileCollection(
        tileCollection,
        bookValidator,
      );

      expect(validatedCollection.tiles[0].types).toEqual(["book"]);
    });
  });

  describe("tiles that do not match", function describeMismatchingTiles(): void {
    it("One tile does not match", async function warnsForOneTile(): Promise<void> {
      const bookValidator = await buildBookValidator();
      const tileCollection = buildTestCollection([
        buildBookTile("first.md", []),
        buildBookTileWithout(NO_COUNTRY_URL, "country"),
        buildBookTile("third.md", []),
      ]);

      const validatedCollection = validateTileCollection(
        tileCollection,
        bookValidator,
      );

      expect(readSources(validatedCollection.tiles)).toEqual([
        `${TILES_URL}first.md`,
        NO_COUNTRY_URL,
        `${TILES_URL}third.md`,
      ]);
      expect(readTypes(validatedCollection)).toEqual([["book"], [], ["book"]]);
      expect(validatedCollection.issues).toHaveLength(1);
      expect(validatedCollection.issues[0].level).toBe("warning");
      expect(validatedCollection.issues[0].source).toBe(NO_COUNTRY_URL);
      expect(validatedCollection.issues[0].message).toContain("book");
      expect(validatedCollection.issues[0].message).toContain("country");
    });

    it("No tile matches", async function warnsForEveryTile(): Promise<void> {
      const bookValidator = await buildBookValidator();
      const firstUrl = `${TILES_URL}first_text.md`;
      const secondUrl = `${TILES_URL}second_text.md`;
      const tileCollection = buildTestCollection([
        buildTestTile(firstUrl, {}),
        buildTestTile(secondUrl, {}),
      ]);

      const validatedCollection = validateTileCollection(
        tileCollection,
        bookValidator,
      );

      expect(readTypes(validatedCollection)).toEqual([[], []]);
      expect(validatedCollection.issues).toHaveLength(2);
      expect(validatedCollection.issues[0].level).toBe("warning");
      expect(validatedCollection.issues[0].source).toBe(firstUrl);
      expect(validatedCollection.issues[1].level).toBe("warning");
      expect(validatedCollection.issues[1].source).toBe(secondUrl);
    });

    it("Issue shape", async function buildsIssueShape(): Promise<void> {
      const bookValidator = await buildBookValidator();
      const tileCollection = buildTestCollection([
        buildBookTileWithout(NO_COUNTRY_URL, "country"),
      ]);

      const validatedCollection = validateTileCollection(
        tileCollection,
        bookValidator,
      );

      expect(validatedCollection.issues).toHaveLength(1);
      expect(Object.keys(validatedCollection.issues[0]).sort()).toEqual([
        "level",
        "message",
        "source",
      ]);
      expect(validatedCollection.issues[0].level).toBe("warning");
      expect(typeof validatedCollection.issues[0].source).toBe("string");
      expect(typeof validatedCollection.issues[0].message).toBe("string");
    });
  });

  describe("existing issues", function describeExistingIssues(): void {
    it("Collection loaded with a failed tile", async function keepsExistingIssues(): Promise<void> {
      const missingUrl = `${TILES_URL}missing.md`;
      serveTestFile(
        TEST_COLLECTION_URL,
        'collection:\n  title: "Test collection"\n  tiles:\n    - path: "./missing.md"\n    - path: "./no_country.md"\n',
      );
      serveTestFile(
        NO_COUNTRY_URL,
        '---\ntitle: "Fahrenheit 451"\ndate: "1953-10-19"\nauthors:\n  - "Ray Bradbury"\ngenres:\n  - "Dystopian"\n---\nBody.\n',
      );
      const tileCollection = await loadTileCollection(TEST_COLLECTION_URL, {
        fetch: fetchTestFile,
      });
      const bookValidator = await buildBookValidator();

      const validatedCollection = validateTileCollection(
        tileCollection,
        bookValidator,
      );

      expect(validatedCollection.issues).toHaveLength(2);
      expect(validatedCollection.issues[0]).toEqual(tileCollection.issues[0]);
      expect(validatedCollection.issues[0].level).toBe("error");
      expect(validatedCollection.issues[0].source).toBe(missingUrl);
      expect(validatedCollection.issues[0].message).toContain("404");
      expect(validatedCollection.issues[1].level).toBe("warning");
      expect(validatedCollection.issues[1].source).toBe(NO_COUNTRY_URL);
      expect(validatedCollection.issues[1].message).toContain("country");
    });
  });

  describe("idempotency", function describeIdempotency(): void {
    it("Validate the sample collection twice", async function validatesTwice(): Promise<void> {
      const tileCollection = await loadSampleCollection();
      const bookValidator = await buildBookValidator();

      const firstResult = validateTileCollection(tileCollection, bookValidator);
      const secondResult = validateTileCollection(firstResult, bookValidator);

      expect(secondResult).toStrictEqual(firstResult);
      expect(readTypes(secondResult)).toEqual([["book"], ["book"], ["book"]]);
    });

    it("Tile that does not match, validated twice", async function warnsOnce(): Promise<void> {
      const tileCollection = buildTestCollection([
        buildBookTileWithout(NO_COUNTRY_URL, "country"),
      ]);
      const firstValidator = await buildBookValidator();
      const secondValidator = await buildBookValidator();

      const firstResult = validateTileCollection(
        tileCollection,
        firstValidator,
      );
      const secondResult = validateTileCollection(firstResult, secondValidator);

      expect(secondResult.issues).toHaveLength(1);
      expect(secondResult.issues[0].source).toBe(NO_COUNTRY_URL);
    });
  });

  describe("several tile types", function describeSeveralTileTypes(): void {
    it("Two types that match", async function addsBothTypes(): Promise<void> {
      const tileCollection = await loadSampleCollection();
      const bookValidator = await buildBookValidator();
      const eventValidator = await buildTestValidator(
        "simple_event.md",
        SIMPLE_EVENT_TYPE_TEXT,
      );

      const validatedCollection = validateTileCollection(
        validateTileCollection(tileCollection, bookValidator),
        eventValidator,
      );

      expect(readTypes(validatedCollection)).toEqual([
        ["book", "simple_event"],
        ["book", "simple_event"],
        ["book", "simple_event"],
      ]);
    });

    it("Two types that do not match", async function warnsForBothTypes(): Promise<void> {
      const tileCollection = buildTestCollection([
        buildBookTileWithout(NO_COUNTRY_URL, "country"),
      ]);
      const bookValidator = await buildBookValidator();
      const locationValidator = await buildTestValidator(
        "country_location.md",
        COUNTRY_LOCATION_TYPE_TEXT,
      );

      const validatedCollection = validateTileCollection(
        validateTileCollection(tileCollection, bookValidator),
        locationValidator,
      );

      expect(validatedCollection.tiles[0].types).toEqual([]);
      expect(validatedCollection.issues).toHaveLength(2);
      expect(validatedCollection.issues[0].message).toContain('"book"');
      expect(validatedCollection.issues[1].message).toContain(
        '"country_location"',
      );
    });
  });

  describe("input collection", function describeInputCollection(): void {
    it("Input unchanged", async function keepsInput(): Promise<void> {
      const tileCollection = await loadSampleCollection();
      const collectionBefore = structuredClone(tileCollection);
      const bookValidator = await buildBookValidator();

      validateTileCollection(tileCollection, bookValidator);

      expect(tileCollection).toStrictEqual(collectionBefore);
      expect(readTypes(tileCollection)).toEqual([[], [], []]);
    });

    it("Result independent of the input", async function sharesNothing(): Promise<void> {
      const tileCollection = await loadSampleCollection();
      const bookValidator = await buildBookValidator();

      const validatedCollection = validateTileCollection(
        tileCollection,
        bookValidator,
      );
      validatedCollection.tiles[0].metadata.title = "Changed";

      expect(tileCollection.tiles[0].metadata.title).toBe("Fahrenheit 451");
    });

    it("Structured clone of the result", async function clonesResult(): Promise<void> {
      const tileCollection = await loadSampleCollection();
      const bookValidator = await buildBookValidator();

      const validatedCollection = validateTileCollection(
        tileCollection,
        bookValidator,
      );
      const clonedCollection = structuredClone(validatedCollection);

      expect(clonedCollection).toStrictEqual(validatedCollection);
    });
  });
});
