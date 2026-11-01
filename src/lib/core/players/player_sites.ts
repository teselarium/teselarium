/** How a player frame is sized: by width-to-height ratio, or at a fixed height. */
export type PlayerShape = { ratio: number } | { height: number };

/** What the app needs to show a player: where it plays from and how it looks. */
export interface Player {
  /** The address the player frame loads. */
  frameUrl: string;
  /** The host of `frameUrl`, which the reader is asked about. */
  host: string;
  /** The name of a known site, or `null` for any other player. */
  siteName: string | null;
  shape: PlayerShape;
}

const WIDE_RATIO = 16 / 9;

const WIDE_SHAPE: PlayerShape = { ratio: WIDE_RATIO };

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const YOUTUBE_SHORT_HOST = "youtu.be";

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_EMBED_PATTERN = /^\/embed\/([^/]+)$/;

const YOUTUBE_SHORT_PATTERN = /^\/([^/]+)$/;

const YOUTUBE_FRAME_ORIGIN = "https://www.youtube-nocookie.com";

const VIMEO_PAGE_HOSTS = new Set(["vimeo.com", "www.vimeo.com"]);

const VIMEO_PLAYER_HOST = "player.vimeo.com";

const VIMEO_PAGE_PATTERN = /^\/(\d+)$/;

const VIMEO_PLAYER_PATTERN = /^\/video\/(\d+)$/;

const SOUNDCLOUD_PAGE_HOSTS = new Set(["soundcloud.com", "www.soundcloud.com"]);

const SOUNDCLOUD_WIDGET_HOST = "w.soundcloud.com";

const SOUNDCLOUD_WIDGET_PATH = /^\/player\/?$/;

const SOUNDCLOUD_TRACK_PATTERN = /^\/([^/]+)\/([^/]+)$/;

const SOUNDCLOUD_SET_PATTERN = /^\/([^/]+)\/sets\/([^/]+)$/;

const SOUNDCLOUD_TRACK_HEIGHT = 166;

const SOUNDCLOUD_SET_HEIGHT = 450;

/** The address as a URL when it is an absolute `https:` address, otherwise `null`. */
function readHttpsUrl(address: string): URL | null {
  if (!URL.canParse(address)) {
    return null;
  }
  const url = new URL(address);
  if (url.protocol !== "https:") {
    return null;
  }
  return url;
}

function readPathMatch(pattern: RegExp, pathname: string): string | null {
  const match = pattern.exec(pathname);
  if (match === null) {
    return null;
  }
  const capture = match[1];
  return capture;
}

function readYouTubeId(url: URL): string | null {
  if (url.hostname === YOUTUBE_SHORT_HOST) {
    const shortId = readPathMatch(YOUTUBE_SHORT_PATTERN, url.pathname);
    return shortId;
  }
  if (!YOUTUBE_HOSTS.has(url.hostname)) {
    return null;
  }
  if (url.pathname === "/watch") {
    const watchId = url.searchParams.get("v");
    return watchId;
  }
  const embedId = readPathMatch(YOUTUBE_EMBED_PATTERN, url.pathname);
  return embedId;
}

function readYouTubePlayer(url: URL): Player | null {
  const id = readYouTubeId(url);
  if (id === null || !YOUTUBE_ID_PATTERN.test(id)) {
    return null;
  }
  const player: Player = {
    frameUrl: `${YOUTUBE_FRAME_ORIGIN}/embed/${id}`,
    host: new URL(YOUTUBE_FRAME_ORIGIN).hostname,
    siteName: "YouTube",
    shape: WIDE_SHAPE,
  };
  return player;
}

function readVimeoId(url: URL): string | null {
  if (VIMEO_PAGE_HOSTS.has(url.hostname)) {
    const pageId = readPathMatch(VIMEO_PAGE_PATTERN, url.pathname);
    return pageId;
  }
  if (url.hostname === VIMEO_PLAYER_HOST) {
    const playerId = readPathMatch(VIMEO_PLAYER_PATTERN, url.pathname);
    return playerId;
  }
  return null;
}

function readVimeoPlayer(url: URL): Player | null {
  const id = readVimeoId(url);
  if (id === null) {
    return null;
  }
  const player: Player = {
    frameUrl: `https://${VIMEO_PLAYER_HOST}/video/${id}`,
    host: VIMEO_PLAYER_HOST,
    siteName: "Vimeo",
    shape: WIDE_SHAPE,
  };
  return player;
}

/** The track or playlist page a SoundCloud address names, without its query. */
function readSoundCloudPage(url: URL): URL | null {
  if (SOUNDCLOUD_PAGE_HOSTS.has(url.hostname)) {
    return url;
  }
  if (
    url.hostname !== SOUNDCLOUD_WIDGET_HOST ||
    !SOUNDCLOUD_WIDGET_PATH.test(url.pathname)
  ) {
    return null;
  }
  const pageAddress = url.searchParams.get("url") ?? "";
  const pageUrl = readHttpsUrl(pageAddress);
  if (pageUrl === null || !SOUNDCLOUD_PAGE_HOSTS.has(pageUrl.hostname)) {
    return null;
  }
  return pageUrl;
}

/** The widget's height for a page: a playlist's, a track's, or `null` for any other page. */
function readSoundCloudHeight(pathname: string): number | null {
  if (SOUNDCLOUD_SET_PATTERN.test(pathname)) {
    return SOUNDCLOUD_SET_HEIGHT;
  }
  if (SOUNDCLOUD_TRACK_PATTERN.test(pathname)) {
    return SOUNDCLOUD_TRACK_HEIGHT;
  }
  return null;
}

function readSoundCloudPlayer(url: URL): Player | null {
  const pageUrl = readSoundCloudPage(url);
  if (pageUrl === null) {
    return null;
  }
  const height = readSoundCloudHeight(pageUrl.pathname);
  if (height === null) {
    return null;
  }
  const page = `https://soundcloud.com${pageUrl.pathname}`;
  const player: Player = {
    frameUrl: `https://${SOUNDCLOUD_WIDGET_HOST}/player/?url=${encodeURIComponent(page)}`,
    host: SOUNDCLOUD_WIDGET_HOST,
    siteName: "SoundCloud",
    shape: { height },
  };
  return player;
}

/**
 * The player of a page link or player address of a known site (YouTube,
 * Vimeo, SoundCloud), or `null` for any other address. Only `https:`
 * addresses count. The query of the address is dropped, so a link cannot turn
 * on autoplay; YouTube plays in its privacy-enhanced mode.
 */
export function readPlayer(address: string): Player | null {
  const url = readHttpsUrl(address);
  if (url === null) {
    return null;
  }
  const player =
    readYouTubePlayer(url) ?? readVimeoPlayer(url) ?? readSoundCloudPlayer(url);
  return player;
}

function readDimension(value: string | null): number | null {
  const dimension = Number(value ?? "");
  if (!Number.isFinite(dimension) || dimension <= 0) {
    return null;
  }
  return dimension;
}

function readIframeShape(
  width: string | null,
  height: string | null,
): PlayerShape {
  const widthNumber = readDimension(width);
  const heightNumber = readDimension(height);
  if (widthNumber === null || heightNumber === null) {
    return WIDE_SHAPE;
  }
  const shape: PlayerShape = { ratio: widthNumber / heightNumber };
  return shape;
}

/**
 * The player of a body's iframe whose `src` is the absolute `https:` address
 * `src`: a known site's through the table, otherwise the iframe's own address,
 * shaped by the ratio of its `width` and `height` (16:9 without them).
 */
export function readIframePlayer(
  src: string,
  width: string | null,
  height: string | null,
): Player {
  const knownPlayer = readPlayer(src);
  if (knownPlayer !== null) {
    return knownPlayer;
  }
  const player: Player = {
    frameUrl: src,
    host: new URL(src).hostname,
    siteName: null,
    shape: readIframeShape(width, height),
  };
  return player;
}
