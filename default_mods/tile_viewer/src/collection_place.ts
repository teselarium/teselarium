import type { CollectionInspection } from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";
import { openView } from "./viewer_view.ts";
import type { ViewerView } from "./viewer_view.ts";

/** Where the tile is in the inspected collection. */
interface CollectionPlace {
  inspection: CollectionInspection;
  index: number;
}

function openCollection(view: ViewerView, collection: string): void {
  openView(view, {
    mod: view.collectionViewer,
    params: { target: collection },
  });
}

/**
 * Replaces the viewer with the neighbouring tile, with its collection as
 * `from`: a page turn, not a new history entry.
 */
function openNeighbour(
  view: ViewerView,
  collection: string,
  address: string,
): void {
  openView(view, {
    mod: view.tileViewer,
    tile: address,
    params: { from: collection },
    replace: true,
  });
}

function buildStepButton(
  view: ViewerView,
  collection: string,
  text: string,
  address: string | undefined,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  if (address === undefined) {
    button.disabled = true;
  } else {
    button.addEventListener(
      "click",
      openNeighbour.bind(undefined, view, collection, address),
    );
  }
  return button;
}

/**
 * The breadcrumb: the collection's title as a button that opens the
 * collection viewer, the tile's position as plain text, and Previous and
 * Next. Next is the primary action. Neither wraps around.
 */
function buildPlaceNav(
  view: ViewerView,
  collection: string,
  place: CollectionPlace,
): HTMLElement {
  const tiles = place.inspection.tiles;
  const titleButton = document.createElement("button");
  titleButton.type = "button";
  titleButton.dataset.otVariant = "ghost";
  titleButton.textContent = place.inspection.title;
  titleButton.addEventListener(
    "click",
    openCollection.bind(undefined, view, collection),
  );
  const position = document.createElement("span");
  position.textContent = `${place.index + 1} of ${tiles.length}`;
  const previous = buildStepButton(
    view,
    collection,
    "Previous",
    tiles[place.index - 1],
  );
  const next = buildStepButton(
    view,
    collection,
    "Next",
    tiles[place.index + 1],
  );
  next.dataset.otVariant = "primary";
  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "Collection");
  nav.append(titleButton, position, previous, next);
  return nav;
}

/** Tells the user, from the stage bar, that the collection cannot be read. The tile is still shown. */
async function warnUnreadCollection(
  view: ViewerView,
  collection: string,
  error: unknown,
): Promise<void> {
  await view.engine.request("ui.notify", {
    message: `Cannot show this tile's place in its collection: ${describeError(error)}`,
    level: "warning",
    source: collection,
  });
}

/**
 * Inspects the viewer's collection and, when it lists the tile, gives its
 * breadcrumb. Keeps the collection's tiles on the view, so links to tiles it
 * lists carry it as `from`. Gives `null` without a collection, when the tile
 * is not in it, or when it cannot be inspected, which is warned about.
 */
export async function readCollectionPlace(
  view: ViewerView,
): Promise<HTMLElement | null> {
  const collection = view.collection;
  if (collection === null) {
    return null;
  }
  let inspection: CollectionInspection;
  try {
    inspection = await view.engine.request("collections.inspect", {
      collection,
    });
  } catch (error) {
    await warnUnreadCollection(view, collection, error);
    return null;
  }
  view.collectionTiles = inspection.tiles;
  const index = inspection.tiles.indexOf(view.tile.source);
  if (index === -1) {
    return null;
  }
  return buildPlaceNav(view, collection, { inspection, index });
}
