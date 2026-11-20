import { describe, expect, it } from "vitest";
import * as stageModule from "./index.ts";

describe("stage module entry point", function describeEntryPoint(): void {
  it("exports the public API", function exportsPublicApi(): void {
    expect(Object.keys(stageModule).sort()).toEqual([
      "NO_COLLECTION",
      "answerApiMismatch",
      "answerSiteConsent",
      "answerStageAction",
      "attachCheckFrame",
      "attachFrame",
      "buildCollectionChoice",
      "buildModChoice",
      "buildMosaicChoice",
      "buildPairChoice",
      "buildSectionHash",
      "buildSitesDrop",
      "changeStageCatalogDefaultMosaics",
      "changeStageColorScheme",
      "changeStageFullscreen",
      "changeStageTheaterMode",
      "changeStageTileLinkedMedia",
      "checkFrameLoadedAgain",
      "clearNotifications",
      "closeSandbox",
      "createStage",
      "dismissMessage",
      "followHistory",
      "frameLoadedAgain",
      "isCombinationSandbox",
      "markMessagesRead",
      "markStageActionPlaying",
      "openStageCombination",
      "openStageLink",
      "openStageSection",
      "readStageCatalog",
      "readStageSnapshot",
      "reloadTiles",
      "subscribeStage",
      "warnFullscreenRefused",
    ]);
  });
});
