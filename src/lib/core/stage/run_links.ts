import type { RunLink } from "../engine/index.ts";

/** Whether an address hash is a run link, and its link. `home` is any other hash. */
export type AppRoute = { page: "home" } | { page: "run"; link: RunLink };

const RUN_PATH = "#/run";

const HOME_ROUTE: AppRoute = { page: "home" };

/** The other parameters, in link order, with the first value of each key. */
function readLinkParams(query: URLSearchParams): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [name, value] of query) {
    const isReserved = name === "mod" || name === "collection";
    if (!isReserved && !Object.hasOwn(params, name)) {
      params[name] = value;
    }
  }
  return params;
}

/**
 * Reads an address hash. `#/run?mod=<reference>&collection=<location>&...`
 * with a non-empty `mod` is a run route; every other hash, including `""`,
 * `#/` and old links such as `#/mods/view`, is home.
 */
export function readAppRoute(hash: string): AppRoute {
  const queryStart = hash.indexOf("?");
  const path = queryStart === -1 ? hash : hash.slice(0, queryStart);
  if (path !== RUN_PATH || queryStart === -1) {
    return HOME_ROUTE;
  }
  const query = new URLSearchParams(hash.slice(queryStart + 1));
  const mod = query.get("mod");
  if (mod === null || mod === "") {
    return HOME_ROUTE;
  }
  const collection = query.get("collection");
  const runRoute: AppRoute = {
    page: "run",
    link: {
      mod,
      collection: collection === null || collection === "" ? null : collection,
      params: readLinkParams(query),
    },
  };
  return runRoute;
}

/** Builds the run link hash of a link: `mod`, then `collection` when present, then the params. */
export function buildRunLink(link: RunLink): string {
  const query = new URLSearchParams();
  query.append("mod", link.mod);
  if (link.collection !== null) {
    query.append("collection", link.collection);
  }
  for (const [name, value] of Object.entries(link.params)) {
    query.append(name, value);
  }
  const runLink = `${RUN_PATH}?${query.toString()}`;
  return runLink;
}
