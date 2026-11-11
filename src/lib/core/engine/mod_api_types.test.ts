import { describe, expectTypeOf, it } from "vitest";
import type {
  ModCheckReport as DeclaredModCheckReport,
  ModContext as DeclaredModContext,
  ModInspection as DeclaredModInspection,
  ModLayoutChangedParams as DeclaredLayoutChangedParams,
} from "../../../../default_mods/mod_api.d.ts";
import type { ModCheckReport } from "./mod_check_report.ts";
import type { ModInspection } from "./mod_inspection.ts";
import type { ModContext } from "./mod_launch.ts";
import type { LayoutChangedParams } from "./mod_session.ts";

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
});
