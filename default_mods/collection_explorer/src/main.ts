/**
 * Default mod: lists the tile collections of the catalog and opens the
 * viewer for the one the user picks. It reads each collection with
 * `collections.inspect`, so no tile is requested, and lists the catalog
 * again when it changes.
 *
 * It is also an example of getting the app's look without classes: the
 * theme's base stylesheet styles semantic HTML like the app's components (an
 * `<article>` is a card, `role="alert"` an alert, `aria-busy` a loading
 * state), and this mod's own CSS sets layout only. See "Write HTML, get the
 * app's look" in docs/modules/lib/core/theme/README.md.
 */

import type { Catalog, ModContext, ModEngine } from "../../mod_api.d.ts";
import {
  inspectCollections,
  readCollectionSources,
} from "./collection_entries.ts";
import {
  buildExplorerPage,
  renderCollectionList,
  showCollectionsLoading,
} from "./explorer_page.ts";
import type { ExplorerView } from "./explorer_view.ts";

/** The viewer opened for a selected collection when the config names none. */
const DEFAULT_VIEWER = "collection_viewer";

/** Starts a listing: the list is busy, and any listing started before is dropped. Returns its number. */
function startListing(view: ExplorerView): number {
  view.listingCount += 1;
  showCollectionsLoading(view);
  return view.listingCount;
}

/** Inspects the catalog's collections and draws them, unless a newer listing started meanwhile. */
async function drawListing(
  view: ExplorerView,
  listing: number,
  catalog: Catalog,
): Promise<void> {
  const entries = await inspectCollections(
    view.engine,
    readCollectionSources(catalog),
  );
  if (listing !== view.listingCount) {
    return;
  }
  renderCollectionList(view, entries);
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
  view.content.setAttribute("aria-label", "Collections");
  view.status.setAttribute("role", "status");
  buildExplorerPage(view, context.mod.title);
  engine.on("catalog.changed", followCatalogChange.bind(undefined, view));
  await listCatalog(view);
}
