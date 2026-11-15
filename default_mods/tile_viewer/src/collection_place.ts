import type { CollectionInspection } from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";
import { openView } from "./viewer_view.ts";
import type { ViewerView } from "./viewer_view.ts";

/** Where the tile is in the inspected collection. */
interface CollectionPlace {
  inspection: CollectionInspection;
  index: number;
}

function openCollection(view: ViewerView, from: string): void {
  openView(view, { mod: view.collectionViewer, params: { target: from } });
}

/** Replaces the viewer with the neighbouring tile, keeping `from`: a page turn, not a new history entry. */
function openNeighbour(view: ViewerView, from: string, address: string): void {
  openView(view, {
    mod: view.tileViewer,
    tile: address,
    params: { from },
    replace: true,
  });
}

function buildStepButton(
  view: ViewerView,
  from: string,
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
      openNeighbour.bind(undefined, view, from, address),
    );
  }
  return button;
}

/**
 * The breadcrumb: the collection's name as a button that opens the
 * collection viewer, the tile's position as plain text, and Previous and
 * Next. Next is the primary action. Neither wraps around.
 */
function buildPlaceNav(
  view: ViewerView,
  from: string,
  place: CollectionPlace,
): HTMLElement {
  const tiles = place.inspection.tiles;
  const nameButton = document.createElement("button");
  nameButton.type = "button";
  nameButton.dataset.otVariant = "ghost";
  nameButton.textContent = place.inspection.name;
  nameButton.addEventListener(
    "click",
    openCollection.bind(undefined, view, from),
  );
  const position = document.createElement("span");
  position.textContent = `${place.index + 1} of ${tiles.length}`;
  const previous = buildStepButton(
    view,
    from,
    "Previous",
    tiles[place.index - 1],
  );
  const next = buildStepButton(view, from, "Next", tiles[place.index + 1]);
  next.dataset.otVariant = "primary";
  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "Collection");
  nav.append(nameButton, position, previous, next);
  return nav;
}

/** Tells the user, from the stage bar, that `from` cannot be read. The tile is still shown. */
async function warnUnreadCollection(
  view: ViewerView,
  from: string,
  error: unknown,
): Promise<void> {
  await view.engine.request("ui.notify", {
    message: `Cannot show this tile's place in its collection: ${describeError(error)}`,
    level: "warning",
    source: from,
  });
}

/**
 * Inspects `from` and, when it lists the tile, gives its breadcrumb.
 * Keeps the collection's tiles on the view, so links to tiles it lists
 * carry `from`. Gives `null` without `from`, when the tile is not in it, or
 * when it cannot be inspected, which is warned about.
 */
export async function readCollectionPlace(
  view: ViewerView,
): Promise<HTMLElement | null> {
  const from = view.from;
  if (from === null) {
    return null;
  }
  let inspection: CollectionInspection;
  try {
    inspection = await view.engine.request("collections.inspect", {
      collection: from,
    });
  } catch (error) {
    await warnUnreadCollection(view, from, error);
    return null;
  }
  view.fromTiles = inspection.tiles;
  const index = inspection.tiles.indexOf(view.tile.source);
  if (index === -1) {
    return null;
  }
  return buildPlaceNav(view, from, { inspection, index });
}
