/**
 * Default mod: lists the mosaics of its config, opens the one the user
 * picks, or opens the viewer for it. It reads each mosaic with
 * `mosaics.inspect`, so neither a mod, a collection nor a tile is requested.
 *
 * Like the collection explorer, it gets the app's look without classes: the
 * theme's base stylesheet styles semantic HTML like the app's components (an
 * `<article>` is a card, `role="alert"` an alert, `aria-busy` a loading
 * state), `data-ot-variant="primary"` makes "Open" the card's primary
 * button, and this mod's own CSS sets layout only. See "Write HTML, get the
 * app's look" in docs/modules/lib/core/theme/README.md.
 */

import type { ModContext, ModEngine } from "../../mod_api.d.ts";
import { buildExplorerPage, renderMosaicList } from "./explorer_page.ts";
import type { ExplorerView } from "./explorer_view.ts";
import { inspectMosaics, readMosaicLocations } from "./mosaic_entries.ts";

/** The viewer opened for a selected mosaic when the config names none. */
const DEFAULT_VIEWER = "mosaic_viewer";

/** Entry point called by the frame loader with the engine API object and the mount context. */
export default async function mount(
  engine: ModEngine,
  context: ModContext,
): Promise<void> {
  const view: ExplorerView = {
    engine,
    viewer: String(context.config.viewer ?? DEFAULT_VIEWER),
    content: document.createElement("section"),
    status: document.createElement("p"),
  };
  view.content.setAttribute("aria-label", "Mosaics");
  view.status.setAttribute("role", "status");
  buildExplorerPage(view, context.mod.title);
  const entries = await inspectMosaics(
    engine,
    readMosaicLocations(context.config),
  );
  renderMosaicList(view, entries);
}
