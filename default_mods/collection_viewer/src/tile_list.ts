import type { CollectionInspection } from "../../mod_api.d.ts";
import { filterTileIndexes } from "./tile_filter.ts";
import { labelTiles } from "./tile_labels.ts";
import { openTile } from "./viewer_view.ts";
import type { ViewerView } from "./viewer_view.ts";

/** The column headings of the tile table. */
const TILE_COLUMNS = ["Tile", "Address"];

/** What the filter updates: each tile's row and label, in the same order, and the count. */
interface TileList {
  rows: HTMLElement[];
  labels: string[];
  count: HTMLElement;
}

function describeCount(shown: number, total: number): string {
  const count = `Showing ${shown} of ${total} tiles`;
  return count;
}

/**
 * The explicit role of each cell. Tables that stack their rows in a narrow
 * frame change their parts' `display`, and some browsers then drop the
 * implicit table semantics. Explicit roles keep them.
 */
const CELL_ROLES: Record<"td" | "th", string> = {
  td: "cell",
  th: "columnheader",
};

function buildCell(tagName: "td" | "th", content: string | Node): HTMLElement {
  const cell = document.createElement(tagName);
  cell.setAttribute("role", CELL_ROLES[tagName]);
  cell.append(content);
  return cell;
}

/**
 * A tile: its label, as a button named after it that opens the tile in the
 * tile viewer, then its full address in muted text.
 */
function buildTileRow(
  view: ViewerView,
  collectionSource: string,
  label: string,
  address: string,
): HTMLElement {
  const row = document.createElement("tr");
  row.setAttribute("role", "row");
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.tesVariant = "ghost";
  button.textContent = label;
  button.addEventListener(
    "click",
    openTile.bind(undefined, view, collectionSource, address),
  );
  const addressElement = document.createElement("small");
  addressElement.textContent = address;
  row.append(buildCell("td", button), buildCell("td", addressElement));
  return row;
}

/** Shows the rows whose label holds the filter's text and hides the others, without rebuilding them. */
function applyFilter(tileList: TileList, event: Event): void {
  const filter = event.currentTarget as HTMLInputElement;
  const shownIndexes = new Set(
    filterTileIndexes(tileList.labels, filter.value),
  );
  for (const [index, row] of tileList.rows.entries()) {
    row.hidden = !shownIndexes.has(index);
  }
  tileList.count.textContent = describeCount(
    shownIndexes.size,
    tileList.rows.length,
  );
}

/**
 * The filter field, labeled "Filter by file name": it matches the tiles'
 * labels, not their addresses, which mostly share the collection's site and
 * folder. It is outside any form, since the mod's sandbox does not allow forms.
 */
function buildFilterField(tileList: TileList): HTMLElement {
  const label = document.createElement("label");
  const field = document.createElement("input");
  field.type = "search";
  field.addEventListener("input", applyFilter.bind(undefined, tileList));
  label.append("Filter by file name", field);
  return label;
}

/**
 * The tiles as a plain `<table>` in an `<article>`: the theme draws the
 * article as a card, and gives the rows separators and a hover highlight.
 * Its parts carry explicit table roles (see `CELL_ROLES`).
 */
function buildTileCard(rows: HTMLElement[]): HTMLElement {
  const header = document.createElement("tr");
  header.setAttribute("role", "row");
  for (const column of TILE_COLUMNS) {
    header.append(buildCell("th", column));
  }
  const head = document.createElement("thead");
  head.setAttribute("role", "rowgroup");
  head.append(header);
  const body = document.createElement("tbody");
  body.setAttribute("role", "rowgroup");
  body.append(...rows);
  const table = document.createElement("table");
  table.setAttribute("role", "table");
  table.append(head, body);
  const card = document.createElement("article");
  card.append(table);
  return card;
}

/**
 * The collection's tiles as a section: a heading, the filter, the count under
 * it and the card of tiles. The count is muted text that screen readers
 * announce (`aria-live`), not `role="status"`, which the theme draws as a box.
 * Hidden rows keep their buttons out of the tab order.
 */
export function buildTileList(
  view: ViewerView,
  inspection: CollectionInspection,
): HTMLElement {
  const addresses = inspection.tiles;
  const tileList: TileList = {
    rows: [],
    labels: labelTiles(addresses),
    count: document.createElement("small"),
  };
  for (const [index, address] of addresses.entries()) {
    tileList.rows.push(
      buildTileRow(view, inspection.source, tileList.labels[index], address),
    );
  }
  tileList.count.setAttribute("aria-live", "polite");
  tileList.count.textContent = describeCount(
    addresses.length,
    addresses.length,
  );
  const section = document.createElement("section");
  section.setAttribute("aria-label", "Tiles");
  const heading = document.createElement("h2");
  heading.textContent = "Tiles";
  section.append(
    heading,
    buildFilterField(tileList),
    tileList.count,
    buildTileCard(tileList.rows),
  );
  return section;
}
