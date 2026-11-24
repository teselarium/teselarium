import {
  buildLoadingSection,
  showCollection,
  showMod,
} from "./bundle_sections.ts";
import { buildMosaicActions } from "./mosaic_actions.ts";
import { readProvenance } from "./provenance_section.ts";
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
  dd + dt { margin-top: var(--tes-space-2); }
  dd { overflow-wrap: anywhere; }
  pre { margin: 0; }
  td { overflow-wrap: anywhere; }
  code { overflow-wrap: anywhere; }
  section { margin-top: var(--tes-space-4); }
  form { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tes-space-2); margin-top: var(--tes-space-4); }
  /* Edit mode: one column of fields, each label above its field. */
  [role="tablist"] { display: flex; flex-wrap: wrap; gap: var(--tes-space-2); margin-top: var(--tes-space-4); }
  [role="tabpanel"] { margin-top: var(--tes-space-2); }
  fieldset { min-width: 0; margin: var(--tes-space-4) 0 0; }
  .edit-field { display: flex; flex-direction: column; gap: var(--tes-space-1); margin-top: var(--tes-space-2); min-width: 0; }
  .edit-field > :is(input, textarea), textarea[name="content"] { box-sizing: border-box; width: 100%; max-width: 100%; }
  .edit-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto; align-items: end; gap: var(--tes-space-2); }
  .edit-columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); gap: var(--tes-space-4); }
  ul[aria-label="Problems"] { padding-left: 0; list-style: none; }
  /*
   * A narrow frame, such as a phone's: each permission is a small grid, its
   * category and, at the end, its status on the first line, then its host,
   * then its reason. The header row is hidden visually but stays for screen
   * readers, and the explicit table roles of mosaic_card.ts keep the table's
   * semantics. The mod viewer has a copy of these rules
   * (mod_viewer/src/viewer_page.ts), since a default mod cannot
   * import another mod's files. Keep both copies alike.
   */
  @media (max-width: 29.99rem) {
    .edit-row { grid-template-columns: minmax(0, 1fr); }
    :is(table, tbody) { display: block; }
    thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    tbody tr { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "category status" "host host" "reason reason"; }
    tbody td:nth-child(1) { grid-area: category; }
    tbody td:nth-child(2) { grid-area: host; }
    tbody td:nth-child(3) { grid-area: reason; }
    tbody td:nth-child(4) { grid-area: status; }
  }
`;

export function addViewerStyle(): void {
  const style = document.createElement("style");
  style.textContent = VIEWER_STYLE;
  document.head.append(style);
}

/**
 * The viewed mosaic: its card, "Mod" and "Collection", which load in
 * parallel, its config, aliases and permissions, "Where it comes from" for
 * a user mosaic of the catalog, the actions and the messages. Resolves once
 * the mod, the collection and the provenance are shown.
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
    view.provenance,
    buildMosaicActions(view),
    view.messages,
  );
  await Promise.all([
    showMod(view, modSection),
    showCollection(view, collectionSection),
    readProvenance(view),
  ]);
}

/** A page with only a title and a message, when there is no mosaic to show. */
export function renderMessage(title: string, message: HTMLElement): void {
  const heading = document.createElement("h1");
  heading.textContent = title;
  document.body.replaceChildren(heading, message);
}
