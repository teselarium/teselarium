import {
  readCombinationSnapshot,
  requestSummaries,
} from "../../lib/core/combinations/index.ts";
import type {
  CombinationCatalog,
  MosaicSummary,
} from "../../lib/core/combinations/index.ts";
import type { SandboxSnapshot, Stage } from "../../lib/core/stage/index.ts";
import type { RecentlyUsedSnapshot } from "../settings/recently_used.ts";
import { readCatalogSources } from "./combination_list_inputs.ts";
import {
  listSources,
  readLoadedValues,
  readSources,
} from "./combination_rows.ts";

/** The mods and collections of the mosaics, whose titles the mosaic list shows. */
function listMosaicPairs(mosaics: readonly MosaicSummary[]): {
  mods: string[];
  collections: string[];
} {
  const mods: string[] = [];
  const collections: string[] = [];
  for (const mosaic of mosaics) {
    mods.push(mosaic.mod);
    if (mosaic.collection !== null) {
      collections.push(mosaic.collection);
    }
  }
  const pairs = { mods, collections };
  return pairs;
}

/** The mods and collections of the tried combinations, for their titles. */
function listTriedPairs(recent: RecentlyUsedSnapshot): {
  mods: string[];
  collections: string[];
} {
  const mods: string[] = [];
  const collections: string[] = [];
  for (const combination of recent.combinations) {
    mods.push(combination.mod);
    collections.push(combination.collection);
  }
  const pairs = { mods, collections };
  return pairs;
}

/**
 * Starts loading the summaries the three lists show, those not requested
 * yet: the mod files, the collection files and the mosaic files, then the
 * files of the mosaics' mods and collections. No tile and no score: those
 * wait for a capsule's hover, focus or list. The stage bar calls it when it
 * shows a combination sandbox whose mod file is loaded, so a refused link
 * or a failed mosaic requests no other file. Resolves once they settled.
 */
export async function requestListSummaries(
  combinations: CombinationCatalog,
  stage: Stage,
  sandbox: SandboxSnapshot,
  recent: RecentlyUsedSnapshot,
): Promise<void> {
  const link = sandbox.link;
  const catalog = readCatalogSources(
    stage,
    readCombinationSnapshot(combinations).catalog,
  );
  const tried = listTriedPairs(recent);
  const mosaicSources = readSources(
    listSources(catalog.mosaics, recent.mosaics, link.mosaic),
  );
  await requestSummaries(combinations, {
    mods: [
      ...readSources(listSources(catalog.mods, recent.mods, link.mod)),
      ...tried.mods,
    ],
    collections: [
      ...readSources(
        listSources(catalog.collections, recent.collections, link.collection),
      ),
      ...tried.collections,
    ],
    mosaics: mosaicSources,
  });
  const mosaics = readLoadedValues(
    readCombinationSnapshot(combinations).mosaics,
    mosaicSources,
  );
  await requestSummaries(combinations, listMosaicPairs(mosaics));
}
