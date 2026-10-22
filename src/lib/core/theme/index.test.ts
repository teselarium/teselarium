import { describe, expect, it } from "vitest";
import * as themeModule from "./index.ts";

describe("theme module entry point", function describeEntryPoint(): void {
  it("exports the public API", function exportsPublicApi(): void {
    expect(Object.keys(themeModule).sort()).toEqual([
      "THEME_CHOICE_KEY",
      "THEME_FRAME_STYLES",
      "THEME_TOKENS",
      "buildTheme",
      "buildThemeTokenStyles",
      "readThemeChoice",
      "resolveColorScheme",
      "writeThemeChoice",
    ]);
  });
});
