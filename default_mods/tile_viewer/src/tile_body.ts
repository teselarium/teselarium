import type { ModTile } from "../../mod_api.d.ts";

/** The `<ot-tile-body>` element every mod frame defines. */
interface TileBodyElement extends HTMLElement {
  tile: ModTile | null;
}

/**
 * The tile's body, drawn by `<ot-tile-body>`, or `null` for an empty body:
 * then nothing is rendered, and no `tiles.renderBody` is sent.
 */
export function buildTileBody(tile: ModTile): HTMLElement | null {
  if (tile.body.trim() === "") {
    return null;
  }
  const body = document.createElement("ot-tile-body") as TileBodyElement;
  body.tile = tile;
  return body;
}
