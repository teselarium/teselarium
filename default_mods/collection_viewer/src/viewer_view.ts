import type { CollectionInspection, ModEngine } from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";

/**
 * What the viewer opens tiles with: the engine, the tile viewer's mod
 * reference, and the status region for errors from opening it.
 */
export interface ViewerView {
  engine: ModEngine;
  tileViewer: string;
  status: HTMLElement;
}

function showOpenError(view: ViewerView, error: unknown): void {
  view.status.textContent = describeError(error);
}

/** Opens the tile viewer for a tile of the collection, with the collection's source as `from`. */
export function openTile(
  view: ViewerView,
  collectionSource: string,
  tileSource: string,
): void {
  view.status.textContent = "";
  const request = view.engine.request("mods.open", {
    mod: view.tileViewer,
    tile: tileSource,
    params: { from: collectionSource },
  });
  request.catch(showOpenError.bind(undefined, view));
}

/** The viewer's target: its inspection, or why it cannot be inspected. */
export type TargetReading =
  | { inspection: CollectionInspection; error: null }
  | { inspection: null; error: string };

/** Inspects the target collection. Its tiles are never requested. */
export async function inspectTarget(
  engine: ModEngine,
  target: string,
): Promise<TargetReading> {
  try {
    const inspection = await engine.request("collections.inspect", {
      collection: target,
    });
    const reading: TargetReading = { inspection, error: null };
    return reading;
  } catch (error) {
    const failedReading: TargetReading = {
      inspection: null,
      error: describeError(error),
    };
    return failedReading;
  }
}
