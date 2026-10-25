import {
  APP_BASE_URL,
  FIXTURES_BASE_URL,
  FIXTURES_REFERENCE,
} from "./sample_files.ts";
import { buildTypeText, testTexts } from "./test_files.ts";

/** The app's origin in tests. Mods under `APP_BASE_URL` are on it and get their permissions. */
export const APP_ORIGIN = "https://example.org";

/** An origin that is not the app's, so the sample mod counts as a foreign mod. */
export const OTHER_APP_ORIGIN = "https://other.example";

export const SAMPLE_MOD_SOURCE = `${FIXTURES_BASE_URL}mods/book_list/mod_conf.yaml`;
export const SAMPLE_ENTRYPOINT = `${FIXTURES_BASE_URL}mods/book_list/main.js`;
export const SAMPLE_TYPE_SOURCE = `${FIXTURES_BASE_URL}types/book.md`;
export const SAMPLE_COLLECTION_SOURCE = `${FIXTURES_BASE_URL}tiles/books_collection.yaml`;
export const SAMPLE_TILE_SOURCES = [
  `${FIXTURES_BASE_URL}tiles/books/farenheit_451.md`,
  `${FIXTURES_BASE_URL}tiles/books/kallocain.md`,
  `${FIXTURES_BASE_URL}tiles/books/fictions.md`,
];

/** `./fixtures/mods/book_list`: the sample mod as a run link names it. It resolves to `SAMPLE_MOD_SOURCE`. */
export const SAMPLE_MOD_REFERENCE = `${FIXTURES_REFERENCE}mods/book_list`;

/** `./fixtures/tiles/books_collection.yaml`: the sample collection as a run link names it. It resolves to `SAMPLE_COLLECTION_SOURCE`. */
export const SAMPLE_COLLECTION_REFERENCE = `${FIXTURES_REFERENCE}tiles/books_collection.yaml`;

/** `./fixtures/mods/missing`: a mod folder that does not exist. It resolves to `MISSING_MOD_SOURCE`. */
export const MISSING_MOD_REFERENCE = `${FIXTURES_REFERENCE}mods/missing`;

/** `https://example.org/fixtures/mods/missing/mod_conf.yaml`: the mod file of `MISSING_MOD_REFERENCE`, which answers `404 Not Found`. */
export const MISSING_MOD_SOURCE = `${FIXTURES_BASE_URL}mods/missing/mod_conf.yaml`;

/**
 * `#/run?mod=.%2Ffixtures%2Fmods%2Fbook_list`: the run link of the sample mod,
 * as the stage writes it. Written by hand, so tests of the encoding compare
 * against an independent value.
 */
export const SAMPLE_RUN_HASH = "#/run?mod=.%2Ffixtures%2Fmods%2Fbook_list";

/**
 * `#/run?mod=.%2Ffixtures%2Fmods%2Fbook_list&collection=.%2Ffixtures%2Ftiles%2Fbooks_collection.yaml`:
 * the run link of the sample mod on the sample collection, as the stage writes it.
 * Written by hand, like `SAMPLE_RUN_HASH`.
 */
export const SAMPLE_COLLECTION_RUN_HASH =
  "#/run?mod=.%2Ffixtures%2Fmods%2Fbook_list&collection=.%2Ffixtures%2Ftiles%2Fbooks_collection.yaml";

/**
 * `#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Ffixtures%2Fmods%2Fbook_list%2Fmod_conf.yaml`:
 * the run link of the mod viewer on `SAMPLE_MOD_SOURCE`, as the stage writes it.
 * Written by hand, like `SAMPLE_RUN_HASH`.
 */
export const SAMPLE_VIEWER_RUN_HASH =
  "#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Ffixtures%2Fmods%2Fbook_list%2Fmod_conf.yaml";

export const SAMPLE_COVERS_PERMISSION = {
  category: "show",
  host: "https://upload.wikimedia.org",
  reason: "Shows the book covers",
} as const;

/** The vanilla default mod settings, resolved for the app at `APP_BASE_URL`. */
export const TEST_DEFAULTS = {
  folder: `${APP_BASE_URL}default_mods/`,
  switchedOff: [] as { name: string; source: string }[],
};

/** A mod without `type_path`, served by `fetchTestFile` once `serveUntypedMod` ran. */
export const UNTYPED_MOD_SOURCE = `${FIXTURES_BASE_URL}mods/untyped/mod_conf.yaml`;

/** A collection with the three sample books and a fourth tile without `country`. */
export const FOUR_BOOKS_SOURCE = `${FIXTURES_BASE_URL}tiles/four_books.yaml`;
export const NO_COUNTRY_TILE_SOURCE = `${FIXTURES_BASE_URL}tiles/books/no_country.md`;

/** A collection with two of the sample books. */
export const TWO_BOOKS_SOURCE = `${FIXTURES_BASE_URL}tiles/two_books.yaml`;

const MOUNT_CODE = "export default function mount() {}\n";

export function serveUntypedMod(): void {
  testTexts.set(
    UNTYPED_MOD_SOURCE,
    [
      "mod:",
      '  name: "untyped"',
      '  version: "0.1.0"',
      '  entrypoint: "./main.js"',
    ].join("\n"),
  );
  testTexts.set(`${FIXTURES_BASE_URL}mods/untyped/main.js`, MOUNT_CODE);
}

/** Serves an inline mod file at `source`, with a `main.js` next to it. */
export function serveTestMod(source: string, modLines: string[]): void {
  testTexts.set(source, ["mod:", ...modLines].join("\n"));
  testTexts.set(new URL("./main.js", source).href, MOUNT_CODE);
}

export function serveFourBooks(): void {
  testTexts.set(
    FOUR_BOOKS_SOURCE,
    [
      "collection:",
      '  name: "Four books"',
      "  tiles:",
      '    - path: "./books/farenheit_451.md"',
      '    - path: "./books/kallocain.md"',
      '    - path: "./books/fictions.md"',
      '    - path: "./books/no_country.md"',
    ].join("\n"),
  );
  testTexts.set(
    NO_COUNTRY_TILE_SOURCE,
    buildTypeText([
      'title: "No country"',
      'date: "2001-01-01"',
      "authors:",
      '  - "Anonymous"',
      "genres:",
      '  - "Mystery"',
    ]),
  );
}

export function serveTwoBooks(): void {
  testTexts.set(
    TWO_BOOKS_SOURCE,
    [
      "collection:",
      '  name: "Two books"',
      "  tiles:",
      '    - path: "./books/kallocain.md"',
      '    - path: "./books/fictions.md"',
    ].join("\n"),
  );
}
