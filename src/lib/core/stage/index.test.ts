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
      "buildRunLink",
      "buildSectionHash",
      "buildSitesDrop",
      "changeStageCatalogDefaultMosaics",
      "changeStageColorScheme",
      "changeStageFullscreen",
      "changeStageTheaterMode",
      "changeStageTileLinkedMedia",
      "changeStageUserCatalog",
      "checkFrameLoadedAgain",
      "clearNotifications",
      "closeSandbox",
      "createStage",
      "dismissMessage",
      "followHistory",
      "frameLoadedAgain",
      "isCatalogAction",
      "isCombinationSandbox",
      "markMessagesRead",
      "markStageActionPlaying",
      "openStageCombination",
      "openStageLink",
      "openStageSection",
      "readStageCatalog",
      "readStageSnapshot",
      "refreshStageCatalog",
      "reloadTiles",
      "subscribeStage",
      "warnFullscreenRefused",
    ]);
  });
});
