import { describe, expect, it } from "vitest";
import { FIXTURES_BASE_URL, readFixtureText } from "../../test/sample_files.ts";
import { parseYaml } from "../files/index.ts";
import type { ParsedYaml } from "../files/index.ts";
import { readCollectionFormat, readTileEntry } from "./collection_format.ts";
import { CollectionFormatError } from "./tile_errors.ts";

const TEST_SOURCE = `${FIXTURES_BASE_URL}test_collection.yaml`;
const COLLECTION_PATH = "tiles/books_collection.yaml";

function parseCollectionText(content: string): ParsedYaml {
  const parsedYaml = parseYaml({ source: TEST_SOURCE, content });
  return parsedYaml;
}

function readExpectingError(parsedYaml: ParsedYaml): CollectionFormatError {
  try {
    readCollectionFormat(parsedYaml);
  } catch (error) {
    if (error instanceof CollectionFormatError) {
      return error;
    }
    throw error;
  }
  throw new Error(
    `Expected reading "${parsedYaml.source}" to fail, but it passed`,
  );
}

describe("readCollectionFormat", function describeReadCollectionFormat(): void {
  describe("valid collections", function describeValidCollections(): void {
    it("reads the sample collection", function readsSampleCollection(): void {
      const collectionFormat = readCollectionFormat(
        parseCollectionText(readFixtureText(COLLECTION_PATH)),
      );

      expect(collectionFormat.name).toBe("Science fiction books");
      expect(collectionFormat.description).toBe(
        "A sample book list for demonstration purposes.",
      );
      expect(collectionFormat.entries).toEqual([
        { path: "./books/farenheit_451.md" },
        { path: "./books/kallocain.md" },
        { path: "./books/fictions.md" },
      ]);
    });

    it("Description is missing", function readsMissingDescription(): void {
      const collectionFormat = readCollectionFormat(
        parseCollectionText('collection:\n  name: "A"\n  tiles: []\n'),
      );

      expect(collectionFormat.description).toBe("");
    });

    it("Unknown keys are ignored", function ignoresUnknownKeys(): void {
      const collectionFormat = readCollectionFormat(
        parseCollectionText(
          'collection:\n  name: "A"\n  license: "CC-BY"\n  tiles: []\n',
        ),
      );

      expect(Object.keys(collectionFormat).sort()).toEqual([
        "description",
        "entries",
        "name",
      ]);
    });
  });

  describe("wrong structure", function describeWrongStructure(): void {
    it("Missing collection mapping", function rejectsMissingCollection(): void {
      const error = readExpectingError(parseCollectionText('name: "A"\n'));

      expect(error.source).toBe(TEST_SOURCE);
      expect(error.message).toContain(TEST_SOURCE);
      expect(error.message).toContain('a "collection" mapping is required');
    });

    it("rejects a collection that is not a mapping", function rejectsCollectionList(): void {
      const error = readExpectingError(parseCollectionText("collection: []\n"));

      expect(error.message).toContain('a "collection" mapping is required');
    });

    it("rejects a missing name", function rejectsMissingName(): void {
      const error = readExpectingError(
        parseCollectionText("collection:\n  tiles: []\n"),
      );

      expect(error.source).toBe(TEST_SOURCE);
      expect(error.message).toContain('"name" must be a non-empty string');
    });

    it("rejects an empty name", function rejectsEmptyName(): void {
      const error = readExpectingError(
        parseCollectionText('collection:\n  name: ""\n  tiles: []\n'),
      );

      expect(error.message).toContain('"name" must be a non-empty string');
    });

    it("Name is not a string", function rejectsNumericName(): void {
      const error = readExpectingError(
        parseCollectionText("collection:\n  name: 3\n  tiles: []\n"),
      );

      expect(error.message).toContain('"name" must be a non-empty string');
    });

    it("rejects a description that is not a string", function rejectsNumericDescription(): void {
      const error = readExpectingError(
        parseCollectionText(
          'collection:\n  name: "A"\n  description: 3\n  tiles: []\n',
        ),
      );

      expect(error.source).toBe(TEST_SOURCE);
      expect(error.message).toContain('"description" must be a string');
    });

    it("Missing tiles list", function rejectsMissingTiles(): void {
      const error = readExpectingError(
        parseCollectionText('collection:\n  name: "A"\n'),
      );

      expect(error.source).toBe(TEST_SOURCE);
      expect(error.message).toContain('"tiles" must be a list');
    });

    it("rejects tiles that are not a list", function rejectsTilesMapping(): void {
      const error = readExpectingError(
        parseCollectionText(
          'collection:\n  name: "A"\n  tiles:\n    path: "./a.md"\n',
        ),
      );

      expect(error.message).toContain('"tiles" must be a list');
    });
  });
});

describe("readTileEntry", function describeReadTileEntry(): void {
  it("reads a path entry", function readsPathEntry(): void {
    const tileEntry = readTileEntry({ path: "./books/kallocain.md" }, 1);

    expect(tileEntry).toStrictEqual({
      kind: "path",
      location: "./books/kallocain.md",
    });
  });

  it("reads a url entry", function readsUrlEntry(): void {
    const tileEntry = readTileEntry(
      { url: "https://other.example/books/kallocain.md" },
      1,
    );

    expect(tileEntry).toStrictEqual({
      kind: "url",
      location: "https://other.example/books/kallocain.md",
    });
  });

  it("ignores an extra key next to path", function ignoresExtraKey(): void {
    const tileEntry = readTileEntry(
      { path: "./books/kallocain.md", title: "Kallocain" },
      1,
    );

    expect(tileEntry).toStrictEqual({
      kind: "path",
      location: "./books/kallocain.md",
    });
  });

  it("Entry is not a mapping", function rejectsPlainString(): void {
    const tileEntry = readTileEntry("./books/kallocain.md", 3);

    expect(tileEntry).toStrictEqual({
      kind: "malformed",
      position: 3,
      reason: "must be a mapping",
    });
  });

  it("Entry with both path and url", function rejectsBothKeys(): void {
    const tileEntry = readTileEntry(
      { path: "./a.md", url: "https://example.org/a.md" },
      2,
    );

    expect(tileEntry).toStrictEqual({
      kind: "malformed",
      position: 2,
      reason: 'must have exactly one of "path" or "url"',
    });
  });

  it("Entry with neither path nor url", function rejectsNeitherKey(): void {
    const tileEntry = readTileEntry({ title: "A" }, 1);

    expect(tileEntry).toStrictEqual({
      kind: "malformed",
      position: 1,
      reason: 'must have exactly one of "path" or "url"',
    });
  });

  it("Path is not a string", function rejectsNumericPath(): void {
    const tileEntry = readTileEntry({ path: 42 }, 1);

    expect(tileEntry).toStrictEqual({
      kind: "malformed",
      position: 1,
      reason: '"path" must be a non-empty string',
    });
  });

  it("rejects an empty path", function rejectsEmptyPath(): void {
    const tileEntry = readTileEntry({ path: "" }, 1);

    expect(tileEntry).toStrictEqual({
      kind: "malformed",
      position: 1,
      reason: '"path" must be a non-empty string',
    });
  });
});
