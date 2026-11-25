import type { YamlMapping, YamlValue } from "../../files/index.ts";
import type { LoadedLibrary, LoadedMod } from "../../mod/index.ts";
import { describeEngineError, ModMethodError } from "./engine_errors.ts";
import { fetchLibraryFiles, PAGE_LIBRARY_FILES } from "./library_files.ts";
import type { LibraryFileCache, LibraryFileText } from "./library_files.ts";
import { LOAD_FAILED } from "./mod_messages.ts";
import { readRequiredText, throwInvalidParams } from "./mod_methods.ts";
import type { ModMethodContext, ModMethodTable } from "./mod_methods.ts";

declare const __MERMAID_VERSION__: string;

/** The shipped mermaid's full version, from its `package.json` when the app was built. */
export const MERMAID_VERSION: string = __MERMAID_VERSION__;

/** A library the app ships and installs in the frames of the mods that ask for it. */
export interface ShippedLibrary {
  /** The major version a mod asks for. */
  major: string;
  /** The full version, from the library's package.json at build time. */
  version: string;
  /** Loads the library's single-file classic script as text. */
  loadCode: () => Promise<string>;
}

/** The answer of `libs.load` for a shipped library: the frame loader installs `code` and gives the mod the rest. */
export interface LibraryCode {
  name: string;
  version: string;
  code: string;
}

/**
 * The answer of `libs.load` for a declared library: the frame loader installs
 * the scripts and stylesheets, and gives the mod the name, the version and
 * the data files.
 */
export interface DeclaredLibraryFiles {
  name: string;
  /** The declared npm version, or `null` for files next to the mod. */
  version: string | null;
  files: LibraryFileText[];
}

interface RawModule {
  default: string;
}

function readRawText(module: RawModule): string {
  return module.default;
}

/** Mermaid's single-file build, in a chunk of its own the page fetches from the app's host on first use. */
function loadMermaidCode(): Promise<string> {
  return import("mermaid/dist/mermaid.min.js?raw").then(readRawText);
}

/** The libraries mods can load, by name. Adding one is a change of its own. */
export const SHIPPED_LIBRARIES: Record<string, ShippedLibrary> = {
  mermaid: {
    major: "12",
    version: MERMAID_VERSION,
    loadCode: loadMermaidCode,
  },
};

/** The code of each library already requested in this page, by name. */
type LibraryCodeCache = Map<string, Promise<string>>;

/** Checks the major version a request asks of a shipped library, or raises `INVALID_PARAMS`. */
function checkShippedVersion(
  name: string,
  library: ShippedLibrary,
  params: YamlMapping,
): void {
  const version = params.version;
  if (typeof version !== "string") {
    throwInvalidParams(
      "libs.load",
      `"version" must be a string naming a major version, and the app has ${name} ${library.major}`,
    );
  }
  if (version !== library.major) {
    throwInvalidParams(
      "libs.load",
      `the app has ${name} ${library.major}, not ${name} "${version}"`,
    );
  }
}

function findDeclaredLibrary(
  mod: LoadedMod,
  name: string,
): LoadedLibrary | null {
  for (const library of mod.libraries) {
    if (library.name === name) {
      return library;
    }
  }
  return null;
}

function listDeclaredNames(mod: LoadedMod): string {
  const names: string[] = [];
  for (const library of mod.libraries) {
    names.push(library.name);
  }
  if (names.length === 0) {
    return "";
  }
  const declaredNames = ` (it declares ${names.join(", ")})`;
  return declaredNames;
}

/** Raises `INVALID_PARAMS` for a name that is neither shipped nor declared by the requesting mod. */
function throwUnknownLibrary(
  libraries: Record<string, ShippedLibrary>,
  mod: LoadedMod,
  name: string,
): never {
  const shippedNames = Object.keys(libraries).join(", ");
  throwInvalidParams(
    "libs.load",
    `the app has no library "${name}" (it has ${shippedNames}), and the mod declares none of that name${listDeclaredNames(mod)}`,
  );
}

function describeRequestedVersion(version: YamlValue): string {
  return JSON.stringify(version);
}

/**
 * Checks the version a request asks of a declared library: absent, `null`
 * or the declared npm version all name the library. Raises `INVALID_PARAMS`
 * for any other version.
 */
function checkDeclaredVersion(
  library: LoadedLibrary,
  params: YamlMapping,
): void {
  const version = params.version;
  if (
    version === undefined ||
    version === null ||
    version === library.version
  ) {
    return;
  }
  const requested = describeRequestedVersion(version);
  if (library.version === null) {
    throwInvalidParams(
      "libs.load",
      `the library "${library.name}" has no npm version, so "version" must be absent or null, not ${requested}`,
    );
  }
  throwInvalidParams(
    "libs.load",
    `the mod declares ${library.name} ${library.version}, not ${library.name} ${requested}`,
  );
}

/** A failed load leaves the cache, so a later request loads the code again. */
function forgetFailedCode(
  cache: LibraryCodeCache,
  name: string,
  error: unknown,
): never {
  cache.delete(name);
  throw error;
}

/** Loads a library's code once per page: later requests share the first request's promise. */
function loadCodeOnce(
  cache: LibraryCodeCache,
  name: string,
  library: ShippedLibrary,
): Promise<string> {
  const cachedCode = cache.get(name);
  if (cachedCode !== undefined) {
    return cachedCode;
  }
  const code = library
    .loadCode()
    .catch(forgetFailedCode.bind(undefined, cache, name));
  cache.set(name, code);
  return code;
}

/** Answers the code of a shipped library at the major version the request asks for. */
async function loadShippedLibrary(
  libraries: Record<string, ShippedLibrary>,
  cache: LibraryCodeCache,
  name: string,
  params: YamlMapping,
): Promise<LibraryCode> {
  const library = libraries[name];
  checkShippedVersion(name, library, params);
  const code = await loadCodeOnce(cache, name, library);
  const libraryCode: LibraryCode = { name, version: library.version, code };
  return libraryCode;
}

/** Answers the files of a declared library once all of them arrived, or raises `LOAD_FAILED`. */
async function loadDeclaredLibrary(
  libraryFiles: LibraryFileCache,
  context: ModMethodContext,
  library: LoadedLibrary,
  params: YamlMapping,
): Promise<DeclaredLibraryFiles> {
  checkDeclaredVersion(library, params);
  try {
    const files = await fetchLibraryFiles(
      libraryFiles,
      library,
      context.fetchOptions,
    );
    const declaredFiles: DeclaredLibraryFiles = {
      name: library.name,
      version: library.version,
      files,
    };
    return declaredFiles;
  } catch (error) {
    throw new ModMethodError(
      LOAD_FAILED,
      `libs.load: ${describeEngineError(error)}`,
      { cause: error },
    );
  }
}

/**
 * `libs.load { name, version? }`: answers the code of the shipped library
 * `name` at the major version `version`, with its full version, or else the
 * files of the library `name` the requesting mod declares. Raises
 * `INVALID_PARAMS` for a name that is neither, or a version the library does
 * not have, and `LOAD_FAILED` for a declared file that cannot be fetched.
 */
function loadLibrary(
  libraries: Record<string, ShippedLibrary>,
  codeCache: LibraryCodeCache,
  libraryFiles: LibraryFileCache,
  context: ModMethodContext,
  params: YamlMapping,
): Promise<LibraryCode | DeclaredLibraryFiles> {
  const name = readRequiredText(params, "name", "libs.load");
  if (Object.hasOwn(libraries, name)) {
    return loadShippedLibrary(libraries, codeCache, name, params);
  }
  const declaredLibrary = findDeclaredLibrary(context.mod, name);
  if (declaredLibrary === null) {
    throwUnknownLibrary(libraries, context.mod, name);
  }
  return loadDeclaredLibrary(libraryFiles, context, declaredLibrary, params);
}

/**
 * The `libs.*` requests for a table of shipped libraries, each loaded once by
 * the table, and the mods' declared libraries, each file fetched once through
 * `libraryFiles`.
 */
export function buildLibsMethods(
  libraries: Record<string, ShippedLibrary>,
  libraryFiles: LibraryFileCache,
): ModMethodTable {
  const codeCache: LibraryCodeCache = new Map();
  const methods: ModMethodTable = {
    "libs.load": loadLibrary.bind(
      undefined,
      libraries,
      codeCache,
      libraryFiles,
    ),
  };
  return methods;
}

/**
 * The `libs.*` requests: the libraries the app ships and the ones mods
 * declare, which frames install. Declared files go through the page's cache.
 */
export const LIBS_METHODS: ModMethodTable = buildLibsMethods(
  SHIPPED_LIBRARIES,
  PAGE_LIBRARY_FILES,
);
