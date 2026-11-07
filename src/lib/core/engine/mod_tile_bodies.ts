import { listYamlStrings } from "../../files/index.ts";
import type { ModIssue, ModPermission } from "../../mod/index.ts";
import type { Tile } from "../../tile/index.ts";
import { readPlayer } from "../players/index.ts";
import { collectTileLinks } from "../sandbox/index.ts";
import type { TileLinks } from "../sandbox/index.ts";
import { renderTileBody, scanTileBody } from "../tile_bodies/index.ts";
import type { TilePlayer } from "../tile_bodies/index.ts";

/**
 * The bodies of the tiles a mod currently receives, and what the engine
 * checks against them. The launch scans the bodies; each one renders on its
 * first request and is kept, so the value grows while the mod runs; "Reload
 * tiles" replaces it.
 */
export interface TileBodies {
  /** Each tile by source. */
  tiles: Map<string, Tile>;
  /** The HTML of each body requested so far, by tile source, as it renders. */
  renderedBodies: Map<string, Promise<string>>;
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
  const bodyScan = scanTileBody(tile);
  tileBodies.mediaByTile.set(tile.source, bodyScan.mediaUrls);
  for (const [address, tilePlayer] of bodyScan.playerAddresses) {
    tileBodies.playerAddresses.set(address, tilePlayer);
  }
  tileBodies.issues.push(...bodyScan.issues);
}

/**
 * Builds the `TileBodies` of the tiles a mod receives: the player addresses
 * of their metadata strings that `readPlayer` recognizes, and the media,
 * players and issues of each body that holds `<`, `![` or `://`, from
 * `scanTileBody`. No body is rendered: each renders when the mod asks for
 * it. The tiles are not changed.
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

/** A failed render is forgotten, so a later request renders the body again. */
function forgetFailedBody(
  tileBodies: TileBodies,
  source: string,
  error: unknown,
): never {
  tileBodies.renderedBodies.delete(source);
  throw error;
}

/** The HTML of a tile's body, rendered on first request; later requests share its promise. */
function renderBodyOnce(tileBodies: TileBodies, tile: Tile): Promise<string> {
  const keptHtml = tileBodies.renderedBodies.get(tile.source);
  if (keptHtml !== undefined) {
    return keptHtml;
  }
  const html = renderTileBody(tile).catch(
    forgetFailedBody.bind(undefined, tileBodies, tile.source),
  );
  tileBodies.renderedBodies.set(tile.source, html);
  return html;
}

/**
 * The rendered HTML of the body of the tile whose source is `source`, or
 * `null` when no tile the mod receives has it. Renders on first request and
 * keeps the promise, so two requests for one body render it once. Rejects
 * when the body cannot be rendered, such as when a library it needs cannot
 * be loaded; the failed render is not kept.
 */
export async function readTileBodyHtml(
  tileBodies: TileBodies,
  source: string,
): Promise<string | null> {
  const tile = tileBodies.tiles.get(source);
  if (tile === undefined) {
    return null;
  }
  const html = await renderBodyOnce(tileBodies, tile);
  return html;
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
