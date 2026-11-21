import type { LocalFiles } from "../../lib/files/index.ts";
import type { ModLoadOptions } from "../../lib/mod/index.ts";
import { readStageCatalog } from "../../lib/core/stage/index.ts";
import { loadMosaicFile } from "../../lib/mosaic/index.ts";
import type { LoadedMosaic } from "../../lib/mosaic/index.ts";
import type { ReviewSources } from "../../lib/user_catalog/index.ts";
import { readUserCatalogText } from "./user_catalog_store.ts";
import type { UserCatalogStore } from "./user_catalog_store.ts";

function readStoredText(
  store: UserCatalogStore,
  address: string,
): Promise<string | null> {
  return readUserCatalogText(store, address);
}

/**
 * The stage's fetch options, with the default mods folder, as a mosaic is
 * loaded when it opens, and the store's own files at `opentesela-browser:`
 * addresses.
 */
function readMosaicOptions(store: UserCatalogStore): ModLoadOptions {
  const options: ModLoadOptions = {
    ...store.stage.fetchOptions,
    defaultModsFolder: store.stage.defaults.folder,
    browserFiles: { readText: readStoredText.bind(undefined, store) },
  };
  return options;
}

function readPickedMosaic(
  store: UserCatalogStore,
  address: string,
  localFiles: LocalFiles,
): Promise<LoadedMosaic> {
  return loadMosaicFile(address, { ...readMosaicOptions(store), localFiles });
}

/** What the import and update reviews read: the current entries, the stored texts, and the real mosaic loader. */
export function buildReviewSources(store: UserCatalogStore): ReviewSources {
  const sources: ReviewSources = {
    entries: store.snapshot.entries,
    storedFiles: { readText: readStoredText.bind(undefined, store) },
    readMosaic: readPickedMosaic.bind(undefined, store),
  };
  return sources;
}

/** Loads a mosaic file, stored or remote, without its mod or collection, as the stage would. */
export function loadUserMosaic(
  store: UserCatalogStore,
  address: string,
): Promise<LoadedMosaic> {
  return loadMosaicFile(address, readMosaicOptions(store));
}

/** Whether the catalog already lists a mosaic at `address`, at any place. */
export async function isListedMosaic(
  store: UserCatalogStore,
  address: string,
): Promise<boolean> {
  const catalog = await readStageCatalog(store.stage);
  for (const mosaic of catalog.mosaics) {
    if (mosaic.source === address) {
      return true;
    }
  }
  return false;
}
