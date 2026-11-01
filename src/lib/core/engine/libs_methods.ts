import type { YamlMapping } from "../../files/index.ts";
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

/** The answer of `libs.load`: the frame loader installs `code` and gives the mod the rest. */
export interface LibraryCode {
  name: string;
  version: string;
  code: string;
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

function readShippedLibrary(
  libraries: Record<string, ShippedLibrary>,
  params: YamlMapping,
): [string, ShippedLibrary] {
  const name = readRequiredText(params, "name", "libs.load");
  if (!Object.hasOwn(libraries, name)) {
    const names = Object.keys(libraries).join(", ");
    throwInvalidParams(
      "libs.load",
      `the app has no library "${name}" (it has ${names})`,
    );
  }
  const library = libraries[name];
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
  const shippedLibrary: [string, ShippedLibrary] = [name, library];
  return shippedLibrary;
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

/**
 * `libs.load { name, version }`: answers the code of the shipped library
 * `name` at the major version `version`, with its full version. Raises
 * `INVALID_PARAMS` for a library or a major version the app does not ship.
 */
async function loadLibrary(
  libraries: Record<string, ShippedLibrary>,
  cache: LibraryCodeCache,
  _context: ModMethodContext,
  params: YamlMapping,
): Promise<LibraryCode> {
  const [name, library] = readShippedLibrary(libraries, params);
  const code = await loadCodeOnce(cache, name, library);
  const libraryCode: LibraryCode = { name, version: library.version, code };
  return libraryCode;
}

/** The `libs.*` requests for a table of libraries, each loaded once by the table. */
export function buildLibsMethods(
  libraries: Record<string, ShippedLibrary>,
): ModMethodTable {
  const cache: LibraryCodeCache = new Map();
  const methods: ModMethodTable = {
    "libs.load": loadLibrary.bind(undefined, libraries, cache),
  };
  return methods;
}

/** The `libs.*` requests: the libraries the app ships, which frames install. */
export const LIBS_METHODS: ModMethodTable = buildLibsMethods(SHIPPED_LIBRARIES);
