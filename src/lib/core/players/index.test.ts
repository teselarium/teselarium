import { describe, expect, it } from "vitest";
import * as playersModule from "./index.ts";

describe("players module entry point", function describeEntryPoint(): void {
  it("exports the public API", function exportsPublicApi(): void {
    expect(Object.keys(playersModule).sort()).toEqual([
      "readIframePlayer",
      "readPlayer",
    ]);
  });
});
