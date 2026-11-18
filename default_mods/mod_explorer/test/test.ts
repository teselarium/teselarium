/**
 * Tests of the mod explorer, which `mods.check` runs after mounting it. Each
 * case answers `catalog.list` with fixture mods before mounting the explorer,
 * so the cases pass whatever samples and catalog the app ships
 * (default_mods/README.md).
 */

import type { ModTestRegistration } from "../../mod_api.d.ts";
import {
  drawsCardBackground,
  keepsOwnStylesToLayout,
  listsFailureAsAlert,
  listsModsAsCards,
  opensViewerForSelectedMod,
} from "./explorer_cases.ts";

export default function registerExplorerTests(t: ModTestRegistration): void {
  t.test("lists the mods of the catalog as cards", listsModsAsCards);
  t.test(
    "lists a mod that cannot be inspected as an alert",
    listsFailureAsAlert,
  );
  t.test("opens the viewer for the selected mod", opensViewerForSelectedMod);
  t.test("keeps its own styles to layout", keepsOwnStylesToLayout);
  t.test("draws each mod on the card background", drawsCardBackground);
}
