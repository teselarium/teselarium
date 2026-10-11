/** How serious an issue is. */
export type IssueLevel = "warning" | "error";

/**
 * A problem found while loading or validating a tile collection. `source` is
 * the tile's source, or the collection's source for an entry with no usable
 * tile location.
 */
export interface TileIssue {
  level: IssueLevel;
  source: string;
  message: string;
}
