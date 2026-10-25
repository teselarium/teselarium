import { fetchFile, parseYaml, resolveLocation } from "../files/index.ts";
import type { FileFetchOptions, YamlMapping } from "../files/index.ts";
import { readModFormat } from "./mod_format.ts";
import type { ModFormat, ModThemeSetting } from "./mod_format.ts";
import type { ModPermission } from "./mod_permissions.ts";
import { resolveModReference } from "./mod_reference.ts";

/** A loaded mod file. Paths are resolved against the mod file. */
export interface ModFile {
  /** Resolved URL of the mod file: the mod's identity. */
  source: string;
  name: string;
  title: string;
  version: string;
  /** The mod API range the mod was written for, as written, or `null`. */
  api: string | null;
  description: string;
  /** Resolved URL of the entrypoint. */
  entrypoint: string;
  /** Resolved URL of the tile type file, or `null`. */
  typeSource: string | null;
  /** Resolved URL of the sample collection, or `null`. It is not fetched. */
  sampleCollection: string | null;
  config: YamlMapping;
  permissions: ModPermission[];
  theme: ModThemeSetting;
}

/** A mod file with the text of its entrypoint. */
export interface LoadedMod extends ModFile {
  code: string;
}

export type ModLoadOptions = FileFetchOptions & {
  /** Absolute URL of the default mods folder, needed for default mod names. */
  defaultModsFolder?: string;
};

function readDefaultBaseUrl(options: ModLoadOptions): string | undefined {
  if (options.baseUrl !== undefined || typeof document === "undefined") {
    return options.baseUrl;
  }
  return document.baseURI;
}

function resolveModPath(path: string | null, source: string): string | null {
  if (path === null) {
    return null;
  }
  const url = resolveLocation(path, source);
  return url.href;
}

function buildModFile(source: string, modFormat: ModFormat): ModFile {
  const modFile: ModFile = {
    source,
    name: modFormat.name,
    title: modFormat.title,
    version: modFormat.version,
    api: modFormat.api,
    description: modFormat.description,
    entrypoint: resolveLocation(modFormat.entrypoint, source).href,
    typeSource: resolveModPath(modFormat.typePath, source),
    sampleCollection: resolveModPath(modFormat.sampleCollection, source),
    config: modFormat.config,
    permissions: modFormat.permissions,
    theme: modFormat.theme,
  };
  return modFile;
}

/**
 * Loads a mod file from a mod reference (a default mod name, a folder or the
 * file itself) without fetching its entrypoint, its tile type or its sample
 * collection. Raises `FileFetchError`, `YamlParseError` or `ModFormatError`.
 */
export async function loadModFile(
  reference: string,
  options: ModLoadOptions = {},
): Promise<ModFile> {
  const source = resolveModReference(reference, {
    baseUrl: readDefaultBaseUrl(options),
    defaultModsFolder: options.defaultModsFolder,
  });
  const fetchedFile = await fetchFile(source, options);
  const modFormat = readModFormat(parseYaml(fetchedFile));
  const modFile = buildModFile(fetchedFile.source, modFormat);
  return modFile;
}

/**
 * Fetches the entrypoint of a loaded mod file and returns the mod with its
 * code. Raises `FileFetchError`, whose source is the entrypoint.
 */
export async function loadModCode(
  modFile: ModFile,
  options: ModLoadOptions = {},
): Promise<LoadedMod> {
  const entrypointFile = await fetchFile(modFile.entrypoint, options);
  const loadedMod: LoadedMod = { ...modFile, code: entrypointFile.content };
  return loadedMod;
}

/**
 * Loads a mod file and the code of its entrypoint. Raises `FileFetchError`,
 * `YamlParseError` or `ModFormatError`. Two loads never share objects.
 */
export async function loadMod(
  reference: string,
  options: ModLoadOptions = {},
): Promise<LoadedMod> {
  const modFile = await loadModFile(reference, options);
  const loadedMod = await loadModCode(modFile, options);
  return loadedMod;
}
