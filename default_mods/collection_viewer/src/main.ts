/**
 * Default mod: shows the tile collection named by the `target` parameter,
 * from `collections.inspect`: its name, description, source, entry issues
 * and tiles, which it never requests.
 *
 * It is also an example of getting the app's look without classes: the
 * theme's base stylesheet styles semantic HTML like the app's components (an
 * `<article>` is a card, `role="alert"` an alert, `aria-busy` a loading
 * state), `data-ot-variant` makes the issue levels badges, and this mod's own
 * CSS sets layout only. See "Write HTML, get the app's look" in
 * docs/modules/lib/core/theme/README.md.
 */

import type { ModContext, ModEngine } from "../../mod_api.d.ts";
import { buildErrorAlert, buildStatusMessage } from "./page_elements.ts";
import {
  addViewerStyle,
  renderCollection,
  renderLoading,
  renderMessage,
} from "./viewer_page.ts";
import { inspectTarget } from "./viewer_view.ts";

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
      buildStatusMessage("No collection was given."),
    );
    return;
  }
  renderLoading(context.mod.title);
  const reading = await inspectTarget(engine, target);
  if (reading.inspection === null) {
    renderMessage(context.mod.title, buildErrorAlert(reading.error));
    return;
  }
  renderCollection(reading.inspection);
}
