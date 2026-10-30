import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { FIXTURES_BASE_URL } from "../../../test/sample_files.ts";
import {
  COVER_BOOK_COLLECTION_SOURCE,
  COVER_BOOK_IMAGE_URL,
  MISMATCHED_SAMPLE_MOD_SOURCE,
  MISSING_ENTRYPOINT_MOD_SOURCE,
  MISSING_ENTRYPOINT_SOURCE,
  MISSING_MOD_SOURCE,
  MISSING_TYPE_MOD_SOURCE,
  MISSING_TYPE_SOURCE,
  NO_API_BOOK_MOD_SOURCE,
  NO_COUNTRY_TILE_SOURCE,
  OTHER_API_MOD_SOURCE,
  OTHER_API_RANGE,
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_ENTRYPOINT,
  SAMPLE_MOD_SOURCE,
  SAMPLE_TILE_SOURCES,
  serveCoverBook,
  serveMismatchedSampleMod,
  serveMissingEntrypointMod,
  serveMissingTypeMod,
  serveNoApiBookMod,
  serveOtherApiMod,
  serveTwoBooks,
  serveUntypedMod,
  TWO_BOOKS_SOURCE,
  UNTYPED_MOD_SOURCE,
} from "../../../test/sample_mods.ts";
import {
  fetchTestFile,
  readRequestedUrl,
  testTexts,
} from "../../../test/test_files.ts";
import { describeMissingApiRange, MOD_API_VERSION } from "./mod_api_version.ts";
import { checkModBundle } from "./mod_bundle_check.ts";
import type { ModBundleCheck } from "./mod_bundle_check.ts";

afterEach(function clearTestTexts(): void {
  testTexts.clear();
});

function createTestFetch(): Mock<typeof fetch> {
  const testFetch = vi.fn<typeof fetch>(fetchTestFile);
  return testFetch;
}

function listRequestedUrls(testFetch: Mock<typeof fetch>): string[] {
  const requestedUrls: string[] = [];
  for (const call of testFetch.mock.calls) {
    requestedUrls.push(readRequestedUrl(call[0]));
  }
  return requestedUrls;
}

function listTileSources(bundleCheck: ModBundleCheck): string[] {
  const tileSources: string[] = [];
  for (const tile of bundleCheck.modTiles?.tiles ?? []) {
    tileSources.push(tile.source);
  }
  return tileSources;
}

describe("Check a mod", function describeCheckMod(): void {
  it("Check with another collection", async function usesGivenCollection(): Promise<void> {
    serveTwoBooks();
    const testFetch = createTestFetch();

    const bundleCheck = await checkModBundle(
      SAMPLE_MOD_SOURCE,
      TWO_BOOKS_SOURCE,
      { fetch: testFetch },
    );

    expect(bundleCheck.findings).toEqual([]);
    expect(bundleCheck.modTiles?.collectionSource).toBe(TWO_BOOKS_SOURCE);
    expect(listTileSources(bundleCheck)).toEqual([
      SAMPLE_TILE_SOURCES[1],
      SAMPLE_TILE_SOURCES[2],
    ]);
    expect(listRequestedUrls(testFetch)).not.toContain(
      SAMPLE_COLLECTION_SOURCE,
    );
  });

  it("Mount check gets the resolved tiles", async function resolvesCheckedTiles(): Promise<void> {
    serveCoverBook();

    const bundleCheck = await checkModBundle(
      SAMPLE_MOD_SOURCE,
      COVER_BOOK_COLLECTION_SOURCE,
      { fetch: fetchTestFile },
    );

    expect(bundleCheck.findings).toEqual([]);
    expect(bundleCheck.modTiles?.tiles).toHaveLength(1);
    expect(bundleCheck.modTiles?.tiles[0].metadata.image).toBe(
      COVER_BOOK_IMAGE_URL,
    );
  });

  it("Mod without a sample collection", async function checksWithoutCollection(): Promise<void> {
    serveUntypedMod();
    const testFetch = createTestFetch();

    const bundleCheck = await checkModBundle(UNTYPED_MOD_SOURCE, null, {
      fetch: testFetch,
    });

    expect(bundleCheck.findings).toEqual([]);
    expect(bundleCheck.mod?.source).toBe(UNTYPED_MOD_SOURCE);
    expect(bundleCheck.modTiles).toBeNull();
    expect(listRequestedUrls(testFetch)).toEqual([
      UNTYPED_MOD_SOURCE,
      `${FIXTURES_BASE_URL}mods/untyped/main.js`,
    ]);
  });
});

describe("Bundle check", function describeBundleCheck(): void {
  it("Fixture mod", async function checksFixtureMod(): Promise<void> {
    const bundleCheck = await checkModBundle(SAMPLE_MOD_SOURCE, null, {
      fetch: fetchTestFile,
    });

    expect(bundleCheck.findings).toEqual([]);
    expect(bundleCheck.mod?.entrypoint).toBe(SAMPLE_ENTRYPOINT);
    expect(bundleCheck.modTiles?.collectionSource).toBe(
      SAMPLE_COLLECTION_SOURCE,
    );
    expect(listTileSources(bundleCheck)).toEqual(SAMPLE_TILE_SOURCES);
  });

  it("Missing mod file", async function reportsMissingModFile(): Promise<void> {
    const testFetch = createTestFetch();

    const bundleCheck = await checkModBundle(MISSING_MOD_SOURCE, null, {
      fetch: testFetch,
    });

    expect(bundleCheck.findings).toHaveLength(1);
    expect(bundleCheck.findings[0]).toMatchObject({
      step: "bundle",
      level: "error",
      source: MISSING_MOD_SOURCE,
    });
    expect(bundleCheck.findings[0].message).toContain("404");
    expect(bundleCheck.mod).toBeNull();
    expect(bundleCheck.modTiles).toBeNull();
    expect(listRequestedUrls(testFetch)).toEqual([MISSING_MOD_SOURCE]);
  });

  it("Missing entrypoint", async function reportsMissingEntrypoint(): Promise<void> {
    serveMissingEntrypointMod();

    const bundleCheck = await checkModBundle(
      MISSING_ENTRYPOINT_MOD_SOURCE,
      null,
      { fetch: fetchTestFile },
    );

    expect(bundleCheck.findings).toHaveLength(1);
    expect(bundleCheck.findings[0]).toMatchObject({
      step: "bundle",
      level: "error",
      source: MISSING_ENTRYPOINT_SOURCE,
    });
    expect(bundleCheck.findings[0].message).toContain("404");
    expect(bundleCheck.mod).toBeNull();
  });

  it("Failed tile type skips the collection", async function skipsCollectionWithoutType(): Promise<void> {
    serveMissingTypeMod();
    const testFetch = createTestFetch();

    const bundleCheck = await checkModBundle(MISSING_TYPE_MOD_SOURCE, null, {
      fetch: testFetch,
    });

    expect(bundleCheck.findings).toHaveLength(1);
    expect(bundleCheck.findings[0]).toMatchObject({
      step: "bundle",
      level: "error",
      source: MISSING_TYPE_SOURCE,
    });
    expect(bundleCheck.modTiles).toBeNull();
    expect(listRequestedUrls(testFetch)).not.toContain(
      SAMPLE_COLLECTION_SOURCE,
    );
  });

  it("Sample tile that does not match", async function reportsMismatchedTile(): Promise<void> {
    serveMismatchedSampleMod();

    const bundleCheck = await checkModBundle(
      MISMATCHED_SAMPLE_MOD_SOURCE,
      null,
      { fetch: fetchTestFile },
    );

    expect(bundleCheck.findings).toHaveLength(1);
    expect(bundleCheck.findings[0]).toMatchObject({
      step: "bundle",
      level: "warning",
      source: NO_COUNTRY_TILE_SOURCE,
    });
    expect(listTileSources(bundleCheck)).toEqual(SAMPLE_TILE_SOURCES);
  });

  it("findings are plain data", async function keepsPlainData(): Promise<void> {
    serveMismatchedSampleMod(null);

    const bundleCheck = await checkModBundle(
      MISMATCHED_SAMPLE_MOD_SOURCE,
      null,
      { fetch: fetchTestFile },
    );

    expect(structuredClone(bundleCheck.findings)).toEqual(bundleCheck.findings);
  });
});

describe("API range in the check", function describeApiRangeCheck(): void {
  it("Mod for another API", async function warnsAboutOtherApi(): Promise<void> {
    serveOtherApiMod();

    const bundleCheck = await checkModBundle(OTHER_API_MOD_SOURCE, null, {
      fetch: fetchTestFile,
    });

    expect(bundleCheck.findings).toHaveLength(1);
    expect(bundleCheck.findings[0]).toMatchObject({
      step: "bundle",
      level: "warning",
      source: OTHER_API_MOD_SOURCE,
    });
    expect(bundleCheck.findings[0].message).toContain(OTHER_API_RANGE);
    expect(bundleCheck.findings[0].message).toContain(MOD_API_VERSION);
    expect(bundleCheck.mod).not.toBeNull();
  });

  it("Missing range", async function warnsAboutMissingRange(): Promise<void> {
    serveNoApiBookMod();

    const bundleCheck = await checkModBundle(NO_API_BOOK_MOD_SOURCE, null, {
      fetch: fetchTestFile,
    });

    expect(bundleCheck.findings).toEqual([
      {
        step: "bundle",
        level: "warning",
        source: NO_API_BOOK_MOD_SOURCE,
        message: describeMissingApiRange(),
      },
    ]);
  });

  it("Range finding comes first", async function listsRangeFirst(): Promise<void> {
    serveMismatchedSampleMod(null);

    const bundleCheck = await checkModBundle(
      MISMATCHED_SAMPLE_MOD_SOURCE,
      null,
      { fetch: fetchTestFile },
    );

    expect(bundleCheck.findings).toHaveLength(2);
    expect(bundleCheck.findings[0]).toEqual({
      step: "bundle",
      level: "warning",
      source: MISMATCHED_SAMPLE_MOD_SOURCE,
      message: describeMissingApiRange(),
    });
    expect(bundleCheck.findings[1].source).toBe(NO_COUNTRY_TILE_SOURCE);
  });
});
