import { describe, expect, it } from "vitest";
import {
  buildAskingContext,
  catchMethodError,
} from "../../../test/method_contexts.ts";
import type { Tile } from "../../tile/index.ts";
import type { PlayerAction } from "./app_actions.ts";
import { INVALID_PARAMS, PERMISSION_DENIED } from "./mod_messages.ts";
import type { ModMethodContext } from "./mod_methods.ts";
import { buildTileBodies } from "./mod_tile_bodies.ts";
import { PLAYERS_METHODS } from "./players_methods.ts";

const YOUTUBE_PAGE = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";

const MAP_EMBED = "https://maps.example.net/embed?id=7";

const PLAYER_TILES: Tile[] = [
  {
    source: "https://tiles.example.net/films/bunny.md",
    metadata: { title: "Big Buck Bunny", video: YOUTUBE_PAGE },
    body: `<iframe src="${MAP_EMBED}" width="400" height="300" allow="camera"></iframe>`,
    types: [],
  },
];

/** A context whose tiles hold a YouTube page link and a map iframe, where the user answers `answer`. */
function buildPlayerContext(
  answer: boolean | null,
): ReturnType<typeof buildAskingContext> {
  const askingContext = buildAskingContext(answer);
  askingContext.context.tileBodies = buildTileBodies(PLAYER_TILES);
  return askingContext;
}

function openPlayer(
  context: ModMethodContext,
  params: object,
): Promise<unknown> {
  return PLAYERS_METHODS["players.open"](context, params as never);
}

describe("players.open", function describePlayersOpen(): void {
  it("asks with the player of a YouTube page link, titled by its tile", async function asksForYouTube(): Promise<void> {
    const { context, requestSpy } = buildPlayerContext(true);

    const answer = await openPlayer(context, { url: YOUTUBE_PAGE });

    const expectedAction: PlayerAction = {
      kind: "player",
      title: "Big Buck Bunny",
      frameUrl: "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
      host: "www.youtube-nocookie.com",
      siteName: "YouTube",
      shape: { ratio: 16 / 9 },
    };
    expect(requestSpy).toHaveBeenCalledWith(expectedAction);
    expect(answer).toBe(true);
  });

  it("asks with the player of a generic iframe without a title, sized by its width and height", async function asksForIframe(): Promise<void> {
    const { context, requestSpy } = buildPlayerContext(false);

    const answer = await openPlayer(context, { url: MAP_EMBED });

    const expectedAction: PlayerAction = {
      kind: "player",
      title: null,
      frameUrl: MAP_EMBED,
      host: "maps.example.net",
      siteName: null,
      shape: { ratio: 4 / 3 },
    };
    expect(requestSpy).toHaveBeenCalledWith(expectedAction);
    expect(answer).toBe(false);
  });

  it("Address not from the tiles", async function rejectsOtherAddress(): Promise<void> {
    const { context, requestSpy } = buildPlayerContext(true);

    const error = await catchMethodError(
      openPlayer.bind(undefined, context, {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      }),
    );

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toBe(
      "players.open: https://www.youtube.com/watch?v=dQw4w9WgXcQ is not a player of the mod's tiles",
    );
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it("Hidden mod asks for a player", async function rejectsHiddenMod(): Promise<void> {
    const { context } = buildPlayerContext(null);

    const error = await catchMethodError(
      openPlayer.bind(undefined, context, { url: YOUTUBE_PAGE }),
    );

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toBe(
      "players.open: only the visible mod can ask the user",
    );
  });

  it("rejects a url that is not an absolute https: address", async function rejectsInvalidUrl(): Promise<void> {
    const { context, requestSpy } = buildPlayerContext(true);

    for (const url of [
      undefined,
      7,
      "/watch?v=aqz-KE-bpKQ",
      "http://www.youtube.com/watch?v=aqz-KE-bpKQ",
    ]) {
      const error = await catchMethodError(
        openPlayer.bind(undefined, context, { url }),
      );

      expect(error.code).toBe(INVALID_PARAMS);
      expect(error.message).toBe(
        'players.open: "url" must be an absolute https: address',
      );
    }
    expect(requestSpy).not.toHaveBeenCalled();
  });
});
