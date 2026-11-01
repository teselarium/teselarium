import type { Element, Root } from "hast";
import type { ModIssue } from "../../mod/index.ts";
import { readIframePlayer, readPlayer } from "../players/index.ts";
import type { Player } from "../players/index.ts";
import { buildPrivateLinkIssue, isGuardedLink } from "../sandbox/index.ts";
import {
  isWebUrl,
  readTextProperty,
  resolveBodyAddress,
} from "./body_addresses.ts";

/** A player of a tile, and the title the tile gives it, which the player dialog shows. */
export interface TilePlayer {
  player: Player;
  /** The iframe's `title` or the image's alt text, or `null` when the tile gives none. */
  title: string | null;
}

/** What the players pass found in a body: its player addresses, and the iframes it left out. */
export interface BodyPlayers {
  /** Each player address, with its player and title. */
  playerAddresses: Map<string, TilePlayer>;
  issues: ModIssue[];
}

interface PlayersPassState {
  tileSource: string;
  found: BodyPlayers;
  reportedAddresses: Set<string>;
}

/** The title of a placeholder whose iframe or image gives none. */
const UNTITLED_PLAYER = "Player";

/** The host a placeholder shows: the address's, without `www.`. */
function readShownHost(url: URL): string {
  const host = url.hostname.replace(/^www\./, "");
  return host;
}

function buildTextSpan(className: string, text: string): Element {
  const span: Element = {
    type: "element",
    tagName: "span",
    properties: { className: [className] },
    children: [{ type: "text", value: text }],
  };
  return span;
}

/** The placeholder: a button holding the box the stylesheet draws, with the title and the host. */
function buildPlaceholder(url: URL, title: string): Element {
  const box: Element = {
    type: "element",
    tagName: "span",
    properties: { className: ["ot-player-box"] },
    children: [
      buildTextSpan("ot-player-title", title),
      buildTextSpan("ot-player-host", readShownHost(url)),
    ],
  };
  const placeholder: Element = {
    type: "element",
    tagName: "button",
    properties: {
      type: "button",
      className: ["ot-player"],
      dataOtPlayer: url.href,
    },
    children: [box],
  };
  return placeholder;
}

function buildIframeLink(url: URL, title: string | null): Element {
  const link: Element = {
    type: "element",
    tagName: "a",
    properties: { href: url.href },
    children: [{ type: "text", value: title ?? url.href }],
  };
  return link;
}

/** The title the tile gives a player, or `null` for a missing or blank one. */
function readGivenTitle(text: string | null): string | null {
  if (text === null || text.trim() === "") {
    return null;
  }
  return text;
}

/** The title a placeholder shows: the tile's, otherwise the site's name, otherwise `Player`. */
function readShownTitle(tilePlayer: TilePlayer): string {
  const title =
    tilePlayer.title ?? tilePlayer.player.siteName ?? UNTITLED_PLAYER;
  return title;
}

/** Records the player of `url` and builds its placeholder. */
function placePlayer(
  url: URL,
  tilePlayer: TilePlayer,
  state: PlayersPassState,
): Element {
  state.found.playerAddresses.set(url.href, tilePlayer);
  const placeholder = buildPlaceholder(url, readShownTitle(tilePlayer));
  return placeholder;
}

function reportPrivateIframe(url: URL, state: PlayersPassState): void {
  if (state.reportedAddresses.has(url.href)) {
    return;
  }
  state.reportedAddresses.add(url.href);
  state.found.issues.push(buildPrivateLinkIssue(state.tileSource, url.href));
}

/** A placeholder for a player, a link for any other web page, or `null` to leave the iframe out. */
function replaceIframe(
  iframe: Element,
  state: PlayersPassState,
): Element | null {
  const src = readTextProperty(iframe, "src") ?? "";
  const url = resolveBodyAddress(src, state.tileSource);
  if (url === null || !isWebUrl(url)) {
    return null;
  }
  if (isGuardedLink(url, state.tileSource)) {
    reportPrivateIframe(url, state);
    return null;
  }
  const title = readTextProperty(iframe, "title");
  if (url.protocol !== "https:") {
    const link = buildIframeLink(url, title);
    return link;
  }
  const tilePlayer: TilePlayer = {
    player: readIframePlayer(
      url.href,
      readTextProperty(iframe, "width"),
      readTextProperty(iframe, "height"),
    ),
    title: readGivenTitle(title),
  };
  const placeholder = placePlayer(url, tilePlayer, state);
  return placeholder;
}

/** A placeholder for an image whose address is a known site's page link, otherwise the image. */
function replaceImage(image: Element, state: PlayersPassState): Element {
  const src = readTextProperty(image, "src") ?? "";
  const url = resolveBodyAddress(src, state.tileSource);
  const player = url === null ? null : readPlayer(url.href);
  if (url === null || player === null) {
    return image;
  }
  const tilePlayer: TilePlayer = {
    player,
    title: readGivenTitle(readTextProperty(image, "alt")),
  };
  const placeholder = placePlayer(url, tilePlayer, state);
  return placeholder;
}

function replaceElement(
  element: Element,
  state: PlayersPassState,
): Element | null {
  if (element.tagName === "iframe") {
    return replaceIframe(element, state);
  }
  if (element.tagName === "img") {
    return replaceImage(element, state);
  }
  replacePlayersIn(element, state);
  return element;
}

function replacePlayersIn(
  parent: Root | Element,
  state: PlayersPassState,
): void {
  let index = 0;
  while (index < parent.children.length) {
    const child = parent.children[index];
    const replacement =
      child.type === "element" ? replaceElement(child, state) : child;
    if (replacement === null) {
      parent.children.splice(index, 1);
      continue;
    }
    parent.children[index] = replacement;
    index += 1;
  }
}

/**
 * The players pass, which runs before sanitizing removes iframes. Each
 * `<iframe>` whose `src`, resolved against the tile, is an `https:` address
 * that the private network guard allows becomes a player placeholder; an
 * `http:` one becomes a link; any other is left out, with an issue for a
 * private address. Each `<img>` whose address is a page link of a known site
 * becomes a placeholder too. Only `src`, `title`, `width`, `height` and `alt`
 * are read; the placeholders are new elements. Changes the tree in place.
 */
export function replacePlayers(tree: Root, tileSource: string): BodyPlayers {
  const state: PlayersPassState = {
    tileSource,
    found: { playerAddresses: new Map(), issues: [] },
    reportedAddresses: new Set(),
  };
  replacePlayersIn(tree, state);
  return state.found;
}
