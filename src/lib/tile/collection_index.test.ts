import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { FIXTURES_BASE_URL } from "../../test/sample_files.ts";
import {
  fetchTestFile,
  readRequestedUrl,
  testTexts,
} from "../../test/test_files.ts";
import { FileFetchError, YamlParseError } from "../files/index.ts";
import {
  CollectionFormatError,
  loadTileCollection,
  readTileCollectionIndex,
} from "./index.ts";
import type { TileCollectionIndex, TileIssue } from "./index.ts";

const SAMPLE_COLLECTION_URL = `${FIXTURES_BASE_URL}tiles/books_collection.yaml`;
const BOOKS_URL = `${FIXTURES_BASE_URL}tiles/books/`;
const KALLOCAIN_URL = `${BOOKS_URL}kallocain.md`;
const MISSING_TILE_URL = `${BOOKS_URL}missing.md`;
const MISSING_COLLECTION_URL = `${FIXTURES_BASE_URL}missing.yaml`;

function createTestFetch(): Mock<typeof fetch> {
  const testFetch = vi.fn<typeof fetch>(fetchTestFile);
  return testFetch;
}

function serveTestFile(url: string, text: string): void {
  testTexts.set(url, text);
}

function buildCollectionText(entryLines: string[]): string {
  const lines = ["collection:", '  name: "Test collection"', "  tiles:"];
  for (const entryLine of entryLines) {
    lines.push(`    ${entryLine}`);
  }
  const collectionText = `${lines.join("\n")}\n`;
  return collectionText;
}

function readRequestedUrls(testFetch: Mock<typeof fetch>): string[] {
  const requestedUrls: string[] = [];
  for (const call of testFetch.mock.calls) {
    requestedUrls.push(readRequestedUrl(call[0]));
  }
  return requestedUrls;
}

function failOnReadIndex(collectionIndex: TileCollectionIndex): never {
  throw new Error(
    `Expected reading "${collectionIndex.source}" to fail, but it passed`,
  );
}

function returnReadError(error: unknown): unknown {
  return error;
}

function catchReadError(
  reading: Promise<TileCollectionIndex>,
): Promise<unknown> {
  return reading.then(failOnReadIndex, returnReadError);
}

/** The issues whose source is not `tileSource`: a loaded collection's entry issues, without one tile's load issue. */
function removeIssuesOf(issues: TileIssue[], tileSource: string): TileIssue[] {
  const otherIssues: TileIssue[] = [];
  for (const issue of issues) {
    if (issue.source !== tileSource) {
      otherIssues.push(issue);
    }
  }
  return otherIssues;
}

describe("readTileCollectionIndex", function describeReadTileCollectionIndex(): void {
  afterEach(function resetTestFiles(): void {
    testTexts.clear();
  });

  describe("index", function describeIndex(): void {
    it("Index of the sample collection", async function readsSampleIndex(): Promise<void> {
      const testFetch = createTestFetch();

      const collectionIndex = await readTileCollectionIndex(
        SAMPLE_COLLECTION_URL,
        { fetch: testFetch },
      );

      expect(Object.keys(collectionIndex).sort()).toEqual([
        "description",
        "issues",
        "name",
        "source",
        "tiles",
      ]);
      expect(collectionIndex.source).toBe(SAMPLE_COLLECTION_URL);
      expect(collectionIndex.name).toBe("Science fiction books");
      expect(collectionIndex.description).toBe(
        "A sample book list for demonstration purposes.",
      );
      expect(collectionIndex.tiles).toEqual([
        `${BOOKS_URL}farenheit_451.md`,
        KALLOCAIN_URL,
        `${BOOKS_URL}fictions.md`,
      ]);
      expect(collectionIndex.issues).toEqual([]);
      expect(readRequestedUrls(testFetch)).toEqual([SAMPLE_COLLECTION_URL]);
    });

    it("Collection without tiles", async function readsEmptyIndex(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        'collection:\n  name: "A"\n  tiles: []\n',
      );

      const collectionIndex = await readTileCollectionIndex(
        SAMPLE_COLLECTION_URL,
        { fetch: testFetch },
      );

      expect(collectionIndex.tiles).toEqual([]);
      expect(collectionIndex.issues).toEqual([]);
    });

    it("Relative location with a base URL", async function readsRelativeLocation(): Promise<void> {
      const testFetch = createTestFetch();

      const collectionIndex = await readTileCollectionIndex(
        "./tiles/books_collection.yaml",
        { baseUrl: FIXTURES_BASE_URL, fetch: testFetch },
      );

      expect(collectionIndex.source).toBe(SAMPLE_COLLECTION_URL);
    });
  });

  describe("entry rules", function describeEntryRules(): void {
    it("Repeated tile is listed once", async function listsRepeatOnce(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        buildCollectionText([
          '- path: "./books/kallocain.md"',
          '- path: "./books/fictions.md"',
          `- url: "${KALLOCAIN_URL}"`,
        ]),
      );

      const collectionIndex = await readTileCollectionIndex(
        SAMPLE_COLLECTION_URL,
        { fetch: testFetch },
      );

      expect(collectionIndex.tiles).toEqual([
        KALLOCAIN_URL,
        `${BOOKS_URL}fictions.md`,
      ]);
      expect(collectionIndex.issues).toHaveLength(1);
      expect(collectionIndex.issues[0].level).toBe("warning");
      expect(collectionIndex.issues[0].source).toBe(KALLOCAIN_URL);
    });

    it("Malformed entry", async function reportsMalformedEntry(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        buildCollectionText([
          '- path: "./books/farenheit_451.md"',
          '- { path: "./a.md", url: "https://example.org/a.md" }',
          '- path: "./books/fictions.md"',
        ]),
      );

      const collectionIndex = await readTileCollectionIndex(
        SAMPLE_COLLECTION_URL,
        { fetch: testFetch },
      );

      expect(collectionIndex.tiles).toEqual([
        `${BOOKS_URL}farenheit_451.md`,
        `${BOOKS_URL}fictions.md`,
      ]);
      expect(collectionIndex.issues).toHaveLength(1);
      expect(collectionIndex.issues[0].level).toBe("error");
      expect(collectionIndex.issues[0].source).toBe(SAMPLE_COLLECTION_URL);
      expect(collectionIndex.issues[0].message).toContain("Tile entry 2");
    });

    it("Tile that would fail to load", async function listsMissingTile(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        buildCollectionText(['- path: "./books/missing.md"']),
      );

      const collectionIndex = await readTileCollectionIndex(
        SAMPLE_COLLECTION_URL,
        { fetch: testFetch },
      );

      expect(collectionIndex.tiles).toEqual([MISSING_TILE_URL]);
      expect(collectionIndex.issues).toEqual([]);
      expect(readRequestedUrls(testFetch)).toEqual([SAMPLE_COLLECTION_URL]);
    });

    it("Index and loaded collection agree", async function agreesWithLoader(): Promise<void> {
      const indexFetch = createTestFetch();
      const loadFetch = createTestFetch();
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        buildCollectionText([
          '- path: "./books/farenheit_451.md"',
          '- { path: "./a.md", url: "https://example.org/a.md" }',
          '- url: "./books/fictions.md"',
          `- url: "${KALLOCAIN_URL}"`,
          '- path: "./books/kallocain.md"',
          '- url: "file:///library/books/fictions.md"',
          '- path: "./books/missing.md"',
          '- "./books/fictions.md"',
          "- path: 7",
        ]),
      );

      const collectionIndex = await readTileCollectionIndex(
        SAMPLE_COLLECTION_URL,
        { fetch: indexFetch },
      );
      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: loadFetch,
      });

      expect(collectionIndex.tiles).toEqual(
        readRequestedUrls(loadFetch).slice(1),
      );
      expect(collectionIndex.tiles).toEqual([
        `${BOOKS_URL}farenheit_451.md`,
        KALLOCAIN_URL,
        MISSING_TILE_URL,
      ]);
      expect(collectionIndex.issues).toEqual(
        removeIssuesOf(collection.issues, MISSING_TILE_URL),
      );
      expect(collectionIndex.issues).toHaveLength(6);
    });
  });

  describe("failures", function describeFailures(): void {
    it("Collection file missing", async function rejectsMissingFile(): Promise<void> {
      const testFetch = createTestFetch();

      const error = await catchReadError(
        readTileCollectionIndex(MISSING_COLLECTION_URL, { fetch: testFetch }),
      );

      expect(error).toBeInstanceOf(FileFetchError);
      expect(error).toMatchObject({ source: MISSING_COLLECTION_URL });
      expect(String(error)).toContain("404");
    });

    it("Not plain YAML", async function rejectsInvalidYaml(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(SAMPLE_COLLECTION_URL, "collection: [unclosed");

      const error = await catchReadError(
        readTileCollectionIndex(SAMPLE_COLLECTION_URL, { fetch: testFetch }),
      );

      expect(error).toBeInstanceOf(YamlParseError);
      expect(error).toMatchObject({ source: SAMPLE_COLLECTION_URL });
    });

    it("Wrong structure", async function rejectsMissingTiles(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(SAMPLE_COLLECTION_URL, 'collection:\n  name: "A"\n');

      const error = await catchReadError(
        readTileCollectionIndex(SAMPLE_COLLECTION_URL, { fetch: testFetch }),
      );

      expect(error).toBeInstanceOf(CollectionFormatError);
      expect(error).toMatchObject({ source: SAMPLE_COLLECTION_URL });
      expect(String(error)).toContain('"tiles" must be a list');
    });
  });

  describe("plain data", function describePlainData(): void {
    it("Structured clone of an index", async function clonesIndex(): Promise<void> {
      const testFetch = createTestFetch();

      const collectionIndex = await readTileCollectionIndex(
        SAMPLE_COLLECTION_URL,
        { fetch: testFetch },
      );

      expect(structuredClone(collectionIndex)).toStrictEqual(collectionIndex);
    });
  });
});
