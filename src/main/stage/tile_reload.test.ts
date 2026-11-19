import { describe, expect, it } from "vitest";
import {
  buildCountKey,
  readCombinationSnapshot,
  requestCounts,
} from "../../lib/core/combinations/index.ts";
import { readStageSnapshot } from "../../lib/core/stage/index.ts";
import type { SandboxSnapshot, Stage } from "../../lib/core/stage/index.ts";
import {
  SAMPLE_COLLECTION_RUN_HASH,
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_MOD_SOURCE,
} from "../../test/sample_mods.ts";
import {
  buildTestCombinations,
  startTestStage,
} from "../../test/test_stages.ts";
import { reloadSandboxTiles } from "./tile_reload.ts";

function readVisible(stage: Stage): SandboxSnapshot {
  for (const sandbox of readStageSnapshot(stage).sandboxes) {
    if (sandbox.isVisible) {
      return sandbox;
    }
  }
  throw new Error("Expected a visible sandbox");
}

describe("reloadSandboxTiles", function describeReloadSandboxTiles(): void {
  it("Reload tiles drops that collection's counts", async function dropsCounts(): Promise<void> {
    const stage = await startTestStage(SAMPLE_COLLECTION_RUN_HASH);
    const combinations = buildTestCombinations(stage);
    const key = buildCountKey(SAMPLE_MOD_SOURCE, SAMPLE_COLLECTION_SOURCE);
    await requestCounts(combinations, [SAMPLE_MOD_SOURCE], {
      kind: "collection",
      source: SAMPLE_COLLECTION_SOURCE,
    });
    const countBefore = readCombinationSnapshot(combinations).counts[key];

    await reloadSandboxTiles(stage, combinations, readVisible(stage));

    expect(countBefore).toEqual({
      state: "loaded",
      value: { matching: 3, total: 3 },
    });
    expect(readCombinationSnapshot(combinations).counts[key]).toBeUndefined();
  });
});
