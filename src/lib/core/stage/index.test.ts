import { describe, expect, it } from "vitest";
import * as stageModule from "./index.ts";

describe("stage module entry point", function describeEntryPoint(): void {
  it("exports the public API", function exportsPublicApi(): void {
    expect(Object.keys(stageModule).sort()).toEqual([
      "answerApiMismatch",
      "answerSiteConsent",
      "answerStageAction",
      "attachCheckFrame",
      "attachFrame",
      "buildSectionHash",
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
      "markMessagesRead",
      "markStageActionPlaying",
      "openStageLink",
      "openStageSection",
      "readStageSnapshot",
      "reloadTiles",
      "subscribeStage",
      "warnFullscreenRefused",
    ]);
  });
});
