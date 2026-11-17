/**
 * Tests of the mod viewer, which `mods.check` runs after mounting it. Each
 * case mounts the viewer with a fixture mod of `fixtures/` as its target, so
 * the cases pass whatever samples the app ships (default_mods/README.md).
 * The run choices are answered with `null`, so they open nothing.
 */

import type { ModTestRegistration } from "../../mod_api.d.ts";
import {
  drawsPrimaryAction,
  keepsOwnStylesToLayout,
  showsPermissionBadges,
} from "./look_cases.ts";
import {
  offersNoDefaultMosaicWithoutOne,
  opensDefaultMosaic,
  runsNothingWithEmptyField,
  runsWithoutTiles,
  runsWithTypedCollection,
} from "./run_cases.ts";
import {
  marksMatchingApiRange,
  marksOtherApiRange,
  saysEmptyTarget,
  saysNoApiRange,
  saysNoTarget,
  showsMissingTargetError,
  showsTargetFormatError,
  showsTargetMetadata,
} from "./viewer_cases.ts";

export default function registerViewerTests(t: ModTestRegistration): void {
  t.test("shows the metadata of its target", showsTargetMetadata);
  t.test("marks an API range that matches", marksMatchingApiRange);
  t.test("marks an API range that does not match", marksOtherApiRange);
  t.test("says when the mod declares no API range", saysNoApiRange);
  t.test("says no mod was given without a target", saysNoTarget);
  t.test("says no mod was given for an empty target", saysEmptyTarget);
  t.test(
    "shows why a missing target cannot be loaded",
    showsMissingTargetError,
  );
  t.test("shows the format error of its target", showsTargetFormatError);
  t.test("opens the default mosaic", opensDefaultMosaic);
  t.test(
    "runs with the typed collection, sent as typed",
    runsWithTypedCollection,
  );
  t.test(
    "runs nothing with an empty collection field",
    runsNothingWithEmptyField,
  );
  t.test("runs without tiles", runsWithoutTiles);
  t.test(
    "offers no default mosaic without one",
    offersNoDefaultMosaicWithoutOne,
  );
  t.test("shows permission statuses as badges", showsPermissionBadges);
  t.test(
    "makes opening the default mosaic the primary action",
    drawsPrimaryAction,
  );
  t.test("keeps its own styles to layout", keepsOwnStylesToLayout);
}
