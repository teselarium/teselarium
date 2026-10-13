import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  fetchSample,
  readSampleText,
  SAMPLES_BASE_URL,
} from "../../test/sample_files.ts";
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
  FileFetchError,
  indexLocalFiles,
  loadTile,
  MarkdownParseError,
  TileTypeError,
  TileValidationError,
  validateTile,
} from "./index.ts";
import type { Tile, TileValidator } from "./index.ts";

const BOOK_TYPE_URL = `${SAMPLES_BASE_URL}types/book.md`;
const KALLOCAIN_URL = `${SAMPLES_BASE_URL}tiles/books/kallocain.md`;
const TYPES_URL = "https://example.org/types/";
const NO_COUNTRY_URL = "https://example.org/tiles/no_country.md";
const NO_TITLE_URL = "https://example.org/tiles/no_title.md";
const TEST_TILE_URL = "https://example.org/tiles/test_tile.md";

function createTestFetch(): Mock<typeof fetch> {
  const testFetch = vi.fn<typeof fetch>(fetchTestFile);
  return testFetch;
}

function serveTestFile(url: string, text: string): void {
  testTexts.set(url, text);
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

function buildBookValidator(): Promise<TileValidator> {
  return buildTileValidator(BOOK_TYPE_URL, { fetch: fetchSample });
}

function catchBuildError(building: Promise<TileValidator>): Promise<unknown> {
  return building.then(failOnBuiltValidator, returnBuildError);
}

function failOnBuiltValidator(tileValidator: TileValidator): never {
  throw new Error(
    `Expected building "${tileValidator.source}" to fail, but it passed`,
  );
}

function returnBuildError(error: unknown): unknown {
  return error;
}

/** Serves a type file at `<TYPES_URL><fileName>`, expecting the build to fail. */
function buildFailingValidator(
  fileName: string,
  typeText: string,
): Promise<unknown> {
  return catchBuildError(buildTestValidator(fileName, typeText));
}

function catchValidationError(
  tile: Tile,
  tileValidator: TileValidator,
): unknown {
  try {
    validateTile(tile, tileValidator);
  } catch (error) {
    return error;
  }
  throw new Error(
    `Expected validating "${tile.source}" to fail, but it passed`,
  );
}

/** A `book` type whose `title` field is described by `titleLines`. */
function buildBookTitleTypeText(titleLines: string[]): string {
  const frontmatterLines = [
    "schema:",
    "  definitions:",
    "    book:",
    "      properties:",
    "        title:",
  ];
  for (const titleLine of titleLines) {
    frontmatterLines.push(`          ${titleLine}`);
  }
  frontmatterLines.push("  ref: book");
  return buildTypeText(frontmatterLines);
}

const NO_SCHEMA_TYPE_TEXT = buildTypeText(['title: "Not a type"']);

const CLOSED_EVENT_TYPE_TEXT = buildTypeText([
  "schema:",
  "  definitions:",
  "    closed_event:",
  "      properties:",
  "        title:",
  "          type: string",
  "        date:",
  "          type: string",
  "      additionalProperties: false",
  "  ref: closed_event",
]);

const PUBLISHED_TYPE_TEXT = buildTypeText([
  "schema:",
  "  definitions:",
  "    published:",
  "      properties:",
  "        publisher:",
  "          properties:",
  "            name:",
  "              type: string",
  "  ref: published",
]);

const EDITIONS_TYPE_TEXT = buildTypeText([
  "schema:",
  "  definitions:",
  "    edited:",
  "      properties:",
  "        editions:",
  "          elements:",
  "            properties:",
  "              year:",
  "                type: uint16",
  "  ref: edited",
]);

const PLACE_TYPE_TEXT = buildTypeText([
  "schema:",
  "  definitions:",
  "    place:",
  "      properties:",
  "        properties:",
  "          type: string",
  "  ref: place",
]);

describe("buildTileValidator", function describeBuildTileValidator(): void {
  afterEach(function resetTestFiles(): void {
    testTexts.clear();
  });

  describe("type file location", function describeTypeFileLocation(): void {
    it("Build from the sample book type", async function buildsBookType(): Promise<void> {
      const tileValidator = await buildBookValidator();

      expect(tileValidator.typeName).toBe("book");
      expect(tileValidator.source).toBe(BOOK_TYPE_URL);
    });

    it("Relative type path with a base URL", async function buildsRelativePath(): Promise<void> {
      const testFetch = createTestFetch();

      const tileValidator = await buildTileValidator("./types/book.md", {
        baseUrl: SAMPLES_BASE_URL,
        fetch: testFetch,
      });

      expect(testFetch).toHaveBeenCalledExactlyOnceWith(BOOK_TYPE_URL);
      expect(tileValidator.source).toBe(BOOK_TYPE_URL);
    });

    it("Type file in a picked folder", async function buildsLocalType(): Promise<void> {
      const testFetch = createTestFetch();
      const localFiles = indexLocalFiles([
        {
          path: "library/types/book.md",
          content: new Blob([readSampleText("types/book.md")]),
        },
      ]);

      const tileValidator = await buildTileValidator(
        "file:///library/types/book.md",
        { fetch: testFetch, localFiles },
      );

      expect(tileValidator.typeName).toBe("book");
      expect(testFetch).not.toHaveBeenCalled();
    });
  });

  describe("type files that cannot be read", function describeUnreadableTypeFiles(): void {
    it("Type file HTTP 404", async function rejectsMissingTypeFile(): Promise<void> {
      const missingUrl = `${SAMPLES_BASE_URL}types/missing.md`;

      const error = await catchBuildError(
        buildTileValidator(missingUrl, { fetch: fetchSample }),
      );

      expect(error).toBeInstanceOf(FileFetchError);
      expect(error).toMatchObject({ source: missingUrl });
      expect(String(error)).toContain("404");
    });

    it("Type file with invalid frontmatter", async function rejectsInvalidFrontmatter(): Promise<void> {
      const error = await buildFailingValidator(
        "bad.md",
        '---\nschema: "unterminated\n---\n',
      );

      expect(error).toBeInstanceOf(MarkdownParseError);
      expect(error).toMatchObject({ source: `${TYPES_URL}bad.md` });
    });
  });

  describe("schema mapping", function describeSchemaMapping(): void {
    it("Type file without a schema", async function rejectsMissingSchema(): Promise<void> {
      const error = await buildFailingValidator(
        "plain.md",
        NO_SCHEMA_TYPE_TEXT,
      );

      expect(error).toBeInstanceOf(TileTypeError);
      expect(error).toMatchObject({ source: `${TYPES_URL}plain.md` });
      expect(String(error)).toContain(`${TYPES_URL}plain.md`);
      expect(String(error)).toContain('"schema" is missing');
    });

    it("Type file without frontmatter", async function rejectsPlainMarkdown(): Promise<void> {
      const error = await buildFailingValidator("text.md", "# Just text\n");

      expect(error).toBeInstanceOf(TileTypeError);
      expect(error).toMatchObject({ source: `${TYPES_URL}text.md` });
      expect(String(error)).toContain('"schema" is missing');
    });

    it("Schema is not a mapping", async function rejectsStringSchema(): Promise<void> {
      const error = await buildFailingValidator(
        "string_schema.md",
        buildTypeText(['schema: "book"']),
      );

      expect(error).toBeInstanceOf(TileTypeError);
      expect(error).toMatchObject({ source: `${TYPES_URL}string_schema.md` });
      expect(String(error)).toContain('"schema" must be a mapping');
    });
  });

  describe("type name", function describeTypeName(): void {
    it("Schema without ref", async function rejectsMissingRef(): Promise<void> {
      const error = await buildFailingValidator(
        "no_ref.md",
        buildTypeText([
          "schema:",
          "  definitions:",
          "    book:",
          "      properties:",
          "        title:",
          "          type: string",
        ]),
      );

      expect(error).toBeInstanceOf(TileTypeError);
      expect(error).toMatchObject({ source: `${TYPES_URL}no_ref.md` });
      expect(String(error)).toContain(`${TYPES_URL}no_ref.md`);
      expect(String(error)).toContain(
        '"schema.ref" must be a non-empty string',
      );
    });

    it("Ref names a missing definition", async function rejectsMissingDefinition(): Promise<void> {
      const error = await buildFailingValidator(
        "novel.md",
        buildTypeText([
          "schema:",
          "  definitions:",
          "    book:",
          "      properties:",
          "        title:",
          "          type: string",
          "  ref: novel",
        ]),
      );

      expect(error).toBeInstanceOf(TileTypeError);
      expect(error).toMatchObject({ source: `${TYPES_URL}novel.md` });
      expect(String(error)).toContain(`${TYPES_URL}novel.md`);
      expect(String(error)).toContain("novel");
      expect(String(error)).toContain("not one of the schema's definitions");
    });
  });

  describe("JSON Type Definition", function describeJsonTypeDefinition(): void {
    it("Unknown type name", async function rejectsUnknownType(): Promise<void> {
      const typeUrl = `${TYPES_URL}text_type.md`;

      const error = await buildFailingValidator(
        "text_type.md",
        buildBookTitleTypeText(["type: text"]),
      );

      expect(error).toBeInstanceOf(TileTypeError);
      expect(error).toMatchObject({
        source: typeUrl,
        message: `Invalid tile type "${typeUrl}": "schema" is not valid JSON Type Definition`,
      });
      expect((error as TileTypeError).cause).toBeInstanceOf(Error);
    });

    it("Keyword from another schema language", async function rejectsForeignKeyword(): Promise<void> {
      const error = await buildFailingValidator(
        "min_length.md",
        buildBookTitleTypeText(["type: string", "minLength: 1"]),
      );

      expect(error).toBeInstanceOf(TileTypeError);
      expect(error).toMatchObject({ source: `${TYPES_URL}min_length.md` });
      expect((error as TileTypeError).cause).toBeInstanceOf(Error);
    });

    it("Descriptions under metadata", async function acceptsMetadata(): Promise<void> {
      const tileValidator = await buildTestValidator(
        "described.md",
        buildBookTitleTypeText([
          "type: string",
          "metadata:",
          '  description: "Title of the book"',
        ]),
      );

      expect(tileValidator.typeName).toBe("book");
    });
  });

  describe("failure kinds", function describeFailureKinds(): void {
    it("Caller tells the type file failures apart", async function distinguishesFailures(): Promise<void> {
      const missingUrl = `${TYPES_URL}missing.md`;
      const badUrl = `${TYPES_URL}bad.md`;
      const plainUrl = `${TYPES_URL}plain.md`;
      serveTestFile(badUrl, '---\nschema: "unterminated\n---\n');
      serveTestFile(plainUrl, NO_SCHEMA_TYPE_TEXT);

      const missingError = await catchBuildError(
        buildTileValidator(missingUrl, { fetch: fetchTestFile }),
      );
      const badError = await catchBuildError(
        buildTileValidator(badUrl, { fetch: fetchTestFile }),
      );
      const plainError = await catchBuildError(
        buildTileValidator(plainUrl, { fetch: fetchTestFile }),
      );

      expect(missingError).toBeInstanceOf(FileFetchError);
      expect(missingError).not.toBeInstanceOf(MarkdownParseError);
      expect(missingError).not.toBeInstanceOf(TileTypeError);
      expect(missingError).toMatchObject({ source: missingUrl });
      expect(badError).toBeInstanceOf(MarkdownParseError);
      expect(badError).not.toBeInstanceOf(FileFetchError);
      expect(badError).not.toBeInstanceOf(TileTypeError);
      expect(badError).toMatchObject({ source: badUrl });
      expect(plainError).toBeInstanceOf(TileTypeError);
      expect(plainError).not.toBeInstanceOf(FileFetchError);
      expect(plainError).not.toBeInstanceOf(MarkdownParseError);
      expect(plainError).toMatchObject({ source: plainUrl });
    });
  });
});

describe("validateTile", function describeValidateTile(): void {
  afterEach(function resetTestFiles(): void {
    testTexts.clear();
  });

  describe("extra fields", function describeExtraFields(): void {
    it("Omitted at the top level", async function acceptsExtraTopLevelField(): Promise<void> {
      const tileValidator = await buildTestValidator(
        "simple_event.md",
        SIMPLE_EVENT_TYPE_TEXT,
      );
      const tile = buildTestTile(TEST_TILE_URL, {
        title: "Launch",
        date: "2026-10-12",
        pages: 3,
      });

      expect(validateTile(tile, tileValidator)).toBe("simple_event");
    });

    it("Omitted in a nested object", async function acceptsExtraNestedField(): Promise<void> {
      const tileValidator = await buildTestValidator(
        "published.md",
        PUBLISHED_TYPE_TEXT,
      );
      const tile = buildTestTile(TEST_TILE_URL, {
        publisher: { name: "Ace", city: "New York" },
      });

      expect(validateTile(tile, tileValidator)).toBe("published");
    });

    it("Omitted for objects in a list", async function acceptsExtraListField(): Promise<void> {
      const tileValidator = await buildTestValidator(
        "edited.md",
        EDITIONS_TYPE_TEXT,
      );
      const tile = buildTestTile(TEST_TILE_URL, {
        editions: [{ year: 1953, format: "paperback" }],
      });

      expect(validateTile(tile, tileValidator)).toBe("edited");
    });

    it("Explicitly false", async function rejectsExtraField(): Promise<void> {
      const tileValidator = await buildTestValidator(
        "closed_event.md",
        CLOSED_EVENT_TYPE_TEXT,
      );
      const tile = buildTestTile(TEST_TILE_URL, {
        title: "Launch",
        date: "2026-10-12",
        pages: 3,
      });

      const error = catchValidationError(tile, tileValidator);

      expect(error).toBeInstanceOf(TileValidationError);
      expect(String(error)).toContain("pages");
    });

    it("Field named properties", async function acceptsPropertiesField(): Promise<void> {
      const tileValidator = await buildTestValidator(
        "place.md",
        PLACE_TYPE_TEXT,
      );
      const tile = buildTestTile(TEST_TILE_URL, {
        properties: "three rooms",
        title: "Flat",
      });

      expect(validateTile(tile, tileValidator)).toBe("place");
    });
  });

  describe("matching tiles", function describeMatchingTiles(): void {
    it("Matching sample tile", async function matchesKallocain(): Promise<void> {
      const tileValidator = await buildBookValidator();
      const tile = await loadTile(KALLOCAIN_URL, { fetch: fetchSample });

      expect(validateTile(tile, tileValidator)).toBe("book");
    });

    it("Optional property absent", async function matchesWithoutLanguage(): Promise<void> {
      const tileValidator = await buildBookValidator();
      const tile = buildTestTile(TEST_TILE_URL, buildBookMetadata());

      expect(validateTile(tile, tileValidator)).toBe("book");
    });

    it("Optional property with the wrong type", async function rejectsNumericLanguage(): Promise<void> {
      const tileValidator = await buildBookValidator();
      const tile = buildTestTile(TEST_TILE_URL, {
        ...buildBookMetadata(),
        language: 3,
      });

      const error = catchValidationError(tile, tileValidator);

      expect(error).toBeInstanceOf(TileValidationError);
      expect(String(error)).toContain("language");
    });
  });

  describe("tiles that do not match", function describeMismatchingTiles(): void {
    it("Missing required field", async function rejectsMissingCountry(): Promise<void> {
      const tileValidator = await buildBookValidator();
      const tile = buildBookTileWithout(NO_COUNTRY_URL, "country");

      const error = catchValidationError(tile, tileValidator);

      expect(error).toBeInstanceOf(TileValidationError);
      expect(error).toMatchObject({ source: NO_COUNTRY_URL });
      expect(String(error)).toContain(NO_COUNTRY_URL);
      expect(String(error)).toContain("book");
      expect(String(error)).toContain(BOOK_TYPE_URL);
      expect(String(error)).toContain("country");
    });

    it("Wrong field type", async function rejectsStringAuthors(): Promise<void> {
      const tileValidator = await buildBookValidator();
      const tile = buildTestTile(TEST_TILE_URL, {
        ...buildBookMetadata(),
        authors: "Ray Bradbury",
      });

      const error = catchValidationError(tile, tileValidator);

      expect(error).toBeInstanceOf(TileValidationError);
      expect(String(error)).toContain("authors");
    });

    it("Several mismatches", async function reportsEveryMismatch(): Promise<void> {
      const tileValidator = await buildBookValidator();
      const tile = buildBookTileWithout(NO_COUNTRY_URL, "country");
      tile.metadata.genres = "Dystopian";

      const error = catchValidationError(tile, tileValidator);

      expect(error).toBeInstanceOf(TileValidationError);
      expect(String(error)).toContain("country");
      expect(String(error)).toContain("genres");
    });

    it("Tile without metadata", async function rejectsEmptyMetadata(): Promise<void> {
      const tileValidator = await buildBookValidator();
      serveTestFile(TEST_TILE_URL, "# Just text\n");
      const tile = await loadTile(TEST_TILE_URL, { fetch: fetchTestFile });

      const error = catchValidationError(tile, tileValidator);

      expect(error).toBeInstanceOf(TileValidationError);
      expect(String(error)).toContain("title");
    });

    it("Caller tells a mismatch from a bad type", async function distinguishesMismatch(): Promise<void> {
      const typeError = await buildFailingValidator(
        "plain.md",
        NO_SCHEMA_TYPE_TEXT,
      );
      const tileValidator = await buildBookValidator();

      const validationError = catchValidationError(
        buildBookTileWithout(NO_COUNTRY_URL, "country"),
        tileValidator,
      );

      expect(typeError).toBeInstanceOf(TileTypeError);
      expect(typeError).not.toBeInstanceOf(TileValidationError);
      expect(validationError).toBeInstanceOf(TileValidationError);
      expect(validationError).not.toBeInstanceOf(TileTypeError);
    });
  });

  describe("tile unchanged", function describeTileUnchanged(): void {
    it("Matching tile unchanged", async function keepsMatchingTile(): Promise<void> {
      const tileValidator = await buildBookValidator();
      const tile = await loadTile(KALLOCAIN_URL, { fetch: fetchSample });
      const tileBefore = structuredClone(tile);

      validateTile(tile, tileValidator);

      expect(tile).toStrictEqual(tileBefore);
      expect(tile.types).toEqual([]);
    });

    it("Tile that does not match unchanged", async function keepsMismatchingTile(): Promise<void> {
      const tileValidator = await buildBookValidator();
      const tile = buildBookTileWithout(NO_COUNTRY_URL, "country");
      tile.metadata.pages = 156;
      const tileBefore = structuredClone(tile);

      catchValidationError(tile, tileValidator);

      expect(tile).toStrictEqual(tileBefore);
      expect(tile.types).toEqual([]);
    });
  });

  describe("reused validator", function describeReusedValidator(): void {
    it("Matching tile after a tile that does not match", async function matchesAfterMismatch(): Promise<void> {
      const tileValidator = await buildBookValidator();
      const kallocain = await loadTile(KALLOCAIN_URL, { fetch: fetchSample });

      const error = catchValidationError(
        buildBookTileWithout(NO_COUNTRY_URL, "country"),
        tileValidator,
      );

      expect(error).toBeInstanceOf(TileValidationError);
      expect(validateTile(kallocain, tileValidator)).toBe("book");
    });

    it("Two errors from one validator", async function keepsErrorsApart(): Promise<void> {
      const tileValidator = await buildBookValidator();

      const firstError = catchValidationError(
        buildBookTileWithout(NO_COUNTRY_URL, "country"),
        tileValidator,
      );
      const secondError = catchValidationError(
        buildBookTileWithout(NO_TITLE_URL, "title"),
        tileValidator,
      );

      expect(String(firstError)).toContain("country");
      expect(String(firstError)).not.toContain("title");
      expect(String(secondError)).toContain("title");
      expect(String(secondError)).not.toContain("country");
    });
  });
});
