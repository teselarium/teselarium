import type { CollectionInspection } from "../../mod_api.d.ts";
import { buildCollectionCard } from "./collection_card.ts";
import { buildEntryIssues } from "./entry_issues.ts";
import { buildTileList } from "./tile_list.ts";
import type { ViewerView } from "./viewer_view.ts";

// Layout only: the colors, borders and fonts come from the theme. These rules
// are outside the theme's layer, so they win over its `[hidden]` rule: a rule
// that sets `display` must skip `[hidden]` elements, or the filter shows them.
const VIEWER_STYLE = `
  article h1 { margin-top: 0; }
  dd { overflow-wrap: anywhere; }
  section { margin-top: var(--tes-space-4); }
  li { overflow-wrap: anywhere; }
  label { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tes-space-2); }
  input[type="search"] { flex: 1; min-width: 16rem; max-width: 24rem; }
  section[aria-label="Tiles"] > small { display: block; margin: var(--tes-space-2) 0 var(--tes-space-4); }
  section[aria-label="Tiles"] article { padding: var(--tes-space-2) var(--tes-space-4); }
  section[aria-label="Tiles"] table { margin: 0; }
  td { overflow-wrap: anywhere; }
  td > button { white-space: normal; text-align: start; overflow-wrap: anywhere; }
  /*
   * A narrow frame, such as a phone's: each tile is a block, its label, then
   * its address, each across the row. The header row is hidden visually but
   * stays for screen readers, and the explicit table roles of tile_list.ts
   * keep the table's semantics.
   */
  @media (max-width: 29.99rem) {
    section[aria-label="Tiles"] :is(table, tbody, td) { display: block; }
    section[aria-label="Tiles"] tr:not([hidden]) { display: block; }
    section[aria-label="Tiles"] thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  }
`;

export function addViewerStyle(): void {
  const style = document.createElement("style");
  style.textContent = VIEWER_STYLE;
  document.head.append(style);
}

/** A page with only a title and a message, when there is no collection to show. */
export function renderMessage(title: string, message: HTMLElement): void {
  const heading = document.createElement("h1");
  heading.textContent = title;
  document.body.replaceChildren(heading, message);
}

/** The page while the target is inspected: the region is busy. */
export function renderLoading(title: string): void {
  const loading = document.createElement("p");
  loading.setAttribute("aria-busy", "true");
  loading.textContent = "Loading the collection…";
  renderMessage(title, loading);
}

/**
 * The viewed collection: its card, its entry issues, if any, its tiles, and
 * the status region for errors from opening a tile, empty until one.
 */
export function renderCollection(
  view: ViewerView,
  inspection: CollectionInspection,
): void {
  document.body.replaceChildren(
    buildCollectionCard(inspection),
    ...buildEntryIssues(inspection.issues),
    buildTileList(view, inspection),
    view.status,
  );
}
