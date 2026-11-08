/**
 * Default mod: lists the mods of its config and opens the viewer for the one
 * the user picks.
 *
 * It is also an example of getting the app's look without classes: the
 * theme's base stylesheet styles semantic HTML like the app's components (an
 * `<article>` is a card, `role="alert"` an alert, `aria-busy` a loading
 * state), and this mod's own CSS sets layout only. See "Write HTML, get the
 * app's look" in docs/modules/lib/core/theme/README.md.
 */

import type { ModContext, ModEngine } from "../../mod_api.d.ts";
import { buildExplorerPage, renderModList } from "./explorer_page.ts";
import type { ExplorerView } from "./explorer_view.ts";
import { inspectMods, readModReferences } from "./mod_entries.ts";

/** The viewer opened for a selected mod when the config names none. */
const DEFAULT_VIEWER = "mod_viewer";

/** Entry point called by the frame loader with the engine API object and the mount context. */
export default async function mount(
  engine: ModEngine,
  context: ModContext,
): Promise<void> {
  const view: ExplorerView = {
    engine,
    viewer: String(context.config.viewer ?? DEFAULT_VIEWER),
    content: document.createElement("section"),
    status: document.createElement("p"),
  };
  view.content.setAttribute("aria-label", "Mods");
  view.status.setAttribute("role", "status");
  buildExplorerPage(view, context.mod.title);
  const entries = await inspectMods(engine, readModReferences(context.config));
  renderModList(view, entries);
}
