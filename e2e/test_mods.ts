import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { Frame, Page } from "@playwright/test";
import {
  APP_ORIGIN_MOD_PATH,
  buildPassedResults,
  buildProbeFiles,
  buildTestCode,
  findModFrame,
  routeCovers,
  serveAppOriginMod,
  waitForProbe,
} from "./mod_routes.ts";
import type { CheckTestResult, ModFiles } from "./mod_routes.ts";

/*
 * The mods the e2e tests own, so the tests of the engine, the stage, the
 * default mods and the app need no shipped sample (docs/code_conventions.md,
 * Tests):
 * - the probe: a mod that keeps its engine API object on `globalThis.probe`
 * - the typed probe: the probe with a `note` tile type and two notes
 * - the tiles mod: the files of `e2e/test_mods/tiles/`, with a tile type, a
 *   default mosaic with a collection of three items, a `show` host, a config key, a storage
 *   key and a test file
 */

/** `/#/run?mod=./test-mods/probe/`: the run link of the probe on the app's origin. */
export const PROBE_LINK = `/#/run?mod=.${APP_ORIGIN_MOD_PATH}probe/`;

/** Opens the probe from the app's origin, with `extraLines` in its mod file, and waits for its mount. */
export async function openProbe(
  page: Page,
  extraLines: string[] = [],
  title: string = "probe",
): Promise<Frame> {
  await serveAppOriginMod(page, buildProbeFiles("probe", extraLines));
  await page.goto(PROBE_LINK);
  const frame = await findModFrame(page, title);
  await waitForProbe(frame);
  return frame;
}

/** `note`: the typed probe's tile type, a title and nothing else. */
export const NOTE_TYPE = [
  "---",
  "schema:",
  "  definitions:",
  "    note:",
  "      properties:",
  "        title:",
  "          type: string",
  "  ref: note",
  "---",
  "",
  "# Note",
  "",
].join("\n");

/** A tile of the `note` type, titled `title`. */
export function buildNoteTile(title: string): string {
  const tile = [
    "---",
    `title: "${title}"`,
    "---",
    "",
    "A probe note.",
    "",
  ].join("\n");
  return tile;
}

/**
 * The typed probe: a probe of the `note` type, so a collection can be opened
 * with it, with two notes under `/test-mods/` for its collections, `first.md`
 * ("First note") and `second.md` ("Second note").
 */
export function buildTypedProbeFiles(): ModFiles {
  const files = buildProbeFiles("probe", ['  type_path: "./note_type.md"']);
  files["probe/note_type.md"] = NOTE_TYPE;
  files["first.md"] = buildNoteTile("First note");
  files["second.md"] = buildNoteTile("Second note");
  return files;
}

/** A collection of the first note, followed by `extraPaths`, relative to `/test-mods/`. */
export function buildNoteCollection(extraPaths: string[]): string {
  const lines = [
    "collection:",
    '  title: "Probe notes"',
    "  tiles:",
    '    - path: "./first.md"',
  ];
  for (const path of extraPaths) {
    lines.push(`    - path: "${path}"`);
  }
  const collection = lines.join("\n");
  return collection;
}

/** `./test-mods/collection.yaml`: the collection `openTypedProbe` opens, which a test puts in its files. */
export const TYPED_PROBE_COLLECTION_REFERENCE = `.${APP_ORIGIN_MOD_PATH}collection.yaml`;

/**
 * Serves `files`, which a test can change before a reload, and opens the
 * typed probe with `collection.yaml`. Waits for its mount.
 */
export async function openTypedProbe(
  page: Page,
  files: ModFiles,
): Promise<Frame> {
  await serveAppOriginMod(page, files);
  await page.goto(
    `${PROBE_LINK}&collection=${TYPED_PROBE_COLLECTION_REFERENCE}`,
  );
  const frame = await findModFrame(page, "probe");
  await waitForProbe(frame);
  return frame;
}

/** `tiles`: the tiles mod's folder under `/test-mods/`. */
const TILES_FOLDER = "tiles";

/** The folder of the tiles mod's files in the repository. */
const TILES_FILES_URL = new URL("./test_mods/tiles/", import.meta.url);

/** The paths of the files under `folderUrl`, relative to it, subfolders included. */
function listFilePaths(folderUrl: URL): string[] {
  const folderPath = fileURLToPath(folderUrl);
  const paths: string[] = [];
  const entries = readdirSync(folderPath, {
    recursive: true,
    withFileTypes: true,
  });
  for (const entry of entries) {
    if (entry.isFile()) {
      paths.push(relative(folderPath, join(entry.parentPath, entry.name)));
    }
  }
  return paths;
}

/**
 * The tiles mod's files in the folder `folder/`, read from
 * `e2e/test_mods/tiles/`, for `serveAppOriginMod`.
 */
export function buildTilesModFiles(folder: string = TILES_FOLDER): ModFiles {
  const files: ModFiles = {};
  for (const path of listFilePaths(TILES_FILES_URL)) {
    files[`${folder}/${path}`] = readFileSync(
      new URL(path, TILES_FILES_URL),
      "utf8",
    );
  }
  return files;
}

/**
 * The tiles mod in the folder `folder/`, with `testCode` as its test file
 * instead of its own.
 */
export function buildTilesCaseFiles(
  folder: string,
  testCode: string,
): ModFiles {
  const files: ModFiles = {
    ...buildTilesModFiles(folder),
    [`${folder}/test.js`]: testCode,
  };
  return files;
}

/** `Tiles`: the tiles mod's title, which is its frame's title. */
export const TILES_TITLE = "Tiles";

/** `1.0.0`: the tiles mod's version. */
export const TILES_VERSION = "1.0.0";

/** The titles of the three items of the tiles mod's default mosaic, in its order. */
export const TILES_ITEM_TITLES = ["First item", "Second item", "Third item"];

/** `/test-mods/tiles`: the tiles mod's folder on the app's origin. */
export const TILES_FOLDER_PATH = `${APP_ORIGIN_MOD_PATH}${TILES_FOLDER}`;

/** `/test-mods/tiles/mod_conf.yaml`: the tiles mod's file. */
export const TILES_MOD_FILE_PATH = `${TILES_FOLDER_PATH}/mod_conf.yaml`;

/** `/test-mods/tiles/main.js`: the tiles mod's entrypoint. */
export const TILES_ENTRYPOINT_PATH = `${TILES_FOLDER_PATH}/main.js`;

/** `/test-mods/tiles/test.js`: the tiles mod's test file. */
export const TILES_TEST_PATH = `${TILES_FOLDER_PATH}/test.js`;

/** `/test-mods/tiles/item_collection.yaml`: the collection of three items of the tiles mod's default mosaic. */
export const TILES_COLLECTION_PATH = `${TILES_FOLDER_PATH}/item_collection.yaml`;

/** `./test-mods/tiles/`: the tiles mod as a run link names it. */
export const TILES_MOD_REFERENCE = `.${TILES_FOLDER_PATH}/`;

/** `./test-mods/tiles/item_collection.yaml`: the tiles mod's collection of three items as a run link names it. */
export const TILES_COLLECTION_REFERENCE = `.${TILES_COLLECTION_PATH}`;

/** `./test-mods/mosaics/labels.yaml`: the labels mosaic as a run link names it. */
export const LABELS_MOSAIC_REFERENCE = `.${APP_ORIGIN_MOD_PATH}mosaics/labels.yaml`;

/** `/test-mods/mosaics/labels.yaml`: the labels mosaic's file. */
export const LABELS_MOSAIC_PATH = `${APP_ORIGIN_MOD_PATH}mosaics/labels.yaml`;

/** `#/run?mosaic=./test-mods/mosaics/labels.yaml`: the run link of the labels mosaic. */
export const LABELS_MOSAIC_HASH = `#/run?mosaic=${LABELS_MOSAIC_REFERENCE}`;

/** `Labelled items`: the labels mosaic's title. */
export const LABELS_MOSAIC_TITLE = "Labelled items";

/** `/test-mods/mosaics/labels/collection.yaml`: the labels mosaic's collection, which a test can change before a reload. */
export const LABELS_COLLECTION_FILE = "mosaics/labels/collection.yaml";

/** A tile that writes its title under `label`, which the item type does not know. */
export function buildLabelledTile(label: string): string {
  const tile = ["---", `label: "${label}"`, "---", "", "A labelled tile.", ""];
  return tile.join("\n");
}

/** The labels mosaic's collection: the labelled tiles `first.md`, then `extraPaths`, relative to it. */
export function buildLabelsCollection(extraPaths: string[] = []): string {
  const lines = [
    "collection:",
    '  title: "Labelled tiles"',
    "  tiles:",
    '    - path: "./first.md"',
  ];
  for (const path of extraPaths) {
    lines.push(`    - path: "${path}"`);
  }
  return lines.join("\n");
}

/**
 * The labels mosaic, served with `serveTilesMod`: the tiles mod with a
 * collection folder whose tiles write their title under `label`, renamed to
 * `title` by the mosaic's aliases, and a config that hides the images. Its
 * collection holds `first.md` ("First label"); `second.md` ("Second label")
 * is next to it for a test to add.
 */
export function buildLabelsMosaicFiles(): ModFiles {
  const files: ModFiles = {
    "mosaics/labels.yaml": [
      "mosaic:",
      `  title: "${LABELS_MOSAIC_TITLE}"`,
      '  description: "The tiles mod on labelled tiles."',
      '  mod: "../tiles/"',
      '  collection: "./labels"',
      "  config:",
      "    show_images: false",
      "  aliases:",
      '    title: ["label"]',
    ].join("\n"),
    [LABELS_COLLECTION_FILE]: buildLabelsCollection(),
    "mosaics/labels/first.md": buildLabelledTile("First label"),
    "mosaics/labels/second.md": buildLabelledTile("Second label"),
  };
  return files;
}

/** `#/run?mod=./test-mods/tiles/`: the run link of the tiles mod without tiles. */
export const TILES_RUN_HASH = `#/run?mod=${TILES_MOD_REFERENCE}`;

/** `#/run?mod=./test-mods/tiles/&collection=./test-mods/tiles/item_collection.yaml`: the tiles mod on its collection of three items. */
export const TILES_COLLECTION_RUN_HASH = `${TILES_RUN_HASH}&collection=${TILES_COLLECTION_REFERENCE}`;

/** `**\/test-mods/tiles/item_collection.yaml`: the route glob of the tiles mod's collection of three items. */
export const TILES_COLLECTION_GLOB = `**${TILES_COLLECTION_PATH}`;

/** The tiles mod's source on the page's origin, e.g. `http://127.0.0.1:4173/test-mods/tiles/mod_conf.yaml`. */
export function readTilesModSource(page: Page): string {
  const tilesModSource = new URL(TILES_MOD_FILE_PATH, page.url()).href;
  return tilesModSource;
}

/** `/test-mods/tiles/mosaic.yaml`: the tiles mod's default mosaic, with its three items. */
export const TILES_MOSAIC_PATH = `${TILES_FOLDER_PATH}/mosaic.yaml`;

/** The address of the tiles mod's default mosaic on the page's origin. */
export function readTilesMosaicSource(page: Page): string {
  const tilesMosaicSource = new URL(TILES_MOSAIC_PATH, page.url()).href;
  return tilesMosaicSource;
}

/** The cases of the tiles mod's test file, in the order it registers them. */
export const TILES_CASE_NAMES = [
  "lists the tiles",
  "hides the images when they are off",
];

/** The report's `tests` when every case of the tiles mod passes. */
export const TILES_TEST_RESULTS: CheckTestResult[] =
  buildPassedResults(TILES_CASE_NAMES);

/**
 * Serves the tiles mod at `/test-mods/tiles/`, with `extraFiles` under
 * `/test-mods/`, on the app's origin, and answers its images. Any other path
 * under `/test-mods/` answers `404 Not Found`. Returns the URLs the route saw.
 */
export async function serveTilesMod(
  page: Page,
  extraFiles: ModFiles = {},
): Promise<string[]> {
  await routeCovers(page);
  const seenUrls = await serveAppOriginMod(page, {
    ...buildTilesModFiles(),
    ...extraFiles,
  });
  return seenUrls;
}

/**
 * Serves the tiles mod and opens it at `hash`, its collection of three items unless
 * given, and waits for its mount.
 */
export async function openTilesMod(
  page: Page,
  hash: string = TILES_COLLECTION_RUN_HASH,
): Promise<Frame> {
  await serveTilesMod(page);
  await page.goto(`/${hash}`);
  const frame = await findModFrame(page, TILES_TITLE);
  await waitForProbe(frame);
  return frame;
}

/**
 * Serves the tiles mod, which the catalog of the `e2e-test-catalog` build
 * lists, so its mod explorer at `TEST_CATALOG_PREVIEW_URL` lists `Tiles`.
 */
export async function serveExplorerOfTilesMod(page: Page): Promise<void> {
  await serveTilesMod(page);
}

/**
 * Serves the tiles mod and the labels mosaic, which the catalog of the
 * `e2e-test-catalog` build lists, so its mosaic explorer at
 * `TEST_CATALOG_PREVIEW_URL` lists the labels mosaic.
 */
export async function serveMosaicExplorerOfLabels(page: Page): Promise<void> {
  await serveTilesMod(page, buildLabelsMosaicFiles());
}

/**
 * `./test-mods/missing`: a mod folder that does not exist. Its mod file
 * answers `404 Not Found` once `serveAppOriginMod` or `serveTilesMod` serves
 * `/test-mods/`.
 */
export const MISSING_TEST_MOD_REFERENCE = `.${APP_ORIGIN_MOD_PATH}missing`;

/** `/test-mods/missing/mod_conf.yaml`: the mod file of `MISSING_TEST_MOD_REFERENCE`. */
export const MISSING_TEST_MOD_FILE_PATH = `${APP_ORIGIN_MOD_PATH}missing/mod_conf.yaml`;

/**
 * The case context on the tiles mod: seeded storage, the request record, a
 * config override, other tiles and mounting twice.
 */
export const TILES_CONTEXT_TEST_CODE = buildTestCode(
  [
    "async function readsTheSeededStarts(context) {",
    '  await context.storage.set("starts", 4);',
    "  await context.mount();",
    '  const starts = context.root.querySelector("[data-starts]");',
    '  context.expect(starts.textContent).toBe("Started 4 times before");',
    "}",
    "",
    "function listStorageRequests(context) {",
    "  const storageRequests = [];",
    "  for (const request of context.requests) {",
    '    if (request.method.startsWith("storage.")) {',
    "      storageRequests.push(request);",
    "    }",
    "  }",
    "  return storageRequests;",
    "}",
    "",
    "async function recordsTheRequests(context) {",
    "  await context.mount();",
    "  context.expect(listStorageRequests(context)).toEqual([",
    '    { method: "storage.get", params: { key: "starts" }, result: null },',
    '    { method: "storage.set", params: { key: "starts", value: 1 }, result: null },',
    "  ]);",
    "}",
    "",
    "async function hidesTheImages(context) {",
    "  await context.mount({ config: { show_images: false } });",
    '  context.expect(context.root.querySelectorAll("li").length).toBe(3);',
    '  context.expect(context.root.querySelectorAll("img").length).toBe(0);',
    "  context.expect(globalThis.probe.context.config).toEqual({",
    "    show_images: false,",
    '    empty_text: "There are no tiles to show.",',
    "  });",
    "}",
    "",
    "async function showsTheImages(context) {",
    "  await context.mount();",
    '  context.expect(context.root.querySelectorAll("img").length).toBe(3);',
    "}",
    "",
    "async function showsNoTiles(context) {",
    "  await context.mount({ tiles: [] });",
    "  context.expect(globalThis.probe.context.tiles).toEqual([]);",
    "  const status = context.root.querySelector('[role=\"status\"]');",
    '  context.expect(status.textContent).toBe("There are no tiles to show.");',
    "}",
    "",
    "async function mountsTwice(context) {",
    "  await context.mount();",
    "  await context.mount();",
    "}",
  ],
  [
    ["reads the seeded starts", "readsTheSeededStarts"],
    ["records the requests", "recordsTheRequests"],
    ["hides the images", "hidesTheImages"],
    ["shows the images", "showsTheImages"],
    ["shows no tiles", "showsNoTiles"],
    ["mounts twice", "mountsTwice"],
  ],
);
