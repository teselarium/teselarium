/**
 * Default mod: lists the mosaics of the catalog, opens the one the
 * user picks, or opens the viewer for it. It reads each mosaic with
 * `mosaics.inspect`, so neither a mod, a collection nor a tile is requested,
 * marks a mod's default mosaic with its mod, and lists the catalog again
 * when it changes.
 *
 * Like the collection explorer, it gets the app's look without classes: the
 * theme's base stylesheet styles semantic HTML like the app's components (an
 * `<article>` is a card, `role="alert"` an alert, `aria-busy` a loading
 * state), `data-tes-variant="primary"` makes "Open" the card's primary
 * button, and this mod's own CSS sets layout only. See "Write HTML, get the
 * app's look" in docs/modules/lib/core/theme/README.md.
 */

import type { Catalog, ModContext, ModEngine } from "../../mod_api.d.ts";
import {
  buildExplorerPage,
  renderMosaicList,
  showMosaicsLoading,
} from "./explorer_page.ts";
import type { ExplorerView } from "./explorer_view.ts";
import { inspectMosaics } from "./mosaic_entries.ts";

/** The viewer opened for a selected mosaic when the config names none. */
const DEFAULT_VIEWER = "mosaic_viewer";

/** Starts a listing: the list is busy, and any listing started before is dropped. Returns its number. */
function startListing(view: ExplorerView): number {
  view.listingCount += 1;
  showMosaicsLoading(view);
  return view.listingCount;
}

/** Inspects the catalog's mosaics and draws them, unless a newer listing started meanwhile. */
async function drawListing(
  view: ExplorerView,
  listing: number,
  catalog: Catalog,
): Promise<void> {
  const entries = await inspectMosaics(view.engine, catalog);
  if (listing !== view.listingCount) {
    return;
  }
  renderMosaicList(view, entries);
}

/** Lists the catalog the engine answers now. */
async function listCatalog(view: ExplorerView): Promise<void> {
  const listing = startListing(view);
  const catalog = await view.engine.request("catalog.list", {});
  await drawListing(view, listing, catalog);
}

/** `catalog.changed`: lists the new catalog in place of the list, without reloading the frame. */
function followCatalogChange(view: ExplorerView, catalog: Catalog): void {
  const listing = startListing(view);
  void drawListing(view, listing, catalog);
}

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
    listingCount: 0,
  };
  view.content.setAttribute("aria-label", "Mosaics");
  view.status.setAttribute("role", "status");
  buildExplorerPage(view, context.mod.title);
  engine.on("catalog.changed", followCatalogChange.bind(undefined, view));
  await listCatalog(view);
}
