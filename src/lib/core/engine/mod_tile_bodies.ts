import { listYamlStrings } from "../../files/index.ts";
import type { ModIssue, ModPermission } from "../../mod/index.ts";
import type { Tile } from "../../tile/index.ts";
import { readPlayer } from "../players/index.ts";
import { collectTileLinks } from "../sandbox/index.ts";
import type { TileLinks } from "../sandbox/index.ts";
import { renderTileBody } from "../tile_bodies/index.ts";
import type { RenderedBody, TilePlayer } from "../tile_bodies/index.ts";

/**
 * The bodies of the tiles a mod currently receives, and what the engine
 * checks against them. Bodies render on first request and are kept, so the
 * value grows while the mod runs; "Reload tiles" replaces it.
 */
export interface TileBodies {
  /** Each tile by source. */
  tiles: Map<string, Tile>;
  /** The bodies rendered so far, by tile source. */
  renderedBodies: Map<string, RenderedBody>;
  /** Each player address of the tiles, normalized, with its player and the title the tile gives it. */
  playerAddresses: Map<string, TilePlayer>;
  /** The media addresses of each collected body, by tile source. */
  mediaByTile: Map<string, string[]>;
  /** The warnings of iframes the collected bodies left out. */
  issues: ModIssue[];
}

/** What a body must hold for it to have media or players: HTML, an image, or an address. */
const COLLECTED_BODY_MARKERS = ["<", "![", "://"];

function needsBodyCollection(body: string): boolean {
  for (const marker of COLLECTED_BODY_MARKERS) {
    if (body.includes(marker)) {
      return true;
    }
  }
  return false;
}

/** A metadata string as a normalized address, the way `players.open` compares it. */
function normalizeAddress(value: string): string | null {
  if (!URL.canParse(value)) {
    return null;
  }
  const href = new URL(value).href;
  return href;
}

/** The tile's `title` metadata, which names the players of its metadata, or `null`. */
function readTileTitle(tile: Tile): string | null {
  const title = tile.metadata.title;
  if (typeof title !== "string" || title.trim() === "") {
    return null;
  }
  return title;
}

function collectMetadataPlayers(tile: Tile, tileBodies: TileBodies): void {
  for (const value of listYamlStrings(tile.metadata)) {
    const player = readPlayer(value);
    const address = normalizeAddress(value);
    if (player !== null && address !== null) {
      const tilePlayer: TilePlayer = { player, title: readTileTitle(tile) };
      tileBodies.playerAddresses.set(address, tilePlayer);
    }
  }
}

function collectBody(tile: Tile, tileBodies: TileBodies): void {
  const renderedBody = renderTileBody(tile);
  tileBodies.renderedBodies.set(tile.source, renderedBody);
  tileBodies.mediaByTile.set(tile.source, renderedBody.mediaUrls);
  for (const [address, tilePlayer] of renderedBody.playerAddresses) {
    tileBodies.playerAddresses.set(address, tilePlayer);
  }
  tileBodies.issues.push(...renderedBody.issues);
}

/**
 * Builds the `TileBodies` of the tiles a mod receives: the player addresses
 * of their metadata strings that `readPlayer` recognizes, and the rendered
 * body, media and players of each body that holds `<`, `![` or `://`. Other
 * bodies render only when the mod asks for them. The tiles are not changed.
 */
export function buildTileBodies(tiles: Tile[]): TileBodies {
  const tileBodies: TileBodies = {
    tiles: new Map(),
    renderedBodies: new Map(),
    playerAddresses: new Map(),
    mediaByTile: new Map(),
    issues: [],
  };
  for (const tile of tiles) {
    tileBodies.tiles.set(tile.source, tile);
    collectMetadataPlayers(tile, tileBodies);
    if (needsBodyCollection(tile.body)) {
      collectBody(tile, tileBodies);
    }
  }
  return tileBodies;
}

/**
 * The rendered HTML of the body of the tile whose source is `source`, or
 * `null` when no tile the mod receives has it. Renders on first request and
 * keeps the result.
 */
export function readTileBodyHtml(
  tileBodies: TileBodies,
  source: string,
): string | null {
  const renderedBody = tileBodies.renderedBodies.get(source);
  if (renderedBody !== undefined) {
    return renderedBody.html;
  }
  const tile = tileBodies.tiles.get(source);
  if (tile === undefined) {
    return null;
  }
  const newBody = renderTileBody(tile);
  tileBodies.renderedBodies.set(source, newBody);
  return newBody.html;
}

/** The player and title of a player address of the tiles, or `null` for any other address. */
export function findTilePlayer(
  tileBodies: TileBodies,
  url: string,
): TilePlayer | null {
  const address = normalizeAddress(url);
  if (address === null) {
    return null;
  }
  const tilePlayer = tileBodies.playerAddresses.get(address) ?? null;
  return tilePlayer;
}

/**
 * The tile links of a mod's tiles (`collectTileLinks`) with their body media,
 * followed by the warnings of the iframes their bodies left out, which the
 * stage reports and replaces with the other left-out links.
 */
export function collectModTileLinks(
  tiles: Tile[],
  tileBodies: TileBodies,
  contentHosts: string[],
  granted: ModPermission[],
): TileLinks {
  const tileLinks = collectTileLinks(
    tiles,
    contentHosts,
    granted,
    tileBodies.mediaByTile,
  );
  const modTileLinks: TileLinks = {
    sources: tileLinks.sources,
    issues: [...tileLinks.issues, ...tileBodies.issues],
  };
  return modTileLinks;
}
