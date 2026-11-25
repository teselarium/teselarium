import type { ModEngine, ModOpenParams, ModTile } from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";

/**
 * What the viewer shows and opens with: the engine, the mods its config
 * names, its tile, its collection, the tiles that collection lists once it
 * is inspected, and the region for errors of opening another view.
 */
export interface ViewerView {
  engine: ModEngine;
  tileViewer: string;
  collectionViewer: string;
  tile: ModTile;
  /**
   * The address of the viewer's collection: the one it was opened with, or
   * else the `from` parameter, or `null` without either.
   */
  collection: string | null;
  /** The tiles of `collection`, empty until it is inspected or when it cannot be. */
  collectionTiles: string[];
  errors: HTMLElement;
}

function showOpenError(view: ViewerView, error: unknown): void {
  view.errors.textContent = describeError(error);
}

/**
 * Sends `mods.open`, clearing the last error first. A refusal is shown in the
 * error region. With `replace`, the viewer is closed and gets no answer.
 */
export function openView(view: ViewerView, params: ModOpenParams): void {
  view.errors.textContent = "";
  const request = view.engine.request("mods.open", params);
  request.catch(showOpenError.bind(undefined, view));
}
