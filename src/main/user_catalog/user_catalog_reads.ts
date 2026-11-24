import { parseYaml } from "../../lib/files/index.ts";
import type { LocalFiles } from "../../lib/files/index.ts";
import type { ModLoadOptions } from "../../lib/mod/index.ts";
import { validateMosaicDraft } from "../../lib/core/engine/index.ts";
import type {
  DraftLoadCache,
  DraftValidation,
} from "../../lib/core/engine/index.ts";
import { readStageCatalog } from "../../lib/core/stage/index.ts";
import {
  buildLoadedMosaic,
  DRAFT_ADDRESS,
  loadMosaicFile,
} from "../../lib/mosaic/index.ts";
import type { LoadedMosaic } from "../../lib/mosaic/index.ts";
import type { ReviewSources } from "../../lib/user_catalog/index.ts";
import {
  readUserCatalogText,
  readUserCatalogVersions,
} from "./user_catalog_store.ts";
import type { UserCatalogStore } from "./user_catalog_store.ts";

function readStoredText(
  store: UserCatalogStore,
  address: string,
): Promise<string | null> {
  return readUserCatalogText(store, address);
}

/**
 * The stage's fetch options, with the default mods folder, as a mosaic is
 * loaded when it opens, and the store's own files at `teselarium-browser:`
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
    storedVersions: {
      readVersions: readUserCatalogVersions.bind(undefined, store),
    },
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

/**
 * Validates a draft as `mosaics.validate` does, through the stage's fetch
 * options and the stored files, without any permission check: the app, not
 * a mod, asks.
 */
export function validateUserDraft(
  store: UserCatalogStore,
  content: string,
  address: string | null,
  loads: DraftLoadCache,
): Promise<DraftValidation> {
  return validateMosaicDraft(content, address, {
    fetchOptions: readMosaicOptions(store),
    loads,
  });
}

/**
 * A mosaic file's text read as the loader reads it, at `address` or the
 * draft address, or `null` when the loader refuses it.
 */
export function readDraftMosaic(
  store: UserCatalogStore,
  content: string,
  address: string | null,
): LoadedMosaic | null {
  try {
    const parsedYaml = parseYaml({ source: address ?? DRAFT_ADDRESS, content });
    return buildLoadedMosaic(parsedYaml, readMosaicOptions(store));
  } catch {
    return null;
  }
}
