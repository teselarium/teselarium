import type { Catalog, CatalogMosaicEntry } from "../../mod_api.d.ts";
import {
  addDefinition,
  buildButton,
  buildStatusMessage,
  buildTitledSection,
} from "./page_elements.ts";
import { showError } from "./viewer_view.ts";
import type { ViewerView } from "./viewer_view.ts";

/** The message after a removal from the viewer. */
const REMOVED_MESSAGE = "The mosaic was removed from your catalog.";

/** The viewed mosaic's entry in the catalog when the user listed it, or `null`. */
export function findUserEntry(
  catalog: Catalog,
  source: string,
): CatalogMosaicEntry | null {
  for (const entry of catalog.mosaics) {
    if (entry.source === source && entry.listedBy === "user") {
      return entry;
    }
  }
  return null;
}

/** A time of the provenance: a `<time>` with the ISO string, shown in the reader's locale. */
function buildTime(iso: string): HTMLElement {
  const time = document.createElement("time");
  time.dateTime = iso;
  time.textContent = new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return time;
}

function buildStoredDetails(entry: CatalogMosaicEntry): HTMLElement[] {
  const provenance = entry.provenance;
  const details = document.createElement("dl");
  if (provenance === null) {
    return [details];
  }
  if (provenance.folder !== null) {
    addDefinition(details, "Folder", provenance.folder);
  }
  addDefinition(
    details,
    provenance.folder === null ? "File" : "Path",
    provenance.path ?? "",
  );
  addDefinition(details, "Imported", buildTime(provenance.addedAt));
  addDefinition(
    details,
    "Updated",
    provenance.updatedAt === null ? "Never" : buildTime(provenance.updatedAt),
  );
  const note = document.createElement("p");
  note.textContent =
    "It is kept only in this browser. Export it to keep a copy as a backup.";
  return [details, note];
}

function buildRemoteDetails(entry: CatalogMosaicEntry): HTMLElement[] {
  const note = document.createElement("p");
  note.append("You added it by URL on ");
  if (entry.provenance !== null) {
    note.append(buildTime(entry.provenance.addedAt));
  }
  note.append(".");
  return [note];
}

/** After a removal: the status in the messages, and the section without its buttons. */
function showRemoved(view: ViewerView, isRemoved: boolean): void {
  if (!isRemoved) {
    return;
  }
  view.messages.replaceChildren(buildStatusMessage(REMOVED_MESSAGE));
  view.provenance.querySelector("form")?.remove();
}

function removeMosaic(view: ViewerView): void {
  view.messages.replaceChildren();
  view.engine
    .request("userCatalog.remove", { mosaic: view.inspection.source })
    .then(showRemoved.bind(undefined, view), showError.bind(undefined, view));
}

function exportMosaic(view: ViewerView): void {
  view.messages.replaceChildren();
  view.engine
    .request("userCatalog.export", { mosaic: view.inspection.source })
    .catch(showError.bind(undefined, view));
}

/** After an update: the mosaic inspected anew, so its new title and contents show. */
function showUpdated(view: ViewerView, isUpdated: boolean): void {
  if (isUpdated) {
    void view.onUpdated();
  }
}

function updateMosaic(view: ViewerView): void {
  view.messages.replaceChildren();
  view.engine
    .request("userCatalog.update", { mosaic: view.inspection.source })
    .then(showUpdated.bind(undefined, view), showError.bind(undefined, view));
}

/**
 * The section's actions: "Update from file…", "Export" and "Remove" for a
 * stored mosaic, "Remove" only for a remote one. "Remove" is destructive,
 * the others outline buttons.
 */
function buildProvenanceActions(
  view: ViewerView,
  entry: CatalogMosaicEntry,
): HTMLElement {
  const form = document.createElement("form");
  form.setAttribute("aria-label", "Your mosaic");
  if (entry.place === "browser") {
    const updateButton = buildButton(
      "Update from file…",
      updateMosaic.bind(undefined, view),
    );
    updateButton.dataset.otVariant = "outline";
    const exportButton = buildButton(
      "Export",
      exportMosaic.bind(undefined, view),
    );
    exportButton.dataset.otVariant = "outline";
    form.append(updateButton, exportButton);
  }
  const removeButton = buildButton(
    "Remove",
    removeMosaic.bind(undefined, view),
  );
  removeButton.dataset.otVariant = "destructive";
  form.append(removeButton);
  return form;
}

/** "Where it comes from" of a user mosaic: its provenance and its actions. */
function buildProvenanceSection(
  view: ViewerView,
  entry: CatalogMosaicEntry,
): HTMLElement {
  const section = buildTitledSection("Where it comes from");
  const details =
    entry.place === "browser"
      ? buildStoredDetails(entry)
      : buildRemoteDetails(entry);
  section.append(...details, buildProvenanceActions(view, entry));
  return section;
}

/**
 * Shows "Where it comes from" when the catalog lists the viewed mosaic as
 * the user's, and nothing otherwise, in place of what was shown.
 */
export function showProvenance(view: ViewerView, catalog: Catalog): void {
  const entry = findUserEntry(catalog, view.inspection.source);
  if (entry === null) {
    view.provenance.replaceChildren();
    return;
  }
  view.provenance.replaceChildren(buildProvenanceSection(view, entry));
}

/** Reads the catalog and shows the provenance. A catalog that cannot be read shows none. */
export async function readProvenance(view: ViewerView): Promise<void> {
  try {
    const catalog = await view.engine.request("catalog.list", {});
    showProvenance(view, catalog);
  } catch {
    view.provenance.replaceChildren();
  }
}
