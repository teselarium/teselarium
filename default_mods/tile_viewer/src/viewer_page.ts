import type { ViewerView } from "./viewer_view.ts";
import { buildTileCard } from "./tile_card.ts";

// Layout only: the colors, borders, separator and fonts come from the theme.
// These rules are outside the theme's layer, so they win over its `[hidden]`
// rule: a rule that sets `display` must skip `[hidden]` elements, or a
// thumbnail that failed to load shows as a broken image. The metadata rules
// are scoped to its section, so they never reach a rendered body, which is
// in the same card.
const VIEWER_STYLE = `
  nav[aria-label="Collection"] { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ot-space-2); margin-bottom: var(--ot-space-4); }
  nav[aria-label="Collection"] > button[data-ot-variant="ghost"] { flex: 0 1 auto; min-width: 0; margin-inline-end: auto; justify-content: flex-start; white-space: normal; text-align: start; }
  nav[aria-label="Collection"] > span { flex: none; white-space: nowrap; }
  article > h1 { margin-top: 0; overflow-wrap: anywhere; }
  article > small { display: block; overflow-wrap: anywhere; }
  section[aria-label="Metadata"] > header { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ot-space-2); margin-bottom: var(--ot-space-2); }
  section[aria-label="Metadata"] > header > h2 { margin: 0; }
  section[aria-label="Metadata"] > header > button { min-height: 0; padding: 0.125rem var(--ot-space-3); }
  section[aria-label="Metadata"] dl > div:not([hidden]) { display: contents; }
  section[aria-label="Metadata"] dl { display: grid; grid-template-columns: fit-content(40%) minmax(0, 1fr); column-gap: var(--ot-space-6); row-gap: var(--ot-space-2); margin: 0; }
  section[aria-label="Metadata"] dt { overflow-wrap: anywhere; }
  section[aria-label="Metadata"] dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
  section[aria-label="Metadata"] ul { display: grid; gap: var(--ot-space-1); margin: 0; padding: 0; list-style: none; }
  article > hr { margin: var(--ot-space-6) 0; }
  section[aria-label="Metadata"] a > img:not([hidden]) { block-size: 2lh; inline-size: auto; max-inline-size: 6rem; object-fit: contain; vertical-align: middle; margin-inline-end: var(--ot-space-2); }
  ot-tile-body { display: block; }
`;

export function addViewerStyle(): void {
  const style = document.createElement("style");
  style.textContent = VIEWER_STYLE;
  document.head.append(style);
}

/** A page with only a title and a message, when there is no tile to show. */
export function renderMessage(title: string, message: HTMLElement): void {
  const heading = document.createElement("h1");
  heading.textContent = title;
  document.body.replaceChildren(heading, message);
}

/** The tile's page: its card, which holds the body, and the error region. Returns the card. */
export function renderTile(view: ViewerView): HTMLElement {
  const card = buildTileCard(view.tile);
  document.body.replaceChildren(card, view.errors);
  return card;
}
