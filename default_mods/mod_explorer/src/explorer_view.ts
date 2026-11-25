import type { ModEngine, ModInspection } from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";

/**
 * What the explorer draws in and opens with: the engine, the viewer's mod
 * reference, the list region, the status region for errors from opening
 * the viewer, and the count of listings started, so only the latest one is
 * drawn. Mutable.
 */
export interface ExplorerView {
  engine: ModEngine;
  viewer: string;
  content: HTMLElement;
  status: HTMLElement;
  listingCount: number;
}

function showOpenError(view: ExplorerView, error: unknown): void {
  view.status.textContent = describeError(error);
}

/** Opens the viewer for a mod, with the mod's source as the `target` parameter. */
export function openViewer(
  view: ExplorerView,
  inspection: ModInspection,
): void {
  view.status.textContent = "";
  const request = view.engine.request("mods.open", {
    mod: view.viewer,
    params: { target: inspection.source },
  });
  request.catch(showOpenError.bind(undefined, view));
}
