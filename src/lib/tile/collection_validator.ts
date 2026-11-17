import type { TileCollection } from "./collection_loader.ts";
import { TileValidationError } from "./tile_errors.ts";
import type { TileIssue } from "./tile_issues.ts";
import type { Tile } from "./tile_loader.ts";
import { validateTile } from "./tile_validator.ts";
import type { TileValidator } from "./tile_validator.ts";

/** Two issues are equal when their level, source and message are equal. */
function buildIssueKey(issue: TileIssue): string {
  const issueKey = JSON.stringify([issue.level, issue.source, issue.message]);
  return issueKey;
}

function collectIssueKeys(issues: TileIssue[]): Set<string> {
  const issueKeys = new Set<string>();
  for (const issue of issues) {
    issueKeys.add(buildIssueKey(issue));
  }
  return issueKeys;
}

/** Returns the tile type name, or a warning when the tile does not match. Any other error is a bug. */
function checkCollectionTile(
  tile: Tile,
  tileValidator: TileValidator,
): string | TileIssue {
  try {
    const typeName = validateTile(tile, tileValidator);
    return typeName;
  } catch (error) {
    if (!(error instanceof TileValidationError)) {
      throw error;
    }
    const issue: TileIssue = {
      level: "warning",
      source: error.source,
      message: error.message,
    };
    return issue;
  }
}

/** Adds the type name at the end of the tile's types, unless the tile already has it. */
function addTileType(tile: Tile, typeName: string): Tile {
  if (tile.types.includes(typeName)) {
    return tile;
  }
  const typedTile: Tile = { ...tile, types: [...tile.types, typeName] };
  return typedTile;
}

/**
 * Validates every tile of a collection with a tile validator and returns a new
 * collection. Matching tiles get the type name in their types. Tiles that do
 * not match keep their place and types, and each adds a warning issue after
 * the existing issues. Validating the result again with the same type adds
 * nothing. The input collection is not changed.
 */
export function validateTileCollection(
  tileCollection: TileCollection,
  tileValidator: TileValidator,
): TileCollection {
  const copiedCollection = structuredClone(tileCollection);
  const issues = copiedCollection.issues;
  const issueKeys = collectIssueKeys(issues);
  const tiles: Tile[] = [];
  for (const tile of copiedCollection.tiles) {
    const tileCheck = checkCollectionTile(tile, tileValidator);
    if (typeof tileCheck === "string") {
      tiles.push(addTileType(tile, tileCheck));
      continue;
    }
    tiles.push(tile);
    const issueKey = buildIssueKey(tileCheck);
    if (!issueKeys.has(issueKey)) {
      issueKeys.add(issueKey);
      issues.push(tileCheck);
    }
  }
  const validatedCollection: TileCollection = {
    source: copiedCollection.source,
    title: copiedCollection.title,
    description: copiedCollection.description,
    tiles,
    issues,
  };
  return validatedCollection;
}
