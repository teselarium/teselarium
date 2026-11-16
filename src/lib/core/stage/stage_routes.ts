import type { RunLink } from "../engine/index.ts";
import { buildRunLink, readAppRoute } from "./run_links.ts";

/** What Home is: the index page of a page section, or a mod. `section` is the Home section's id. */
export type StageHome =
  | { kind: "page"; section: string }
  | { kind: "mod"; section: string; link: RunLink };

/** A section whose target is a mod link. */
export interface SectionLink {
  section: string;
  link: RunLink;
}

/**
 * What the stage knows of the app's sections, as plain data: which ids are
 * page sections, what Home is, and the mod link of each mod section, in
 * sidebar order.
 */
export interface StageRouting {
  pageSections: readonly string[];
  home: StageHome;
  sectionLinks: readonly SectionLink[];
}

/**
 * What an address means to the stage: a page, or a sandbox to open with its
 * link. `hash` is the address of the entry, `#/` for Home.
 */
export type StageRoute =
  | { kind: "page"; hash: string; section: string; page: string | null }
  | { kind: "sandbox"; hash: string; link: RunLink; isHomeMod: boolean };

const HOME_HASH = "#/";

/**
 * `#/<section>` or `#/<section>/<page>`. The page name is checked on the raw
 * hash, before any decoding, so `..`, `/` and their encoded forms never match.
 */
const PAGE_HASH_PATTERN = /^#\/([a-z][a-z0-9_-]*)(?:\/([A-Za-z0-9_-]+))?$/;

/** The address of a page. The Home section's index page is `#/`. */
export function buildPageHash(
  routing: StageRouting,
  section: string,
  page: string | null,
): string {
  if (page === null) {
    const isHomeIndex =
      routing.home.kind === "page" && routing.home.section === section;
    return isHomeIndex ? HOME_HASH : `#/${section}`;
  }
  const pageHash = `#/${section}/${page}`;
  return pageHash;
}

function buildPageRoute(
  routing: StageRouting,
  section: string,
  page: string | null,
): StageRoute {
  const pageRoute: StageRoute = {
    kind: "page",
    hash: buildPageHash(routing, section, page),
    section,
    page,
  };
  return pageRoute;
}

/** The route of Home: the Home section's index page, or the Home mod at `#/`. */
export function buildHomeRoute(routing: StageRouting): StageRoute {
  if (routing.home.kind === "page") {
    return buildPageRoute(routing, routing.home.section, null);
  }
  const homeModRoute: StageRoute = {
    kind: "sandbox",
    hash: HOME_HASH,
    link: structuredClone(routing.home.link),
    isHomeMod: true,
  };
  return homeModRoute;
}

/** The page route of a hash, or `null` when it is not the address of a page. */
function readPageRoute(hash: string, routing: StageRouting): StageRoute | null {
  const match = PAGE_HASH_PATTERN.exec(hash);
  if (match === null || !routing.pageSections.includes(match[1])) {
    return null;
  }
  return buildPageRoute(routing, match[1], match[2] ?? null);
}

/**
 * Reads an address hash: a run link with a non-empty `mod` opens a sandbox
 * and keeps its hash, the address of a page shows it, and every other hash,
 * including `""` and `#/`, is Home.
 */
export function readStageRoute(
  hash: string,
  routing: StageRouting,
): StageRoute {
  const appRoute = readAppRoute(hash);
  if (appRoute.page === "run") {
    const runRoute: StageRoute = {
      kind: "sandbox",
      hash,
      link: appRoute.link,
      isHomeMod: false,
    };
    return runRoute;
  }
  return readPageRoute(hash, routing) ?? buildHomeRoute(routing);
}

/** The route of a link a mod asked to open. */
export function routeForLink(link: RunLink): StageRoute {
  const route: StageRoute = {
    kind: "sandbox",
    hash: buildRunLink(link),
    link: structuredClone(link),
    isHomeMod: false,
  };
  return route;
}

function haveSameParams(
  first: Record<string, string>,
  second: Record<string, string>,
): boolean {
  const firstNames = Object.keys(first);
  if (firstNames.length !== Object.keys(second).length) {
    return false;
  }
  for (const name of firstNames) {
    if (!Object.hasOwn(second, name) || first[name] !== second[name]) {
      return false;
    }
  }
  return true;
}

/**
 * Whether two links are the same: same mod reference, collection, tile,
 * mosaic and params. An absent tile or mosaic is the same as a `null` one.
 */
export function areSameLinks(first: RunLink, second: RunLink): boolean {
  return (
    first.mod === second.mod &&
    first.collection === second.collection &&
    (first.tile ?? null) === (second.tile ?? null) &&
    (first.mosaic ?? null) === (second.mosaic ?? null) &&
    haveSameParams(first.params, second.params)
  );
}

/** The first section whose mod link is exactly `link`, or `null`. */
export function findLinkSection(
  routing: StageRouting,
  link: RunLink,
): string | null {
  for (const sectionLink of routing.sectionLinks) {
    if (areSameLinks(sectionLink.link, link)) {
      return sectionLink.section;
    }
  }
  return null;
}

/** Whether a section is the Home section and Home is its mod. */
export function isHomeModSection(
  routing: StageRouting,
  section: string,
): boolean {
  return routing.home.kind === "mod" && routing.home.section === section;
}

/**
 * The address of a section's start: `#/<section>` for a page section (`#/`
 * for Home), the run link of a mod section's link (`#/` for the Home mod), or
 * `null` for a section the stage does not know.
 */
export function buildSectionHash(
  routing: StageRouting,
  section: string,
): string | null {
  if (routing.pageSections.includes(section)) {
    return buildPageHash(routing, section, null);
  }
  const link = findSectionLink(routing, section);
  if (link === null) {
    return null;
  }
  return isHomeModSection(routing, section) ? HOME_HASH : buildRunLink(link);
}

/** The mod link of a mod section, or `null` for a page section or an unknown id. */
export function findSectionLink(
  routing: StageRouting,
  section: string,
): RunLink | null {
  for (const sectionLink of routing.sectionLinks) {
    if (sectionLink.section === section) {
      return sectionLink.link;
    }
  }
  return null;
}
