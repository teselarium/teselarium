import { YAMLException } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";
import { FIXTURES_BASE_URL, readFixtureText } from "../../test/sample_files.ts";
import { YamlParseError } from "./file_errors.ts";
import type { FetchedFile } from "./file_fetcher.ts";
import { parseYaml } from "./yaml_parser.ts";

const TEST_SOURCE = `${FIXTURES_BASE_URL}test.yaml`;
const COLLECTION_PATH = "tiles/books_collection.yaml";
const CODE_RAN_MARKER = "teselariumYamlCodeRan";

function buildFetchedFile(content: string): FetchedFile {
  const fetchedFile: FetchedFile = { source: TEST_SOURCE, content };
  return fetchedFile;
}

function parseExpectingError(file: FetchedFile): YamlParseError {
  try {
    parseYaml(file);
  } catch (error) {
    if (error instanceof YamlParseError) {
      return error;
    }
    throw error;
  }
  throw new Error(`Expected parsing "${file.source}" to fail, but it passed`);
}

function hasCodeRan(): boolean {
  return Reflect.has(globalThis, CODE_RAN_MARKER);
}

describe("parseYaml", function describeParseYaml(): void {
  afterEach(function removeCodeRanMarker(): void {
    Reflect.deleteProperty(globalThis, CODE_RAN_MARKER);
  });

  describe("valid YAML", function describeValidYaml(): void {
    it("parses the sample collection", function parsesSampleCollection(): void {
      const parsed = parseYaml(
        buildFetchedFile(readFixtureText(COLLECTION_PATH)),
      );

      expect(parsed.source).toBe(TEST_SOURCE);
      expect(parsed.content.collection).toMatchObject({
        title: "Science fiction books",
      });
    });

    it("Unquoted date stays a string", function keepsDateString(): void {
      const parsed = parseYaml(buildFetchedFile("date: 1953-10-19\n"));

      expect(parsed.content.date).toBe("1953-10-19");
    });
  });

  describe("invalid YAML", function describeInvalidYaml(): void {
    it("Empty file", function rejectsEmptyFile(): void {
      const error = parseExpectingError(buildFetchedFile(""));

      expect(error.source).toBe(TEST_SOURCE);
      expect(error.message).toContain(TEST_SOURCE);
    });

    it("rejects a comment-only file", function rejectsCommentOnlyFile(): void {
      const error = parseExpectingError(buildFetchedFile("# only a comment\n"));

      expect(error.source).toBe(TEST_SOURCE);
      expect(error.message).toContain(TEST_SOURCE);
    });

    it("Invalid YAML", function rejectsInvalidYaml(): void {
      const error = parseExpectingError(
        buildFetchedFile("collection: [unclosed"),
      );

      expect(error.source).toBe(TEST_SOURCE);
      expect(error.message).toContain(TEST_SOURCE);
      expect(error.cause).toBeInstanceOf(YAMLException);
    });

    it("More than one document", function rejectsTwoDocuments(): void {
      const error = parseExpectingError(
        buildFetchedFile('name: "A"\n---\nname: "B"\n'),
      );

      expect(error.source).toBe(TEST_SOURCE);
      expect(error.message).toContain(TEST_SOURCE);
    });

    it("Repeated key", function rejectsRepeatedKey(): void {
      const error = parseExpectingError(
        buildFetchedFile('name: "A"\nname: "B"\n'),
      );

      expect(error.source).toBe(TEST_SOURCE);
      expect(error.message).toContain(TEST_SOURCE);
    });

    it("Tag for another value type", function rejectsBinaryTag(): void {
      const error = parseExpectingError(
        buildFetchedFile("cover: !!binary aGk=\n"),
      );

      expect(error.source).toBe(TEST_SOURCE);
      expect(error.message).toContain(TEST_SOURCE);
    });

    it("Code tag is never run", function rejectsFunctionTag(): void {
      const content = `name: !!js/function "function () { globalThis.${CODE_RAN_MARKER} = true; }"\n`;

      const error = parseExpectingError(buildFetchedFile(content));

      expect(error.source).toBe(TEST_SOURCE);
      expect(error.message).toContain(TEST_SOURCE);
      expect(hasCodeRan()).toBe(false);
    });
  });

  describe("top level", function describeTopLevel(): void {
    it("Top level is a list", function rejectsList(): void {
      const error = parseExpectingError(buildFetchedFile("- a\n- b\n"));

      expect(error.source).toBe(TEST_SOURCE);
      expect(error.message).toContain("YAML must be a mapping");
    });

    it("rejects a single value at the top level", function rejectsScalar(): void {
      const error = parseExpectingError(buildFetchedFile("just a value\n"));

      expect(error.message).toContain("YAML must be a mapping");
    });
  });

  describe("independent results", function describeIndependentResults(): void {
    it("gives independent content for the same file", function parsesIndependently(): void {
      const fetchedFile = buildFetchedFile(readFixtureText(COLLECTION_PATH));

      const firstParsed = parseYaml(fetchedFile);
      const secondParsed = parseYaml(fetchedFile);
      firstParsed.content.collection = "Changed";

      expect(secondParsed.content).not.toBe(firstParsed.content);
      expect(secondParsed.content.collection).toMatchObject({
        title: "Science fiction books",
      });
    });
  });
});
