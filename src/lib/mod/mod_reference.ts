import { FileFetchError, resolveLocation } from "../files/index.ts";

export interface ModReferenceOptions {
  /** Base for relative locations: the app's address. */
  baseUrl?: string;
  /** Absolute URL of the default mods folder, with a trailing `/`. */
  defaultModsFolder?: string;
}

/** A reference without `/` that matches this is a default mod name. */
const DEFAULT_MOD_NAME = /^[a-z][a-z0-9_]*$/;

/** The mod file of a mod folder. */
const MOD_FILE_NAME = "mod_conf.yaml";

const MOD_FILE_EXTENSIONS = [".yaml", ".yml"];

function resolveDefaultModName(
  name: string,
  defaultModsFolder: string | undefined,
): string {
  if (defaultModsFolder === undefined) {
    throw new FileFetchError(
      name,
      "a default mod name needs a default mods folder",
    );
  }
  const modFileUrl = new URL(`${name}/${MOD_FILE_NAME}`, defaultModsFolder);
  return modFileUrl.href;
}

function isModFileUrl(url: URL): boolean {
  for (const extension of MOD_FILE_EXTENSIONS) {
    if (url.pathname.endsWith(extension)) {
      return true;
    }
  }
  return false;
}

/** The mod file in a folder. The folder's query and fragment are dropped. */
function resolveModFolder(folderUrl: URL): string {
  const folder = new URL(folderUrl.href);
  folder.search = "";
  folder.hash = "";
  if (!folder.pathname.endsWith("/")) {
    folder.pathname = `${folder.pathname}/`;
  }
  const modFileUrl = new URL(MOD_FILE_NAME, folder);
  return modFileUrl.href;
}

/**
 * Resolves a mod reference to the URL of its mod file, the mod's source. A
 * default mod name (`mod_viewer`) means its folder in the default mods folder.
 * A location whose path ends in `.yaml` or `.yml` is the mod file itself, any
 * other location is the mod's folder. Every reference to one mod file gives
 * the same source. Raises `FileFetchError` when it cannot be resolved.
 */
export function resolveModReference(
  reference: string,
  options: ModReferenceOptions,
): string {
  if (DEFAULT_MOD_NAME.test(reference)) {
    return resolveDefaultModName(reference, options.defaultModsFolder);
  }
  const url = resolveLocation(reference, options.baseUrl);
  if (isModFileUrl(url)) {
    return url.href;
  }
  return resolveModFolder(url);
}
