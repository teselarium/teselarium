import { readFileSync } from "node:fs";
import type { Page, Route } from "@playwright/test";
import { buildPassedResults } from "./mod_routes.ts";
import type { CheckTestResult } from "./mod_routes.ts";

/** `/samples/mods`: the folder of the shipped sample mods on the app's server. */
const SAMPLE_MODS_PATH = "/samples/mods";

/** `/samples/mods/book_list`: the folder of the shipped sample book list mod. */
export const SAMPLE_MOD_FOLDER_PATH = `${SAMPLE_MODS_PATH}/book_list`;

/** `/samples/mods/book_list/mod_conf.yaml`: the sample mod's file. */
export const SAMPLE_MOD_FILE_PATH = `${SAMPLE_MOD_FOLDER_PATH}/mod_conf.yaml`;

/** `/samples/mods/book_list/main.js`: the sample mod's entrypoint. */
export const SAMPLE_ENTRYPOINT_PATH = `${SAMPLE_MOD_FOLDER_PATH}/main.js`;

/**
 * The text of the sample mod's entrypoint, to serve it in a test mod of
 * another folder. It is read when a test asks for it, not when this file is
 * imported, so the other tests load without the samples.
 */
export function readSampleEntrypointCode(): string {
  const code = readFileSync(
    new URL(`../public${SAMPLE_ENTRYPOINT_PATH}`, import.meta.url),
    "utf8",
  );
  return code;
}

/** `/samples/mods/book_list/test.js`: the sample mod's test file. */
export const SAMPLE_TEST_PATH = `${SAMPLE_MOD_FOLDER_PATH}/test.js`;

/** `/samples/mods/book_list/book_type.md`: the sample mod's tile type, `book`. */
export const SAMPLE_TYPE_PATH = `${SAMPLE_MOD_FOLDER_PATH}/book_type.md`;

/** `/samples/mods/book_list/book_collection.yaml`: the sample collection of three books. */
export const SAMPLE_COLLECTION_PATH = `${SAMPLE_MOD_FOLDER_PATH}/book_collection.yaml`;

/** `/samples/mods/book_list/books`: the folder of the sample book tiles. */
export const SAMPLE_BOOKS_FOLDER_PATH = `${SAMPLE_MOD_FOLDER_PATH}/books`;

/** `/samples/mods/missing/mod_conf.yaml`: the mod file of `MISSING_MOD_REFERENCE`, which answers `404 Not Found`. */
export const MISSING_MOD_FILE_PATH = `${SAMPLE_MODS_PATH}/missing/mod_conf.yaml`;

/** `/samples/mods/book_list/missing.yaml`: a collection next to the sample mod that does not exist. */
export const MISSING_COLLECTION_PATH = `${SAMPLE_MOD_FOLDER_PATH}/missing.yaml`;

/** `./samples/mods/book_list`: the sample mod as a run link names it. */
export const SAMPLE_MOD_REFERENCE = `.${SAMPLE_MOD_FOLDER_PATH}`;

/** `./samples/mods/book_list/book_collection.yaml`: the sample collection as a run link names it. */
export const SAMPLE_COLLECTION_REFERENCE = `.${SAMPLE_COLLECTION_PATH}`;

/** `./samples/mods/missing`: a mod folder that does not exist. */
export const MISSING_MOD_REFERENCE = `.${SAMPLE_MODS_PATH}/missing`;

/** `./samples/mods/book_list/missing.yaml`: a collection that does not exist. */
export const MISSING_COLLECTION_REFERENCE = `.${MISSING_COLLECTION_PATH}`;

/** `#/run?mod=./samples/mods/book_list`: the run link of the sample mod without tiles. */
export const SAMPLE_RUN_HASH = `#/run?mod=${SAMPLE_MOD_REFERENCE}`;

/**
 * `#/run?mod=./samples/mods/book_list&collection=./samples/mods/book_list/book_collection.yaml`:
 * the run link of the sample mod on the sample collection.
 */
export const SAMPLE_COLLECTION_RUN_HASH = `${SAMPLE_RUN_HASH}&collection=${SAMPLE_COLLECTION_REFERENCE}`;

/** `**\/samples/mods/book_list/main.js`: the route glob of the sample mod's entrypoint. */
export const SAMPLE_ENTRYPOINT_GLOB = `**${SAMPLE_ENTRYPOINT_PATH}`;

/** `**\/samples/mods/book_list/book_collection.yaml`: the route glob of the sample collection. */
export const SAMPLE_COLLECTION_GLOB = `**${SAMPLE_COLLECTION_PATH}`;

/** The sample mod's source on the page's origin, e.g. `http://localhost:4173/samples/mods/book_list/mod_conf.yaml`. */
export function readSampleModSource(page: Page): string {
  const sampleModSource = new URL(SAMPLE_MOD_FILE_PATH, page.url()).href;
  return sampleModSource;
}

/** The cases of the sample mod's test file, in the order it registers them. */
export const SAMPLE_CASE_NAMES = [
  "lists the sample books",
  "shows a placeholder without an image",
  "shows placeholders when covers are off",
  "names each book by title and authors",
  "uses the config's books per row",
  "ignores an unknown books per row",
  "remembers the books per row",
  "ignores an unknown stored books per row",
  "has no select without books",
  "opens the card of a clicked book",
  "leaves out missing metadata",
  "shows a date without a year as written",
  "shows no small book without a cover",
  "marks the book whose card is open",
  "unmarks the book when its card closes",
];

/** The report's `tests` when every case of the sample mod passes. */
export const SAMPLE_TEST_RESULTS: CheckTestResult[] =
  buildPassedResults(SAMPLE_CASE_NAMES);

/** `/samples/mods/flashcards`: the folder of the shipped sample flashcards mod. */
export const FLASHCARDS_FOLDER_PATH = `${SAMPLE_MODS_PATH}/flashcards`;

/** `/samples/mods/flashcards/mod_conf.yaml`: the flashcards mod's file. */
export const FLASHCARDS_MOD_FILE_PATH = `${FLASHCARDS_FOLDER_PATH}/mod_conf.yaml`;

/** The flashcards mod's source on the page's origin, e.g. `http://localhost:4173/samples/mods/flashcards/mod_conf.yaml`. */
export function readFlashcardsModSource(page: Page): string {
  const flashcardsModSource = new URL(FLASHCARDS_MOD_FILE_PATH, page.url())
    .href;
  return flashcardsModSource;
}

/** `/samples/mods/flashcards/flashcard_collection.yaml`: the sample deck of eight cards. */
export const FLASHCARDS_COLLECTION_PATH = `${FLASHCARDS_FOLDER_PATH}/flashcard_collection.yaml`;

/** `/samples/mods/flashcards/cards`: the folder of the sample deck's tiles. */
export const FLASHCARDS_CARDS_FOLDER_PATH = `${FLASHCARDS_FOLDER_PATH}/cards`;

/** `./samples/mods/flashcards`: the flashcards mod as a run link names it. */
export const FLASHCARDS_MOD_REFERENCE = `.${FLASHCARDS_FOLDER_PATH}`;

/** `./samples/mods/flashcards/flashcard_collection.yaml`: the sample deck as a run link names it. */
export const FLASHCARDS_COLLECTION_REFERENCE = `.${FLASHCARDS_COLLECTION_PATH}`;

/** `#/run?mod=./samples/mods/flashcards`: the run link of the flashcards mod without tiles. */
export const FLASHCARDS_RUN_HASH = `#/run?mod=${FLASHCARDS_MOD_REFERENCE}`;

/**
 * `#/run?mod=./samples/mods/flashcards&collection=./samples/mods/flashcards/flashcard_collection.yaml`:
 * the run link of the flashcards mod on the sample deck.
 */
export const FLASHCARDS_COLLECTION_RUN_HASH = `${FLASHCARDS_RUN_HASH}&collection=${FLASHCARDS_COLLECTION_REFERENCE}`;

/** `**\/samples/mods/flashcards/flashcard_collection.yaml`: the route glob of the sample deck. */
export const FLASHCARDS_COLLECTION_GLOB = `**${FLASHCARDS_COLLECTION_PATH}`;

/** `/samples/mods/country_map`: the folder of the shipped sample country map mod. */
export const COUNTRY_MAP_FOLDER_PATH = `${SAMPLE_MODS_PATH}/country_map`;

/** `/samples/mods/country_map/mod_conf.yaml`: the country map mod's file. */
export const COUNTRY_MAP_MOD_FILE_PATH = `${COUNTRY_MAP_FOLDER_PATH}/mod_conf.yaml`;

/** The country map mod's source on the page's origin, e.g. `http://localhost:4173/samples/mods/country_map/mod_conf.yaml`. */
export function readCountryMapModSource(page: Page): string {
  const countryMapModSource = new URL(COUNTRY_MAP_MOD_FILE_PATH, page.url())
    .href;
  return countryMapModSource;
}

/** `/samples/tiles/literature_nobel_laureates_books/collection.yaml`: the country map's sample collection of 51 books. */
export const COUNTRY_MAP_COLLECTION_PATH =
  "/samples/tiles/literature_nobel_laureates_books/collection.yaml";

/** `/samples/tiles/literature_nobel_laureates_books`: the folder of the sample books. */
export const COUNTRY_MAP_BOOKS_FOLDER_PATH =
  "/samples/tiles/literature_nobel_laureates_books";

/** `./samples/mods/country_map`: the country map mod as a run link names it. */
export const COUNTRY_MAP_MOD_REFERENCE = `.${COUNTRY_MAP_FOLDER_PATH}`;

/** `./samples/tiles/literature_nobel_laureates_books/collection.yaml`: the sample books as a run link names them. */
export const COUNTRY_MAP_COLLECTION_REFERENCE = `.${COUNTRY_MAP_COLLECTION_PATH}`;

/** `#/run?mod=./samples/mods/country_map`: the run link of the country map mod without tiles. */
export const COUNTRY_MAP_RUN_HASH = `#/run?mod=${COUNTRY_MAP_MOD_REFERENCE}`;

/**
 * `#/run?mod=./samples/mods/country_map&collection=./samples/tiles/literature_nobel_laureates_books/collection.yaml`:
 * the run link of the country map mod on the sample books.
 */
export const COUNTRY_MAP_COLLECTION_RUN_HASH = `${COUNTRY_MAP_RUN_HASH}&collection=${COUNTRY_MAP_COLLECTION_REFERENCE}`;

/** `**\/samples/tiles/literature_nobel_laureates_books/collection.yaml`: the route glob of the sample books. */
export const COUNTRY_MAP_COLLECTION_GLOB = `**${COUNTRY_MAP_COLLECTION_PATH}`;

/** The vanilla app's npm host, which `routeNpmFiles` answers. */
export const NPM_HOST = "https://cdn.jsdelivr.net/npm/";

/**
 * `e2e/npm_files/`: exact copies of the npm files the country map declares,
 * as `<package>@<version>/<path>`, with each package's license.
 */
const NPM_FILES_FOLDER = new URL("./npm_files/", import.meta.url);

const NPM_CONTENT_TYPES: Record<string, string> = {
  js: "application/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
};

/** A request the routed npm host saw, and whether the app's page made it rather than a mod's frame. */
export interface NpmRequest {
  url: string;
  isFromPage: boolean;
}

/** How `routeNpmFiles` changes its answers. */
export interface NpmRouteOptions {
  /** Paths under the host it answers with a 404, as if the package had no such file. */
  missingPaths?: string[];
  /** Code it appends to the copy of a file, by path under the host, such as a hook that keeps Leaflet's map for a test to read. */
  appendedCode?: Record<string, string>;
}

function readNpmContentType(path: string): string {
  const extension = path.slice(path.lastIndexOf(".") + 1);
  const contentType =
    NPM_CONTENT_TYPES[extension] ?? "application/octet-stream";
  return contentType;
}

/** jsDelivr's text for a missing file, as in `Couldn't find the requested file /dist/leaflet.js in leaflet.` */
function describeMissingNpmFile(path: string): string {
  const versionStart = path.indexOf("@", 1);
  const fileStart = path.indexOf("/", versionStart);
  const missingFile = `Couldn't find the requested file ${path.slice(fileStart)} in ${path.slice(0, versionStart)}.`;
  return missingFile;
}

/** The copy of an npm file, or `null` when `e2e/npm_files/` has none or the route treats it as missing. */
function readNpmFileCopy(
  path: string,
  options: NpmRouteOptions,
): Buffer | null {
  if (options.missingPaths?.includes(path) === true) {
    return null;
  }
  let copy: Buffer;
  try {
    copy = readFileSync(new URL(path, NPM_FILES_FOLDER));
  } catch {
    return null;
  }
  const appendedCode = options.appendedCode?.[path];
  if (appendedCode === undefined) {
    return copy;
  }
  const changedCopy = Buffer.concat([copy, Buffer.from(`\n${appendedCode}\n`)]);
  return changedCopy;
}

async function answerNpmFile(
  page: Page,
  requests: NpmRequest[],
  options: NpmRouteOptions,
  route: Route,
): Promise<void> {
  const request = route.request();
  requests.push({
    url: request.url(),
    isFromPage: request.frame() === page.mainFrame(),
  });
  const path = decodeURIComponent(
    new URL(request.url()).pathname.slice("/npm/".length),
  );
  const headers = { "Access-Control-Allow-Origin": "*" };
  const copy = readNpmFileCopy(path, options);
  if (copy === null) {
    await route.fulfill({
      status: 404,
      headers,
      contentType: "text/plain; charset=utf-8",
      body: describeMissingNpmFile(path),
    });
    return;
  }
  await route.fulfill({
    status: 200,
    headers,
    contentType: readNpmContentType(path),
    body: copy,
  });
}

/**
 * Answers `https://cdn.jsdelivr.net/npm/**` from `e2e/npm_files/`, so no test
 * reaches the network, and a file it has no copy of with a 404 and
 * jsDelivr's text. Returns the requests the host saw.
 */
export async function routeNpmFiles(
  page: Page,
  options: NpmRouteOptions = {},
): Promise<NpmRequest[]> {
  const requests: NpmRequest[] = [];
  await page.route(
    `${NPM_HOST}**`,
    answerNpmFile.bind(undefined, page, requests, options),
  );
  return requests;
}
