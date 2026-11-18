import { afterEach, describe, expect, it } from "vitest";
import { APP_BASE_URL } from "../../../test/sample_files.ts";
import {
  MISSING_MOD_SOURCE,
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_DEFAULT_MOSAIC_SOURCE,
  SAMPLE_MOD_SOURCE,
  SAMPLE_MOSAIC_SOURCE,
  serveUntypedMod,
  UNTYPED_MOD_SOURCE,
} from "../../../test/sample_mods.ts";
import {
  fetchTestFile,
  readRequestedUrl,
  testTexts,
} from "../../../test/test_files.ts";
import type { ModLoadOptions } from "../../mod/index.ts";
import type { ResolvedAppCatalog } from "./app_catalog.ts";
import { buildCatalogListing } from "./catalog_listing.ts";

afterEach(function clearTestTexts(): void {
  testTexts.clear();
});

/** Fetch options whose fetch serves the test files and records each requested address. */
interface RecordingFetch {
  fetchOptions: ModLoadOptions;
  requested: string[];
}

function recordFetch(
  requested: string[],
  input: RequestInfo | URL,
): Promise<Response> {
  requested.push(readRequestedUrl(input));
  return fetchTestFile(input);
}

function buildRecordingFetch(): RecordingFetch {
  const requested: string[] = [];
  const recording: RecordingFetch = {
    fetchOptions: {
      baseUrl: APP_BASE_URL,
      fetch: recordFetch.bind(undefined, requested),
    },
    requested,
  };
  return recording;
}

function buildCatalog(lists: Partial<ResolvedAppCatalog>): ResolvedAppCatalog {
  const catalog: ResolvedAppCatalog = {
    mods: [],
    collections: [],
    mosaics: [],
    ...lists,
  };
  return catalog;
}

const BOOK_LIST_MARK = { source: SAMPLE_MOD_SOURCE, title: "Book List" };

describe("buildCatalogListing", function describeBuildCatalogListing(): void {
  it("lists the catalog with nothing fetched while the switch is off", async function listsWithoutFetching(): Promise<void> {
    const recording = buildRecordingFetch();

    const listing = await buildCatalogListing(
      buildCatalog({
        mods: [SAMPLE_MOD_SOURCE],
        collections: [SAMPLE_COLLECTION_SOURCE],
        mosaics: [SAMPLE_MOSAIC_SOURCE],
      }),
      false,
      recording.fetchOptions,
    );

    expect(listing).toEqual({
      mods: [{ source: SAMPLE_MOD_SOURCE }],
      collections: [{ source: SAMPLE_COLLECTION_SOURCE }],
      mosaics: [{ source: SAMPLE_MOSAIC_SOURCE, defaultOf: null }],
    });
    expect(recording.requested).toEqual([]);
  });

  it("Vanilla default mosaics", async function addsDefaultMosaics(): Promise<void> {
    serveUntypedMod();
    const recording = buildRecordingFetch();

    const listing = await buildCatalogListing(
      buildCatalog({
        mods: [SAMPLE_MOD_SOURCE, UNTYPED_MOD_SOURCE],
        mosaics: [SAMPLE_MOSAIC_SOURCE],
      }),
      true,
      recording.fetchOptions,
    );

    expect(listing.mosaics).toEqual([
      { source: SAMPLE_MOSAIC_SOURCE, defaultOf: null },
      { source: SAMPLE_DEFAULT_MOSAIC_SOURCE, defaultOf: BOOK_LIST_MARK },
    ]);
    expect([...recording.requested].sort()).toEqual(
      [SAMPLE_MOD_SOURCE, UNTYPED_MOD_SOURCE].sort(),
    );
  });

  it("Mod that cannot be loaded", async function skipsMissingMod(): Promise<void> {
    const recording = buildRecordingFetch();

    const listing = await buildCatalogListing(
      buildCatalog({ mods: [MISSING_MOD_SOURCE, SAMPLE_MOD_SOURCE] }),
      true,
      recording.fetchOptions,
    );

    expect(listing.mods).toEqual([
      { source: MISSING_MOD_SOURCE },
      { source: SAMPLE_MOD_SOURCE },
    ]);
    expect(listing.mosaics).toEqual([
      { source: SAMPLE_DEFAULT_MOSAIC_SOURCE, defaultOf: BOOK_LIST_MARK },
    ]);
  });

  it("Default mosaic also in the catalog", async function keepsCatalogPlace(): Promise<void> {
    const recording = buildRecordingFetch();

    const listing = await buildCatalogListing(
      buildCatalog({
        mods: [SAMPLE_MOD_SOURCE],
        mosaics: [SAMPLE_DEFAULT_MOSAIC_SOURCE, SAMPLE_MOSAIC_SOURCE],
      }),
      true,
      recording.fetchOptions,
    );

    expect(listing.mosaics).toEqual([
      { source: SAMPLE_DEFAULT_MOSAIC_SOURCE, defaultOf: null },
      { source: SAMPLE_MOSAIC_SOURCE, defaultOf: null },
    ]);
  });

  it("lists a default mosaic two mods share once, marked with the first", async function dedupesDefaults(): Promise<void> {
    const recording = buildRecordingFetch();
    const otherModSource = `${APP_BASE_URL}fixtures/mods/book_list/other_mod.yaml`;
    testTexts.set(
      otherModSource,
      [
        "mod:",
        '  title: "Other"',
        '  version: "0.1.0"',
        '  entrypoint: "./main.js"',
        '  default_mosaic: "./mosaic.yaml"',
        "",
      ].join("\n"),
    );

    const listing = await buildCatalogListing(
      buildCatalog({ mods: [SAMPLE_MOD_SOURCE, otherModSource] }),
      true,
      recording.fetchOptions,
    );

    expect(listing.mosaics).toEqual([
      { source: SAMPLE_DEFAULT_MOSAIC_SOURCE, defaultOf: BOOK_LIST_MARK },
    ]);
  });
});
