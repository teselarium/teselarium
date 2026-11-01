import type { YamlMapping } from "../../files/index.ts";
import { throwInvalidParams } from "./mod_methods.ts";
import type { ModMethodContext, ModMethodTable } from "./mod_methods.ts";
import { readTileBodyHtml } from "./mod_tile_bodies.ts";

/** What `tiles.renderBody` answers. */
interface RenderedBodyResult {
  html: string;
}

function readTileSource(params: YamlMapping): string {
  const source = params.source;
  if (typeof source !== "string") {
    throwInvalidParams("tiles.renderBody", '"source" must be a string');
  }
  return source;
}

/**
 * `tiles.renderBody { source }`: answers `{ html }`, the rendered body of
 * the tile the mod currently receives whose `source` is `source`. Raises
 * `INVALID_PARAMS` for a source that is not a string or names no such tile.
 */
async function renderTileBodyForMod(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<RenderedBodyResult> {
  const source = readTileSource(params);
  const html = readTileBodyHtml(context.tileBodies, source);
  if (html === null) {
    throwInvalidParams(
      "tiles.renderBody",
      `the source ${source} is not one of the mod's tiles`,
    );
  }
  const result: RenderedBodyResult = { html };
  return result;
}

/** The `tiles.*` requests: what the engine does with the mod's tiles. */
export const TILES_METHODS: ModMethodTable = {
  "tiles.renderBody": renderTileBodyForMod,
};
