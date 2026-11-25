import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bundleDefaultMod,
  listDefaultModNames,
  readDefaultModFileAddress,
} from "../../build/default_mod_build.ts";
import type { ServedModFile } from "../../build/default_mod_build.ts";

/** Base URL under which `fetchAppFile` serves the files of `public/`: the app's address in tests. */
export const APP_BASE_URL = "https://example.org/";

/**
 * Base URL under which `fetchFixture` and `fetchAppFile` serve the files of
 * `src/test/fixtures/`. It is on the app's origin, so fixture mods get the
 * permissions of mods from the app's origin.
 */
export const FIXTURES_BASE_URL = `${APP_BASE_URL}fixtures/`;

/**
 * `./fixtures/`: the app-relative form of the fixtures root, as run links and
 * mod references write it. It resolves to `FIXTURES_BASE_URL` against `APP_BASE_URL`.
 */
export const FIXTURES_REFERENCE = "./fixtures/";

const PROJECT_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

/**
 * `public/` on disk. Built from a path rather than `new URL("…", import.meta.url)`,
 * which Vite rewrites into a served URL for files under `public/`.
 */
const PUBLIC_DIRECTORY = join(PROJECT_DIRECTORY, "public");

/** `default_mods/` on disk: the source of the default mods, which `fetchAppFile` builds like the app's build does. */
const DEFAULT_MODS_DIRECTORY = join(PROJECT_DIRECTORY, "default_mods");

/** The path, below `APP_BASE_URL`, where the app serves the default mods. */
const DEFAULT_MODS_PATHNAME = "/default_mods/";

/** The built files of each default mod, by mod name: each mod is built once per test run. */
const builtDefaultMods = new Map<string, Promise<ServedModFile[]>>();

/** `src/test/fixtures/` on disk: the files unit tests read, apart from the shipped sample. */
const FIXTURES_DIRECTORY = join(PROJECT_DIRECTORY, "src", "test", "fixtures");

/** Reads a file under `src/test/fixtures/` from disk, e.g. `tiles/books/kallocain.md`. */
export function readFixtureText(relativePath: string): string {
  const fixtureText = readFileSync(
    join(FIXTURES_DIRECTORY, relativePath),
    "utf8",
  );
  return fixtureText;
}

function readRequestedUrl(input: RequestInfo | URL): string {
  if (input instanceof Request) {
    return input.url;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input;
}

function buildNotFoundResponse(): Response {
  const notFoundResponse = new Response("Not Found", {
    status: 404,
    statusText: "Not Found",
  });
  return notFoundResponse;
}

/** Answers with the text of a file on disk, or `404 Not Found` when it cannot be read. */
async function readFileResponse(filePath: string): Promise<Response> {
  try {
    const fileText = await readFile(filePath, "utf8");
    const fileResponse = new Response(fileText, { status: 200 });
    return fileResponse;
  } catch {
    return buildNotFoundResponse();
  }
}

function readBuiltDefaultMod(modName: string): Promise<ServedModFile[]> {
  const cachedMod = builtDefaultMods.get(modName);
  if (cachedMod !== undefined) {
    return cachedMod;
  }
  const builtMod = bundleDefaultMod(join(DEFAULT_MODS_DIRECTORY, modName));
  builtDefaultMods.set(modName, builtMod);
  return builtMod;
}

function findServedContent(
  servedFiles: ServedModFile[],
  path: string,
): Uint8Array<ArrayBuffer> | null {
  for (const servedFile of servedFiles) {
    if (servedFile.path === path) {
      return servedFile.content;
    }
  }
  return null;
}

/**
 * Answers with a file of a default mod, built from `default_mods/` like the
 * app's build does (build/default_mod_build.ts), with `500` and the error
 * when the mod cannot be built, like the dev server.
 */
async function readDefaultModResponse(modsPath: string): Promise<Response> {
  const fileAddress = readDefaultModFileAddress(modsPath);
  if (
    !listDefaultModNames(DEFAULT_MODS_DIRECTORY).includes(fileAddress.modName)
  ) {
    return buildNotFoundResponse();
  }
  try {
    const servedFiles = await readBuiltDefaultMod(fileAddress.modName);
    const servedContent = findServedContent(servedFiles, fileAddress.path);
    if (servedContent === null) {
      return buildNotFoundResponse();
    }
    const fileResponse = new Response(servedContent, { status: 200 });
    return fileResponse;
  } catch (error) {
    const errorResponse = new Response(String(error), { status: 500 });
    return errorResponse;
  }
}

/** Answers with the fixture file for a URL below `FIXTURES_BASE_URL`. */
async function readFixtureResponse(requestedUrl: string): Promise<Response> {
  const relativePath = requestedUrl.slice(FIXTURES_BASE_URL.length);
  const fixtureResponse = await readFileResponse(
    join(FIXTURES_DIRECTORY, decodeURIComponent(relativePath)),
  );
  return fixtureResponse;
}

/**
 * Test-only fetch: serves the file under `src/test/fixtures/` for URLs below
 * `FIXTURES_BASE_URL`, and answers `404 Not Found` for anything else.
 */
export async function fetchFixture(
  input: RequestInfo | URL,
): Promise<Response> {
  const requestedUrl = readRequestedUrl(input);
  if (!requestedUrl.startsWith(FIXTURES_BASE_URL)) {
    return buildNotFoundResponse();
  }
  const fixtureResponse = await readFixtureResponse(requestedUrl);
  return fixtureResponse;
}

/**
 * Test-only fetch: serves the file under `public/` for URLs below
 * `APP_BASE_URL`, like the built app does, and answers `404 Not Found` for
 * anything else. Two folders are exceptions. URLs below
 * `${APP_BASE_URL}default_mods/` get the default mods built from
 * `default_mods/`, as the app's build gives them. URLs below
 * `FIXTURES_BASE_URL` are served from `src/test/fixtures/`, at the same URLs
 * as `fetchFixture`. `public/` has no `fixtures/` folder, so no file is hidden.
 * Only the sample smoke test reads the shipped sample, at `${APP_BASE_URL}samples/`.
 */
export async function fetchAppFile(
  input: RequestInfo | URL,
): Promise<Response> {
  const requestedUrl = new URL(readRequestedUrl(input));
  if (requestedUrl.href.startsWith(FIXTURES_BASE_URL)) {
    const fixtureResponse = await readFixtureResponse(requestedUrl.href);
    return fixtureResponse;
  }
  if (!requestedUrl.href.startsWith(APP_BASE_URL)) {
    return buildNotFoundResponse();
  }
  const pathname = decodeURIComponent(requestedUrl.pathname);
  if (pathname.startsWith(DEFAULT_MODS_PATHNAME)) {
    const defaultModResponse = await readDefaultModResponse(
      pathname.slice(DEFAULT_MODS_PATHNAME.length),
    );
    return defaultModResponse;
  }
  const publicResponse = await readFileResponse(
    join(PUBLIC_DIRECTORY, pathname),
  );
  return publicResponse;
}
