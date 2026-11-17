import type { ModEngine, MosaicInspection } from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";
import { buildErrorAlert } from "./page_elements.ts";

/**
 * What the viewer shows and opens: the engine, the app's mod API version,
 * the viewers of its config, the viewed mosaic's inspection, and the region
 * for errors, notices and the check report.
 */
export interface ViewerView {
  engine: ModEngine;
  apiVersion: string;
  modViewer: string;
  collectionViewer: string;
  inspection: MosaicInspection;
  messages: HTMLElement;
}

export function showError(view: ViewerView, error: unknown): void {
  view.messages.replaceChildren(buildErrorAlert(describeError(error)));
}

/** Opens `viewer` with `target` as its target parameter. A refusal is shown in the messages. */
export function openViewer(
  view: ViewerView,
  viewer: string,
  target: string,
): void {
  view.messages.replaceChildren();
  const request = view.engine.request("mods.open", {
    mod: viewer,
    params: { target },
  });
  request.catch(showError.bind(undefined, view));
}
