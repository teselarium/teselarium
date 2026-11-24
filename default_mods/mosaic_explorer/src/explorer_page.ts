import { buildMosaicItem } from "./mosaic_cards.ts";
import type { MosaicEntry } from "./mosaic_entries.ts";
import { addMosaicByUrl, importMosaics } from "./explorer_view.ts";
import type { ExplorerView } from "./explorer_view.ts";

// Layout only: the colors, borders and fonts come from the theme.
const EXPLORER_STYLE = `
  ul { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); gap: var(--tes-space-4); }
  li { display: grid; }
  li > * { margin: 0; }
  article { display: grid; grid-template-rows: auto 1fr auto; }
  header { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tes-space-1) var(--tes-space-2); }
  header > * { margin: 0; }
  header > h2 { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
  header > small { flex-basis: 100%; }
  body > p:first-of-type { display: flex; flex-wrap: wrap; gap: var(--tes-space-2); }
  body > p:first-of-type > button { min-height: 2rem; }
  article > p:last-child { display: flex; flex-wrap: wrap; gap: var(--tes-space-2); margin-bottom: 0; }
  code { overflow-wrap: anywhere; }
`;

/** Marks the list region busy while the mosaics load, in place of the list. */
export function showMosaicsLoading(view: ExplorerView): void {
  view.content.setAttribute("aria-busy", "true");
  view.content.textContent = "Loading mosaics…";
}

function buildToolbarButton(
  label: string,
  handleClick: () => void,
): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.tesVariant = "outline";
  button.addEventListener("click", handleClick);
  return button;
}

/** "Import…" and "Add by URL…", above the list: outline buttons, so "Open" stays the page's primary action. */
function buildToolbar(view: ExplorerView): HTMLElement {
  const toolbar = document.createElement("p");
  toolbar.append(
    buildToolbarButton("Import…", importMosaics.bind(undefined, view)),
    buildToolbarButton("Add by URL…", addMosaicByUrl.bind(undefined, view)),
  );
  return toolbar;
}

/** The page while the mosaics load: the toolbar, the busy region, and the status region, empty. */
export function buildExplorerPage(view: ExplorerView, title: string): void {
  const style = document.createElement("style");
  style.textContent = EXPLORER_STYLE;
  document.head.append(style);
  const heading = document.createElement("h1");
  heading.textContent = title;
  showMosaicsLoading(view);
  document.body.replaceChildren(
    heading,
    buildToolbar(view),
    view.content,
    view.status,
  );
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
