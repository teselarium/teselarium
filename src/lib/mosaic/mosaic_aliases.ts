import { isYamlMapping } from "../files/index.ts";
import type { Metadata, YamlValue } from "../files/index.ts";
import type { Tile, TileCollection } from "../tile/index.ts";
import { MosaicFormatError } from "./mosaic_errors.ts";

/**
 * A mosaic's aliases: for each field name of the tile type, the names a
 * collection may use for it, in order of preference.
 */
export type MosaicAliases = { [field: string]: string[] };

function isNonEmptyStringList(value: YamlValue): value is string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  for (const item of value) {
    if (typeof item !== "string" || item === "") {
      return false;
    }
  }
  return true;
}

function readAliasNames(
  field: string,
  value: YamlValue,
  source: string,
): string[] {
  if (field === "") {
    throw new MosaicFormatError(
      source,
      '"aliases" keys must be non-empty strings',
    );
  }
  if (!isNonEmptyStringList(value)) {
    throw new MosaicFormatError(
      source,
      `"aliases.${field}" must be a non-empty list of non-empty strings`,
    );
  }
  const names = [...value];
  return names;
}

/**
 * Refuses a name that two fields list, that one field lists twice, or that
 * is also a field, so renaming never depends on the order of the fields.
 */
function checkAliasNames(aliases: MosaicAliases, source: string): void {
  const listingFields = new Map<string, string>();
  for (const [field, names] of Object.entries(aliases)) {
    for (const name of names) {
      const listingField = listingFields.get(name);
      if (listingField !== undefined) {
        throw new MosaicFormatError(
          source,
          `"aliases": the name "${name}" is listed under both "${listingField}" and "${field}"`,
        );
      }
      if (Object.hasOwn(aliases, name)) {
        throw new MosaicFormatError(
          source,
          `"aliases": the name "${name}" is also a field of "aliases"`,
        );
      }
      listingFields.set(name, field);
    }
  }
}

/**
 * Reads the `aliases` mapping of a mosaic file. Absent aliases give an empty
 * mapping. Raises `MosaicFormatError`.
 */
export function readMosaicAliases(
  value: YamlValue | undefined,
  source: string,
): MosaicAliases {
  const aliases: MosaicAliases = {};
  if (value === undefined) {
    return aliases;
  }
  if (!isYamlMapping(value)) {
    throw new MosaicFormatError(source, '"aliases" must be a mapping');
  }
  for (const [field, names] of Object.entries(value)) {
    aliases[field] = readAliasNames(field, names, source);
  }
  checkAliasNames(aliases, source);
  return aliases;
}

function findAliasName(metadata: Metadata, names: string[]): string | null {
  for (const name of names) {
    if (Object.hasOwn(metadata, name)) {
      return name;
    }
  }
  return null;
}

/** Maps each name to rename to its field: for each field the metadata lacks, the first listed name it has. */
function planAliasRenames(
  metadata: Metadata,
  aliases: MosaicAliases,
): Map<string, string> {
  const renames = new Map<string, string>();
  for (const [field, names] of Object.entries(aliases)) {
    if (Object.hasOwn(metadata, field)) {
      continue;
    }
    const name = findAliasName(metadata, names);
    if (name !== null) {
      renames.set(name, field);
    }
  }
  return renames;
}

/**
 * Renames a tile's top-level metadata keys with a mosaic's aliases. For each
 * field the metadata lacks, the first listed name it has is renamed to the
 * field, keeping its value and its place in the key order. A field the
 * metadata already has is kept, and its listed names are left as written.
 * Returns new metadata and changes neither input.
 */
export function applyMosaicAliases(
  metadata: Metadata,
  aliases: MosaicAliases,
): Metadata {
  const renames = planAliasRenames(metadata, aliases);
  const aliasedMetadata: Metadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    const aliasedKey = renames.get(key) ?? key;
    aliasedMetadata[aliasedKey] = value;
  }
  return aliasedMetadata;
}

/**
 * The collection with each tile's metadata renamed by a mosaic's aliases
 * (`applyMosaicAliases`). The tiles' `source`, `body` and `types` are kept.
 * Changes neither input.
 */
export function aliasCollectionTiles(
  collection: TileCollection,
  aliases: MosaicAliases,
): TileCollection {
  const aliasedTiles: Tile[] = [];
  for (const tile of collection.tiles) {
    aliasedTiles.push({
      ...tile,
      metadata: applyMosaicAliases(tile.metadata, aliases),
    });
  }
  const aliasedCollection: TileCollection = {
    ...collection,
    tiles: aliasedTiles,
  };
  return aliasedCollection;
}
