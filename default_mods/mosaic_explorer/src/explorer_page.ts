import { buildMosaicItem } from "./mosaic_cards.ts";
import type { MosaicEntry } from "./mosaic_entries.ts";
import type { ExplorerView } from "./explorer_view.ts";

// Layout only: the colors, borders and fonts come from the theme.
const EXPLORER_STYLE = `
  ul { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); gap: var(--ot-space-4); }
  li { display: grid; }
  li > * { margin: 0; }
  article { display: grid; grid-template-rows: auto 1fr auto; }
  header { display: grid; gap: var(--ot-space-1); }
  header > * { margin: 0; }
  article > p:last-child { display: flex; flex-wrap: wrap; gap: var(--ot-space-2); margin-bottom: 0; }
  code { overflow-wrap: anywhere; }
`;

/** Marks the list region busy while the mosaics load, in place of the list. */
export function showMosaicsLoading(view: ExplorerView): void {
  view.content.setAttribute("aria-busy", "true");
  view.content.textContent = "Loading mosaics…";
}

/** The page while the mosaics load: the region is busy, and the status region waits, empty. */
export function buildExplorerPage(view: ExplorerView, title: string): void {
  const style = document.createElement("style");
  style.textContent = EXPLORER_STYLE;
  document.head.append(style);
  const heading = document.createElement("h1");
  heading.textContent = title;
  showMosaicsLoading(view);
  document.body.replaceChildren(heading, view.content, view.status);
}

/** Replaces the loading message with the list of mosaics, and ends the busy state. */
export function renderMosaicList(
  view: ExplorerView,
  entries: MosaicEntry[],
): void {
  const list = document.createElement("ul");
  for (const entry of entries) {
    list.append(buildMosaicItem(view, entry));
  }
  view.content.replaceChildren(list);
  view.content.removeAttribute("aria-busy");
}
