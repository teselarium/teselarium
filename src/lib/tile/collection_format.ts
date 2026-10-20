import { isYamlMapping } from "../files/index.ts";
import type { ParsedYaml, YamlMapping, YamlValue } from "../files/index.ts";
import { CollectionFormatError } from "./tile_errors.ts";

/** The checked content of a collection file. `entries` are the unchecked tile entries. */
export interface CollectionFormat {
  name: string;
  description: string;
  entries: YamlValue[];
}

/** A tile entry with exactly one location: a `path` or a `url`, not yet resolved. */
export interface TileEntry {
  kind: "path" | "url";
  location: string;
}

/** A tile entry that cannot be loaded. `position` counts from 1. */
export interface MalformedTileEntry {
  kind: "malformed";
  position: number;
  reason: string;
}

export type TileEntryReading = TileEntry | MalformedTileEntry;

function readCollectionMapping(parsedYaml: ParsedYaml): YamlMapping {
  const collection = parsedYaml.content.collection;
  if (!isYamlMapping(collection)) {
    throw new CollectionFormatError(
      parsedYaml.source,
      'a "collection" mapping is required',
    );
  }
  return collection;
}

function isNonEmptyString(value: YamlValue | undefined): value is string {
  return typeof value === "string" && value !== "";
}

function readCollectionName(collection: YamlMapping, source: string): string {
  const name = collection.name;
  if (!isNonEmptyString(name)) {
    throw new CollectionFormatError(
      source,
      '"name" must be a non-empty string',
    );
  }
  return name;
}

function readCollectionDescription(
  collection: YamlMapping,
  source: string,
): string {
  const description = collection.description;
  if (description === undefined) {
    return "";
  }
  if (typeof description !== "string") {
    throw new CollectionFormatError(source, '"description" must be a string');
  }
  return description;
}

function readCollectionEntries(
  collection: YamlMapping,
  source: string,
): YamlValue[] {
  const entries = collection.tiles;
  if (!Array.isArray(entries)) {
    throw new CollectionFormatError(source, '"tiles" must be a list');
  }
  return entries;
}

/**
 * Checks the structure of a parsed collection file: a `collection` mapping with
 * a non-empty string `name`, an optional string `description` and a `tiles`
 * list. Other keys are ignored. Raises `CollectionFormatError`.
 */
export function readCollectionFormat(parsedYaml: ParsedYaml): CollectionFormat {
  const collection = readCollectionMapping(parsedYaml);
  const collectionFormat: CollectionFormat = {
    name: readCollectionName(collection, parsedYaml.source),
    description: readCollectionDescription(collection, parsedYaml.source),
    entries: readCollectionEntries(collection, parsedYaml.source),
  };
  return collectionFormat;
}

export function buildMalformedTileEntry(
  position: number,
  reason: string,
): MalformedTileEntry {
  const malformedTileEntry: MalformedTileEntry = {
    kind: "malformed",
    position,
    reason,
  };
  return malformedTileEntry;
}

/**
 * Checks one tile entry of a collection without resolving it. `position` is
 * the entry's position in the `tiles` list, counting from 1.
 */
export function readTileEntry(
  entry: YamlValue,
  position: number,
): TileEntryReading {
  if (!isYamlMapping(entry)) {
    return buildMalformedTileEntry(position, "must be a mapping");
  }
  const hasPath = entry.path !== undefined;
  const hasUrl = entry.url !== undefined;
  if (hasPath === hasUrl) {
    return buildMalformedTileEntry(
      position,
      'must have exactly one of "path" or "url"',
    );
  }
  const kind = hasPath ? "path" : "url";
  const location = entry[kind];
  if (!isNonEmptyString(location)) {
    return buildMalformedTileEntry(
      position,
      `"${kind}" must be a non-empty string`,
    );
  }
  const tileEntry: TileEntry = { kind, location };
  return tileEntry;
}
