/**
 * Tests of the mosaic viewer, which `mods.check` runs after mounting it.
 * Each case mounts the viewer with a fixture mosaic of `fixtures/` as its
 * target, whose mod and collection are fixtures next to it, so the cases
 * pass whatever samples the app ships (default_mods/README.md). The opens
 * are answered with `null`, so they open nothing. A case cannot answer
 * `mosaics.check`, so the report itself is tested by e2e/default_mods.spec.ts.
 */

import type { ModTestRegistration } from "../../mod_api.d.ts";
import {
  opensCollectionViewer,
  opensModViewer,
  opensMosaic,
  showsRefusedCheck,
} from "./action_cases.ts";
import {
  exportsStoredMosaic,
  removesStoredMosaic,
  showsNoProvenanceForOthers,
  showsRemoteProvenance,
  showsStoredProvenance,
  updatesStoredMosaicWhenCancelled,
} from "./provenance_cases.ts";
import {
  drawsFailureBorder,
  drawsMosaicCard,
  drawsOpenAsPrimary,
  keepsOwnStylesToLayout,
} from "./look_cases.ts";
import {
  givesTableRoles,
  saysEmptyTarget,
  saysNoCollection,
  saysNoTarget,
  showsFailingCollection,
  showsMissingTargetError,
  showsPermissionBadges,
  showsTargetCollection,
  showsTargetFormatError,
  showsTargetMod,
  showsTargetMosaic,
} from "./viewer_cases.ts";

export default function registerViewerTests(t: ModTestRegistration): void {
  t.test("shows the mosaic of its target", showsTargetMosaic);
  t.test("shows permission statuses as badges", showsPermissionBadges);
  t.test("gives its permission table explicit table roles", givesTableRoles);
  t.test("shows the mosaic's mod", showsTargetMod);
  t.test("shows the mosaic's collection", showsTargetCollection);
  t.test("says when the mosaic has no collection", saysNoCollection);
  t.test(
    "shows a collection that cannot be inspected as an alert",
    showsFailingCollection,
  );
  t.test("says no mosaic was given without a target", saysNoTarget);
  t.test("says no mosaic was given for an empty target", saysEmptyTarget);
  t.test(
    "shows why a missing target cannot be inspected",
    showsMissingTargetError,
  );
  t.test("shows the format error of its target", showsTargetFormatError);
  t.test("opens the mod viewer from the mod's title", opensModViewer);
  t.test(
    "opens the collection viewer from the collection's title",
    opensCollectionViewer,
  );
  t.test("opens the mosaic", opensMosaic);
  t.test("shows a refused check and enables it again", showsRefusedCheck);
  t.test("shows where a stored mosaic comes from", showsStoredProvenance);
  t.test("shows where a remote mosaic comes from", showsRemoteProvenance);
  t.test(
    "shows no provenance for a mosaic the user did not add",
    showsNoProvenanceForOthers,
  );
  t.test("removes a stored mosaic", removesStoredMosaic);
  t.test("exports a stored mosaic", exportsStoredMosaic);
  t.test(
    "updates a stored mosaic from a file",
    updatesStoredMosaicWhenCancelled,
  );
  t.test("makes opening the mosaic the primary action", drawsOpenAsPrimary);
  t.test("draws the mosaic on the card background", drawsMosaicCard);
  t.test("draws a failure with the destructive border", drawsFailureBorder);
  t.test("keeps its own styles to layout", keepsOwnStylesToLayout);
}
