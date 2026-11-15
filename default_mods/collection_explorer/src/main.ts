/**
 * Default mod: lists the tile collections of its config and opens the viewer
 * for the one the user picks. It reads each collection with
 * `collections.inspect`, so no tile is requested.
 *
 * It is also an example of getting the app's look without classes: the
 * theme's base stylesheet styles semantic HTML like the app's components (an
 * `<article>` is a card, `role="alert"` an alert, `aria-busy` a loading
 * state), and this mod's own CSS sets layout only. See "Write HTML, get the
 * app's look" in docs/modules/lib/core/theme/README.md.
 */

import type { ModContext, ModEngine } from "../../mod_api.d.ts";
import {
  inspectCollections,
  readCollectionLocations,
} from "./collection_entries.ts";
import { buildExplorerPage, renderCollectionList } from "./explorer_page.ts";
import type { ExplorerView } from "./explorer_view.ts";

/** The viewer opened for a selected collection when the config names none. */
const DEFAULT_VIEWER = "collection_viewer";

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
  view.content.setAttribute("aria-label", "Collections");
  view.status.setAttribute("role", "status");
  buildExplorerPage(view, context.mod.title);
  const entries = await inspectCollections(
    engine,
    readCollectionLocations(context.config),
  );
  renderCollectionList(view, entries);
}
