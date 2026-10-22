import { describe, expect, it } from "vitest";
import * as engineModule from "./index.ts";

describe("engine module entry point", function describeEntryPoint(): void {
  it("exports the public API", function exportsPublicApi(): void {
    expect(Object.keys(engineModule).sort()).toEqual([
      "ModMethodError",
      "ModSwitchedOffError",
      "THEME_CHANGED_METHOD",
      "connectModSession",
      "findSwitchedOffMod",
      "inspectMod",
      "loadModTiles",
      "prepareModLaunch",
      "pushThemeChanged",
      "pushTilesChanged",
      "resolveDefaultModSettings",
      "stopModSession",
    ]);
  });
});
