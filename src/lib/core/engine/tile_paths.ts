import { isYamlMapping } from "../../files/index.ts";
import type { YamlMapping, YamlValue } from "../../files/index.ts";
import type { Tile } from "../../tile/index.ts";

/** Prefixes that mark a metadata string as a path relative to its tile. */
const RELATIVE_PATH_MARKERS = ["./", "../"];

function isRelativePath(value: string): boolean {
  for (const marker of RELATIVE_PATH_MARKERS) {
    if (value.startsWith(marker)) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves a marked string against the tile's source. A URL that cannot be
 * built, as with a non-hierarchical source, leaves the string as written.
 */
function resolveRelativePath(value: string, tileSource: string): string {
  try {
    const url = new URL(value, tileSource);
    return url.href;
  } catch {
    return value;
  }
}

function resolveListPaths(items: YamlValue[], tileSource: string): YamlValue[] {
  const resolvedItems: YamlValue[] = [];
  for (const item of items) {
    resolvedItems.push(resolveValuePaths(item, tileSource));
  }
  return resolvedItems;
}

function resolveMappingPaths(
  mapping: YamlMapping,
  tileSource: string,
): YamlMapping {
  const resolvedMapping: YamlMapping = {};
  for (const [key, value] of Object.entries(mapping)) {
    resolvedMapping[key] = resolveValuePaths(value, tileSource);
  }
  return resolvedMapping;
}

function resolveValuePaths(value: YamlValue, tileSource: string): YamlValue {
  if (typeof value === "string" && isRelativePath(value)) {
    return resolveRelativePath(value, tileSource);
  }
  if (Array.isArray(value)) {
    return resolveListPaths(value, tileSource);
  }
  if (isYamlMapping(value)) {
    return resolveMappingPaths(value, tileSource);
  }
  return value;
}

/**
 * Returns a new tile whose metadata strings starting with `./` or `../`,
 * also inside lists and nested mappings, are absolute URLs resolved against
 * the tile's `source`. Keys, other values and the body stay as written. The
 * input tile is not changed, and the result is plain data.
 */
export function resolveTilePaths(tile: Tile): Tile {
  const resolvedTile: Tile = {
    source: tile.source,
    metadata: resolveMappingPaths(tile.metadata, tile.source),
    body: tile.body,
    types: [...tile.types],
  };
  return resolvedTile;
}
