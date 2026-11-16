import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  buildMethodContext,
  buildOpenPermission,
  catchMethodError,
} from "../../../test/method_contexts.ts";
import { APP_BASE_URL, FIXTURES_BASE_URL } from "../../../test/sample_files.ts";
import {
  fetchTestFile,
  readRequestedUrl,
  testTexts,
} from "../../../test/test_files.ts";
import { COLLECTIONS_METHODS } from "./collections_methods.ts";
import {
  INVALID_PARAMS,
  LOAD_FAILED,
  PERMISSION_DENIED,
} from "./mod_messages.ts";
import type { ModMethodContext, OpenLinkOutcome } from "./mod_methods.ts";

const SAMPLE_COLLECTION_REFERENCE = "./fixtures/tiles/books_collection.yaml";
const SAMPLE_COLLECTION_SOURCE = `${FIXTURES_BASE_URL}tiles/books_collection.yaml`;
const BOOKS_URL = `${FIXTURES_BASE_URL}tiles/books/`;
const MISSING_COLLECTION_SOURCE = `${FIXTURES_BASE_URL}tiles/missing.yaml`;
const REMOTE_COLLECTION_SOURCE = "https://tiles.example.net/books.yaml";

const REMOTE_COLLECTION_TEXT =
  'collection:\n  name: "Remote books"\n  tiles:\n    - path: "./kallocain.md"\n';

afterEach(function clearTestTexts(): void {
  testTexts.clear();
});

function inspectCollection(
  context: ModMethodContext,
  params: object,
): Promise<unknown> {
  return COLLECTIONS_METHODS["collections.inspect"](context, params as never);
}

/** A context granted `open` for `hosts`, whose fetch is a spy. */
function buildSpiedContext(hosts: string[]): {
  context: ModMethodContext;
  fetchSpy: Mock<typeof fetch>;
} {
  const permissions = [];
  for (const host of hosts) {
    permissions.push(buildOpenPermission(host));
  }
  const context = buildMethodContext(permissions);
  const fetchSpy = vi.fn<typeof fetch>(fetchTestFile);
  context.fetchOptions = { baseUrl: APP_BASE_URL, fetch: fetchSpy };
  const spiedContext = { context, fetchSpy };
  return spiedContext;
}

function readRequestedUrls(fetchSpy: Mock<typeof fetch>): string[] {
  const requestedUrls: string[] = [];
  for (const call of fetchSpy.mock.calls) {
    requestedUrls.push(readRequestedUrl(call[0]));
  }
  return requestedUrls;
}

function returnNotVisible(): null {
  return null;
}

function refuseOpenLink(): OpenLinkOutcome {
  return "not-visible";
}

describe("collections.inspect", function describeCollectionsInspect(): void {
  describe("index", function describeIndex(): void {
    it("Inspect the sample collection", async function inspectsSample(): Promise<void> {
      const { context, fetchSpy } = buildSpiedContext([
        APP_BASE_URL.slice(0, -1),
      ]);

      const inspection = await inspectCollection(context, {
        collection: SAMPLE_COLLECTION_REFERENCE,
      });

      expect(inspection).toStrictEqual({
        source: SAMPLE_COLLECTION_SOURCE,
        name: "Science fiction books",
        description: "A sample book list for demonstration purposes.",
        tiles: [
          `${BOOKS_URL}farenheit_451.md`,
          `${BOOKS_URL}kallocain.md`,
          `${BOOKS_URL}fictions.md`,
        ],
        issues: [],
      });
      expect(readRequestedUrls(fetchSpy)).toEqual([SAMPLE_COLLECTION_SOURCE]);
    });

    it("Collection folder", async function inspectsFolder(): Promise<void> {
      const folderSource = `${FIXTURES_BASE_URL}tiles/books/collection.yaml`;
      testTexts.set(
        folderSource,
        'collection:\n  name: "Folder books"\n  tiles:\n    - path: "./kallocain.md"\n',
      );
      const { context } = buildSpiedContext([APP_BASE_URL.slice(0, -1)]);

      const collectionIndex = await inspectCollection(context, {
        collection: "./fixtures/tiles/books",
      });

      expect(collectionIndex).toMatchObject({ source: folderSource });
    });

    it("Entry issues are returned", async function returnsEntryIssues(): Promise<void> {
      const { context } = buildSpiedContext(["*"]);
      testTexts.set(
        SAMPLE_COLLECTION_SOURCE,
        'collection:\n  name: "A"\n  tiles:\n    - path: "./books/kallocain.md"\n    - { path: "./a.md", url: "https://example.org/a.md" }\n',
      );

      const inspection = (await inspectCollection(context, {
        collection: SAMPLE_COLLECTION_REFERENCE,
      })) as { tiles: string[]; issues: { level: string; message: string }[] };

      expect(inspection.tiles).toEqual([`${BOOKS_URL}kallocain.md`]);
      expect(inspection.issues).toHaveLength(1);
      expect(inspection.issues[0].level).toBe("error");
      expect(inspection.issues[0].message).toContain("entry 2");
    });

    it("Structured clone of a collection inspection", async function clonesInspection(): Promise<void> {
      const { context } = buildSpiedContext(["*"]);

      const inspection = await inspectCollection(context, {
        collection: SAMPLE_COLLECTION_REFERENCE,
      });

      expect(structuredClone(inspection)).toStrictEqual(inspection);
    });

    it("Same collection from two mods", async function resolvesAgainstApp(): Promise<void> {
      const { context } = buildSpiedContext(["*"]);
      context.mod = {
        ...context.mod,
        source: `${APP_BASE_URL}default_mods/collection_viewer/mod_conf.yaml`,
      };

      const inspection = await inspectCollection(context, {
        collection: SAMPLE_COLLECTION_REFERENCE,
      });

      expect(inspection).toMatchObject({ source: SAMPLE_COLLECTION_SOURCE });
    });

    it("Hidden mod inspects", async function answersHiddenMod(): Promise<void> {
      const { context } = buildSpiedContext(["*"]);
      context.onOpenLink = refuseOpenLink;
      context.onRequestAction = returnNotVisible;
      context.onCheckMod = returnNotVisible;

      const inspection = await inspectCollection(context, {
        collection: SAMPLE_COLLECTION_REFERENCE,
      });

      expect(inspection).toMatchObject({ source: SAMPLE_COLLECTION_SOURCE });
    });
  });

  describe("failures", function describeFailures(): void {
    it("Missing collection file", async function reportsMissingFile(): Promise<void> {
      const { context } = buildSpiedContext(["*"]);

      const error = await catchMethodError(function sendInspect(): unknown {
        return inspectCollection(context, {
          collection: "./fixtures/tiles/missing.yaml",
        });
      });

      expect(error.code).toBe(LOAD_FAILED);
      expect(error.message).toContain(MISSING_COLLECTION_SOURCE);
      expect(error.message).toContain("404");
    });

    it("Collection without a tiles list", async function reportsMissingTiles(): Promise<void> {
      const { context } = buildSpiedContext(["*"]);
      testTexts.set(SAMPLE_COLLECTION_SOURCE, 'collection:\n  name: "A"\n');

      const error = await catchMethodError(function sendInspect(): unknown {
        return inspectCollection(context, {
          collection: SAMPLE_COLLECTION_REFERENCE,
        });
      });

      expect(error.code).toBe(LOAD_FAILED);
      expect(error.message).toContain('"tiles" must be a list');
    });

    it("Missing collection param", async function rejectsMissingParam(): Promise<void> {
      const { context, fetchSpy } = buildSpiedContext(["*"]);

      const error = await catchMethodError(function sendInspect(): unknown {
        return inspectCollection(context, {});
      });

      expect(error.code).toBe(INVALID_PARAMS);
      expect(error.message).toBe(
        'collections.inspect: "collection" must be a non-empty string',
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("rejects a location that cannot be resolved", async function rejectsUnresolvable(): Promise<void> {
      const { context, fetchSpy } = buildSpiedContext(["*"]);

      const error = await catchMethodError(function sendInspect(): unknown {
        return inspectCollection(context, { collection: "https://" });
      });

      expect(error.code).toBe(INVALID_PARAMS);
      expect(error.message).toContain("collections.inspect");
      expect(error.message).toContain('"https://"');
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("open permission", function describeOpenPermission(): void {
    it("Mod without the open permission", async function refusesWithoutGrant(): Promise<void> {
      const { context, fetchSpy } = buildSpiedContext([]);

      const error = await catchMethodError(function sendInspect(): unknown {
        return inspectCollection(context, {
          collection: REMOTE_COLLECTION_SOURCE,
        });
      });

      expect(error.code).toBe(PERMISSION_DENIED);
      expect(error.message).toBe(
        "Inspecting collections from https://tiles.example.net is not allowed. Add it to permissions.open in mod_conf.yaml.",
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("Foreign mod declares open", async function refusesDeniedGrant(): Promise<void> {
      const { context, fetchSpy } = buildSpiedContext([]);
      context.grants = { granted: [], denied: [buildOpenPermission("*")] };
      const requestActionSpy = vi.fn<ModMethodContext["onRequestAction"]>();
      context.onRequestAction = requestActionSpy;

      const error = await catchMethodError(function sendInspect(): unknown {
        return inspectCollection(context, {
          collection: REMOTE_COLLECTION_SOURCE,
        });
      });

      expect(error.code).toBe(PERMISSION_DENIED);
      expect(error.message).toContain("the permission was not granted");
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(requestActionSpy).not.toHaveBeenCalled();
    });

    it("Any site", async function inspectsAnySite(): Promise<void> {
      const { context, fetchSpy } = buildSpiedContext(["*"]);
      testTexts.set(REMOTE_COLLECTION_SOURCE, REMOTE_COLLECTION_TEXT);

      const inspection = await inspectCollection(context, {
        collection: REMOTE_COLLECTION_SOURCE,
      });

      expect(inspection).toMatchObject({
        source: REMOTE_COLLECTION_SOURCE,
        name: "Remote books",
        tiles: ["https://tiles.example.net/kallocain.md"],
      });
      expect(readRequestedUrls(fetchSpy)).toEqual([REMOTE_COLLECTION_SOURCE]);
    });

    it("Declared open covers collections", async function inspectsDeclaredOrigin(): Promise<void> {
      const { context, fetchSpy } = buildSpiedContext([
        "https://tiles.example.net",
      ]);
      testTexts.set(REMOTE_COLLECTION_SOURCE, REMOTE_COLLECTION_TEXT);

      const inspection = await inspectCollection(context, {
        collection: REMOTE_COLLECTION_SOURCE,
      });

      expect(inspection).toMatchObject({ source: REMOTE_COLLECTION_SOURCE });
      expect(readRequestedUrls(fetchSpy)).toEqual([REMOTE_COLLECTION_SOURCE]);
    });
  });
});
