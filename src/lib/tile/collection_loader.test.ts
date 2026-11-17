import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  fetchFixture,
  readFixtureText,
  FIXTURES_BASE_URL,
} from "../../test/sample_files.ts";
import {
  fetchTestFile,
  readRequestedUrl,
  testTexts,
} from "../../test/test_files.ts";
import {
  FileFetchError,
  indexLocalFiles,
  YamlParseError,
} from "../files/index.ts";
import type { FileFetchOptions } from "../files/index.ts";
import { CollectionFormatError, loadTileCollection } from "./index.ts";
import type { TileCollection } from "./index.ts";

const SAMPLE_COLLECTION_PATH = "tiles/books_collection.yaml";
const SAMPLE_COLLECTION_URL = `${FIXTURES_BASE_URL}${SAMPLE_COLLECTION_PATH}`;
const BOOKS_URL = `${FIXTURES_BASE_URL}tiles/books/`;
const KALLOCAIN_URL = `${BOOKS_URL}kallocain.md`;
const LOCAL_COLLECTION_URL = "file:///library/books_collection.yaml";
const CODE_RAN_MARKER = "openTeselaCollectionCodeRan";
const SAMPLE_BOOK_FILES = ["farenheit_451.md", "kallocain.md", "fictions.md"];
const EMPTY_COLLECTION_TEXT = 'collection:\n  title: "Empty"\n  tiles: []\n';

interface PendingFetch {
  url: string;
  respond: (response: Response) => void;
}

/** Requests made through `fetchPending` that have not been answered yet. */
const pendingFetches: PendingFetch[] = [];

/** Fetch whose responses stay pending until the test answers them. */
function fetchPending(input: RequestInfo | URL): Promise<Response> {
  const url = readRequestedUrl(input);
  return new Promise(function recordPendingFetch(
    respond: (response: Response) => void,
  ): void {
    pendingFetches.push({ url, respond });
  });
}

async function answerPendingFetch(pendingFetch: PendingFetch): Promise<void> {
  const response = await fetchTestFile(pendingFetch.url);
  pendingFetch.respond(response);
}

function readPendingUrls(): string[] {
  const pendingUrls: string[] = [];
  for (const pendingFetch of pendingFetches) {
    pendingUrls.push(pendingFetch.url);
  }
  return pendingUrls;
}

function waitForPendingFetches(count: number): Promise<void> {
  return vi.waitFor(function checkPendingFetches(): void {
    expect(pendingFetches.length).toBeGreaterThanOrEqual(count);
  });
}

/** Answers the first `count` requests in order. Answering a request twice has no effect. */
async function answerPendingFetchesInOrder(count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await waitForPendingFetches(index + 1);
    await answerPendingFetch(pendingFetches[index]);
  }
}

function waitForNextTask(): Promise<void> {
  return new Promise(function scheduleNextTask(resolve: () => void): void {
    setTimeout(resolve, 0);
  });
}

function createTestFetch(): Mock<typeof fetch> {
  const testFetch = vi.fn<typeof fetch>(fetchTestFile);
  return testFetch;
}

function serveTestFile(url: string, text: string): void {
  testTexts.set(url, text);
}

function buildTileText(title: string): string {
  const tileText = `---\ntitle: "${title}"\n---\nBody of ${title}.\n`;
  return tileText;
}

function buildCollectionText(entryLines: string[]): string {
  const lines = ["collection:", '  title: "Test collection"', "  tiles:"];
  for (const entryLine of entryLines) {
    lines.push(`    ${entryLine}`);
  }
  const collectionText = `${lines.join("\n")}\n`;
  return collectionText;
}

/** Serves a collection of `count` tiles, `./tile_1.md` to `./tile_<count>.md`, next to it. */
function serveNumberedCollection(collectionUrl: string, count: number): void {
  const entryLines: string[] = [];
  for (let number = 1; number <= count; number += 1) {
    entryLines.push(`- path: "./tile_${number}.md"`);
    serveTestFile(
      new URL(`./tile_${number}.md`, collectionUrl).href,
      buildTileText(`Tile ${number}`),
    );
  }
  serveTestFile(collectionUrl, buildCollectionText(entryLines));
}

function readTitles(collection: TileCollection): unknown[] {
  const titles: unknown[] = [];
  for (const tile of collection.tiles) {
    titles.push(tile.metadata.title);
  }
  return titles;
}

function buildPickedBooks(): { path: string; content: Blob }[] {
  const pickedBooks: { path: string; content: Blob }[] = [];
  for (const bookFile of SAMPLE_BOOK_FILES) {
    pickedBooks.push({
      path: `library/books/${bookFile}`,
      content: new Blob([readFixtureText(`tiles/books/${bookFile}`)]),
    });
  }
  return pickedBooks;
}

function catchLoadError(loading: Promise<TileCollection>): Promise<unknown> {
  return loading.then(failOnLoadedCollection, returnLoadError);
}

function failOnLoadedCollection(collection: TileCollection): never {
  throw new Error(
    `Expected loading "${collection.source}" to fail, but it passed`,
  );
}

function returnLoadError(error: unknown): unknown {
  return error;
}

/** Loads a collection served at `url` with `text`, expecting the load to fail. */
async function loadFailingCollection(
  url: string,
  text: string,
  testFetch: Mock<typeof fetch>,
): Promise<unknown> {
  serveTestFile(url, text);
  const options: FileFetchOptions = { fetch: testFetch };
  const error = await catchLoadError(loadTileCollection(url, options));
  return error;
}

function hasCodeRan(): boolean {
  return Reflect.has(globalThis, CODE_RAN_MARKER);
}

describe("loadTileCollection", function describeLoadTileCollection(): void {
  afterEach(function resetTestFiles(): void {
    testTexts.clear();
    pendingFetches.length = 0;
    Reflect.deleteProperty(globalThis, CODE_RAN_MARKER);
  });

  describe("loaded collection", function describeLoadedCollection(): void {
    it("Load the sample collection", async function loadsSampleCollection(): Promise<void> {
      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: fetchFixture,
      });

      expect(Object.keys(collection).sort()).toEqual([
        "description",
        "issues",
        "source",
        "tiles",
        "title",
      ]);
      expect(collection.source).toBe(SAMPLE_COLLECTION_URL);
      expect(collection.title).toBe("Science fiction books");
      expect(collection.description).toBe(
        "A sample book list for demonstration purposes.",
      );
      expect(readTitles(collection)).toEqual([
        "Fahrenheit 451",
        "Kallocain",
        "The Library of Babel",
      ]);
      for (const tile of collection.tiles) {
        expect(tile.types).toEqual([]);
      }
      expect(collection.issues).toEqual([]);
    });

    it("Collection without tiles", async function loadsEmptyCollection(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        'collection:\n  title: "A"\n  tiles: []\n',
      );

      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: testFetch,
      });

      expect(collection.tiles).toEqual([]);
      expect(collection.issues).toEqual([]);
    });
  });

  describe("collection location", function describeCollectionLocation(): void {
    it("Relative collection path with a base URL", async function loadsRelativePath(): Promise<void> {
      const collection = await loadTileCollection(
        "./tiles/books_collection.yaml",
        { baseUrl: FIXTURES_BASE_URL, fetch: fetchFixture },
      );

      expect(collection.source).toBe(SAMPLE_COLLECTION_URL);
    });

    it("Relative collection path without any base", async function rejectsMissingBase(): Promise<void> {
      const testFetch = createTestFetch();

      const error = await catchLoadError(
        loadTileCollection(SAMPLE_COLLECTION_PATH, { fetch: testFetch }),
      );

      expect(error).toBeInstanceOf(FileFetchError);
      expect(error).toMatchObject({ source: SAMPLE_COLLECTION_PATH });
      expect(String(error)).toContain(SAMPLE_COLLECTION_PATH);
      expect(String(error)).toContain("a base URL is required");
      expect(testFetch).not.toHaveBeenCalled();
    });

    it("Collection folder", async function loadsCollectionFolder(): Promise<void> {
      const testFetch = createTestFetch();
      const folderFileUrl =
        "https://example.org/samples/tiles/literature_nobel_laureates/collection.yaml";
      serveTestFile(folderFileUrl, EMPTY_COLLECTION_TEXT);

      const collection = await loadTileCollection(
        "./samples/tiles/literature_nobel_laureates",
        { baseUrl: "https://example.org/", fetch: testFetch },
      );

      expect(collection.source).toBe(folderFileUrl);
      expect(testFetch).toHaveBeenCalledExactlyOnceWith(folderFileUrl);
    });

    it("Folder with a trailing slash and a query", async function loadsFolderWithQuery(): Promise<void> {
      const testFetch = createTestFetch();
      const folderFileUrl = "https://tiles.example.net/books/collection.yaml";
      serveTestFile(folderFileUrl, EMPTY_COLLECTION_TEXT);

      const collection = await loadTileCollection(
        "https://tiles.example.net/books/?v=2",
        { fetch: testFetch },
      );

      expect(collection.source).toBe(folderFileUrl);
      expect(testFetch).toHaveBeenCalledExactlyOnceWith(folderFileUrl);
    });
  });

  describe("collection file format", function describeCollectionFormat(): void {
    it("Description is missing", async function loadsMissingDescription(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        'collection:\n  title: "A"\n  tiles: []\n',
      );

      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: testFetch,
      });

      expect(collection.description).toBe("");
    });

    it("Unknown keys are ignored", async function ignoresUnknownKeys(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        'collection:\n  title: "A"\n  license: "CC-BY"\n  tiles: []\n',
      );

      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: testFetch,
      });

      expect(collection).not.toHaveProperty("license");
      expect(collection.title).toBe("A");
    });
  });

  describe("collection-level failures", function describeCollectionFailures(): void {
    it("Missing tiles list", async function rejectsMissingTiles(): Promise<void> {
      const testFetch = createTestFetch();
      const noTilesUrl = `${FIXTURES_BASE_URL}no_tiles.yaml`;

      const error = await loadFailingCollection(
        noTilesUrl,
        'collection:\n  title: "A"\n',
        testFetch,
      );

      expect(error).toBeInstanceOf(CollectionFormatError);
      expect(error).toMatchObject({ source: noTilesUrl });
      expect(String(error)).toContain('"tiles" must be a list');
      expect(testFetch).toHaveBeenCalledExactlyOnceWith(noTilesUrl);
    });

    it("Missing collection mapping", async function rejectsMissingCollection(): Promise<void> {
      const testFetch = createTestFetch();

      const error = await loadFailingCollection(
        SAMPLE_COLLECTION_URL,
        'title: "A"\n',
        testFetch,
      );

      expect(error).toBeInstanceOf(CollectionFormatError);
      expect(error).toMatchObject({ source: SAMPLE_COLLECTION_URL });
      expect(String(error)).toContain('a "collection" mapping is required');
      expect(testFetch).toHaveBeenCalledOnce();
    });

    it("Title is not a string", async function rejectsNumericTitle(): Promise<void> {
      const testFetch = createTestFetch();

      const error = await loadFailingCollection(
        SAMPLE_COLLECTION_URL,
        'collection:\n  title: 3\n  tiles:\n    - path: "./books/kallocain.md"\n',
        testFetch,
      );

      expect(error).toBeInstanceOf(CollectionFormatError);
      expect(error).toMatchObject({ source: SAMPLE_COLLECTION_URL });
      expect(String(error)).toContain('"title" must be a non-empty string');
      expect(testFetch).toHaveBeenCalledOnce();
    });

    it("Invalid YAML", async function rejectsInvalidYaml(): Promise<void> {
      const testFetch = createTestFetch();
      const badUrl = "https://example.org/bad.yaml";

      const error = await loadFailingCollection(
        badUrl,
        "collection: [unclosed",
        testFetch,
      );

      expect(error).toBeInstanceOf(YamlParseError);
      expect(error).toMatchObject({ source: badUrl });
      expect(String(error)).toContain(badUrl);
      expect(testFetch).toHaveBeenCalledOnce();
    });

    it("Empty file", async function rejectsEmptyFile(): Promise<void> {
      const testFetch = createTestFetch();

      const error = await loadFailingCollection(
        SAMPLE_COLLECTION_URL,
        "",
        testFetch,
      );

      expect(error).toBeInstanceOf(YamlParseError);
      expect(error).toMatchObject({ source: SAMPLE_COLLECTION_URL });
      expect(testFetch).toHaveBeenCalledOnce();
    });

    it("Top level is a list", async function rejectsTopLevelList(): Promise<void> {
      const testFetch = createTestFetch();

      const error = await loadFailingCollection(
        SAMPLE_COLLECTION_URL,
        "- a\n- b\n",
        testFetch,
      );

      expect(error).toBeInstanceOf(YamlParseError);
      expect(error).toMatchObject({ source: SAMPLE_COLLECTION_URL });
      expect(String(error)).toContain("YAML must be a mapping");
      expect(testFetch).toHaveBeenCalledOnce();
    });

    it("Tag for another value type", async function rejectsBinaryTag(): Promise<void> {
      const testFetch = createTestFetch();

      const error = await loadFailingCollection(
        SAMPLE_COLLECTION_URL,
        'collection:\n  title: "A"\n  cover: !!binary aGk=\n  tiles:\n    - path: "./books/kallocain.md"\n',
        testFetch,
      );

      expect(error).toBeInstanceOf(YamlParseError);
      expect(error).toMatchObject({ source: SAMPLE_COLLECTION_URL });
      expect(testFetch).toHaveBeenCalledOnce();
    });

    it("Code tag is never run", async function rejectsFunctionTag(): Promise<void> {
      const testFetch = createTestFetch();

      const error = await loadFailingCollection(
        SAMPLE_COLLECTION_URL,
        `collection:\n  title: !!js/function "function () { globalThis.${CODE_RAN_MARKER} = true; }"\n  tiles: []\n`,
        testFetch,
      );

      expect(error).toBeInstanceOf(YamlParseError);
      expect(error).toMatchObject({ source: SAMPLE_COLLECTION_URL });
      expect(hasCodeRan()).toBe(false);
      expect(testFetch).toHaveBeenCalledOnce();
    });

    it("More than one document", async function rejectsTwoDocuments(): Promise<void> {
      const testFetch = createTestFetch();

      const error = await loadFailingCollection(
        SAMPLE_COLLECTION_URL,
        'collection:\n  title: "A"\n  tiles: []\n---\ncollection:\n  title: "B"\n  tiles: []\n',
        testFetch,
      );

      expect(error).toBeInstanceOf(YamlParseError);
      expect(error).toMatchObject({ source: SAMPLE_COLLECTION_URL });
      expect(testFetch).toHaveBeenCalledOnce();
    });

    it("Collection HTTP 404", async function rejectsMissingCollectionFile(): Promise<void> {
      const testFetch = createTestFetch();
      const missingUrl = `${FIXTURES_BASE_URL}missing.yaml`;

      const error = await catchLoadError(
        loadTileCollection(missingUrl, { fetch: testFetch }),
      );

      expect(error).toBeInstanceOf(FileFetchError);
      expect(error).toMatchObject({ source: missingUrl });
      expect(String(error)).toContain("404");
      expect(testFetch).toHaveBeenCalledOnce();
    });

    it("Caller tells the collection failures apart", async function distinguishesFailures(): Promise<void> {
      const testFetch = createTestFetch();
      const missingUrl = `${FIXTURES_BASE_URL}missing.yaml`;
      const badUrl = "https://example.org/bad.yaml";
      const noTilesUrl = `${FIXTURES_BASE_URL}no_tiles.yaml`;

      const missingError = await catchLoadError(
        loadTileCollection(missingUrl, { fetch: testFetch }),
      );
      const badError = await loadFailingCollection(
        badUrl,
        "collection: [unclosed",
        testFetch,
      );
      const noTilesError = await loadFailingCollection(
        noTilesUrl,
        'collection:\n  title: "A"\n',
        testFetch,
      );

      expect(missingError).toBeInstanceOf(FileFetchError);
      expect(missingError).not.toBeInstanceOf(YamlParseError);
      expect(missingError).not.toBeInstanceOf(CollectionFormatError);
      expect(missingError).toMatchObject({ source: missingUrl });
      expect(badError).toBeInstanceOf(YamlParseError);
      expect(badError).not.toBeInstanceOf(FileFetchError);
      expect(badError).not.toBeInstanceOf(CollectionFormatError);
      expect(badError).toMatchObject({ source: badUrl });
      expect(noTilesError).toBeInstanceOf(CollectionFormatError);
      expect(noTilesError).not.toBeInstanceOf(FileFetchError);
      expect(noTilesError).not.toBeInstanceOf(YamlParseError);
      expect(noTilesError).toMatchObject({ source: noTilesUrl });
    });
  });

  describe("tile entries", function describeTileEntries(): void {
    it("Relative tile path", async function resolvesRelativePath(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        buildCollectionText(['- path: "./books/kallocain.md"']),
      );

      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: testFetch,
      });

      expect(testFetch).toHaveBeenCalledWith(KALLOCAIN_URL);
      expect(collection.tiles[0].source).toBe(KALLOCAIN_URL);
    });

    it("Parent folder path", async function resolvesParentPath(): Promise<void> {
      const testFetch = createTestFetch();
      const otherUrl = `${FIXTURES_BASE_URL}other/kallocain.md`;
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        buildCollectionText(['- path: "../other/kallocain.md"']),
      );
      serveTestFile(otherUrl, readFixtureText("tiles/books/kallocain.md"));

      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: testFetch,
      });

      expect(testFetch).toHaveBeenCalledWith(otherUrl);
      expect(collection.tiles[0].source).toBe(otherUrl);
    });

    it("Absolute tile URL", async function usesAbsoluteUrl(): Promise<void> {
      const testFetch = createTestFetch();
      const otherUrl = "https://other.example/books/kallocain.md";
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        buildCollectionText([`- url: "${otherUrl}"`]),
      );
      serveTestFile(otherUrl, readFixtureText("tiles/books/kallocain.md"));

      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: testFetch,
      });

      expect(testFetch).toHaveBeenCalledWith(otherUrl);
      expect(collection.tiles[0].source).toBe(otherUrl);
    });

    it("Relative tile URL", async function rejectsRelativeUrl(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        buildCollectionText(['- url: "./books/kallocain.md"']),
      );

      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: testFetch,
      });

      expect(testFetch).toHaveBeenCalledExactlyOnceWith(SAMPLE_COLLECTION_URL);
      expect(collection.tiles).toEqual([]);
      expect(collection.issues).toHaveLength(1);
      expect(collection.issues[0].level).toBe("error");
      expect(collection.issues[0].source).toBe(SAMPLE_COLLECTION_URL);
      expect(collection.issues[0].message).toContain(
        '"url" must be an absolute URL',
      );
      expect(collection.issues[0].message).toContain("./books/kallocain.md");
    });

    it("Entry with both path and url", async function rejectsBothKeys(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        buildCollectionText([
          '- path: "./books/farenheit_451.md"',
          '- { path: "./a.md", url: "https://example.org/a.md" }',
          '- path: "./books/fictions.md"',
        ]),
      );

      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: testFetch,
      });

      expect(testFetch).not.toHaveBeenCalledWith(
        `${FIXTURES_BASE_URL}tiles/a.md`,
      );
      expect(testFetch).not.toHaveBeenCalledWith("https://example.org/a.md");
      expect(readTitles(collection)).toEqual([
        "Fahrenheit 451",
        "The Library of Babel",
      ]);
      expect(collection.issues).toHaveLength(1);
      expect(collection.issues[0].level).toBe("error");
      expect(collection.issues[0].source).toBe(SAMPLE_COLLECTION_URL);
      expect(collection.issues[0].message).toContain("Tile entry 2");
      expect(collection.issues[0].message).toContain(
        'must have exactly one of "path" or "url"',
      );
    });

    it("Entry with neither path nor url", async function rejectsNeitherKey(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        buildCollectionText(['- title: "A"']),
      );

      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: testFetch,
      });

      expect(testFetch).toHaveBeenCalledOnce();
      expect(collection.issues).toHaveLength(1);
      expect(collection.issues[0].level).toBe("error");
      expect(collection.issues[0].message).toContain("Tile entry 1");
      expect(collection.issues[0].message).toContain(
        'must have exactly one of "path" or "url"',
      );
    });

    it("Entry is not a mapping", async function rejectsPlainString(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        buildCollectionText(['- "./books/kallocain.md"']),
      );

      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: testFetch,
      });

      expect(testFetch).toHaveBeenCalledOnce();
      expect(collection.issues).toHaveLength(1);
      expect(collection.issues[0].level).toBe("error");
      expect(collection.issues[0].message).toContain("must be a mapping");
    });

    it("Path is not a string", async function rejectsNumericPath(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(SAMPLE_COLLECTION_URL, buildCollectionText(["- path: 42"]));

      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: testFetch,
      });

      expect(testFetch).toHaveBeenCalledOnce();
      expect(collection.issues).toHaveLength(1);
      expect(collection.issues[0].level).toBe("error");
      expect(collection.issues[0].message).toContain(
        '"path" must be a non-empty string',
      );
    });
  });

  describe("tile failures", function describeTileFailures(): void {
    it("One tile cannot be fetched", async function reportsMissingTile(): Promise<void> {
      const testFetch = createTestFetch();
      const missingUrl = `${BOOKS_URL}missing.md`;
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        buildCollectionText([
          '- path: "./books/farenheit_451.md"',
          '- path: "./books/missing.md"',
          '- path: "./books/fictions.md"',
        ]),
      );

      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: testFetch,
      });

      expect(readTitles(collection)).toEqual([
        "Fahrenheit 451",
        "The Library of Babel",
      ]);
      expect(collection.issues).toHaveLength(1);
      expect(collection.issues[0].level).toBe("error");
      expect(collection.issues[0].source).toBe(missingUrl);
      expect(collection.issues[0].message).toContain("404");
    });

    it("One tile has invalid frontmatter", async function reportsInvalidTile(): Promise<void> {
      const testFetch = createTestFetch();
      const badUrl = `${BOOKS_URL}bad.md`;
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        buildCollectionText([
          '- path: "./books/bad.md"',
          '- path: "./books/kallocain.md"',
        ]),
      );
      serveTestFile(badUrl, '---\ntitle: "unterminated\n---\nText');

      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: testFetch,
      });

      expect(readTitles(collection)).toEqual(["Kallocain"]);
      expect(collection.issues).toHaveLength(1);
      expect(collection.issues[0].level).toBe("error");
      expect(collection.issues[0].source).toBe(badUrl);
      expect(collection.issues[0].message).toContain("Cannot parse markdown");
    });

    it("Every tile fails", async function reportsEveryTile(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        buildCollectionText([
          '- path: "./books/missing_1.md"',
          '- path: "./books/missing_2.md"',
          '- path: "./books/missing_3.md"',
        ]),
      );

      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: testFetch,
      });

      expect(collection.tiles).toEqual([]);
      expect(collection.issues).toHaveLength(3);
      for (const issue of collection.issues) {
        expect(issue.level).toBe("error");
        expect(issue.message).toContain("404");
      }
    });

    it("Issue for a failed tile", async function buildsIssueShape(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        buildCollectionText(['- path: "./books/missing.md"']),
      );

      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: testFetch,
      });

      expect(collection.issues).toHaveLength(1);
      expect(Object.keys(collection.issues[0]).sort()).toEqual([
        "level",
        "message",
        "source",
      ]);
      expect(collection.issues[0].level).toBe("error");
      expect(typeof collection.issues[0].source).toBe("string");
      expect(typeof collection.issues[0].message).toBe("string");
    });
  });

  describe("order and parallel loads", function describeOrderAndParallelLoads(): void {
    it("Responses arrive out of order", async function keepsEntryOrder(): Promise<void> {
      const loading = loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: fetchPending,
      });
      await waitForPendingFetches(1);
      await answerPendingFetch(pendingFetches[0]);
      await waitForPendingFetches(4);

      await answerPendingFetch(pendingFetches[3]);
      await answerPendingFetch(pendingFetches[2]);
      await waitForNextTask();
      await answerPendingFetch(pendingFetches[1]);
      const collection = await loading;

      expect(readTitles(collection)).toEqual([
        "Fahrenheit 451",
        "Kallocain",
        "The Library of Babel",
      ]);
    });

    it("Collection larger than the limit", async function limitsParallelLoads(): Promise<void> {
      const collectionUrl = `${FIXTURES_BASE_URL}numbered_collection.yaml`;
      serveNumberedCollection(collectionUrl, 10);
      const loading = loadTileCollection(collectionUrl, {
        fetch: fetchPending,
      });
      await waitForPendingFetches(1);
      await answerPendingFetch(pendingFetches[0]);

      await waitForPendingFetches(7);
      await waitForNextTask();

      expect(readPendingUrls()).toEqual([
        collectionUrl,
        `${FIXTURES_BASE_URL}tile_1.md`,
        `${FIXTURES_BASE_URL}tile_2.md`,
        `${FIXTURES_BASE_URL}tile_3.md`,
        `${FIXTURES_BASE_URL}tile_4.md`,
        `${FIXTURES_BASE_URL}tile_5.md`,
        `${FIXTURES_BASE_URL}tile_6.md`,
      ]);

      await answerPendingFetch(pendingFetches[3]);
      await waitForPendingFetches(8);

      expect(pendingFetches).toHaveLength(8);
      expect(pendingFetches[7].url).toBe(`${FIXTURES_BASE_URL}tile_7.md`);

      await answerPendingFetchesInOrder(11);
      await loading;
    });

    it("Every tile still loads", async function loadsEveryTile(): Promise<void> {
      const testFetch = createTestFetch();
      const collectionUrl = `${FIXTURES_BASE_URL}numbered_collection.yaml`;
      serveNumberedCollection(collectionUrl, 10);

      const collection = await loadTileCollection(collectionUrl, {
        fetch: testFetch,
      });

      expect(readTitles(collection)).toEqual([
        "Tile 1",
        "Tile 2",
        "Tile 3",
        "Tile 4",
        "Tile 5",
        "Tile 6",
        "Tile 7",
        "Tile 8",
        "Tile 9",
        "Tile 10",
      ]);
      expect(collection.issues).toEqual([]);
    });
  });

  describe("repeated tiles", function describeRepeatedTiles(): void {
    it("Same tile listed by path and by URL", async function loadsRepeatOnce(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        buildCollectionText([
          '- path: "./books/kallocain.md"',
          '- path: "./books/fictions.md"',
          `- url: "${KALLOCAIN_URL}"`,
        ]),
      );

      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: testFetch,
      });

      expect(testFetch).toHaveBeenCalledTimes(3);
      expect(readTitles(collection)).toEqual([
        "Kallocain",
        "The Library of Babel",
      ]);
      expect(collection.issues).toHaveLength(1);
      expect(collection.issues[0].level).toBe("warning");
      expect(collection.issues[0].source).toBe(KALLOCAIN_URL);
      expect(collection.issues[0].message).toContain("Tile entry 3");
    });
  });

  describe("local files", function describeLocalFiles(): void {
    it("Remote collection lists a local file", async function rejectsLocalTile(): Promise<void> {
      const testFetch = createTestFetch();
      const localTileUrl = "file:///library/books/kallocain.md";
      const pickedContent = new Blob([
        readFixtureText("tiles/books/kallocain.md"),
      ]);
      const readPickedText = vi.spyOn(pickedContent, "text");
      const localFiles = indexLocalFiles([
        { path: "library/books/kallocain.md", content: pickedContent },
      ]);
      serveTestFile(
        SAMPLE_COLLECTION_URL,
        buildCollectionText([`- url: "${localTileUrl}"`]),
      );

      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: testFetch,
        localFiles,
      });

      expect(readPickedText).not.toHaveBeenCalled();
      expect(collection.tiles).toEqual([]);
      expect(collection.issues).toHaveLength(1);
      expect(collection.issues[0].level).toBe("error");
      expect(collection.issues[0].source).toBe(localTileUrl);
      expect(collection.issues[0].message).toContain(
        "a remote collection cannot list local files",
      );
    });

    it("Collection in a picked folder", async function loadsLocalCollection(): Promise<void> {
      const testFetch = createTestFetch();
      const localFiles = indexLocalFiles([
        {
          path: "library/books_collection.yaml",
          content: new Blob([readFixtureText(SAMPLE_COLLECTION_PATH)]),
        },
        ...buildPickedBooks(),
      ]);

      const collection = await loadTileCollection(LOCAL_COLLECTION_URL, {
        fetch: testFetch,
        localFiles,
      });

      expect(collection.tiles).toHaveLength(3);
      expect(collection.tiles[0].source).toBe(
        "file:///library/books/farenheit_451.md",
      );
      expect(collection.issues).toEqual([]);
      expect(testFetch).not.toHaveBeenCalled();
    });

    it("Local collection lists a remote tile", async function loadsRemoteTile(): Promise<void> {
      const testFetch = createTestFetch();
      const localFiles = indexLocalFiles([
        {
          path: "library/books_collection.yaml",
          content: new Blob([
            buildCollectionText([`- url: "${KALLOCAIN_URL}"`]),
          ]),
        },
      ]);

      const collection = await loadTileCollection(LOCAL_COLLECTION_URL, {
        fetch: testFetch,
        localFiles,
      });

      expect(testFetch).toHaveBeenCalledExactlyOnceWith(KALLOCAIN_URL);
      expect(collection.tiles).toHaveLength(1);
      expect(collection.tiles[0].source).toBe(KALLOCAIN_URL);
    });
  });

  describe("plain data", function describePlainData(): void {
    it("Structured clone of a collection", async function clonesCollection(): Promise<void> {
      const collection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: fetchFixture,
      });

      const clonedCollection = structuredClone(collection);

      expect(clonedCollection).toStrictEqual(collection);
    });

    it("Same collection loaded twice", async function loadsIndependentCollections(): Promise<void> {
      const firstCollection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: fetchFixture,
      });
      const secondCollection = await loadTileCollection(SAMPLE_COLLECTION_URL, {
        fetch: fetchFixture,
      });

      firstCollection.tiles[0].metadata.title = "Changed";

      expect(secondCollection.tiles[0].metadata.title).toBe("Fahrenheit 451");
    });
  });
});
