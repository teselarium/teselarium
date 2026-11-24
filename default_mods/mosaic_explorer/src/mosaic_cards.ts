import type { CatalogMosaicEntry, MosaicInspection } from "../../mod_api.d.ts";
import type { MosaicEntry } from "./mosaic_entries.ts";
import {
  downloadMosaic,
  exportMosaic,
  openMosaic,
  openViewer,
} from "./explorer_view.ts";
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

/**
 * The card's actions: "Open", its primary action, then "View" and "Export"
 * for a mosaic stored in this browser, whether or not it has unexported
 * changes, as in the viewer, or "Download" for any other, outline buttons.
 */
function buildCardActions(
  view: ExplorerView,
  inspection: MosaicInspection,
  catalogEntry: CatalogMosaicEntry,
): HTMLElement {
  const actions = document.createElement("p");
  const openButton = buildCardButton(
    "Open",
    inspection.title,
    openMosaic.bind(undefined, view, inspection),
  );
  openButton.dataset.tesVariant = "primary";
  const viewButton = buildCardButton(
    "View",
    inspection.title,
    openViewer.bind(undefined, view, inspection),
  );
  actions.append(openButton, viewButton);
  const isStored = catalogEntry.place === "browser";
  actions.append(
    buildCardButton(
      isStored ? "Export" : "Download",
      inspection.title,
      (isStored ? exportMosaic : downloadMosaic).bind(
        undefined,
        view,
        inspection,
      ),
    ),
  );
  return actions;
}

/** Who listed the mosaic, under the title, or `null` for the instance catalog's mosaics. */
function describeListedBy(catalogEntry: CatalogMosaicEntry): string | null {
  if (catalogEntry.defaultOf !== null) {
    return `Default mosaic of ${catalogEntry.defaultOf.title}`;
  }
  if (catalogEntry.listedBy === "user") {
    return "Added by you";
  }
  return null;
}

/**
 * The mark of who listed the mosaic, under the title: a `<small>`, not a
 * `<p>`, so the card's first paragraph stays its description.
 */
function buildListedByMark(text: string): HTMLElement {
  const mark = document.createElement("small");
  mark.textContent = text;
  return mark;
}

/**
 * Where the mosaic's file lives, after its title: "Browser", a secondary
 * badge, for a file stored in this browser, or "Remote", an outline badge.
 */
function buildPlaceBadge(catalogEntry: CatalogMosaicEntry): HTMLElement {
  const badge = document.createElement("span");
  const isStored = catalogEntry.place === "browser";
  badge.textContent = isStored ? "Browser" : "Remote";
  badge.dataset.tesVariant = isStored ? "secondary" : "outline";
  return badge;
}

/** "Unexported changes", a warning badge, for a stored mosaic whose text no exported or imported file holds (`changedSinceExport`). */
function buildChangedBadge(): HTMLElement {
  const badge = document.createElement("span");
  badge.textContent = "Unexported changes";
  badge.dataset.tesVariant = "warning";
  return badge;
}

/**
 * A mosaic as a card: an `<article>` with its title and where its file
 * lives, the mark of who listed it and whether it has unexported changes, its
 * description and its actions.
 */
function buildMosaicCard(
  view: ExplorerView,
  inspection: MosaicInspection,
  catalogEntry: CatalogMosaicEntry,
): HTMLElement {
  const card = document.createElement("article");
  const heading = document.createElement("header");
  const title = document.createElement("h2");
  title.textContent = inspection.title;
  heading.append(title, buildPlaceBadge(catalogEntry));
  const listedBy = describeListedBy(catalogEntry);
  if (listedBy !== null) {
    heading.append(buildListedByMark(listedBy));
  }
  if (catalogEntry.provenance?.changedSinceExport === true) {
    heading.append(buildChangedBadge());
  }
  const description = document.createElement("p");
  description.textContent = inspection.description;
  card.append(
    heading,
    description,
    buildCardActions(view, inspection, catalogEntry),
  );
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
    item.append(buildFailureAlert(entry.catalogEntry.source, entry.error));
    return item;
  }
  item.append(buildMosaicCard(view, entry.inspection, entry.catalogEntry));
  return item;
}
