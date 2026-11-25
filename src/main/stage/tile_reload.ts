import { dropCollection } from "../../lib/core/combinations/index.ts";
import type { CombinationCatalog } from "../../lib/core/combinations/index.ts";
import { reloadTiles } from "../../lib/core/stage/index.ts";
import type { SandboxSnapshot, Stage } from "../../lib/core/stage/index.ts";

/**
 * "Reload tiles": reloads the sandbox's collection or tile in the stage, then
 * drops their counts from the combination catalog, so the stage bar's lists
 * measure the reloaded tiles.
 */
export async function reloadSandboxTiles(
  stage: Stage,
  combinations: CombinationCatalog,
  sandbox: SandboxSnapshot,
): Promise<void> {
  await reloadTiles(stage, sandbox.id);
  const source = sandbox.link.collection ?? sandbox.link.tile;
  if (source !== null) {
    dropCollection(combinations, source);
  }
}
