import type { YamlMapping } from "../../files/index.ts";
import type { PlayerAction } from "./app_actions.ts";
import { ModMethodError } from "./engine_errors.ts";
import { PERMISSION_DENIED } from "./mod_messages.ts";
import { askUser, throwInvalidParams } from "./mod_methods.ts";
import type { ModMethodContext, ModMethodTable } from "./mod_methods.ts";
import { findTilePlayer } from "./mod_tile_bodies.ts";

/** Reads the `url` of `players.open`: an absolute `https:` address. Raises `INVALID_PARAMS`. */
function readPlayerUrl(params: YamlMapping): string {
  const url = params.url;
  if (
    typeof url !== "string" ||
    !URL.canParse(url) ||
    new URL(url).protocol !== "https:"
  ) {
    throwInvalidParams(
      "players.open",
      '"url" must be an absolute https: address',
    );
  }
  return url;
}

/**
 * `players.open { url }`: when `url` is a player address of the mod's
 * current tiles, asks the user and shows the player in the app's dialog.
 * Answers `true` when the player was shown, `false` when the user closed the
 * dialog before. Raises `INVALID_PARAMS` for a url that is not an absolute
 * `https:` address, and `PERMISSION_DENIED` for one the tiles do not hold.
 */
async function openPlayer(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<boolean> {
  const url = readPlayerUrl(params);
  const tilePlayer = findTilePlayer(context.tileBodies, url);
  if (tilePlayer === null) {
    throw new ModMethodError(
      PERMISSION_DENIED,
      `players.open: ${url} is not a player of the mod's tiles`,
    );
  }
  const action: PlayerAction = {
    kind: "player",
    ...tilePlayer.player,
    title: tilePlayer.title,
  };
  return askUser(context, "players.open", action);
}

/** The `players.*` requests: players the app shows for the mod's tiles. */
export const PLAYERS_METHODS: ModMethodTable = {
  "players.open": openPlayer,
};
