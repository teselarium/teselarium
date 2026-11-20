import { isTileAddress } from "./metadata_addresses.ts";
import { openView } from "./viewer_view.ts";
import type { ViewerView } from "./viewer_view.ts";

/** The link to a tile the click was on, in the metadata or the body, or `null`. */
function findClickedTileLink(event: MouseEvent): HTMLAnchorElement | null {
  if (!(event.target instanceof Element)) {
    return null;
  }
  const link = event.target.closest<HTMLAnchorElement>("a[data-ot-link]");
  if (link === null || !isTileAddress(link.href)) {
    return null;
  }
  return link;
}

/** The params of a linked tile: the viewer's collection as `from`, only when it lists the tile. */
function buildLinkedTileParams(
  view: ViewerView,
  address: string,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (view.collection !== null && view.collectionTiles.includes(address)) {
    params.from = view.collection;
  }
  return params;
}

/** Opens a linked tile in a new tile viewer, instead of asking to open it in a tab. */
function openClickedTile(view: ViewerView, event: MouseEvent): void {
  if (event.defaultPrevented) {
    return;
  }
  const link = findClickedTileLink(event);
  if (link === null) {
    return;
  }
  event.preventDefault();
  openView(view, {
    mod: view.tileViewer,
    tile: link.href,
    params: buildLinkedTileParams(view, link.href),
  });
}

/**
 * Listens to clicks on links to tiles. It listens on `document`, so it runs
 * before the frame loader's listener on `window`, which then leaves the
 * cancelled click alone.
 */
export function watchTileLinks(view: ViewerView): void {
  document.addEventListener("click", openClickedTile.bind(undefined, view));
}
