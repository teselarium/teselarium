import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { APP_BASE_URL } from "../../../test/sample_files.ts";
import {
  APP_ORIGIN,
  MISSING_MOD_SOURCE,
  OTHER_API_MOD_SOURCE,
  OTHER_API_RANGE,
  OTHER_APP_ORIGIN,
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_COVERS_PERMISSION,
  SAMPLE_ENTRYPOINT,
  SAMPLE_MOD_SOURCE,
  SAMPLE_TYPE_SOURCE,
  serveOtherApiMod,
  serveUntypedMod,
  UNTYPED_MOD_SOURCE,
} from "../../../test/sample_mods.ts";
import {
  fetchTestFile,
  readRequestedUrl,
  testTexts,
} from "../../../test/test_files.ts";
import { FileFetchError } from "../../files/index.ts";
import { inspectMod } from "./mod_inspection.ts";

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

describe("inspectMod", function describeInspectMod(): void {
  it("Inspect the sample mod", async function inspectsSampleMod(): Promise<void> {
    const testFetch = createTestFetch();

    const inspection = await inspectMod(SAMPLE_MOD_SOURCE, APP_ORIGIN, {
      baseUrl: APP_BASE_URL,
      fetch: testFetch,
    });

    expect(inspection).toEqual({
      source: SAMPLE_MOD_SOURCE,
      name: "book_list",
      title: "Book List",
      version: "1.0.0",
      description: "A very simple list of books with their covers.",
      api: "^0.1.0",
      apiCompatible: true,
      typeSource: SAMPLE_TYPE_SOURCE,
      sampleCollection: SAMPLE_COLLECTION_SOURCE,
      config: { show_covers: true },
      permissions: { granted: [SAMPLE_COVERS_PERMISSION], denied: [] },
    });
    expect(listRequestedUrls(testFetch)).not.toContain(SAMPLE_ENTRYPOINT);
  });

  it("gives the permissions a foreign mod would get", async function inspectsForeignMod(): Promise<void> {
    const inspection = await inspectMod(SAMPLE_MOD_SOURCE, OTHER_APP_ORIGIN, {
      fetch: fetchTestFile,
    });

    expect(inspection.permissions).toEqual({
      granted: [],
      denied: [SAMPLE_COVERS_PERMISSION],
    });
  });

  it("Inspect a mod for another API", async function inspectsOtherApiMod(): Promise<void> {
    serveOtherApiMod();

    const inspection = await inspectMod(OTHER_API_MOD_SOURCE, APP_ORIGIN, {
      fetch: fetchTestFile,
    });

    expect(inspection.api).toBe(OTHER_API_RANGE);
    expect(inspection.apiCompatible).toBe(false);
  });

  it("Inspect a mod without a range", async function inspectsModWithoutRange(): Promise<void> {
    serveUntypedMod(null);

    const inspection = await inspectMod(UNTYPED_MOD_SOURCE, APP_ORIGIN, {
      fetch: fetchTestFile,
    });

    expect(inspection.api).toBeNull();
    expect(inspection.apiCompatible).toBeNull();
  });

  it("Inspect a missing mod", async function inspectsMissingMod(): Promise<void> {
    const inspecting = inspectMod(MISSING_MOD_SOURCE, APP_ORIGIN, {
      fetch: fetchTestFile,
    });

    await expect(inspecting).rejects.toThrow(FileFetchError);
    await expect(inspecting).rejects.toThrow(/missing\/mod_conf\.yaml.*404/);
  });

  it("Structured clone of an inspection", async function clonesInspection(): Promise<void> {
    const inspection = await inspectMod(SAMPLE_MOD_SOURCE, APP_ORIGIN, {
      fetch: fetchTestFile,
    });

    expect(structuredClone(inspection)).toEqual(inspection);
  });
});
