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

/** `./fixtures/tiles/two_books.yaml`: `TWO_BOOKS_SOURCE` as a request names it, relative to the app. */
export const TWO_BOOKS_REFERENCE = `${FIXTURES_REFERENCE}tiles/two_books.yaml`;

/**
 * `^0.1.0`: the `api` range the test mods declare unless a test asks for
 * another one, so they match the mod API version and get no missing-range
 * warning. A breaking bump of the mod API updates it with the shipped mods.
 */
export const TEST_MOD_API_RANGE = "^0.1.0";

const MOUNT_CODE = "export default function mount() {}\n";

/** The text of a mod file with `modLines` under `mod`, after an `api` line unless `apiRange` is `null`. */
function buildTestModText(modLines: string[], apiRange: string | null): string {
  const lines = ["mod:"];
  if (apiRange !== null) {
    lines.push(`  api: "${apiRange}"`);
  }
  lines.push(...modLines);
  const text = lines.join("\n");
  return text;
}

/** Serves the mod at `UNTYPED_MOD_SOURCE`, declaring `apiRange` unless it is `null`. */
export function serveUntypedMod(
  apiRange: string | null = TEST_MOD_API_RANGE,
): void {
  testTexts.set(
    UNTYPED_MOD_SOURCE,
    buildTestModText(
      ['  name: "untyped"', '  version: "0.1.0"', '  entrypoint: "./main.js"'],
      apiRange,
    ),
  );
  testTexts.set(`${FIXTURES_BASE_URL}mods/untyped/main.js`, MOUNT_CODE);
}

/**
 * Serves an inline mod file at `source`, with a `main.js` next to it. The
 * file declares `apiRange` as its first line under `mod`, unless it is `null`.
 */
export function serveTestMod(
  source: string,
  modLines: string[],
  apiRange: string | null = TEST_MOD_API_RANGE,
): void {
  testTexts.set(source, buildTestModText(modLines, apiRange));
  testTexts.set(new URL("./main.js", source).href, MOUNT_CODE);
}

/** `^0.2.0`: an `api` range for a later mod API, which the mod API version does not match. */
export const OTHER_API_RANGE = "^0.2.0";

/** A mod written for `OTHER_API_RANGE`, served by `fetchTestFile` once `serveOtherApiMod` ran. */
export const OTHER_API_MOD_SOURCE = `${FIXTURES_BASE_URL}mods/other_api/mod_conf.yaml`;

export function serveOtherApiMod(): void {
  serveTestMod(
    OTHER_API_MOD_SOURCE,
    [
      '  name: "other_api"',
      '  title: "Other API"',
      '  version: "2.0.0"',
      '  entrypoint: "./main.js"',
    ],
    OTHER_API_RANGE,
  );
}

/** A mod of the sample book type that declares no `api` range, served by `fetchTestFile` once `serveNoApiBookMod` ran. */
export const NO_API_BOOK_MOD_SOURCE = `${FIXTURES_BASE_URL}mods/no_api_books/mod_conf.yaml`;

export function serveNoApiBookMod(): void {
  serveTestMod(
    NO_API_BOOK_MOD_SOURCE,
    [
      '  name: "no_api_books"',
      '  version: "0.1.0"',
      '  entrypoint: "./main.js"',
      '  type_path: "../../types/book.md"',
    ],
    null,
  );
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

/** A collection with one book tile whose `image` is `./cover.jpg`, a path next to the tile. */
export const COVER_BOOK_COLLECTION_SOURCE = `${FIXTURES_BASE_URL}tiles/cover_book.yaml`;
export const COVER_BOOK_TILE_SOURCE = `${FIXTURES_BASE_URL}tiles/books/cover_book.md`;

/** `./cover.jpg` of the tile at `COVER_BOOK_TILE_SOURCE`, resolved against it. Written by hand. */
export const COVER_BOOK_IMAGE_URL =
  "https://example.org/fixtures/tiles/books/cover.jpg";

export function serveCoverBook(): void {
  testTexts.set(
    COVER_BOOK_COLLECTION_SOURCE,
    [
      "collection:",
      '  name: "Cover book"',
      "  tiles:",
      '    - path: "./books/cover_book.md"',
    ].join("\n"),
  );
  testTexts.set(
    COVER_BOOK_TILE_SOURCE,
    buildTypeText([
      'title: "Cover book"',
      'date: "2001-01-01"',
      "authors:",
      '  - "Anonymous"',
      'country: "Sweden"',
      "genres:",
      '  - "Mystery"',
      'image: "./cover.jpg"',
    ]),
  );
}

/** A mod whose entrypoint answers `404 Not Found`, served by `fetchTestFile` once `serveMissingEntrypointMod` ran. */
export const MISSING_ENTRYPOINT_MOD_SOURCE = `${FIXTURES_BASE_URL}mods/missing_entrypoint/mod_conf.yaml`;
export const MISSING_ENTRYPOINT_SOURCE = `${FIXTURES_BASE_URL}mods/missing_entrypoint/missing.js`;

export function serveMissingEntrypointMod(): void {
  serveTestMod(MISSING_ENTRYPOINT_MOD_SOURCE, [
    '  name: "missing_entrypoint"',
    '  version: "0.1.0"',
    '  entrypoint: "./missing.js"',
  ]);
}

/** A mod whose tile type file answers `404 Not Found`, served by `fetchTestFile` once `serveMissingTypeMod` ran. */
export const MISSING_TYPE_MOD_SOURCE = `${FIXTURES_BASE_URL}mods/missing_type/mod_conf.yaml`;
export const MISSING_TYPE_SOURCE = `${FIXTURES_BASE_URL}mods/missing_type/book_type.md`;

export function serveMissingTypeMod(): void {
  serveTestMod(MISSING_TYPE_MOD_SOURCE, [
    '  name: "missing_type"',
    '  version: "0.1.0"',
    '  entrypoint: "./main.js"',
    '  type_path: "./book_type.md"',
    '  sample_collection: "../../tiles/books_collection.yaml"',
  ]);
}

/**
 * A mod of the sample book type whose sample collection is `FOUR_BOOKS_SOURCE`,
 * where the tile at `NO_COUNTRY_TILE_SOURCE` misses `country`. Served by
 * `fetchTestFile` once `serveMismatchedSampleMod` ran, declaring `apiRange`
 * unless it is `null`.
 */
export const MISMATCHED_SAMPLE_MOD_SOURCE = `${FIXTURES_BASE_URL}mods/mismatched_sample/mod_conf.yaml`;

export function serveMismatchedSampleMod(
  apiRange: string | null = TEST_MOD_API_RANGE,
): void {
  serveTestMod(
    MISMATCHED_SAMPLE_MOD_SOURCE,
    [
      '  name: "mismatched_sample"',
      '  version: "0.1.0"',
      '  entrypoint: "./main.js"',
      '  type_path: "../../types/book.md"',
      '  sample_collection: "../../tiles/four_books.yaml"',
    ],
    apiRange,
  );
  serveFourBooks();
}

/**
 * A mod with `test_path: "./test.js"` and `open` for `"*"`, served by
 * `fetchTestFile` once `serveTestedMod` ran. Unit tests play its frames, so
 * its test file's text is never run.
 */
export const TESTED_MOD_SOURCE = `${FIXTURES_BASE_URL}mods/tested/mod_conf.yaml`;
export const TESTED_MOD_TEST_SOURCE = `${FIXTURES_BASE_URL}mods/tested/test.js`;
export const TESTED_MOD_TEST_CODE =
  'export default function registerTests(t) { t.test("lists books", function listsBooks() {}); }\n';

/** Serves `TESTED_MOD_SOURCE`, with `testCode` as its test file, or no test file (`404 Not Found`) for `null`. */
export function serveTestedMod(
  testCode: string | null = TESTED_MOD_TEST_CODE,
): void {
  serveTestMod(TESTED_MOD_SOURCE, [
    '  name: "tested"',
    '  version: "0.1.0"',
    '  entrypoint: "./main.js"',
    '  test_path: "./test.js"',
    "  permissions:",
    "    open:",
    '      - host: "*"',
    '        reason: "Opens mods"',
  ]);
  if (testCode !== null) {
    testTexts.set(TESTED_MOD_TEST_SOURCE, testCode);
  }
}
