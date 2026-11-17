import type { ModOpenParams, MosaicOpenParams } from "../../mod_api.d.ts";
import { checkMod } from "./mod_check.ts";
import { buildButton } from "./page_elements.ts";
import { readTypedCollection, showError } from "./viewer_view.ts";
import type { ViewerView } from "./viewer_view.ts";

const COLLECTION_FIELD_ID = "collection-address";

/** Opens the viewed mod with a collection, or without tiles when `collection` is `null`. */
function openMod(view: ViewerView, collection: string | null): void {
  const params: ModOpenParams = { mod: view.inspection.source };
  if (collection !== null) {
    params.collection = collection;
  }
  view.messages.replaceChildren();
  const request = view.engine.request("mods.open", params);
  request.catch(showError.bind(undefined, view));
}

/** Opens the viewed mod's default mosaic, which names the mod and its collection. */
function openDefaultMosaic(
  view: ViewerView,
  defaultMosaic: string,
  event: MouseEvent,
): void {
  // The sandbox has no `allow-forms`: the form is never submitted, the click opens the mosaic.
  event.preventDefault();
  const params: MosaicOpenParams = { mosaic: defaultMosaic };
  view.messages.replaceChildren();
  const request = view.engine.request("mosaics.open", params);
  request.catch(showError.bind(undefined, view));
}

function runWithoutTiles(view: ViewerView): void {
  openMod(view, null);
}

function runWithTypedCollection(view: ViewerView, event: MouseEvent): void {
  event.preventDefault();
  const collection = readTypedCollection(view);
  if (collection === null) {
    return;
  }
  openMod(view, collection);
}

/** "Open default mosaic": the page's one primary action, a submit button. */
function buildDefaultMosaicButton(
  view: ViewerView,
  defaultMosaic: string,
): HTMLButtonElement {
  const openButton = document.createElement("button");
  openButton.type = "submit";
  openButton.textContent = "Open default mosaic";
  openButton.addEventListener(
    "click",
    openDefaultMosaic.bind(undefined, view, defaultMosaic),
  );
  return openButton;
}

/**
 * The run choices, and "Check mod" next to them: opening the default
 * mosaic, when the mod declares one, is the page's one primary action, a
 * submit button.
 */
export function buildRunChoices(view: ViewerView): HTMLElement {
  const form = document.createElement("form");
  form.setAttribute("aria-label", "Run");
  const defaultMosaic = view.inspection.defaultMosaic;
  if (defaultMosaic !== null) {
    form.append(buildDefaultMosaicButton(view, defaultMosaic));
  }
  form.append(
    buildButton("Run without tiles", runWithoutTiles.bind(undefined, view)),
    buildButton("Check mod", checkMod.bind(undefined, view)),
  );
  return form;
}

/**
 * The collection address. Its submit button is an outline button, so the
 * page keeps one primary action. Enter in the field clicks it, as in any
 * form.
 */
export function buildCollectionForm(view: ViewerView): HTMLElement {
  const form = document.createElement("form");
  form.setAttribute("aria-label", "Run with a collection");
  const label = document.createElement("label");
  label.htmlFor = COLLECTION_FIELD_ID;
  label.textContent = "Collection address";
  const input = document.createElement("input");
  input.id = COLLECTION_FIELD_ID;
  input.type = "text";
  input.inputMode = "url";
  input.placeholder =
    "./collection.yaml or https://example.org/collection.yaml";
  view.collectionInput = input;
  const runButton = document.createElement("button");
  runButton.type = "submit";
  runButton.dataset.otVariant = "outline";
  runButton.textContent = "Run with this collection";
  runButton.addEventListener(
    "click",
    runWithTypedCollection.bind(undefined, view),
  );
  form.append(label, input, runButton);
  return form;
}
