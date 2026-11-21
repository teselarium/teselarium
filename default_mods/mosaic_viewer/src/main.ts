/**
 * Default mod: shows the mosaic named by the `target` parameter, with its
 * mod and its collection, opens it, and checks it. It reads the mosaic with
 * `mosaics.inspect`, then its mod with `mods.inspect` and its collection
 * with `collections.inspect`, in parallel, so no tile is requested.
 *
 * Like the mod viewer, it gets the app's look without classes: the theme's
 * base stylesheet styles semantic HTML like the app's components (a submit
 * button is the primary button, an `<article>` a card, `role="alert"` an
 * alert), `data-ot-variant` picks the variants that have no semantic HTML
 * (badges, ghost buttons), and this mod's own CSS sets layout only. See
 * "Write HTML, get the app's look" in docs/modules/lib/core/theme/README.md.
 */

import type {
  ModContext,
  ModEngine,
  MosaicInspection,
} from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";
import { buildErrorAlert, buildStatusMessage } from "./page_elements.ts";
import { showProvenance } from "./provenance_section.ts";
import {
  addViewerStyle,
  renderInspection,
  renderMessage,
} from "./viewer_page.ts";
import type { ViewerView } from "./viewer_view.ts";

/** The viewers the titles open when the config names none. */
const DEFAULT_MOD_VIEWER = "mod_viewer";
const DEFAULT_COLLECTION_VIEWER = "collection_viewer";

/** After an update from a file: the mosaic inspected anew and shown again, or the error. */
async function showUpdatedMosaic(view: ViewerView): Promise<void> {
  try {
    view.inspection = await view.engine.request("mosaics.inspect", {
      mosaic: view.inspection.source,
    });
  } catch (error) {
    view.messages.replaceChildren(buildErrorAlert(describeError(error)));
    return;
  }
  await renderInspection(view);
}

function buildViewerView(
  engine: ModEngine,
  context: ModContext,
  inspection: MosaicInspection,
): ViewerView {
  const view: ViewerView = {
    engine,
    apiVersion: context.api.version,
    modViewer: String(context.config.mod_viewer ?? DEFAULT_MOD_VIEWER),
    collectionViewer: String(
      context.config.collection_viewer ?? DEFAULT_COLLECTION_VIEWER,
    ),
    inspection,
    messages: document.createElement("div"),
    provenance: document.createElement("div"),
    onUpdated: noUpdate,
  };
  view.onUpdated = showUpdatedMosaic.bind(undefined, view);
  return view;
}

async function noUpdate(): Promise<void> {
  // Replaced once the view is built.
}

/** Entry point called by the frame loader with the engine API object and the mount context. */
export default async function mount(
  engine: ModEngine,
  context: ModContext,
): Promise<void> {
  addViewerStyle();
  const target = context.params.target;
  if (typeof target !== "string" || target === "") {
    renderMessage(
      context.mod.title,
      buildStatusMessage("No mosaic was given."),
    );
    return;
  }
  let inspection: MosaicInspection;
  try {
    inspection = await engine.request("mosaics.inspect", { mosaic: target });
  } catch (error) {
    renderMessage(context.mod.title, buildErrorAlert(describeError(error)));
    return;
  }
  const view = buildViewerView(engine, context, inspection);
  // The catalog's changes reach "Where it comes from" without a reload.
  engine.on("catalog.changed", showProvenance.bind(undefined, view));
  await renderInspection(view);
}
