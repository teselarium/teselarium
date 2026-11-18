import type { ExplorerView } from "./explorer_view.ts";
import { buildModItem } from "./mod_cards.ts";
import type { ModEntry } from "./mod_entries.ts";

// Layout only: the colors, borders and fonts come from the theme.
const EXPLORER_STYLE = `
  ul { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); gap: var(--ot-space-4); }
  li { display: grid; }
  li > * { margin: 0; }
  article { display: grid; grid-template-rows: auto 1fr auto; }
  article button { justify-self: start; }
`;

/** Marks the list region busy while the mods load, in place of the list. */
export function showModsLoading(view: ExplorerView): void {
  view.content.setAttribute("aria-busy", "true");
  view.content.textContent = "Loading mods…";
}

/** The page while the mods load: the region is busy, and the status region waits, empty. */
export function buildExplorerPage(view: ExplorerView, title: string): void {
  const style = document.createElement("style");
  style.textContent = EXPLORER_STYLE;
  document.head.append(style);
  const heading = document.createElement("h1");
  heading.textContent = title;
  showModsLoading(view);
  document.body.replaceChildren(heading, view.content, view.status);
}

/** Replaces the loading message with the list of mods, and ends the busy state. */
export function renderModList(view: ExplorerView, entries: ModEntry[]): void {
  const list = document.createElement("ul");
  for (const entry of entries) {
    list.append(buildModItem(view, entry));
  }
  view.content.replaceChildren(list);
  view.content.removeAttribute("aria-busy");
}
