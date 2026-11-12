import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

/** `/samples/mods`: the folder of the shipped sample mods on the app's server. */
const SAMPLE_MODS_PATH = "/samples/mods";

/** `/samples/mods/book_list`: the folder of the shipped sample book list mod. */
export const SAMPLE_MOD_FOLDER_PATH = `${SAMPLE_MODS_PATH}/book_list`;

/** `/samples/mods/book_list/mod_conf.yaml`: the sample mod's file. */
export const SAMPLE_MOD_FILE_PATH = `${SAMPLE_MOD_FOLDER_PATH}/mod_conf.yaml`;

/** `/samples/mods/book_list/main.js`: the sample mod's entrypoint. */
export const SAMPLE_ENTRYPOINT_PATH = `${SAMPLE_MOD_FOLDER_PATH}/main.js`;

/** The text of the sample mod's entrypoint, to serve it in a test mod of another folder. */
export const SAMPLE_ENTRYPOINT_CODE = readFileSync(
  new URL(`../public${SAMPLE_ENTRYPOINT_PATH}`, import.meta.url),
  "utf8",
);

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

/** `/samples/mods/flashcards`: the folder of the shipped sample flashcards mod. */
export const FLASHCARDS_FOLDER_PATH = `${SAMPLE_MODS_PATH}/flashcards`;

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
