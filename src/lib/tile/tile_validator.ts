import Ajv from "ajv/dist/jtd";
import type { ErrorObject, ValidateFunction } from "ajv/dist/jtd";
import { fetchFile } from "./file_fetcher.ts";
import type { FileFetchOptions } from "./file_fetcher.ts";
import { parseMarkdown } from "./markdown_parser.ts";
import { TileTypeError, TileValidationError } from "./tile_errors.ts";
import type { Tile } from "./tile_loader.ts";
import { readTileTypeSchema } from "./tile_type_schema.ts";
import type { YamlMapping } from "./yaml_parser.ts";

/** Checks tiles against one tile type. Built by `buildTileValidator`, used with `validateTile`. */
export interface TileValidator {
  /** Resolved absolute URL of the tile type file. */
  source: string;
  /** The schema's `ref`. */
  typeName: string;
  /** Compiled by Ajv. Use `validateTile`, not this function. */
  validateMetadata: ValidateFunction;
}

/**
 * Shared by every validator: a new instance compiles its meta-schema first.
 * `allErrors` reports every mismatch, and `strictSchema: false` accepts the
 * free-form `metadata` keyword that RFC 8927 allows.
 */
const jtdCompiler = new Ajv({ allErrors: true, strictSchema: false });

/** Ajv's own message stays in `cause`: it lists every JTD form the schema failed and can be very long. */
function compileTileTypeSchema(
  schema: YamlMapping,
  source: string,
): ValidateFunction {
  try {
    const validateMetadata = jtdCompiler.compile(schema);
    return validateMetadata;
  } catch (error) {
    throw new TileTypeError(
      source,
      '"schema" is not valid JSON Type Definition',
      { cause: error },
    );
  } finally {
    jtdCompiler.removeSchema(schema);
  }
}

/**
 * Builds a tile validator from a tile type file given as a path or URL: fetches
 * the file, parses its markdown and compiles the `schema` of its frontmatter,
 * with `additionalProperties: true` wherever it is omitted. Raises
 * `FileFetchError`, `MarkdownParseError` or `TileTypeError`.
 */
export async function buildTileValidator(
  location: string,
  options?: FileFetchOptions,
): Promise<TileValidator> {
  const typeFile = await fetchFile(location, options);
  const tileTypeSchema = readTileTypeSchema(parseMarkdown(typeFile));
  const tileValidator: TileValidator = {
    source: typeFile.source,
    typeName: tileTypeSchema.typeName,
    validateMetadata: compileTileTypeSchema(
      tileTypeSchema.schema,
      typeFile.source,
    ),
  };
  return tileValidator;
}

/** Describes one Ajv error, located from `metadata`, e.g. `metadata/genres/1 must be string`. */
function describeMetadataMismatch(mismatchError: ErrorObject): string {
  const location = `metadata${mismatchError.instancePath}`;
  if (mismatchError.params.error === "additional") {
    const extraFieldDescription = `${location} is not allowed by the type`;
    return extraFieldDescription;
  }
  const message =
    mismatchError.message ?? `does not match "${mismatchError.keyword}"`;
  const description = `${location} ${message}`;
  return description;
}

function describeMetadataMismatches(mismatchErrors: ErrorObject[]): string {
  const descriptions: string[] = [];
  for (const mismatchError of mismatchErrors) {
    descriptions.push(describeMetadataMismatch(mismatchError));
  }
  return descriptions.join("; ");
}

/**
 * Checks a tile's metadata against a tile validator and returns the tile type
 * name. Raises `TileValidationError` naming every mismatching field when the
 * metadata does not match. The tile is not changed.
 */
export function validateTile(tile: Tile, tileValidator: TileValidator): string {
  const isMatch = tileValidator.validateMetadata(tile.metadata);
  if (isMatch) {
    return tileValidator.typeName;
  }
  // Ajv keeps the errors of the last call only, so they are read right away.
  const mismatchErrors = tileValidator.validateMetadata.errors ?? [];
  throw new TileValidationError(
    tile.source,
    `"${tileValidator.typeName}" (${tileValidator.source}): ${describeMetadataMismatches(mismatchErrors)}`,
  );
}
