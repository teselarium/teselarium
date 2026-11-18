/**
 * Tests of the mosaic explorer, which `mods.check` runs after mounting it.
 * Each case answers `catalog.list` with fixture mosaics before mounting the
 * explorer, so the cases pass whatever samples and catalog the app ships
 * (default_mods/README.md). "Open" and "View" are answered with `null`, so
 * they open nothing.
 */

import type { ModTestRegistration } from "../../mod_api.d.ts";
import {
  listsFailureAsAlert,
  listsMosaicsAsCards,
  marksDefaultMosaic,
  opensSelectedMosaic,
  opensViewerForSelectedMosaic,
  showsRefusedOpen,
} from "./explorer_cases.ts";
import {
  drawsBusyListWhileLoading,
  drawsCardBackground,
  drawsFailureBorder,
  drawsOpenAsPrimary,
  keepsOwnStylesToLayout,
} from "./look_cases.ts";

export default function registerExplorerTests(t: ModTestRegistration): void {
  t.test("lists the mosaics of the catalog as cards", listsMosaicsAsCards);
  t.test("marks a mod's default mosaic", marksDefaultMosaic);
  t.test(
    "lists a mosaic that cannot be inspected as an alert",
    listsFailureAsAlert,
  );
  t.test("opens the selected mosaic", opensSelectedMosaic);
  t.test(
    "opens the viewer for the selected mosaic",
    opensViewerForSelectedMosaic,
  );
  t.test("shows a refused open", showsRefusedOpen);
  t.test("says the list is busy while it loads", drawsBusyListWhileLoading);
  t.test("keeps its own styles to layout", keepsOwnStylesToLayout);
  t.test("draws each mosaic on the card background", drawsCardBackground);
  t.test("draws a failure with the destructive border", drawsFailureBorder);
  t.test("makes Open the primary action", drawsOpenAsPrimary);
}
