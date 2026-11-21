import type { ModEngine, MosaicInspection } from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";

/**
 * What the explorer draws in and opens with: the engine, the viewer's mod
 * reference, the list region, the status region for errors from opening a
 * mosaic or the viewer, and the count of listings started, so only the
 * latest one is drawn. Mutable.
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

/** Opens the mosaic itself: its mod with its collection, config, aliases and permissions. */
export function openMosaic(
  view: ExplorerView,
  inspection: MosaicInspection,
): void {
  view.status.textContent = "";
  const request = view.engine.request("mosaics.open", {
    mosaic: inspection.source,
  });
  request.catch(showOpenError.bind(undefined, view));
}

/** "Import…": the app's import dialog. A refusal is shown in the status region. */
export function importMosaics(view: ExplorerView): void {
  view.status.textContent = "";
  const request = view.engine.request("userCatalog.import", {});
  request.catch(showOpenError.bind(undefined, view));
}

/** "Add by URL…": the app's "Add a mosaic" dialog. A refusal is shown in the status region. */
export function addMosaicByUrl(view: ExplorerView): void {
  view.status.textContent = "";
  const request = view.engine.request("userCatalog.add", {});
  request.catch(showOpenError.bind(undefined, view));
}

/** Opens the viewer for a mosaic, with the mosaic's source as the `target` parameter. */
export function openViewer(
  view: ExplorerView,
  inspection: MosaicInspection,
): void {
  view.status.textContent = "";
  const request = view.engine.request("mods.open", {
    mod: view.viewer,
    params: { target: inspection.source },
  });
  request.catch(showOpenError.bind(undefined, view));
}
