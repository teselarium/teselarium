/**
 * Default mod: shows the first tile it receives, with its heading, its
 * source, its metadata and its body. With a `from` parameter, the address of
 * a collection that lists the tile, it also shows the tile's place in it,
 * with Previous and Next, which replace the viewer with the neighbouring
 * tile. Links to tiles, in the metadata or the body, open in a new viewer.
 *
 * It is also an example of getting the app's look without classes: the
 * theme's base stylesheet styles semantic HTML like the app's components (an
 * `<article>` is a card, a `<dl>` a list of details), `data-ot-variant`
 * picks the button variants, and this mod's own CSS sets layout only. See
 * "Write HTML, get the app's look" in docs/modules/lib/core/theme/README.md.
 */

import type { ModContext, ModEngine, ModYamlMapping } from "../../mod_api.d.ts";
import { readCollectionPlace } from "./collection_place.ts";
import { buildErrorRegion, buildStatusMessage } from "./page_elements.ts";
import { watchTileLinks } from "./tile_links.ts";
import { addViewerStyle, renderMessage, renderTile } from "./viewer_page.ts";
import type { ViewerView } from "./viewer_view.ts";

/** The mod a linked or a neighbouring tile opens in when the config names none. */
const DEFAULT_TILE_VIEWER = "tile_viewer";

/** The mod the collection's title opens when the config names none. */
const DEFAULT_COLLECTION_VIEWER = "collection_viewer";

function readConfigText(
  config: ModYamlMapping,
  key: string,
  fallback: string,
): string {
  const value = config[key];
  return typeof value === "string" && value !== "" ? value : fallback;
}

/** The `from` parameter, or `null` when it is missing or empty. */
function readFrom(params: Record<string, string>): string | null {
  const from = params.from;
  return typeof from === "string" && from !== "" ? from : null;
}

/** Entry point called by the frame loader with the engine API object and the mount context. */
export default async function mount(
  engine: ModEngine,
  context: ModContext,
): Promise<void> {
  addViewerStyle();
  const tile = context.tiles[0];
  if (tile === undefined) {
    renderMessage(context.mod.title, buildStatusMessage("No tile was given."));
    return;
  }
  const view: ViewerView = {
    engine,
    tileViewer: readConfigText(
      context.config,
      "tile_viewer",
      DEFAULT_TILE_VIEWER,
    ),
    collectionViewer: readConfigText(
      context.config,
      "collection_viewer",
      DEFAULT_COLLECTION_VIEWER,
    ),
    tile,
    from: readFrom(context.params),
    fromTiles: [],
    errors: buildErrorRegion(),
  };
  const card = renderTile(view);
  watchTileLinks(view);
  const place = await readCollectionPlace(view);
  if (place !== null) {
    card.before(place);
  }
}
