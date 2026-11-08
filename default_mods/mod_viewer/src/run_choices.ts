import type { ModOpenParams } from "../../mod_api.d.ts";
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

function runWithSampleTiles(view: ViewerView, event: MouseEvent): void {
  // The sandbox has no `allow-forms`: the form is never submitted, the click runs the mod.
  event.preventDefault();
  openMod(view, view.inspection.sampleCollection);
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

/** "Run with sample tiles": the page's one primary action, a submit button. */
function buildSampleRunButton(view: ViewerView): HTMLButtonElement {
  const runButton = document.createElement("button");
  runButton.type = "submit";
  runButton.textContent = "Run with sample tiles";
  runButton.addEventListener("click", runWithSampleTiles.bind(undefined, view));
  return runButton;
}

/**
 * The run choices, and "Check mod" next to them: running with the sample
 * tiles is the page's one primary action, a submit button.
 */
export function buildRunChoices(view: ViewerView): HTMLElement {
  const form = document.createElement("form");
  form.setAttribute("aria-label", "Run");
  if (view.inspection.sampleCollection !== null) {
    form.append(buildSampleRunButton(view));
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
