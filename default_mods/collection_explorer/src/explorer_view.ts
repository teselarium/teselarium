import type { CollectionInspection, ModEngine } from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";

/**
 * What the explorer draws in and opens with: the engine, the viewer's mod
 * reference, the list region and the status region for errors from opening
 * the viewer.
 */
export interface ExplorerView {
  engine: ModEngine;
  viewer: string;
  content: HTMLElement;
  status: HTMLElement;
}

function showOpenError(view: ExplorerView, error: unknown): void {
  view.status.textContent = describeError(error);
}

/** Opens the viewer for a collection, with the collection's source as the `target` parameter. */
export function openViewer(
  view: ExplorerView,
  inspection: CollectionInspection,
): void {
  view.status.textContent = "";
  const request = view.engine.request("mods.open", {
    mod: view.viewer,
    params: { target: inspection.source },
  });
  request.catch(showOpenError.bind(undefined, view));
}
