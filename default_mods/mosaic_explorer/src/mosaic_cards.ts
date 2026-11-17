import type { MosaicInspection } from "../../mod_api.d.ts";
import type { MosaicEntry } from "./mosaic_entries.ts";
import { openMosaic, openViewer } from "./explorer_view.ts";
import type { ExplorerView } from "./explorer_view.ts";

/**
 * A card's button. The card's heading names the mosaic, so the visible text
 * does not repeat it. The accessible name keeps it, for a screen reader
 * moving between buttons.
 */
function buildCardButton(
  label: string,
  title: string,
  handleClick: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.ariaLabel = `${label} ${title}`;
  button.addEventListener("click", handleClick);
  return button;
}

/** The card's actions: "Open", its primary action, then "View", an outline button. */
function buildCardActions(
  view: ExplorerView,
  inspection: MosaicInspection,
): HTMLElement {
  const actions = document.createElement("p");
  const openButton = buildCardButton(
    "Open",
    inspection.title,
    openMosaic.bind(undefined, view, inspection),
  );
  openButton.dataset.otVariant = "primary";
  const viewButton = buildCardButton(
    "View",
    inspection.title,
    openViewer.bind(undefined, view, inspection),
  );
  actions.append(openButton, viewButton);
  return actions;
}

/** A mosaic as a card: an `<article>` with its title, its description and its actions. */
function buildMosaicCard(
  view: ExplorerView,
  inspection: MosaicInspection,
): HTMLElement {
  const card = document.createElement("article");
  const title = document.createElement("h2");
  title.textContent = inspection.title;
  const description = document.createElement("p");
  description.textContent = inspection.description;
  card.append(title, description, buildCardActions(view, inspection));
  return card;
}

/** A mosaic that cannot be inspected: `role="alert"` gives it the app's destructive alert look. */
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

/** A list item of the explorer: the mosaic's card, or the alert of a mosaic that cannot be inspected. */
export function buildMosaicItem(
  view: ExplorerView,
  entry: MosaicEntry,
): HTMLElement {
  const item = document.createElement("li");
  if (entry.inspection === null) {
    item.append(buildFailureAlert(entry.location, entry.error));
    return item;
  }
  item.append(buildMosaicCard(view, entry.inspection));
  return item;
}
