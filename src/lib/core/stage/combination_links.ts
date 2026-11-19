import type { RunLink } from "../engine/index.ts";
import type { SandboxLink } from "./stage_controller.ts";

/** The collection list's "None" row, in place of a collection source. */
export const NO_COLLECTION = "none";

/** A collection source, or `NO_COLLECTION` for "None". */
export type CollectionChoice = string;

function copyParams(link: SandboxLink): Record<string, string> {
  const params: Record<string, string> = { ...link.params };
  return params;
}

/**
 * The run link that choosing `modSource` in the mod list opens: that mod with
 * the current collection or tile. From a sandbox opened from a mosaic, the
 * mosaic becomes `sites`, and a sandbox with `sites` keeps it. The other
 * params are dropped. `null` for the current mod.
 */
export function buildModChoice(
  link: SandboxLink,
  modSource: string,
): RunLink | null {
  if (modSource === link.mod) {
    return null;
  }
  const choice: RunLink = {
    mod: modSource,
    collection: link.collection,
    tile: link.mosaic === null ? link.tile : null,
    sites: link.mosaic ?? link.sites,
    params: {},
  };
  return choice;
}

/** Whether `choice` is what the sandbox already has: its collection, or "None" without a collection or a tile. */
function isCurrentCollection(
  link: SandboxLink,
  choice: CollectionChoice,
): boolean {
  if (choice === NO_COLLECTION) {
    return link.collection === null && link.tile === null;
  }
  return choice === link.collection;
}

/**
 * The run link that choosing a collection, or "None", in the collection list
 * opens: the current mod with it, without `tile` and without `sites`. The
 * link's params are kept. `null` for the current collection.
 */
export function buildCollectionChoice(
  link: SandboxLink,
  choice: CollectionChoice,
): RunLink | null {
  if (isCurrentCollection(link, choice)) {
    return null;
  }
  const collectionLink: RunLink = {
    mod: link.mod,
    collection: choice === NO_COLLECTION ? null : choice,
    tile: null,
    params: copyParams(link),
  };
  return collectionLink;
}

/** The run link that choosing a mosaic in the mosaic list opens: that mosaic, with no other params. `null` for the current mosaic. */
export function buildMosaicChoice(
  link: SandboxLink,
  mosaicSource: string,
): RunLink | null {
  if (mosaicSource === link.mosaic) {
    return null;
  }
  const mosaicLink: RunLink = {
    mod: "",
    collection: null,
    tile: null,
    mosaic: mosaicSource,
    params: {},
  };
  return mosaicLink;
}

/** The run link "Stop using these sites" opens: the same combination, params kept, without `sites`. */
export function buildSitesDrop(link: SandboxLink): RunLink {
  const droppedLink: RunLink = {
    mod: link.mod,
    collection: link.collection,
    tile: link.tile,
    params: copyParams(link),
  };
  return droppedLink;
}

/**
 * Whether a sandbox gets capsules: it was opened from a mosaic, from a link
 * with a collection or a tile, or from a link whose mod `knownMods` (the
 * catalog's and the recently used mods) holds.
 */
export function isCombinationSandbox(
  link: SandboxLink,
  knownMods: readonly string[],
): boolean {
  if (link.mosaic !== null || link.collection !== null || link.tile !== null) {
    return true;
  }
  return knownMods.includes(link.mod);
}
