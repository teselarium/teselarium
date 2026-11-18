import type { CatalogMosaicEntry, MosaicInspection } from "../../mod_api.d.ts";
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

/**
 * The default mosaic mark, under the title: a `<small>`, not a `<p>`, so the
 * card's first paragraph stays its description.
 */
function buildDefaultMark(
  defaultOf: NonNullable<CatalogMosaicEntry["defaultOf"]>,
): HTMLElement {
  const mark = document.createElement("small");
  mark.textContent = `Default mosaic of ${defaultOf.title}`;
  return mark;
}

/**
 * A mosaic as a card: an `<article>` with its title, the mark of a mod's
 * default mosaic, its description and its actions.
 */
function buildMosaicCard(
  view: ExplorerView,
  inspection: MosaicInspection,
  defaultOf: CatalogMosaicEntry["defaultOf"],
): HTMLElement {
  const card = document.createElement("article");
  const heading = document.createElement("header");
  const title = document.createElement("h2");
  title.textContent = inspection.title;
  heading.append(title);
  if (defaultOf !== null) {
    heading.append(buildDefaultMark(defaultOf));
  }
  const description = document.createElement("p");
  description.textContent = inspection.description;
  card.append(heading, description, buildCardActions(view, inspection));
  return card;
}

/** A mosaic that cannot be inspected: `role="alert"` gives it the app's destructive alert look. */
function buildFailureAlert(source: string, error: string): HTMLElement {
  const failure = document.createElement("div");
  failure.setAttribute("role", "alert");
  const sourceCode = document.createElement("code");
  sourceCode.textContent = source;
  const message = document.createElement("p");
  message.textContent = error;
  failure.append(sourceCode, message);
  return failure;
}

/** A list item of the explorer: the mosaic's card, or the alert of a mosaic that cannot be inspected. */
export function buildMosaicItem(
  view: ExplorerView,
  entry: MosaicEntry,
): HTMLElement {
  const item = document.createElement("li");
  if (entry.inspection === null) {
    item.append(buildFailureAlert(entry.source, entry.error));
    return item;
  }
  item.append(buildMosaicCard(view, entry.inspection, entry.defaultOf));
  return item;
}
