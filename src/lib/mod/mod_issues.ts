import type { IssueLevel } from "../tile/index.ts";

/**
 * A problem found while starting or running a mod. It has the shape of a
 * `TileIssue`, so both are listed together. `source` is the mod's source.
 */
export interface ModIssue {
  level: IssueLevel;
  source: string;
  message: string;
}
