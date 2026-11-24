import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { APP_BASE_URL } from "../../../test/sample_files.ts";
import {
  APP_ORIGIN,
  buildSampleCoversDecision,
  HELPER_SCRIPT_SOURCE,
  LEAFLET_SCRIPT_SOURCE,
  LEAFLET_STYLE_SOURCE,
  LIBRARY_MOD_SOURCE,
  MISSING_MOD_SOURCE,
  OTHER_API_MOD_SOURCE,
  OTHER_API_RANGE,
  OTHER_APP_ORIGIN,
  SAMPLE_COVERS_PERMISSION,
  SAMPLE_DEFAULT_MOSAIC_SOURCE,
  SAMPLE_ENTRYPOINT,
  SAMPLE_MOD_SOURCE,
  SAMPLE_TYPE_SOURCE,
  serveLibraryMod,
  serveOtherApiMod,
  serveUntypedMod,
  TEST_NPM_HOST,
  UNTYPED_MOD_SOURCE,
} from "../../../test/sample_mods.ts";
import {
  fetchTestFile,
  readRequestedUrl,
  testTexts,
} from "../../../test/test_files.ts";
import { FileFetchError } from "../../files/index.ts";
import { inspectMod } from "./mod_inspection.ts";

const CLOCK_MOD_SOURCE = "https://example.org/mods/clock/mod_conf.yaml";
const CLOCK_TEST_SOURCE = "https://example.org/mods/clock/test.js";

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

    const inspection = await inspectMod(SAMPLE_MOD_SOURCE, APP_ORIGIN, [], {
      baseUrl: APP_BASE_URL,
      fetch: testFetch,
    });

    expect(inspection).toEqual({
      source: SAMPLE_MOD_SOURCE,
      title: "Book List",
      version: "1.0.0",
      description: "A very simple list of books with their covers.",
      api: "^0.2.0",
      apiCompatible: true,
      typeSource: SAMPLE_TYPE_SOURCE,
      defaultMosaic: SAMPLE_DEFAULT_MOSAIC_SOURCE,
      testSource: null,
      config: { show_covers: true },
      libraries: [],
      permissions: { granted: [SAMPLE_COVERS_PERMISSION], denied: [] },
    });
    expect(listRequestedUrls(testFetch)).not.toContain(SAMPLE_ENTRYPOINT);
    expect(listRequestedUrls(testFetch)).not.toContain(
      SAMPLE_DEFAULT_MOSAIC_SOURCE,
    );
  });

  it("Inspect a mod with a library", async function inspectsModWithLibrary(): Promise<void> {
    serveLibraryMod();
    const testFetch = createTestFetch();

    const inspection = await inspectMod(LIBRARY_MOD_SOURCE, APP_ORIGIN, [], {
      fetch: testFetch,
      npmHost: TEST_NPM_HOST,
    });

    expect(inspection.libraries).toEqual([
      {
        name: "leaflet",
        package: "leaflet",
        version: "1.9.4",
        files: [
          {
            path: "dist/leaflet.js",
            source: LEAFLET_SCRIPT_SOURCE,
            kind: "script",
          },
          {
            path: "dist/leaflet.css",
            source: LEAFLET_STYLE_SOURCE,
            kind: "style",
          },
        ],
      },
      {
        name: "helper",
        package: null,
        version: null,
        files: [
          {
            path: "./vendor/helper.js",
            source: HELPER_SCRIPT_SOURCE,
            kind: "script",
          },
        ],
      },
    ]);
    expect(listRequestedUrls(testFetch)).toEqual([LIBRARY_MOD_SOURCE]);
  });

  it("Inspect a mod with tests", async function inspectsModWithTests(): Promise<void> {
    testTexts.set(
      CLOCK_MOD_SOURCE,
      'mod:\n  title: "clock"\n  version: "1.0.0"\n  entrypoint: "./main.js"\n  test_path: "./test.js"',
    );
    const testFetch = createTestFetch();

    const inspection = await inspectMod(CLOCK_MOD_SOURCE, APP_ORIGIN, [], {
      fetch: testFetch,
    });

    expect(inspection.testSource).toBe(CLOCK_TEST_SOURCE);
    expect(listRequestedUrls(testFetch)).toEqual([CLOCK_MOD_SOURCE]);
  });

  it("Inspect a mod without tests", async function inspectsModWithoutTests(): Promise<void> {
    serveUntypedMod();

    const inspection = await inspectMod(UNTYPED_MOD_SOURCE, APP_ORIGIN, [], {
      fetch: fetchTestFile,
    });

    expect(inspection.testSource).toBeNull();
  });

  it("gives the permissions a foreign mod would get", async function inspectsForeignMod(): Promise<void> {
    const inspection = await inspectMod(
      SAMPLE_MOD_SOURCE,
      OTHER_APP_ORIGIN,
      [],
      {
        fetch: fetchTestFile,
      },
    );

    expect(inspection.permissions).toEqual({
      granted: [],
      denied: [SAMPLE_COVERS_PERMISSION],
    });
  });

  it("Inspect a foreign mod with a remembered allow", async function inspectsRememberedAllow(): Promise<void> {
    const inspection = await inspectMod(
      SAMPLE_MOD_SOURCE,
      OTHER_APP_ORIGIN,
      [buildSampleCoversDecision(true)],
      { fetch: fetchTestFile },
    );

    expect(inspection.permissions).toEqual({
      granted: [SAMPLE_COVERS_PERMISSION],
      denied: [],
    });
  });

  it("Inspect a mod for another API", async function inspectsOtherApiMod(): Promise<void> {
    serveOtherApiMod();

    const inspection = await inspectMod(OTHER_API_MOD_SOURCE, APP_ORIGIN, [], {
      fetch: fetchTestFile,
    });

    expect(inspection.api).toBe(OTHER_API_RANGE);
    expect(inspection.apiCompatible).toBe(false);
  });

  it("Inspect a mod without a range", async function inspectsModWithoutRange(): Promise<void> {
    serveUntypedMod(null);

    const inspection = await inspectMod(UNTYPED_MOD_SOURCE, APP_ORIGIN, [], {
      fetch: fetchTestFile,
    });

    expect(inspection.api).toBeNull();
    expect(inspection.apiCompatible).toBeNull();
  });

  it("Inspect a missing mod", async function inspectsMissingMod(): Promise<void> {
    const inspecting = inspectMod(MISSING_MOD_SOURCE, APP_ORIGIN, [], {
      fetch: fetchTestFile,
    });

    await expect(inspecting).rejects.toThrow(FileFetchError);
    await expect(inspecting).rejects.toThrow(/missing\/mod_conf\.yaml.*404/);
  });

  it("Structured clone of an inspection", async function clonesInspection(): Promise<void> {
    const inspection = await inspectMod(SAMPLE_MOD_SOURCE, APP_ORIGIN, [], {
      fetch: fetchTestFile,
    });

    expect(structuredClone(inspection)).toEqual(inspection);
  });
});
