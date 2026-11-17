import { describeYamlValue, isYamlMapping } from "../files/index.ts";
import type { ParsedMarkdown, YamlMapping, YamlValue } from "../files/index.ts";
import { TileTypeError } from "./tile_errors.ts";

/** The schema of a tile type file, ready to compile. */
export interface TileTypeSchema {
  /** The schema's `ref`. */
  typeName: string;
  /** The top-level fields of the `ref` definition: its `properties`, then its `optionalProperties`. */
  fieldNames: string[];
  /** With `additionalProperties: true` added wherever it is omitted. */
  schema: YamlMapping;
}

/** JTD keywords whose value is a map of schemas, keyed by name. */
const SCHEMA_MAP_KEYWORDS = new Set([
  "definitions",
  "properties",
  "optionalProperties",
  "mapping",
]);

/** JTD keywords whose value is one schema. */
const SINGLE_SCHEMA_KEYWORDS = new Set(["elements", "values"]);

function readSchemaMapping(parsedMarkdown: ParsedMarkdown): YamlMapping {
  if (!Object.hasOwn(parsedMarkdown.metadata, "schema")) {
    throw new TileTypeError(parsedMarkdown.source, '"schema" is missing');
  }
  const schema = parsedMarkdown.metadata.schema;
  if (!isYamlMapping(schema)) {
    throw new TileTypeError(
      parsedMarkdown.source,
      `"schema" must be a mapping, found ${describeYamlValue(schema)}`,
    );
  }
  return schema;
}

/** The type name is `schema.ref`, which must name one of the schema's own definitions. */
function readTypeName(schema: YamlMapping, source: string): string {
  const ref = schema.ref;
  if (typeof ref !== "string" || ref === "") {
    throw new TileTypeError(
      source,
      '"schema.ref" must be a non-empty string naming the tile type',
    );
  }
  const definitions = schema.definitions;
  if (!isYamlMapping(definitions) || !Object.hasOwn(definitions, ref)) {
    throw new TileTypeError(
      source,
      `"schema.ref" is "${ref}", which is not one of the schema's definitions`,
    );
  }
  return ref;
}

function listSchemaMapNames(schemaMap: YamlValue | undefined): string[] {
  if (!isYamlMapping(schemaMap)) {
    const noNames: string[] = [];
    return noNames;
  }
  return Object.keys(schemaMap);
}

/** The names of the `properties` and `optionalProperties` of the definition `typeName`, which `readTypeName` found. */
function readTypeFieldNames(schema: YamlMapping, typeName: string): string[] {
  const definitions = schema.definitions as YamlMapping;
  const definition = definitions[typeName];
  if (!isYamlMapping(definition)) {
    const noNames: string[] = [];
    return noNames;
  }
  const fieldNames = [
    ...listSchemaMapNames(definition.properties),
    ...listSchemaMapNames(definition.optionalProperties),
  ];
  return fieldNames;
}

/**
 * Reads the schema of a parsed tile type file and applies structural typing.
 * Raises `TileTypeError` when `schema` is missing or not a mapping, or when
 * `schema.ref` does not name one of its definitions. JTD validity is checked
 * when the schema is compiled.
 */
export function readTileTypeSchema(
  parsedMarkdown: ParsedMarkdown,
): TileTypeSchema {
  const schema = readSchemaMapping(parsedMarkdown);
  const typeName = readTypeName(schema, parsedMarkdown.source);
  const tileTypeSchema: TileTypeSchema = {
    typeName,
    fieldNames: readTypeFieldNames(schema, typeName),
    schema: applyStructuralTyping(schema),
  };
  return tileTypeSchema;
}

/** A value that is not a mapping is copied as it is, and the JTD compiler rejects it. */
function typeSchemaValue(value: YamlValue): YamlValue {
  if (!isYamlMapping(value)) {
    return structuredClone(value);
  }
  return applyStructuralTyping(value);
}

/** Visits each schema of a map of schemas. The names in the map are never schemas. */
function typeSchemaMap(schemaMap: YamlValue): YamlValue {
  if (!isYamlMapping(schemaMap)) {
    return structuredClone(schemaMap);
  }
  const typedEntries: [string, YamlValue][] = [];
  for (const [name, schema] of Object.entries(schemaMap)) {
    typedEntries.push([name, typeSchemaValue(schema)]);
  }
  const typedSchemaMap: YamlMapping = Object.fromEntries(typedEntries);
  return typedSchemaMap;
}

function typeKeywordValue(keyword: string, value: YamlValue): YamlValue {
  if (SCHEMA_MAP_KEYWORDS.has(keyword)) {
    return typeSchemaMap(value);
  }
  if (SINGLE_SCHEMA_KEYWORDS.has(keyword)) {
    return typeSchemaValue(value);
  }
  return structuredClone(value);
}

function needsAdditionalProperties(schema: YamlMapping): boolean {
  const describesObject =
    Object.hasOwn(schema, "properties") ||
    Object.hasOwn(schema, "optionalProperties");
  return describesObject && !Object.hasOwn(schema, "additionalProperties");
}

/**
 * Returns a copy of a JTD schema where every object description (a schema
 * with `properties` or `optionalProperties`) that omits `additionalProperties`
 * sets it to `true`, at any depth. An explicit value is kept. Only schemas
 * are visited, so field names and `metadata` content are copied unchanged.
 * The input is not changed.
 */
export function applyStructuralTyping(schema: YamlMapping): YamlMapping {
  const typedEntries: [string, YamlValue][] = [];
  for (const [keyword, value] of Object.entries(schema)) {
    typedEntries.push([keyword, typeKeywordValue(keyword, value)]);
  }
  if (needsAdditionalProperties(schema)) {
    typedEntries.push(["additionalProperties", true]);
  }
  const typedSchema: YamlMapping = Object.fromEntries(typedEntries);
  return typedSchema;
}
