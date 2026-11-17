import { describe, expect, it } from "vitest";
import { readFixtureText, FIXTURES_BASE_URL } from "../../test/sample_files.ts";
import { parseMarkdown } from "../files/index.ts";
import type { Metadata, ParsedMarkdown, YamlMapping } from "../files/index.ts";
import { TileTypeError } from "./tile_errors.ts";
import {
  applyStructuralTyping,
  readTileTypeSchema,
} from "./tile_type_schema.ts";

const BOOK_TYPE_URL = `${FIXTURES_BASE_URL}types/book.md`;
const TYPE_SOURCE = "https://example.org/types/test_type.md";

const STRING_FIELD: YamlMapping = { type: "string" };

function buildTypeFile(metadata: Metadata): ParsedMarkdown {
  const typeFile: ParsedMarkdown = { source: TYPE_SOURCE, metadata, body: "" };
  return typeFile;
}

function readTypeError(metadata: Metadata): unknown {
  try {
    readTileTypeSchema(buildTypeFile(metadata));
  } catch (error) {
    return error;
  }
  throw new Error(`Expected reading "${TYPE_SOURCE}" to fail, but it passed`);
}

function buildTypeErrorMessage(reason: string): string {
  const message = `Invalid tile type "${TYPE_SOURCE}": ${reason}`;
  return message;
}

describe("readTileTypeSchema", function describeReadTileTypeSchema(): void {
  it("reads the sample book type", function readsBookType(): void {
    const parsedBookType = parseMarkdown({
      source: BOOK_TYPE_URL,
      content: readFixtureText("types/book.md"),
    });

    const tileTypeSchema = readTileTypeSchema(parsedBookType);

    expect(tileTypeSchema.typeName).toBe("book");
    expect(tileTypeSchema.fieldNames).toEqual([
      "title",
      "date",
      "authors",
      "country",
      "genres",
      "language",
    ]);
    expect(tileTypeSchema.schema).toMatchObject({
      ref: "book",
      definitions: { book: { additionalProperties: true } },
    });
  });

  it("rejects a type file without a schema", function rejectsMissingSchema(): void {
    const error = readTypeError({ title: "Not a type" });

    expect(error).toBeInstanceOf(TileTypeError);
    expect(error).toMatchObject({
      source: TYPE_SOURCE,
      message: buildTypeErrorMessage('"schema" is missing'),
    });
  });

  it("rejects empty metadata", function rejectsEmptyMetadata(): void {
    const error = readTypeError({});

    expect(error).toBeInstanceOf(TileTypeError);
    expect(error).toMatchObject({
      source: TYPE_SOURCE,
      message: buildTypeErrorMessage('"schema" is missing'),
    });
  });

  it("rejects a schema that is not a mapping", function rejectsStringSchema(): void {
    const error = readTypeError({ schema: "book" });

    expect(error).toBeInstanceOf(TileTypeError);
    expect(error).toMatchObject({
      source: TYPE_SOURCE,
      message: buildTypeErrorMessage(
        '"schema" must be a mapping, found a single string value',
      ),
    });
  });

  it("rejects a schema without ref", function rejectsMissingRef(): void {
    const error = readTypeError({ schema: { definitions: { book: {} } } });

    expect(error).toBeInstanceOf(TileTypeError);
    expect(error).toMatchObject({
      source: TYPE_SOURCE,
      message: buildTypeErrorMessage(
        '"schema.ref" must be a non-empty string naming the tile type',
      ),
    });
  });

  it("rejects an empty ref", function rejectsEmptyRef(): void {
    const error = readTypeError({
      schema: { definitions: { book: {} }, ref: "" },
    });

    expect(error).toBeInstanceOf(TileTypeError);
    expect(error).toMatchObject({
      source: TYPE_SOURCE,
      message: buildTypeErrorMessage(
        '"schema.ref" must be a non-empty string naming the tile type',
      ),
    });
  });

  it("rejects a ref that is not a string", function rejectsNumericRef(): void {
    const error = readTypeError({
      schema: { definitions: { book: {} }, ref: 3 },
    });

    expect(error).toBeInstanceOf(TileTypeError);
    expect(error).toMatchObject({
      source: TYPE_SOURCE,
      message: buildTypeErrorMessage(
        '"schema.ref" must be a non-empty string naming the tile type',
      ),
    });
  });

  it("rejects a ref naming a missing definition", function rejectsMissingDefinition(): void {
    const error = readTypeError({
      schema: { definitions: { book: {} }, ref: "novel" },
    });

    expect(error).toBeInstanceOf(TileTypeError);
    expect(error).toMatchObject({
      source: TYPE_SOURCE,
      message: buildTypeErrorMessage(
        '"schema.ref" is "novel", which is not one of the schema\'s definitions',
      ),
    });
  });

  it("rejects a schema without definitions", function rejectsMissingDefinitions(): void {
    const error = readTypeError({ schema: { ref: "book" } });

    expect(error).toBeInstanceOf(TileTypeError);
    expect(error).toMatchObject({
      source: TYPE_SOURCE,
      message: buildTypeErrorMessage(
        '"schema.ref" is "book", which is not one of the schema\'s definitions',
      ),
    });
  });

  it("does not find definitions on the prototype", function rejectsPrototypeName(): void {
    const error = readTypeError({
      schema: { definitions: { book: {} }, ref: "toString" },
    });

    expect(error).toBeInstanceOf(TileTypeError);
    expect(error).toMatchObject({
      source: TYPE_SOURCE,
      message: buildTypeErrorMessage(
        '"schema.ref" is "toString", which is not one of the schema\'s definitions',
      ),
    });
  });
});

describe("applyStructuralTyping", function describeApplyStructuralTyping(): void {
  it("adds additionalProperties at the root", function typesRoot(): void {
    const typedSchema = applyStructuralTyping({
      properties: { title: STRING_FIELD },
    });

    expect(typedSchema).toEqual({
      properties: { title: STRING_FIELD },
      additionalProperties: true,
    });
  });

  it("adds additionalProperties in definitions", function typesDefinitions(): void {
    const typedSchema = applyStructuralTyping({
      definitions: { book: { properties: { title: STRING_FIELD } } },
      ref: "book",
    });

    expect(typedSchema).toEqual({
      definitions: {
        book: {
          properties: { title: STRING_FIELD },
          additionalProperties: true,
        },
      },
      ref: "book",
    });
  });

  it("adds additionalProperties in nested properties and optionalProperties", function typesNestedObjects(): void {
    const typedSchema = applyStructuralTyping({
      properties: {
        publisher: { properties: { name: STRING_FIELD } },
      },
      optionalProperties: {
        translator: { optionalProperties: { name: STRING_FIELD } },
      },
    });

    expect(typedSchema).toEqual({
      properties: {
        publisher: {
          properties: { name: STRING_FIELD },
          additionalProperties: true,
        },
      },
      optionalProperties: {
        translator: {
          optionalProperties: { name: STRING_FIELD },
          additionalProperties: true,
        },
      },
      additionalProperties: true,
    });
  });

  it("adds additionalProperties under elements and values", function typesElementsAndValues(): void {
    const typedSchema = applyStructuralTyping({
      properties: {
        editions: { elements: { properties: { year: { type: "uint16" } } } },
        prices: { values: { properties: { amount: { type: "float64" } } } },
      },
    });

    expect(typedSchema).toEqual({
      properties: {
        editions: {
          elements: {
            properties: { year: { type: "uint16" } },
            additionalProperties: true,
          },
        },
        prices: {
          values: {
            properties: { amount: { type: "float64" } },
            additionalProperties: true,
          },
        },
      },
      additionalProperties: true,
    });
  });

  it("adds additionalProperties in each discriminator mapping schema", function typesMapping(): void {
    const typedSchema = applyStructuralTyping({
      discriminator: "kind",
      mapping: {
        novel: { properties: { title: STRING_FIELD } },
        poem: { optionalProperties: { lines: { type: "uint32" } } },
      },
    });

    expect(typedSchema).toEqual({
      discriminator: "kind",
      mapping: {
        novel: {
          properties: { title: STRING_FIELD },
          additionalProperties: true,
        },
        poem: {
          optionalProperties: { lines: { type: "uint32" } },
          additionalProperties: true,
        },
      },
    });
  });

  it("keeps an explicit additionalProperties", function keepsExplicitValues(): void {
    const typedSchema = applyStructuralTyping({
      definitions: {
        closed: {
          properties: { title: STRING_FIELD },
          additionalProperties: false,
        },
        open: {
          properties: { title: STRING_FIELD },
          additionalProperties: true,
        },
      },
      ref: "closed",
    });

    expect(typedSchema).toEqual({
      definitions: {
        closed: {
          properties: { title: STRING_FIELD },
          additionalProperties: false,
        },
        open: {
          properties: { title: STRING_FIELD },
          additionalProperties: true,
        },
      },
      ref: "closed",
    });
  });

  it("leaves schemas without properties unchanged", function leavesOtherForms(): void {
    const typedSchema = applyStructuralTyping({
      properties: {
        title: STRING_FIELD,
        genres: { elements: STRING_FIELD },
        status: { enum: ["draft", "published"] },
      },
    });

    expect(typedSchema).toEqual({
      properties: {
        title: STRING_FIELD,
        genres: { elements: STRING_FIELD },
        status: { enum: ["draft", "published"] },
      },
      additionalProperties: true,
    });
  });

  it("does not type a field named properties", function skipsFieldNames(): void {
    const typedSchema = applyStructuralTyping({
      properties: { properties: STRING_FIELD },
    });

    expect(typedSchema).toEqual({
      properties: { properties: STRING_FIELD },
      additionalProperties: true,
    });
  });

  it("copies metadata unchanged", function copiesMetadata(): void {
    const typedSchema = applyStructuralTyping({
      properties: {
        title: {
          type: "string",
          metadata: { properties: { description: "Title of the book" } },
        },
      },
    });

    expect(typedSchema).toEqual({
      properties: {
        title: {
          type: "string",
          metadata: { properties: { description: "Title of the book" } },
        },
      },
      additionalProperties: true,
    });
  });

  it("leaves the input schema unchanged", function keepsInput(): void {
    const schema: YamlMapping = {
      definitions: {
        book: {
          properties: {
            publisher: { properties: { name: STRING_FIELD } },
            editions: { elements: { properties: { year: STRING_FIELD } } },
          },
        },
      },
      ref: "book",
    };
    const schemaBefore = structuredClone(schema);

    applyStructuralTyping(schema);

    expect(schema).toEqual(schemaBefore);
  });
});
