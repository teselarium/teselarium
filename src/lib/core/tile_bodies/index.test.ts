import { describe, expect, it } from "vitest";
import * as tileBodiesModule from "./index.ts";

describe("tile bodies module entry point", function describeEntryPoint(): void {
  it("exports the public API", function exportsPublicApi(): void {
    expect(Object.keys(tileBodiesModule).sort()).toEqual(["renderTileBody"]);
  });
});
