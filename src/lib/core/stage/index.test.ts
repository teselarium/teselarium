import { describe, expect, it } from "vitest";
import * as stageModule from "./index.ts";

describe("stage module entry point", function describeEntryPoint(): void {
  it("exports the public API", function exportsPublicApi(): void {
    expect(Object.keys(stageModule).sort()).toEqual([
      "answerStageAction",
      "attachFrame",
      "buildSectionHash",
      "changeStageColorScheme",
      "closeSandbox",
      "createStage",
      "followHistory",
      "frameLoadedAgain",
      "openStageLink",
      "openStageSection",
      "readStageSnapshot",
      "reloadTiles",
      "subscribeStage",
    ]);
  });
});
