import { fetchFile, parseYaml, resolveLocation } from "../files/index.ts";
import type { FileFetchOptions, YamlMapping } from "../files/index.ts";
import { readModFormat } from "./mod_format.ts";
import type { ModFormat, ModThemeSetting } from "./mod_format.ts";
import { resolveModLibraries } from "./mod_libraries.ts";
import type { LoadedLibrary } from "./mod_libraries.ts";
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
  /** Resolved URL of the test file, or `null`. It is fetched only by `loadModTestCode`. */
  testSource: string | null;
  config: YamlMapping;
  permissions: ModPermission[];
  theme: ModThemeSetting;
  /** The declared libraries, with the address of each file. Their files are not fetched. */
  libraries: LoadedLibrary[];
}

/** A mod file with the text of its entrypoint. */
export interface LoadedMod extends ModFile {
  code: string;
}

export type ModLoadOptions = FileFetchOptions & {
  /** Absolute URL of the default mods folder, needed for default mod names. */
  defaultModsFolder?: string;
  /**
   * The address npm files are fetched from, ending in `/`, such as
   * `https://cdn.jsdelivr.net/npm/`. Needed for mods that declare an npm library.
   */
  npmHost?: string;
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

function buildModFile(
  source: string,
  modFormat: ModFormat,
  npmHost: string | undefined,
): ModFile {
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
    testSource: resolveModPath(modFormat.testPath, source),
    config: modFormat.config,
    permissions: modFormat.permissions,
    theme: modFormat.theme,
    libraries: resolveModLibraries(modFormat.libraries, source, npmHost),
  };
  return modFile;
}

/**
 * Loads a mod file from a mod reference (a default mod name, a folder or the
 * file itself) without fetching its entrypoint, its tile type, its sample
 * collection, its test file or its library files. Raises `FileFetchError`,
 * `YamlParseError` or `ModFormatError`, and an `Error` for a mod that declares
 * an npm library when `options` has no `npmHost`.
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
  const modFile = buildModFile(fetchedFile.source, modFormat, options.npmHost);
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
 * Fetches the test file of a mod and returns its text. Only a check's tests
 * fetch it. Raises `FileFetchError`, whose source is the test file, and an
 * `Error` when the mod declares no test file.
 */
export async function loadModTestCode(
  modFile: ModFile,
  options: ModLoadOptions = {},
): Promise<string> {
  if (modFile.testSource === null) {
    throw new Error(`The mod "${modFile.source}" declares no test file`);
  }
  const testFile = await fetchFile(modFile.testSource, options);
  return testFile.content;
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
