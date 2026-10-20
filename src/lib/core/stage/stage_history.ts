import type { RunLink } from "../engine/index.ts";
import { buildRunLink, readAppRoute } from "./run_links.ts";

/** The part of `History` the stage uses. The page passes `window.history`. */
export type StageHistory = Pick<
  History,
  "state" | "pushState" | "replaceState"
>;

/** What an address means to the stage: the hash of its entry, the link to run, and whether it is home. */
export interface StageRoute {
  hash: string;
  link: RunLink;
  isHome: boolean;
}

const HOME_HASH = "#/";

/**
 * Reads an address hash. Home (`""`, `#/` or any hash that is not a run
 * link) becomes the home mod's link with hash `#/`. A run link keeps its hash.
 */
export function readStageRoute(hash: string, homeMod: string): StageRoute {
  const appRoute = readAppRoute(hash);
  if (appRoute.page === "home") {
    const homeRoute: StageRoute = {
      hash: HOME_HASH,
      link: { mod: homeMod, collection: null, params: {} },
      isHome: true,
    };
    return homeRoute;
  }
  const runRoute: StageRoute = { hash, link: appRoute.link, isHome: false };
  return runRoute;
}

/** The route of a link a mod asked to open. */
export function routeForLink(link: RunLink): StageRoute {
  const route: StageRoute = {
    hash: buildRunLink(link),
    link: structuredClone(link),
    isHome: false,
  };
  return route;
}

function isStageState(
  historyState: unknown,
): historyState is { opentesela: { position: unknown } } {
  if (typeof historyState !== "object" || historyState === null) {
    return false;
  }
  const stageState: unknown = (historyState as { opentesela?: unknown })
    .opentesela;
  return typeof stageState === "object" && stageState !== null;
}

/**
 * The history position the stage stored in an entry's state, or `null` for
 * an entry the stage did not write (first load, a link followed in the page,
 * another app's state).
 */
export function readHistoryPosition(historyState: unknown): number | null {
  if (!isStageState(historyState)) {
    return null;
  }
  const position = historyState.opentesela.position;
  if (
    typeof position !== "number" ||
    !Number.isInteger(position) ||
    position < 0
  ) {
    return null;
  }
  return position;
}

/**
 * Writes a history entry with the stage's position in its state, so positions
 * stay consistent after a reload. `push` adds an entry, `replace` changes the
 * current one.
 */
export function writeStageEntry(
  history: StageHistory,
  mode: "push" | "replace",
  position: number,
  hash: string,
): void {
  const historyState = { opentesela: { position } };
  if (mode === "push") {
    history.pushState(historyState, "", hash);
    return;
  }
  history.replaceState(historyState, "", hash);
}
