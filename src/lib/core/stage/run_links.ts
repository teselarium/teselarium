import { RUN_LINK_RESERVED_NAMES } from "../engine/index.ts";
import type { RunLink } from "../engine/index.ts";

/** Whether an address hash is a run link, and its link. `home` is any other hash. */
export type AppRoute = { page: "home" } | { page: "run"; link: RunLink };

const RUN_PATH = "#/run";

const HOME_ROUTE: AppRoute = { page: "home" };

/** A location parameter of a link: `null` when absent or empty. */
function readLinkLocation(query: URLSearchParams, name: string): string | null {
  const location = query.get(name);
  return location === null || location === "" ? null : location;
}

/** The other parameters, in link order, with the first value of each key. */
function readLinkParams(query: URLSearchParams): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [name, value] of query) {
    const isReserved = RUN_LINK_RESERVED_NAMES.includes(name);
    if (!isReserved && !Object.hasOwn(params, name)) {
      params[name] = value;
    }
  }
  return params;
}

/**
 * Reads an address hash. `#/run?mod=<reference>&collection=<location>&tile=<location>&...`
 * with a non-empty `mod`, or `#/run?mosaic=<reference>&...` with a non-empty
 * `mosaic`, is a run route; every other hash, including `""`, `#/` and old
 * links such as `#/mods/view`, is home. A link with both a collection and a
 * tile, or with a mosaic and a mod, a collection or a tile, is read as
 * written; launching it fails.
 */
export function readAppRoute(hash: string): AppRoute {
  const queryStart = hash.indexOf("?");
  const path = queryStart === -1 ? hash : hash.slice(0, queryStart);
  if (path !== RUN_PATH || queryStart === -1) {
    return HOME_ROUTE;
  }
  const query = new URLSearchParams(hash.slice(queryStart + 1));
  const mod = readLinkLocation(query, "mod");
  const mosaic = readLinkLocation(query, "mosaic");
  if (mod === null && mosaic === null) {
    return HOME_ROUTE;
  }
  const link: RunLink = {
    mod: mod ?? "",
    collection: readLinkLocation(query, "collection"),
    tile: readLinkLocation(query, "tile"),
    params: readLinkParams(query),
  };
  if (mosaic !== null) {
    link.mosaic = mosaic;
  }
  const runRoute: AppRoute = { page: "run", link };
  return runRoute;
}

/**
 * Builds the run link hash of a link: `mosaic` when present, `mod` unless it
 * is the empty mod of a mosaic link, then `collection` and `tile` when
 * present, then the params. A mosaic link's address therefore never shows the
 * mod or the collection its file names.
 */
export function buildRunLink(link: RunLink): string {
  const query = new URLSearchParams();
  const mosaic = link.mosaic ?? null;
  if (mosaic !== null) {
    query.append("mosaic", mosaic);
  }
  if (mosaic === null || link.mod !== "") {
    query.append("mod", link.mod);
  }
  if (link.collection !== null) {
    query.append("collection", link.collection);
  }
  const tile = link.tile ?? null;
  if (tile !== null) {
    query.append("tile", tile);
  }
  for (const [name, value] of Object.entries(link.params)) {
    query.append(name, value);
  }
  const runLink = `${RUN_PATH}?${query.toString()}`;
  return runLink;
}
