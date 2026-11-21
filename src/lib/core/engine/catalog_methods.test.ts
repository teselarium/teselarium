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
import type { UserCatalogEntry } from "../../user_catalog/index.ts";
import type { ResolvedInstanceCatalog } from "./instance_catalog.ts";
import { buildCatalog } from "./catalog.ts";
import type { Catalog } from "./catalog.ts";
import { CATALOG_METHODS } from "./catalog_methods.ts";
import type { ModMethodContext } from "./mod_methods.ts";

const CATALOG: ResolvedInstanceCatalog = {
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

const STORED_ENTRY: UserCatalogEntry = {
  address: "opentesela-browser:///r1/maps/nobel_map.yaml",
  place: "browser",
  root: "r1",
  provenance: {
    folder: "my-mosaics",
    path: "maps/nobel_map.yaml",
    addedAt: "2026-11-20T10:00:00.000Z",
    updatedAt: null,
  },
};

const REMOTE_ENTRY: UserCatalogEntry = {
  address: "https://mosaics.example.net/maps/laureates.yml",
  place: "remote",
  root: null,
  provenance: {
    folder: null,
    path: null,
    addedAt: "2026-11-20T11:00:00.000Z",
    updatedAt: null,
  },
};

const INSTANCE_MARKS = { listedBy: "instance", place: "remote" };

/**
 * A context of a mod with no permission, whose catalog is `CATALOG` with the
 * switch and the user catalog as given. Requests go to `requested`.
 */
function buildCatalogContext(
  includesDefaultMosaics: boolean,
  requested: string[],
  userCatalog: readonly UserCatalogEntry[] = [],
): ModMethodContext {
  const context = buildMethodContext([]);
  context.fetchOptions = {
    ...context.fetchOptions,
    fetch: recordFetch.bind(undefined, requested),
  };
  context.readCatalog = buildCatalog.bind(
    undefined,
    CATALOG,
    includesDefaultMosaics,
    userCatalog,
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
      mods: [{ source: SAMPLE_MOD_SOURCE, ...INSTANCE_MARKS }],
      collections: [{ source: SAMPLE_COLLECTION_SOURCE, ...INSTANCE_MARKS }],
      mosaics: [
        {
          source: SAMPLE_MOSAIC_SOURCE,
          ...INSTANCE_MARKS,
          defaultOf: null,
          provenance: null,
        },
      ],
    });
  });

  it("Default mosaic entry", async function answersDefaultMosaic(): Promise<void> {
    const requested: string[] = [];
    const context = buildCatalogContext(true, requested);

    const result = await listCatalog(context, {});

    expect(result).toEqual({
      mods: [{ source: SAMPLE_MOD_SOURCE, ...INSTANCE_MARKS }],
      collections: [{ source: SAMPLE_COLLECTION_SOURCE, ...INSTANCE_MARKS }],
      mosaics: [
        {
          source: SAMPLE_MOSAIC_SOURCE,
          ...INSTANCE_MARKS,
          defaultOf: null,
          provenance: null,
        },
        {
          source: SAMPLE_DEFAULT_MOSAIC_SOURCE,
          listedBy: "default",
          place: "remote",
          defaultOf: { source: SAMPLE_MOD_SOURCE, title: "Book List" },
          provenance: null,
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
    expect(result).toHaveProperty("mods", [
      { source: SAMPLE_MOD_SOURCE, ...INSTANCE_MARKS },
    ]);
    expect(requested).toEqual([]);
  });

  it("ignores its params", async function ignoresParams(): Promise<void> {
    const context = buildCatalogContext(false, []);

    const result = await listCatalog(context, {
      mods: [`${APP_BASE_URL}other/mod_conf.yaml`],
    });

    expect(result).toHaveProperty("mods", [
      { source: SAMPLE_MOD_SOURCE, ...INSTANCE_MARKS },
    ]);
  });

  it("Stored user mosaic entry", async function answersStoredMosaic(): Promise<void> {
    const context = buildCatalogContext(false, [], [STORED_ENTRY]);

    const result = (await listCatalog(context, {})) as Catalog;

    expect(result.mosaics.at(-1)).toEqual({
      source: STORED_ENTRY.address,
      listedBy: "user",
      place: "browser",
      defaultOf: null,
      provenance: STORED_ENTRY.provenance,
    });
  });

  it("Remote entry", async function answersRemoteMosaic(): Promise<void> {
    const context = buildCatalogContext(false, [], [REMOTE_ENTRY]);

    const result = (await listCatalog(context, {})) as Catalog;

    expect(result.mosaics.at(-1)).toEqual({
      source: REMOTE_ENTRY.address,
      listedBy: "user",
      place: "remote",
      defaultOf: null,
      provenance: {
        folder: null,
        path: null,
        addedAt: "2026-11-20T11:00:00.000Z",
        updatedAt: null,
      },
    });
  });
});
