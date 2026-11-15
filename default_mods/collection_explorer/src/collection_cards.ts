import type { CollectionInspection } from "../../mod_api.d.ts";
import type { CollectionEntry } from "./collection_entries.ts";
import { openViewer } from "./explorer_view.ts";
import type { ExplorerView } from "./explorer_view.ts";

function describeTileCount(count: number): string {
  if (count === 1) {
    return "1 tile";
  }
  const tileCount = `${count} tiles`;
  return tileCount;
}

/** A collection as a card: an `<article>` with its name, description, number of tiles and a button. */
function buildCollectionCard(
  view: ExplorerView,
  inspection: CollectionInspection,
): HTMLElement {
  const card = document.createElement("article");
  const name = document.createElement("h2");
  name.textContent = inspection.name;
  const description = document.createElement("p");
  description.textContent = inspection.description;
  const tileCount = document.createElement("p");
  tileCount.textContent = describeTileCount(inspection.tiles.length);
  const viewButton = document.createElement("button");
  viewButton.type = "button";
  // The card's heading names the collection, so the visible text does not
  // repeat it. The accessible name keeps it, for a screen reader moving
  // between buttons.
  viewButton.textContent = "View";
  viewButton.ariaLabel = `View ${inspection.name}`;
  viewButton.addEventListener(
    "click",
    openViewer.bind(undefined, view, inspection),
  );
  card.append(name, description, tileCount, viewButton);
  return card;
}

/** A collection that cannot be inspected: `role="alert"` gives it the app's destructive alert look. */
function buildFailureAlert(location: string, error: string): HTMLElement {
  const failure = document.createElement("div");
  failure.setAttribute("role", "alert");
  const locationCode = document.createElement("code");
  locationCode.textContent = location;
  const message = document.createElement("p");
  message.textContent = error;
  failure.append(locationCode, message);
  return failure;
}

/** A list item of the explorer: the collection's card, or the alert of a collection that cannot be inspected. */
export function buildCollectionItem(
  view: ExplorerView,
  entry: CollectionEntry,
): HTMLElement {
  const item = document.createElement("li");
  if (entry.inspection === null) {
    item.append(buildFailureAlert(entry.location, entry.error));
    return item;
  }
  item.append(buildCollectionCard(view, entry.inspection));
  return item;
}
