import {
  buildLoadingSection,
  showCollection,
  showMod,
} from "./bundle_sections.ts";
import { buildMosaicActions } from "./mosaic_actions.ts";
import {
  buildAliasesSection,
  buildConfigSection,
  buildMosaicCard,
  buildPermissionsSection,
} from "./mosaic_card.ts";
import type { ViewerView } from "./viewer_view.ts";

// Layout only: the colors, borders and fonts come from the theme.
const VIEWER_STYLE = `
  article h1 { margin-top: 0; }
  dd + dt { margin-top: var(--ot-space-2); }
  dd { overflow-wrap: anywhere; }
  pre { margin: 0; }
  td { overflow-wrap: anywhere; }
  code { overflow-wrap: anywhere; }
  section { margin-top: var(--ot-space-4); }
  form { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ot-space-2); margin-top: var(--ot-space-4); }
`;

export function addViewerStyle(): void {
  const style = document.createElement("style");
  style.textContent = VIEWER_STYLE;
  document.head.append(style);
}

/**
 * The viewed mosaic: its card, "Mod" and "Collection", which load in
 * parallel, its config, aliases and permissions, the actions and the
 * messages. Resolves once the mod and the collection are shown.
 */
export async function renderInspection(view: ViewerView): Promise<void> {
  const modSection = buildLoadingSection("Mod", "the mod");
  const collectionSection = buildLoadingSection("Collection", "the collection");
  document.body.replaceChildren(
    buildMosaicCard(view.inspection),
    modSection,
    collectionSection,
    buildConfigSection(view.inspection),
    buildAliasesSection(view.inspection),
    buildPermissionsSection(view.inspection),
    buildMosaicActions(view),
    view.messages,
  );
  await Promise.all([
    showMod(view, modSection),
    showCollection(view, collectionSection),
  ]);
}

/** A page with only a title and a message, when there is no mosaic to show. */
export function renderMessage(title: string, message: HTMLElement): void {
  const heading = document.createElement("h1");
  heading.textContent = title;
  document.body.replaceChildren(heading, message);
}
