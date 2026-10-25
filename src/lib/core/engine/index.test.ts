import { describe, expect, it } from "vitest";
import * as engineModule from "./index.ts";

describe("engine module entry point", function describeEntryPoint(): void {
  it("exports the public API", function exportsPublicApi(): void {
    expect(Object.keys(engineModule).sort()).toEqual([
      "MOD_API_VERSION",
      "ModMethodError",
      "ModSwitchedOffError",
      "THEME_CHANGED_METHOD",
      "buildModCheckReport",
      "buildModLaunch",
      "checkModBundle",
      "connectModSession",
      "describeCancelledApiMismatch",
      "describeMissingApiRange",
      "findSwitchedOffMod",
      "inspectMod",
      "loadModTiles",
      "matchModApiRange",
      "prepareModLaunch",
      "pushThemeChanged",
      "pushTilesChanged",
      "resolveDefaultModSettings",
      "selectModTiles",
      "stopModSession",
    ]);
  });
});
