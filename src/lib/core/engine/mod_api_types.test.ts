import { describe, expectTypeOf, it } from "vitest";
import type {
  CollectionInspection as DeclaredCollectionInspection,
  ModCheckReport as DeclaredModCheckReport,
  ModContext as DeclaredModContext,
  ModInspection as DeclaredModInspection,
  ModLayoutChangedParams as DeclaredLayoutChangedParams,
  ModOpenParams as DeclaredModOpenParams,
  MosaicInspection as DeclaredMosaicInspection,
  MosaicOpenParams as DeclaredMosaicOpenParams,
} from "../../../../default_mods/mod_api.d.ts";
import type { TileCollectionIndex } from "../../tile/index.ts";
import type { ModCheckReport } from "./mod_check_report.ts";
import type { ModInspection } from "./mod_inspection.ts";
import type { ModContext, RunLink } from "./mod_launch.ts";
import type { LayoutChangedParams } from "./mod_session.ts";
import type { MosaicInspection } from "./mosaics_methods.ts";

// A compile-time guard: `tsc -b` fails when the engine's types no longer fit
// the declarations the default mods are typed with (default_mods/mod_api.d.ts),
// for example after a field is renamed on either side.
describe("default_mods/mod_api.d.ts", function describeModApiTypes(): void {
  it("declares a mount context the engine's fits", function checksModContext(): void {
    expectTypeOf<ModContext>().toExtend<DeclaredModContext>();
  });

  it("declares layout.changed params the engine's fit", function checksLayoutChanged(): void {
    expectTypeOf<LayoutChangedParams>().toExtend<DeclaredLayoutChangedParams>();
  });

  it("declares an inspection the engine's fits", function checksModInspection(): void {
    expectTypeOf<ModInspection>().toExtend<DeclaredModInspection>();
  });

  it("declares a check report the engine's fits", function checksModCheckReport(): void {
    expectTypeOf<ModCheckReport>().toExtend<DeclaredModCheckReport>();
  });

  it("declares a collection inspection the engine's index fits", function checksCollectionInspection(): void {
    expectTypeOf<TileCollectionIndex>().toExtend<DeclaredCollectionInspection>();
  });

  it("declares the mods.open params the engine reads: the link's fields but mosaic, and replace", function checksModOpenParams(): void {
    expectTypeOf<keyof DeclaredModOpenParams>().toEqualTypeOf<
      Exclude<keyof RunLink, "mosaic"> | "replace"
    >();
    expectTypeOf<DeclaredModOpenParams["replace"]>().toEqualTypeOf<
      boolean | undefined
    >();
  });

  it("declares a mount context mosaic the engine's fits", function checksContextMosaic(): void {
    expectTypeOf<ModContext["mosaic"]>().toExtend<
      DeclaredModContext["mosaic"]
    >();
    expectTypeOf<DeclaredModContext["mosaic"]>().toExtend<
      ModContext["mosaic"]
    >();
  });

  it("declares a mosaic inspection the engine's fits", function checksMosaicInspection(): void {
    expectTypeOf<MosaicInspection>().toExtend<DeclaredMosaicInspection>();
  });

  it("declares the mosaics.open params the engine reads: mosaic, params and replace", function checksMosaicOpenParams(): void {
    expectTypeOf<keyof DeclaredMosaicOpenParams>().toEqualTypeOf<
      "mosaic" | "params" | "replace"
    >();
    expectTypeOf<DeclaredMosaicOpenParams["params"]>().toEqualTypeOf<
      RunLink["params"] | undefined
    >();
  });
});
