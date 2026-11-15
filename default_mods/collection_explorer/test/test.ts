/**
 * Tests of the collection explorer, which `mods.check` runs after mounting
 * it. Each case mounts the explorer with fixture collections in its config's
 * `collections`, so the cases pass whatever samples the app ships
 * (default_mods/README.md).
 */

import type { ModTestRegistration } from "../../mod_api.d.ts";
import {
  drawsCardBackground,
  drawsFailureBorder,
  keepsOwnStylesToLayout,
  listsCollectionsAsCards,
  listsFailureAsAlert,
  opensViewerForSelectedCollection,
} from "./explorer_cases.ts";

export default function registerExplorerTests(t: ModTestRegistration): void {
  t.test(
    "lists the collections of its config as cards",
    listsCollectionsAsCards,
  );
  t.test(
    "lists a collection that cannot be inspected as an alert",
    listsFailureAsAlert,
  );
  t.test(
    "opens the viewer for the selected collection",
    opensViewerForSelectedCollection,
  );
  t.test("keeps its own styles to layout", keepsOwnStylesToLayout);
  t.test("draws each collection on the card background", drawsCardBackground);
  t.test("draws a failure with the destructive border", drawsFailureBorder);
}
