import { expect } from "@playwright/test";
import type { Frame, Locator, Page, Route } from "@playwright/test";
import {
  APP_ORIGIN_MOD_PATH,
  buildProbeFiles,
  findModFrame,
  MEDIA_HOST,
  routeImages,
  serveAppOriginMod,
  waitForProbe,
} from "./mod_routes.ts";
import type { ModFiles } from "./mod_routes.ts";

/** The host that serves the collections of `serveBodyTiles`. */
export const BODIES_HOST = "https://bodies.example.net";

export const BODIES_COLLECTION_URL = `${BODIES_HOST}/bodies.yaml`;

/** The `collection` parameter of a run link that opens the body tiles. */
export const BODIES_COLLECTION_PARAM = `&collection=${encodeURIComponent(BODIES_COLLECTION_URL)}`;

/** The YouTube page and player addresses the tiles of the tests hold. */
export const YOUTUBE_PAGE = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";
export const YOUTUBE_EMBED = "https://www.youtube.com/embed/aqz-KE-bpKQ";
export const YOUTUBE_FRAME =
  "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ";
export const YOUTUBE_FRAME_HOST = "www.youtube-nocookie.com";

/** A generic player, of no known site. */
export const MAP_EMBED = "https://maps.example.net/embed?id=7";

/** The sites the player stubs answer, so no test reaches the network. */
const PLAYER_HOSTS = [
  "https://www.youtube.com",
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
  "https://w.soundcloud.com",
  "https://maps.example.net",
];

/** A 1×1 PNG, for the images next to the body tiles. */
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/** One tile of the body collection: its file name under `books/`, extra metadata lines and body. */
export interface BodyTile {
  name: string;
  metadataLines?: string[];
  body: string;
}

/** A request a player stub saw, with its `Referer` header, or `null` without one. */
export interface PlayerRequest {
  url: string;
  referer: string | null;
}

export function buildBodyTileUrl(name: string): string {
  return `${BODIES_HOST}/books/${name}.md`;
}

function buildCollectionText(tiles: BodyTile[]): string {
  const lines = ["collection:", '  name: "Body tiles"', "  tiles:"];
  for (const tile of tiles) {
    lines.push(`    - url: "${buildBodyTileUrl(tile.name)}"`);
  }
  return lines.join("\n");
}

function buildTileText(tile: BodyTile): string {
  const metadataLines = [
    `title: "${tile.name}"`,
    ...(tile.metadataLines ?? []),
  ];
  return `---\n${metadataLines.join("\n")}\n---\n\n${tile.body}\n`;
}

function findBodyTile(tiles: BodyTile[], url: string): BodyTile | null {
  for (const tile of tiles) {
    if (buildBodyTileUrl(tile.name) === url) {
      return tile;
    }
  }
  return null;
}

async function answerBodyTiles(tiles: BodyTile[], route: Route): Promise<void> {
  const url = route.request().url();
  const headers = { "Access-Control-Allow-Origin": "*" };
  if (url.endsWith(".png")) {
    await route.fulfill({
      status: 200,
      headers,
      contentType: "image/png",
      body: PIXEL_PNG,
    });
    return;
  }
  const tile = findBodyTile(tiles, url);
  const body =
    url === BODIES_COLLECTION_URL
      ? buildCollectionText(tiles)
      : tile === null
        ? null
        : buildTileText(tile);
  if (body === null) {
    await route.fulfill({ status: 404, headers, body: "Not Found" });
    return;
  }
  await route.fulfill({
    status: 200,
    headers,
    contentType: "text/plain",
    body,
  });
}

/**
 * Serves a collection of `tiles` at `BODIES_COLLECTION_URL`, with CORS, and
 * a 1×1 PNG for any `.png` under the host. The list is read at each request,
 * so a test can change it before "Reload tiles".
 */
export async function serveBodyTiles(
  page: Page,
  tiles: BodyTile[],
): Promise<BodyTile[]> {
  await page.route(`${BODIES_HOST}/**`, answerBodyTiles.bind(undefined, tiles));
  return tiles;
}

/** The run link of the app-origin probe named `name`, opened with the body tiles. */
export function buildBodyProbeLink(name: string = "probe"): string {
  return `/#/run?mod=.${APP_ORIGIN_MOD_PATH}${name}/${BODIES_COLLECTION_PARAM}`;
}

/** The probe opened with body tiles, and the media requests it sent so far. */
export interface BodyProbe {
  frame: Frame;
  mediaUrls: string[];
}

/**
 * Serves the body tiles, a 1×1 PNG for anything on the media host and the
 * app-origin probe (with `extraLines` in its mod file) next to `otherFiles`,
 * opens the probe with the tiles and waits until it mounted.
 */
export async function openBodyProbe(
  page: Page,
  tiles: BodyTile[],
  extraLines: string[] = [],
  otherFiles: ModFiles = {},
): Promise<BodyProbe> {
  await serveBodyTiles(page, tiles);
  const mediaUrls = await routeImages(page, `${MEDIA_HOST}/**`);
  await serveAppOriginMod(page, {
    ...buildProbeFiles("probe", extraLines),
    ...otherFiles,
  });
  await page.goto(buildBodyProbeLink());
  const frame = await findModFrame(page, "probe");
  await waitForProbe(frame);
  const bodyProbe: BodyProbe = { frame, mediaUrls };
  return bodyProbe;
}

/**
 * Runs in the probe's frame: appends one `ot-tile-body` per index, set to the
 * mount context's tile at that index, and resolves once every one fired
 * `ot-rendered`. Each element gets `data-index`.
 */
export function showTileBodies(indexes: number[]): Promise<void> {
  const probeGlobal = globalThis as unknown as {
    probe: { context: { tiles: unknown[] } };
  };
  const rendered: Promise<void>[] = [];
  for (const index of indexes) {
    const body = document.createElement("ot-tile-body") as HTMLElement & {
      tile: unknown;
    };
    body.dataset.index = String(index);
    rendered.push(
      new Promise(function waitForRendered(resolve): void {
        body.addEventListener("ot-rendered", function markRendered(): void {
          resolve();
        });
      }),
    );
    document.body.append(body);
    body.tile = probeGlobal.probe.context.tiles[index];
  }
  return Promise.all(rendered).then(function finishShowing(): void {});
}

async function answerPlayer(
  seen: PlayerRequest[],
  route: Route,
): Promise<void> {
  const request = route.request();
  const headers = await request.allHeaders();
  seen.push({ url: request.url(), referer: headers.referer ?? null });
  await route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><title>Player</title><p>Playing</p>",
  });
}

/** Answers every player site with a stub page. Returns the requests they saw, in order. */
export async function routePlayerSites(page: Page): Promise<PlayerRequest[]> {
  const seen: PlayerRequest[] = [];
  for (const host of PLAYER_HOSTS) {
    await page.route(`${host}/**`, answerPlayer.bind(undefined, seen));
  }
  return seen;
}

/** The app's player dialog, while it is open. */
export function playerDialog(page: Page): Locator {
  return page.getByRole("dialog");
}

/** The player frame of the app's player dialog. */
export function playerFrame(page: Page): Locator {
  return playerDialog(page).locator("iframe");
}

/** Presses Play in the player dialog and waits for the player frame. */
export async function pressPlay(page: Page): Promise<void> {
  await playerDialog(page).getByRole("button", { name: "Play" }).click();
  await expect(playerFrame(page)).toBeVisible();
}
