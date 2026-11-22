import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { FIXTURES_BASE_URL } from "../../../test/sample_files.ts";
import {
  ALIASED_MOSAIC_SOURCE,
  NAMED_BOOKS_SOURCE,
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_MOD_SOURCE,
  serveNamedBooks,
} from "../../../test/sample_mods.ts";
import {
  fetchTestFile,
  readRequestedUrl,
  testTexts,
} from "../../../test/test_files.ts";
import {
  createDraftLoadCache,
  DRAFT_LOAD_LIFETIME,
} from "./draft_load_cache.ts";
import type { DraftLoadCache } from "./draft_load_cache.ts";
import { validateMosaicDraft } from "./mosaic_draft.ts";
import type { DraftValidationOptions } from "./mosaic_draft.ts";

const MISSING_COLLECTION_SOURCE = `${FIXTURES_BASE_URL}tiles/missing/collection.yaml`;

/** Builds a mosaic file from the lines of its `mosaic` mapping. */
function buildDraft(mosaicLines: string[]): string {
  const lines = ["mosaic:"];
  for (const mosaicLine of mosaicLines) {
    lines.push(`  ${mosaicLine}`);
  }
  const draft = `${lines.join("\n")}\n`;
  return draft;
}

const NAMED_BOOKS_DRAFT = buildDraft([
  'title: "Named books on the shelf"',
  `mod: "${SAMPLE_MOD_SOURCE}"`,
  `collection: "${NAMED_BOOKS_SOURCE}"`,
  "aliases:",
  '  title: ["name"]',
  '  country: ["origin"]',
]);

function createTestFetch(): Mock<typeof fetch> {
  const testFetch = vi.fn<typeof fetch>(fetchTestFile);
  return testFetch;
}

function readRequestedUrls(testFetch: Mock<typeof fetch>): string[] {
  const requestedUrls: string[] = [];
  for (const call of testFetch.mock.calls) {
    requestedUrls.push(readRequestedUrl(call[0]));
  }
  return requestedUrls;
}

function returnZero(): number {
  return 0;
}

function buildOptions(
  testFetch: Mock<typeof fetch>,
  cache: DraftLoadCache = createDraftLoadCache(returnZero),
): DraftValidationOptions {
  const options: DraftValidationOptions = {
    fetchOptions: { fetch: testFetch },
    loads: cache,
  };
  return options;
}

afterEach(function clearTestTexts(): void {
  testTexts.clear();
});

describe("validateMosaicDraft", function describeValidateMosaicDraft(): void {
  it("Laureates on the map", async function validatesAliasedDraft(): Promise<void> {
    serveNamedBooks();

    const validation = await validateMosaicDraft(
      NAMED_BOOKS_DRAFT,
      ALIASED_MOSAIC_SOURCE,
      buildOptions(createTestFetch()),
    );

    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toEqual([]);
    expect(validation.typeFields).toContainEqual({
      name: "title",
      required: true,
    });
    expect(validation.typeFields).toContainEqual({
      name: "country",
      required: true,
    });
    expect(validation.typeFields).toContainEqual({
      name: "language",
      required: false,
    });
    expect(validation.collectionFields).toEqual([
      "authors",
      "date",
      "genres",
      "name",
      "origin",
    ]);
    expect(validation.tiles).toEqual({ matching: 1, total: 1 });
    expect(validation.draft).toEqual({
      title: "Named books on the shelf",
      description: null,
      mod: SAMPLE_MOD_SOURCE,
      collection: NAMED_BOOKS_SOURCE,
      config: {},
      aliases: { title: ["name"], country: ["origin"] },
      show: [],
    });
  });

  it("counts fewer tiles without the aliases", async function countsWithoutAliases(): Promise<void> {
    serveNamedBooks();
    const draft = buildDraft([
      'title: "Named books on the shelf"',
      `mod: "${SAMPLE_MOD_SOURCE}"`,
      `collection: "${NAMED_BOOKS_SOURCE}"`,
    ]);

    const validation = await validateMosaicDraft(
      draft,
      ALIASED_MOSAIC_SOURCE,
      buildOptions(createTestFetch()),
    );

    expect(validation.tiles).toEqual({ matching: 0, total: 1 });
  });

  it("Missing collection", async function reportsMissingCollection(): Promise<void> {
    const draft = buildDraft([
      'title: "Missing"',
      `mod: "${SAMPLE_MOD_SOURCE}"`,
      `collection: "${MISSING_COLLECTION_SOURCE}"`,
    ]);

    const validation = await validateMosaicDraft(
      draft,
      null,
      buildOptions(createTestFetch()),
    );

    expect(validation.errors).toHaveLength(1);
    expect(validation.errors[0].message).toContain(MISSING_COLLECTION_SOURCE);
    expect(validation.errors[0].message).toContain("404");
    expect(validation.errors[0].line).toBeNull();
    expect(validation.typeFields).toContainEqual({
      name: "title",
      required: true,
    });
    expect(validation.tiles).toBeNull();
  });

  it("reports a mod that cannot be loaded", async function reportsMissingMod(): Promise<void> {
    const missingMod = `${FIXTURES_BASE_URL}mods/missing/mod_conf.yaml`;
    const draft = buildDraft([
      'title: "Missing"',
      `mod: "${missingMod}"`,
      `collection: "${SAMPLE_COLLECTION_SOURCE}"`,
    ]);

    const validation = await validateMosaicDraft(
      draft,
      null,
      buildOptions(createTestFetch()),
    );

    expect(validation.errors).toHaveLength(1);
    expect(validation.errors[0].message).toContain(missingMod);
    expect(validation.collectionFields).toContain("title");
    expect(validation.tiles).toBeNull();
  });

  it("Unknown alias field", async function warnsAboutAlias(): Promise<void> {
    const draft = buildDraft([
      'title: "Books"',
      `mod: "${SAMPLE_MOD_SOURCE}"`,
      `collection: "${SAMPLE_COLLECTION_SOURCE}"`,
      "aliases:",
      '  colour: ["color"]',
    ]);

    const validation = await validateMosaicDraft(
      draft,
      null,
      buildOptions(createTestFetch()),
    );

    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toHaveLength(1);
    expect(validation.warnings[0].message).toContain('"colour"');
  });

  it("warns about an unknown config key", async function warnsAboutConfig(): Promise<void> {
    const draft = buildDraft([
      'title: "Books"',
      `mod: "${SAMPLE_MOD_SOURCE}"`,
      "config:",
      "  colums: 8",
    ]);

    const validation = await validateMosaicDraft(
      draft,
      null,
      buildOptions(createTestFetch()),
    );

    expect(validation.warnings).toHaveLength(1);
    expect(validation.warnings[0].message).toContain('"config.colums"');
    expect(validation.tiles).toBeNull();
  });

  it("YAML that does not parse", async function reportsParseLine(): Promise<void> {
    const testFetch = createTestFetch();
    const draft = buildDraft([
      'title: "Books"',
      `mod: "${SAMPLE_MOD_SOURCE}"`,
      `\tcollection: "${SAMPLE_COLLECTION_SOURCE}"`,
    ]).replace("  \t", "\t");

    const validation = await validateMosaicDraft(
      draft,
      null,
      buildOptions(testFetch),
    );

    expect(validation.errors).toHaveLength(1);
    expect(validation.errors[0].line).toBe(4);
    expect(validation.errors[0].message).toContain("tab");
    expect(validation.typeFields).toEqual([]);
    expect(validation.collectionFields).toEqual([]);
    expect(validation.tiles).toBeNull();
    expect(validation.draft).toBeNull();
    expect(testFetch).not.toHaveBeenCalled();
  });

  it("reports a format error", async function reportsFormatError(): Promise<void> {
    const testFetch = createTestFetch();
    const draft = buildDraft([`mod: "${SAMPLE_MOD_SOURCE}"`]);

    const validation = await validateMosaicDraft(
      draft,
      null,
      buildOptions(testFetch),
    );

    expect(validation.errors).toHaveLength(1);
    expect(validation.errors[0].message).toContain(
      '"title" must be a non-empty string',
    );
    expect(validation.draft).toMatchObject({
      title: null,
      mod: SAMPLE_MOD_SOURCE,
    });
    expect(testFetch).not.toHaveBeenCalled();
  });

  it("Relative collection in a new mosaic", async function refusesRelative(): Promise<void> {
    const testFetch = createTestFetch();
    const draft = buildDraft([
      'title: "Laureates"',
      `mod: "${SAMPLE_MOD_SOURCE}"`,
      'collection: "../tiles/laureates"',
    ]);

    const validation = await validateMosaicDraft(
      draft,
      null,
      buildOptions(testFetch),
    );

    expect(validation.errors).toEqual([
      {
        message: '"collection" must be an absolute address in a new mosaic',
        line: null,
      },
    ]);
    expect(testFetch).not.toHaveBeenCalled();
  });

  it("resolves relative references against the draft's address", async function resolvesRelative(): Promise<void> {
    serveNamedBooks();
    const draft = buildDraft([
      'title: "Named books on the shelf"',
      'mod: "../../mods/book_list"',
      'collection: "../../tiles/named_books"',
    ]);

    const validation = await validateMosaicDraft(
      draft,
      ALIASED_MOSAIC_SOURCE,
      buildOptions(createTestFetch()),
    );

    expect(validation.errors).toEqual([]);
    expect(validation.tiles).toEqual({ matching: 0, total: 1 });
  });

  it("checks the access to the mod and the collection before loading", async function checksAccess(): Promise<void> {
    const testFetch = createTestFetch();
    const checkedSources: string[] = [];
    function recordAccess(source: string): void {
      checkedSources.push(source);
      throw new Error(`Denied ${source}`);
    }
    const options: DraftValidationOptions = {
      ...buildOptions(testFetch),
      checkAccess: recordAccess,
    };

    const validating = validateMosaicDraft(NAMED_BOOKS_DRAFT, null, options);

    await expect(validating).rejects.toThrow(`Denied ${SAMPLE_MOD_SOURCE}`);
    expect(checkedSources).toEqual([SAMPLE_MOD_SOURCE]);
    expect(testFetch).not.toHaveBeenCalled();
  });

  it("loads each file once within the cache's lifetime", async function cachesLoads(): Promise<void> {
    serveNamedBooks();
    let now = 0;
    function readNow(): number {
      return now;
    }
    const cache = createDraftLoadCache(readNow);
    const firstFetch = createTestFetch();
    await validateMosaicDraft(
      NAMED_BOOKS_DRAFT,
      null,
      buildOptions(firstFetch, cache),
    );
    const secondFetch = createTestFetch();
    const thirdFetch = createTestFetch();

    now = DRAFT_LOAD_LIFETIME - 1;
    await validateMosaicDraft(
      NAMED_BOOKS_DRAFT,
      null,
      buildOptions(secondFetch, cache),
    );
    now = DRAFT_LOAD_LIFETIME;
    await validateMosaicDraft(
      NAMED_BOOKS_DRAFT,
      null,
      buildOptions(thirdFetch, cache),
    );

    expect(readRequestedUrls(firstFetch)).toContain(NAMED_BOOKS_SOURCE);
    expect(secondFetch).not.toHaveBeenCalled();
    expect(readRequestedUrls(thirdFetch)).toContain(NAMED_BOOKS_SOURCE);
  });
});
