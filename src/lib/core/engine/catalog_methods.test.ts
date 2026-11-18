import { describe, expect, it } from "vitest";
import { buildMethodContext } from "../../../test/method_contexts.ts";
import { APP_BASE_URL } from "../../../test/sample_files.ts";
import {
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_DEFAULT_MOSAIC_SOURCE,
  SAMPLE_MOD_SOURCE,
  SAMPLE_MOSAIC_SOURCE,
} from "../../../test/sample_mods.ts";
import { fetchTestFile, readRequestedUrl } from "../../../test/test_files.ts";
import type { ResolvedAppCatalog } from "./app_catalog.ts";
import { buildCatalogListing } from "./catalog_listing.ts";
import { CATALOG_METHODS } from "./catalog_methods.ts";
import type { ModMethodContext } from "./mod_methods.ts";

const CATALOG: ResolvedAppCatalog = {
  mods: [SAMPLE_MOD_SOURCE],
  collections: [SAMPLE_COLLECTION_SOURCE],
  mosaics: [SAMPLE_MOSAIC_SOURCE],
};

function recordFetch(
  requested: string[],
  input: RequestInfo | URL,
): Promise<Response> {
  requested.push(readRequestedUrl(input));
  return fetchTestFile(input);
}

/** A context of a mod with no permission, whose catalog is `CATALOG` with the switch as given. Requests go to `requested`. */
function buildCatalogContext(
  includesDefaultMosaics: boolean,
  requested: string[],
): ModMethodContext {
  const context = buildMethodContext([]);
  context.fetchOptions = {
    ...context.fetchOptions,
    fetch: recordFetch.bind(undefined, requested),
  };
  context.readCatalog = buildCatalogListing.bind(
    undefined,
    CATALOG,
    includesDefaultMosaics,
    context.fetchOptions,
  );
  return context;
}

function listCatalog(
  context: ModMethodContext,
  params: object,
): Promise<unknown> {
  return CATALOG_METHODS["catalog.list"](context, params as never);
}

describe("catalog.list", function describeCatalogList(): void {
  it("Vanilla catalog", async function answersCatalog(): Promise<void> {
    const context = buildCatalogContext(false, []);

    const result = await listCatalog(context, {});

    expect(result).toEqual({
      mods: [{ source: SAMPLE_MOD_SOURCE }],
      collections: [{ source: SAMPLE_COLLECTION_SOURCE }],
      mosaics: [{ source: SAMPLE_MOSAIC_SOURCE, defaultOf: null }],
    });
  });

  it("Default mosaic entry", async function answersDefaultMosaic(): Promise<void> {
    const requested: string[] = [];
    const context = buildCatalogContext(true, requested);

    const result = await listCatalog(context, {});

    expect(result).toEqual({
      mods: [{ source: SAMPLE_MOD_SOURCE }],
      collections: [{ source: SAMPLE_COLLECTION_SOURCE }],
      mosaics: [
        { source: SAMPLE_MOSAIC_SOURCE, defaultOf: null },
        {
          source: SAMPLE_DEFAULT_MOSAIC_SOURCE,
          defaultOf: { source: SAMPLE_MOD_SOURCE, title: "Book List" },
        },
      ],
    });
    expect(requested).toEqual([SAMPLE_MOD_SOURCE]);
  });

  it("Mod without permissions", async function needsNoPermission(): Promise<void> {
    const requested: string[] = [];
    const context = buildCatalogContext(false, requested);

    const result = await listCatalog(context, {});

    expect(context.grants.granted).toEqual([]);
    expect(result).toHaveProperty("mods", [{ source: SAMPLE_MOD_SOURCE }]);
    expect(requested).toEqual([]);
  });

  it("ignores its params", async function ignoresParams(): Promise<void> {
    const context = buildCatalogContext(false, []);

    const result = await listCatalog(context, {
      mods: [`${APP_BASE_URL}other/mod_conf.yaml`],
    });

    expect(result).toHaveProperty("mods", [{ source: SAMPLE_MOD_SOURCE }]);
  });
});
