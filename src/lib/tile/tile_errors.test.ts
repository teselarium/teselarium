import { describe, expect, it } from "vitest";
import { FIXTURES_BASE_URL } from "../../test/sample_files.ts";
import {
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_TYPE_SOURCE,
} from "../../test/sample_mods.ts";
import {
  CollectionFormatError,
  TileTypeError,
  TileValidationError,
} from "./tile_errors.ts";

const SOURCE = `${FIXTURES_BASE_URL}tiles/books/kallocain.md`;
const MISMATCH_REASON = `"book" (${SAMPLE_TYPE_SOURCE}): metadata must have property 'country'`;

describe("CollectionFormatError", function describeCollectionFormatError(): void {
  it("is an Error named after its class", function isNamedError(): void {
    const error = new CollectionFormatError(
      SAMPLE_COLLECTION_SOURCE,
      '"tiles" must be a list',
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CollectionFormatError);
    expect(error.name).toBe("CollectionFormatError");
  });

  it("exposes the source", function exposesSource(): void {
    const error = new CollectionFormatError(
      SAMPLE_COLLECTION_SOURCE,
      '"tiles" must be a list',
    );

    expect(error.source).toBe(SAMPLE_COLLECTION_SOURCE);
  });

  it("builds the message from the source and the reason", function buildsMessage(): void {
    const error = new CollectionFormatError(
      SAMPLE_COLLECTION_SOURCE,
      '"tiles" must be a list',
    );

    expect(error.message).toBe(
      `Invalid tile collection "${SAMPLE_COLLECTION_SOURCE}": "tiles" must be a list`,
    );
  });

  it("keeps the cause when given", function keepsCause(): void {
    const formatError = new Error("not a list");

    const error = new CollectionFormatError(
      SAMPLE_COLLECTION_SOURCE,
      '"tiles" must be a list',
      { cause: formatError },
    );

    expect(error.cause).toBe(formatError);
  });
});

describe("TileTypeError", function describeTileTypeError(): void {
  it("is an Error named after its class", function isNamedError(): void {
    const error = new TileTypeError(SAMPLE_TYPE_SOURCE, '"schema" is missing');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(TileTypeError);
    expect(error.name).toBe("TileTypeError");
  });

  it("exposes the source", function exposesSource(): void {
    const error = new TileTypeError(SAMPLE_TYPE_SOURCE, '"schema" is missing');

    expect(error.source).toBe(SAMPLE_TYPE_SOURCE);
  });

  it("builds the message from the source and the reason", function buildsMessage(): void {
    const error = new TileTypeError(SAMPLE_TYPE_SOURCE, '"schema" is missing');

    expect(error.message).toBe(
      `Invalid tile type "${SAMPLE_TYPE_SOURCE}": "schema" is missing`,
    );
  });

  it("keeps the cause when given", function keepsCause(): void {
    const compileError = new Error("schema is invalid: data must be object");

    const error = new TileTypeError(
      SAMPLE_TYPE_SOURCE,
      '"schema" is not valid JSON Type Definition',
      { cause: compileError },
    );

    expect(error.cause).toBe(compileError);
  });
});

describe("TileValidationError", function describeTileValidationError(): void {
  it("is an Error named after its class", function isNamedError(): void {
    const error = new TileValidationError(SOURCE, MISMATCH_REASON);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(TileValidationError);
    expect(error.name).toBe("TileValidationError");
  });

  it("exposes the source", function exposesSource(): void {
    const error = new TileValidationError(SOURCE, MISMATCH_REASON);

    expect(error.source).toBe(SOURCE);
  });

  it("builds the message from the source and the reason", function buildsMessage(): void {
    const error = new TileValidationError(SOURCE, MISMATCH_REASON);

    expect(error.message).toBe(
      `Tile "${SOURCE}" is not of tile type "book" (${SAMPLE_TYPE_SOURCE}): metadata must have property 'country'`,
    );
  });

  it("keeps the cause when given", function keepsCause(): void {
    const mismatchError = new Error("must have property 'country'");

    const error = new TileValidationError(SOURCE, MISMATCH_REASON, {
      cause: mismatchError,
    });

    expect(error.cause).toBe(mismatchError);
  });

  it("is distinguishable from TileTypeError", function isDistinguishable(): void {
    const error = new TileValidationError(SOURCE, MISMATCH_REASON);

    expect(error).not.toBeInstanceOf(TileTypeError);
  });
});
