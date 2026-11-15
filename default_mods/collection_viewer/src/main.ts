/**
 * Default mod: shows the tile collection named by the `target` parameter,
 * from `collections.inspect`: its name, description, source, entry issues
 * and tiles, which it never requests. Selecting a tile opens it in the tile
 * viewer, with the collection as `from`.
 *
 * It is also an example of getting the app's look without classes: the
 * theme's base stylesheet styles semantic HTML like the app's components (an
 * `<article>` is a card, `role="alert"` an alert, `aria-busy` a loading
 * state), `data-ot-variant` makes the issue levels badges, and this mod's own
 * CSS sets layout only. See "Write HTML, get the app's look" in
 * docs/modules/lib/core/theme/README.md.
 */

import type { ModContext, ModEngine } from "../../mod_api.d.ts";
import { buildErrorAlert, buildStatusMessage } from "./page_elements.ts";
import {
  addViewerStyle,
  renderCollection,
  renderLoading,
  renderMessage,
} from "./viewer_page.ts";
import { inspectTarget } from "./viewer_view.ts";
import type { ViewerView } from "./viewer_view.ts";

/** The mod a selected tile opens in when the config names none. */
const DEFAULT_TILE_VIEWER = "tile_viewer";

/** The region for errors from opening a tile. The theme draws a non-empty `role="status"` as a box, so it stays empty until one. */
function buildOpenErrorRegion(): HTMLElement {
  const region = document.createElement("p");
  region.setAttribute("role", "status");
  return region;
}

/** Entry point called by the frame loader with the engine API object and the mount context. */
export default async function mount(
  engine: ModEngine,
  context: ModContext,
): Promise<void> {
  addViewerStyle();
  const target = context.params.target;
  if (typeof target !== "string" || target === "") {
    renderMessage(
      context.mod.title,
      buildStatusMessage("No collection was given."),
    );
    return;
  }
  renderLoading(context.mod.title);
  const reading = await inspectTarget(engine, target);
  if (reading.inspection === null) {
    renderMessage(context.mod.title, buildErrorAlert(reading.error));
    return;
  }
  const view: ViewerView = {
    engine,
    tileViewer: String(context.config.tile_viewer ?? DEFAULT_TILE_VIEWER),
    status: buildOpenErrorRegion(),
  };
  renderCollection(view, reading.inspection);
}
