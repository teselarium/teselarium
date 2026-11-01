import { listYamlStrings } from "../../files/index.ts";
import type { ModIssue, ModPermission } from "../../mod/index.ts";
import { permissionHostCovers } from "../../mod/index.ts";
import type { Tile } from "../../tile/index.ts";
import { isGuardedLink } from "./private_hosts.ts";
import { listCategoryHosts, sortSources } from "./sandbox_policy.ts";

/** What a mod's tiles link: the exact sources the policy adds, and the links left out. */
export interface TileLinks {
  /** `origin + pathname` of each allowed link, sorted and without duplicates. */
  sources: string[];
  /** One warning per left-out URL and tile, whose source is the tile. */
  issues: ModIssue[];
}

/** Why a link that a policy source cannot hold is left out. */
const UNEXPRESSIBLE_LINK_REASON = "the sandbox cannot allow this address";

/** Why a link to the user's computer or network is left out. */
const PRIVATE_LINK_REASON =
  "tiles from other sites cannot link addresses on your computer or network";

const LINK_PROTOCOLS = new Set(["http:", "https:"]);

/** The characters of a host name in a policy source. */
const SOURCE_HOST_PATTERN = /^[a-z0-9.-]+$/;

/** The characters of a path in a policy source: RFC 3986 `pchar`s and `/`, without `;` and `,`. */
const SOURCE_PATH_PATTERN = /^[A-Za-z0-9\-._~!$&'()*+=:@%/]+$/;

/** What a metadata string adds to the policy: a source, a left-out reason, or nothing. */
type LinkOutcome =
  | { kind: "allowed"; source: string }
  | { kind: "left-out"; reason: string }
  | { kind: "skipped" };

const SKIPPED_LINK: LinkOutcome = { kind: "skipped" };

function readLinkUrl(value: string): URL | null {
  if (!URL.canParse(value)) {
    return null;
  }
  const url = new URL(value);
  if (!LINK_PROTOCOLS.has(url.protocol)) {
    return null;
  }
  return url;
}

function hasCredentials(url: URL): boolean {
  const hasUserOrPassword = url.username !== "" || url.password !== "";
  return hasUserOrPassword;
}

function isIpv6Host(url: URL): boolean {
  const isIpv6 = url.hostname.startsWith("[");
  return isIpv6;
}

function isSourceHost(url: URL): boolean {
  const isValidHost = SOURCE_HOST_PATTERN.test(url.hostname);
  return isValidHost;
}

function isSourcePath(url: URL): boolean {
  const isValidPath = SOURCE_PATH_PATTERN.test(url.pathname);
  return isValidPath;
}

/** Whether a policy source can hold the link as `origin + pathname`. */
function canExpressLink(url: URL): boolean {
  const canExpress =
    !hasCredentials(url) &&
    !isIpv6Host(url) &&
    isSourceHost(url) &&
    isSourcePath(url);
  return canExpress;
}

function coversOrigin(coveringHosts: string[], origin: string): boolean {
  for (const host of coveringHosts) {
    if (permissionHostCovers(host, origin)) {
      return true;
    }
  }
  return false;
}

/** Sorts one metadata string; the first step that applies decides. */
function judgeTileLink(
  value: string,
  coveringHosts: string[],
  tileSource: string,
): LinkOutcome {
  const url = readLinkUrl(value);
  if (url === null || url.pathname.endsWith("/")) {
    return SKIPPED_LINK;
  }
  if (coversOrigin(coveringHosts, url.origin)) {
    return SKIPPED_LINK;
  }
  if (!canExpressLink(url)) {
    const unexpressibleOutcome: LinkOutcome = {
      kind: "left-out",
      reason: UNEXPRESSIBLE_LINK_REASON,
    };
    return unexpressibleOutcome;
  }
  if (isGuardedLink(url, tileSource)) {
    const privateOutcome: LinkOutcome = {
      kind: "left-out",
      reason: PRIVATE_LINK_REASON,
    };
    return privateOutcome;
  }
  const allowedOutcome: LinkOutcome = {
    kind: "allowed",
    source: url.origin + url.pathname,
  };
  return allowedOutcome;
}

function buildLeftOutIssue(
  tileSource: string,
  value: string,
  reason: string,
): ModIssue {
  const issue: ModIssue = {
    level: "warning",
    source: tileSource,
    message: `Not loading ${value}: ${reason}.`,
  };
  return issue;
}

/** The warning for a link to the user's computer or network that a tile's link is left out for. */
export function buildPrivateLinkIssue(
  tileSource: string,
  value: string,
): ModIssue {
  const issue = buildLeftOutIssue(tileSource, value, PRIVATE_LINK_REASON);
  return issue;
}

/** The links of one tile, with each left-out URL reported once. Sources are not sorted yet. */
function collectLinksOfTile(
  tile: Tile,
  bodyMediaUrls: string[],
  coveringHosts: string[],
): TileLinks {
  const sources: string[] = [];
  const issues: ModIssue[] = [];
  const reportedValues = new Set<string>();
  const values = [...listYamlStrings(tile.metadata), ...bodyMediaUrls];
  for (const value of values) {
    const outcome = judgeTileLink(value, coveringHosts, tile.source);
    if (outcome.kind === "allowed") {
      sources.push(outcome.source);
    }
    if (outcome.kind === "left-out" && !reportedValues.has(value)) {
      reportedValues.add(value);
      issues.push(buildLeftOutIssue(tile.source, value, outcome.reason));
    }
  }
  const tileLinks: TileLinks = { sources, issues };
  return tileLinks;
}

/**
 * Finds the images, video and audio a mod's tiles link: each `http:` or
 * `https:` URL that is a metadata string, inside lists and nested mappings
 * too, or a media address of the tile's rendered body, which `bodyMedia`
 * holds by tile source (`renderTileBody`'s `mediaUrls`). A link to a folder,
 * or one whose origin a content host or a granted `show` host covers, adds
 * nothing. A link the policy cannot express, or one to the user's computer
 * or network from a tile that is not, is left out and reported. The input
 * tiles are not changed.
 */
export function collectTileLinks(
  tiles: Tile[],
  contentHosts: string[],
  granted: ModPermission[],
  bodyMedia: ReadonlyMap<string, string[]>,
): TileLinks {
  const coveringHosts = [
    ...contentHosts,
    ...listCategoryHosts(granted, "show"),
  ];
  const sources: string[] = [];
  const issues: ModIssue[] = [];
  for (const tile of tiles) {
    const tileLinks = collectLinksOfTile(
      tile,
      bodyMedia.get(tile.source) ?? [],
      coveringHosts,
    );
    sources.push(...tileLinks.sources);
    issues.push(...tileLinks.issues);
  }
  const tileLinks: TileLinks = { sources: sortSources(sources), issues };
  return tileLinks;
}
