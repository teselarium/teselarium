import type { FileFetchOptions } from "../files/index.ts";
import { planTileCollection } from "./collection_plan.ts";
import type { TileIssue } from "./tile_issues.ts";

/**
 * A collection's index: what its file says, read without loading any tile.
 * `tiles` and `issues` follow the order of the entries.
 */
export interface TileCollectionIndex {
  /** Resolved absolute URL of the collection file. */
  source: string;
  title: string;
  /** Empty when the file has none. */
  description: string;
  /** Resolved address of each tile entry that loading the collection would request, a repeated tile once. */
  tiles: string[];
  /** The entry issues, found before any tile request. */
  issues: TileIssue[];
}

/**
 * Reads a collection's index from a path or URL: the collection file alone,
 * with no tile requested. The entries follow the collection loader's rules.
 * Raises `FileFetchError`, `YamlParseError` or `CollectionFormatError` when
 * the collection file itself fails.
 */
export async function readTileCollectionIndex(
  location: string,
  options: FileFetchOptions = {},
): Promise<TileCollectionIndex> {
  const collectionPlan = await planTileCollection(location, options);
  const tiles: string[] = [];
  const issues: TileIssue[] = [];
  for (const slot of collectionPlan.slots) {
    if (slot.kind === "load") {
      tiles.push(slot.href);
    }
    if (slot.kind === "issue") {
      issues.push(slot.issue);
    }
  }
  const collectionIndex: TileCollectionIndex = {
    source: collectionPlan.collectionUrl.href,
    title: collectionPlan.collectionFormat.title,
    description: collectionPlan.collectionFormat.description,
    tiles,
    issues,
  };
  return collectionIndex;
}
