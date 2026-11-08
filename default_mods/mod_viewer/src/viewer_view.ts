import type { ModEngine, ModInspection } from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";
import { buildErrorAlert } from "./page_elements.ts";

/**
 * What the viewer shows and runs: the engine, the app's mod API version, the
 * viewed mod's inspection, the collection field once it is drawn, and the
 * region for errors, notices and the check report.
 */
export interface ViewerView {
  engine: ModEngine;
  apiVersion: string;
  inspection: ModInspection;
  collectionInput: HTMLInputElement | null;
  messages: HTMLElement;
}

export function showError(view: ViewerView, error: unknown): void {
  view.messages.replaceChildren(buildErrorAlert(describeError(error)));
}

/**
 * The collection field's value without surrounding spaces, or `null` when it
 * is empty. It is sent as typed: the engine resolves a relative path against
 * the app's address, as in a run link's `collection`.
 */
export function readTypedCollection(view: ViewerView): string | null {
  const collection = view.collectionInput?.value.trim() ?? "";
  if (collection === "") {
    return null;
  }
  return collection;
}
