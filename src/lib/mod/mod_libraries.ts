import valid from "semver/functions/valid.js";
import { isYamlMapping, resolveLocation } from "../files/index.ts";
import type { YamlMapping, YamlValue } from "../files/index.ts";
import { ModFormatError } from "./mod_errors.ts";

/** How the frame uses a library file: a classic script, a stylesheet, or text given to the mod. */
export type LibraryFileKind = "script" | "style" | "data";

/** A declared library file, as the mod file names it. */
export interface LibraryFileFormat {
  /** The path as declared: inside the npm package, or relative to the mod file. */
  path: string;
  kind: LibraryFileKind;
}

/** A declared library, as the mod file names it. Paths are not resolved yet. */
export interface LibraryFormat {
  name: string;
  /** The npm package, or `null` for files next to the mod. */
  package: string | null;
  /** The exact npm version, or `null` for files next to the mod. */
  version: string | null;
  files: LibraryFileFormat[];
}

/** A declared library file with its address. */
export interface LoadedLibraryFile extends LibraryFileFormat {
  /** The file's address: on the npm host, or resolved against the mod file. */
  source: string;
}

/** A declared library of a loaded mod. Plain data. */
export interface LoadedLibrary {
  name: string;
  package: string | null;
  version: string | null;
  files: LoadedLibraryFile[];
}

/**
 * The names of the libraries the app ships (see `SHIPPED_LIBRARIES` in the
 * engine). A mod cannot declare a library of one of these names.
 */
export const SHIPPED_LIBRARY_NAMES: readonly string[] = ["mermaid"];

const LIBRARY_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

const LIBRARY_KEYS: readonly string[] = ["npm", "files"];

/** An npm package name, scoped or not, in the characters npm accepts for new packages. */
const NPM_PACKAGE_PATTERN =
  /^(@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/;

/** What an npm file path cannot have: a leading `/` or `./`, a `..` segment, `\`, `?` or `#`. */
const NPM_PATH_PATTERN = /^(\/|\.\/)|(^|\/)\.\.(\/|$)|[\\?#]/;

const ES_MODULE_EXTENSION = "mjs";

const KIND_BY_EXTENSION: Record<string, LibraryFileKind> = {
  js: "script",
  css: "style",
};

/** The package and the version of an `npm` value. */
interface NpmPackageVersion {
  package: string;
  version: string;
}

function describeLibrary(name: string): string {
  return `"libraries.${name}"`;
}

function readLibrariesMapping(
  value: YamlValue | undefined,
  source: string,
): YamlMapping {
  if (value === undefined) {
    const noLibraries: YamlMapping = {};
    return noLibraries;
  }
  if (!isYamlMapping(value)) {
    throw new ModFormatError(source, '"libraries" must be a mapping');
  }
  return value;
}

function checkLibraryName(name: string, source: string): void {
  if (SHIPPED_LIBRARY_NAMES.includes(name)) {
    throw new ModFormatError(
      source,
      `${describeLibrary(name)}: "${name}" is a library the app ships, so a mod cannot declare it`,
    );
  }
  if (!LIBRARY_NAME_PATTERN.test(name)) {
    throw new ModFormatError(
      source,
      `${describeLibrary(name)}: a library name has only lowercase letters, digits and "_", and starts with a letter, and "${name}" does not`,
    );
  }
}

function readLibraryMapping(
  name: string,
  value: YamlValue,
  source: string,
): YamlMapping {
  if (!isYamlMapping(value)) {
    throw new ModFormatError(
      source,
      `${describeLibrary(name)} must be a mapping with "files" and an optional "npm"`,
    );
  }
  for (const key of Object.keys(value)) {
    if (!LIBRARY_KEYS.includes(key)) {
      throw new ModFormatError(
        source,
        `${describeLibrary(name)} has the key "${key}", but a library has only "npm" and "files"`,
      );
    }
  }
  return value;
}

/** Splits `<package>@<version>` at the `@` after the package, which is not the first character of a scoped package. */
function splitNpmValue(npm: string): [string, string] | null {
  const separatorIndex = npm.indexOf("@", 1);
  if (separatorIndex === -1) {
    return null;
  }
  const packageVersion: [string, string] = [
    npm.slice(0, separatorIndex),
    npm.slice(separatorIndex + 1),
  ];
  return packageVersion;
}

function isExactNpmVersion(packageName: string, version: string): boolean {
  return NPM_PACKAGE_PATTERN.test(packageName) && valid(version) === version;
}

/** Reads `npm`: absent gives `null`, anything else must be `<package>@<exact version>`. */
function readNpmPackageVersion(
  name: string,
  npm: YamlValue | undefined,
  source: string,
): NpmPackageVersion | null {
  if (npm === undefined) {
    return null;
  }
  const parts = typeof npm === "string" ? splitNpmValue(npm) : null;
  if (parts === null || !isExactNpmVersion(parts[0], parts[1])) {
    throw new ModFormatError(
      source,
      `${describeLibrary(name)}: "npm" needs an exact version of a package, such as "leaflet@1.9.4"`,
    );
  }
  const packageVersion: NpmPackageVersion = {
    package: parts[0],
    version: parts[1],
  };
  return packageVersion;
}

function readFilePaths(
  name: string,
  files: YamlValue | undefined,
  source: string,
): string[] {
  if (!Array.isArray(files) || files.length === 0) {
    throw new ModFormatError(
      source,
      `${describeLibrary(name)}: "files" must be a non-empty list of non-empty strings`,
    );
  }
  const paths: string[] = [];
  for (const file of files) {
    if (typeof file !== "string" || file === "") {
      throw new ModFormatError(
        source,
        `${describeLibrary(name)}: "files" must be a non-empty list of non-empty strings`,
      );
    }
    paths.push(file);
  }
  return paths;
}

function checkNpmPath(name: string, path: string, source: string): void {
  if (NPM_PATH_PATTERN.test(path)) {
    throw new ModFormatError(
      source,
      `${describeLibrary(name)}: the file "${path}" must be a path inside the npm package, without a leading "/" or "./", a ".." segment, "\\", "?" or "#"`,
    );
  }
}

/** The extension of a path's last segment, in lowercase, or `""` without one. */
function readPathExtension(path: string): string {
  const fileName = path.slice(path.lastIndexOf("/") + 1);
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) {
    return "";
  }
  return fileName.slice(dotIndex + 1).toLowerCase();
}

function readFileKind(
  name: string,
  path: string,
  source: string,
): LibraryFileKind {
  const extension = readPathExtension(path);
  if (extension === ES_MODULE_EXTENSION) {
    throw new ModFormatError(
      source,
      `${describeLibrary(name)}: the file "${path}" is an ES module, and ES module libraries are not supported (use a UMD or IIFE build)`,
    );
  }
  return KIND_BY_EXTENSION[extension] ?? "data";
}

function readLibraryFiles(
  name: string,
  library: YamlMapping,
  isNpm: boolean,
  source: string,
): LibraryFileFormat[] {
  const files: LibraryFileFormat[] = [];
  for (const path of readFilePaths(name, library.files, source)) {
    if (isNpm) {
      checkNpmPath(name, path, source);
    }
    files.push({ path, kind: readFileKind(name, path, source) });
  }
  return files;
}

function readLibrary(
  name: string,
  value: YamlValue,
  source: string,
): LibraryFormat {
  checkLibraryName(name, source);
  const library = readLibraryMapping(name, value, source);
  const npm = readNpmPackageVersion(name, library.npm, source);
  const libraryFormat: LibraryFormat = {
    name,
    package: npm?.package ?? null,
    version: npm?.version ?? null,
    files: readLibraryFiles(name, library, npm !== null, source),
  };
  return libraryFormat;
}

/**
 * Reads the `libraries` of a mod file, in the order of the file. Missing
 * gives an empty list. Raises `ModFormatError` at the first failure, with the
 * mod file's `source`.
 */
export function readModLibraries(
  value: YamlValue | undefined,
  source: string,
): LibraryFormat[] {
  const libraries: LibraryFormat[] = [];
  const mapping = readLibrariesMapping(value, source);
  for (const [name, library] of Object.entries(mapping)) {
    libraries.push(readLibrary(name, library, source));
  }
  return libraries;
}

/** The address of a declared file: on the npm host for an npm library, else against the mod file. */
function resolveLibraryFileSource(
  library: LibraryFormat,
  path: string,
  modSource: string,
  npmHost: string | undefined,
): string {
  if (library.package === null) {
    return resolveLocation(path, modSource).href;
  }
  if (npmHost === undefined) {
    throw new Error(
      `Cannot resolve the npm library "${library.name}" of the mod "${modSource}": no npm host was given`,
    );
  }
  const npmSource = `${npmHost}${library.package}@${library.version}/${path}`;
  return npmSource;
}

function resolveLibrary(
  library: LibraryFormat,
  modSource: string,
  npmHost: string | undefined,
): LoadedLibrary {
  const files: LoadedLibraryFile[] = [];
  for (const file of library.files) {
    files.push({
      path: file.path,
      source: resolveLibraryFileSource(library, file.path, modSource, npmHost),
      kind: file.kind,
    });
  }
  const loadedLibrary: LoadedLibrary = {
    name: library.name,
    package: library.package,
    version: library.version,
    files,
  };
  return loadedLibrary;
}

/**
 * Resolves the address of each declared file: `<npmHost><package>@<version>/<path>`
 * for an npm library, the path against the mod file otherwise. Raises an
 * `Error` for an npm library without an npm host, and `FileFetchError` for a
 * path that cannot be resolved.
 */
export function resolveModLibraries(
  libraries: LibraryFormat[],
  modSource: string,
  npmHost: string | undefined,
): LoadedLibrary[] {
  const loadedLibraries: LoadedLibrary[] = [];
  for (const library of libraries) {
    loadedLibraries.push(resolveLibrary(library, modSource, npmHost));
  }
  return loadedLibraries;
}
