import type { CollectionInspection, ModInspection } from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";
import {
  addDefinition,
  buildBadge,
  buildFailureAlert,
  buildTitledSection,
} from "./page_elements.ts";
import { openViewer } from "./viewer_view.ts";
import type { ViewerView } from "./viewer_view.ts";

/** A titled section that says it is loading, until its inspection settles. */
export function buildLoadingSection(title: string, what: string): HTMLElement {
  const section = buildTitledSection(title);
  section.setAttribute("aria-busy", "true");
  const loading = document.createElement("p");
  loading.textContent = `Loading ${what}…`;
  section.append(loading);
  return section;
}

/** Replaces a loading section's content under its heading, and ends the busy state. */
function fillSection(section: HTMLElement, content: HTMLElement): void {
  const heading = section.querySelector("h2");
  section.replaceChildren();
  if (heading !== null) {
    section.append(heading);
  }
  section.append(content);
  section.removeAttribute("aria-busy");
}

/** A title that opens its viewer: a ghost button, so the page keeps one primary action. */
function buildTitleButton(
  view: ViewerView,
  title: string,
  viewer: string,
  target: string,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.tesVariant = "ghost";
  button.textContent = title;
  button.addEventListener(
    "click",
    openViewer.bind(undefined, view, viewer, target),
  );
  return button;
}

/** The mod's `api` range with a badge telling whether it matches the app's mod API version. */
function buildApiRangeDescription(
  modInspection: ModInspection,
  apiVersion: string,
): HTMLElement {
  const description = document.createElement("span");
  if (modInspection.api === null) {
    description.textContent = "The mod declares no API range.";
    return description;
  }
  const range = document.createElement("code");
  range.textContent = modInspection.api;
  if (modInspection.apiCompatible) {
    description.append(range, " ", buildBadge("matches", "success"));
    return description;
  }
  description.append(
    range,
    " ",
    buildBadge("does not match", "warning"),
    ` This app has mod API ${apiVersion}.`,
  );
  return description;
}

function buildModDetails(
  view: ViewerView,
  modInspection: ModInspection,
): HTMLElement {
  const details = document.createElement("dl");
  addDefinition(
    details,
    "Title",
    buildTitleButton(
      view,
      modInspection.title,
      view.modViewer,
      modInspection.source,
    ),
  );
  addDefinition(
    details,
    "Version",
    buildBadge(modInspection.version, "secondary"),
  );
  addDefinition(
    details,
    "API range",
    buildApiRangeDescription(modInspection, view.apiVersion),
  );
  return details;
}

function describeTileCount(count: number): string {
  if (count === 1) {
    return "1 tile";
  }
  const tileCount = `${count} tiles`;
  return tileCount;
}

function buildCollectionDetails(
  view: ViewerView,
  collectionInspection: CollectionInspection,
): HTMLElement {
  const details = document.createElement("dl");
  addDefinition(
    details,
    "Title",
    buildTitleButton(
      view,
      collectionInspection.title,
      view.collectionViewer,
      collectionInspection.source,
    ),
  );
  addDefinition(
    details,
    "Tiles",
    describeTileCount(collectionInspection.tiles.length),
  );
  return details;
}

/** Inspects the mosaic's mod and fills "Mod": its title, version and API range, or an alert. */
export async function showMod(
  view: ViewerView,
  section: HTMLElement,
): Promise<void> {
  const address = view.inspection.mod;
  try {
    const modInspection = await view.engine.request("mods.inspect", {
      mod: address,
    });
    fillSection(section, buildModDetails(view, modInspection));
  } catch (error) {
    fillSection(section, buildFailureAlert(address, describeError(error)));
  }
}

function buildNoCollection(): HTMLElement {
  const none = document.createElement("p");
  none.textContent = "This mosaic has no collection.";
  return none;
}

/** Inspects the mosaic's collection and fills "Collection": its title and number of tiles, or an alert. */
export async function showCollection(
  view: ViewerView,
  section: HTMLElement,
): Promise<void> {
  const address = view.inspection.collection;
  if (address === null) {
    fillSection(section, buildNoCollection());
    return;
  }
  try {
    const collectionInspection = await view.engine.request(
      "collections.inspect",
      { collection: address },
    );
    fillSection(section, buildCollectionDetails(view, collectionInspection));
  } catch (error) {
    fillSection(section, buildFailureAlert(address, describeError(error)));
  }
}
