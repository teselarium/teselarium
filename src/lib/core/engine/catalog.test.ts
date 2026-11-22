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
import type { UserCatalogEntry } from "../../user_catalog/index.ts";
import { buildCatalog } from "./catalog.ts";
import type { CatalogEntry, CatalogMosaicEntry } from "./catalog.ts";
import type { ResolvedInstanceCatalog } from "./instance_catalog.ts";

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

function buildInstanceCatalog(
  lists: Partial<ResolvedInstanceCatalog>,
): ResolvedInstanceCatalog {
  const instanceCatalog: ResolvedInstanceCatalog = {
    mods: [],
    collections: [],
    mosaics: [],
    ...lists,
  };
  return instanceCatalog;
}

const BOOK_LIST_MARK = { source: SAMPLE_MOD_SOURCE, title: "Book List" };

const STORED_ENTRY: UserCatalogEntry = {
  address: "opentesela-browser:///r1/maps/nobel_map.yaml",
  place: "browser",
  root: "r1",
  provenance: {
    folder: "my-mosaics",
    path: "maps/nobel_map.yaml",
    addedAt: "2026-11-20T10:00:00.000Z",
    updatedAt: null,
    changedSinceExport: false,
    copiedFrom: null,
  },
  syncedAt: "2026-11-20T10:00:00.000Z",
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
    changedSinceExport: false,
    copiedFrom: null,
  },
  syncedAt: null,
};

/** The user catalog entry of the book list's default mosaic, added by URL. */
const DEFAULT_MOSAIC_ENTRY: UserCatalogEntry = {
  ...REMOTE_ENTRY,
  address: SAMPLE_DEFAULT_MOSAIC_SOURCE,
};

function markInstanceEntry(source: string): CatalogEntry {
  const entry: CatalogEntry = { source, listedBy: "instance", place: "remote" };
  return entry;
}

function markInstanceMosaic(source: string): CatalogMosaicEntry {
  const entry: CatalogMosaicEntry = {
    source,
    listedBy: "instance",
    place: "remote",
    defaultOf: null,
    provenance: null,
  };
  return entry;
}

function markDefaultMosaic(source: string): CatalogMosaicEntry {
  const entry: CatalogMosaicEntry = {
    source,
    listedBy: "default",
    place: "remote",
    defaultOf: BOOK_LIST_MARK,
    provenance: null,
  };
  return entry;
}

function markUserMosaic(entry: UserCatalogEntry): CatalogMosaicEntry {
  const mosaic: CatalogMosaicEntry = {
    source: entry.address,
    listedBy: "user",
    place: entry.place,
    defaultOf: null,
    provenance: entry.provenance,
  };
  return mosaic;
}

describe("buildCatalog", function describeBuildCatalog(): void {
  it("lists the catalog with nothing fetched while the switch is off", async function listsWithoutFetching(): Promise<void> {
    const recording = buildRecordingFetch();

    const catalog = await buildCatalog(
      buildInstanceCatalog({
        mods: [SAMPLE_MOD_SOURCE],
        collections: [SAMPLE_COLLECTION_SOURCE],
        mosaics: [SAMPLE_MOSAIC_SOURCE],
      }),
      false,
      [],
      recording.fetchOptions,
    );

    expect(catalog).toEqual({
      mods: [markInstanceEntry(SAMPLE_MOD_SOURCE)],
      collections: [markInstanceEntry(SAMPLE_COLLECTION_SOURCE)],
      mosaics: [markInstanceMosaic(SAMPLE_MOSAIC_SOURCE)],
    });
    expect(recording.requested).toEqual([]);
  });

  it("Vanilla default mosaics", async function addsDefaultMosaics(): Promise<void> {
    serveUntypedMod();
    const recording = buildRecordingFetch();

    const catalog = await buildCatalog(
      buildInstanceCatalog({
        mods: [SAMPLE_MOD_SOURCE, UNTYPED_MOD_SOURCE],
        mosaics: [SAMPLE_MOSAIC_SOURCE],
      }),
      true,
      [],
      recording.fetchOptions,
    );

    expect(catalog.mosaics).toEqual([
      markInstanceMosaic(SAMPLE_MOSAIC_SOURCE),
      markDefaultMosaic(SAMPLE_DEFAULT_MOSAIC_SOURCE),
    ]);
    expect([...recording.requested].sort()).toEqual(
      [SAMPLE_MOD_SOURCE, UNTYPED_MOD_SOURCE].sort(),
    );
  });

  it("Mod that cannot be loaded", async function skipsMissingMod(): Promise<void> {
    const recording = buildRecordingFetch();

    const catalog = await buildCatalog(
      buildInstanceCatalog({ mods: [MISSING_MOD_SOURCE, SAMPLE_MOD_SOURCE] }),
      true,
      [],
      recording.fetchOptions,
    );

    expect(catalog.mods).toEqual([
      markInstanceEntry(MISSING_MOD_SOURCE),
      markInstanceEntry(SAMPLE_MOD_SOURCE),
    ]);
    expect(catalog.mosaics).toEqual([
      markDefaultMosaic(SAMPLE_DEFAULT_MOSAIC_SOURCE),
    ]);
  });

  it("Default mosaic also in the instance catalog", async function keepsInstanceCatalogPlace(): Promise<void> {
    const recording = buildRecordingFetch();

    const catalog = await buildCatalog(
      buildInstanceCatalog({
        mods: [SAMPLE_MOD_SOURCE],
        mosaics: [SAMPLE_DEFAULT_MOSAIC_SOURCE, SAMPLE_MOSAIC_SOURCE],
      }),
      true,
      [],
      recording.fetchOptions,
    );

    expect(catalog.mosaics).toEqual([
      markInstanceMosaic(SAMPLE_DEFAULT_MOSAIC_SOURCE),
      markInstanceMosaic(SAMPLE_MOSAIC_SOURCE),
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

    const catalog = await buildCatalog(
      buildInstanceCatalog({ mods: [SAMPLE_MOD_SOURCE, otherModSource] }),
      true,
      [],
      recording.fetchOptions,
    );

    expect(catalog.mosaics).toEqual([
      markDefaultMosaic(SAMPLE_DEFAULT_MOSAIC_SOURCE),
    ]);
  });

  it("With user mosaics", async function addsUserMosaics(): Promise<void> {
    const recording = buildRecordingFetch();

    const catalog = await buildCatalog(
      buildInstanceCatalog({
        mods: [SAMPLE_MOD_SOURCE],
        mosaics: [SAMPLE_MOSAIC_SOURCE],
      }),
      true,
      [STORED_ENTRY, REMOTE_ENTRY],
      recording.fetchOptions,
    );

    expect(catalog.mosaics).toEqual([
      markInstanceMosaic(SAMPLE_MOSAIC_SOURCE),
      markDefaultMosaic(SAMPLE_DEFAULT_MOSAIC_SOURCE),
      markUserMosaic(STORED_ENTRY),
      markUserMosaic(REMOTE_ENTRY),
    ]);
    expect(recording.requested).toEqual([SAMPLE_MOD_SOURCE]);
  });

  it("Marks of the vanilla catalog with a user mosaic", async function marksEntries(): Promise<void> {
    const recording = buildRecordingFetch();

    const catalog = await buildCatalog(
      buildInstanceCatalog({ mods: [SAMPLE_MOD_SOURCE] }),
      true,
      [STORED_ENTRY],
      recording.fetchOptions,
    );

    expect(catalog.mods).toEqual([markInstanceEntry(SAMPLE_MOD_SOURCE)]);
    expect(catalog.mosaics[0]).toMatchObject({
      listedBy: "default",
      place: "remote",
    });
    expect(catalog.mosaics[1]).toMatchObject({
      source: STORED_ENTRY.address,
      listedBy: "user",
      place: "browser",
      defaultOf: null,
      provenance: STORED_ENTRY.provenance,
    });
  });

  it("Default mosaic also added by the user", async function keepsEarlierPlace(): Promise<void> {
    const recording = buildRecordingFetch();
    const instanceCatalog = buildInstanceCatalog({ mods: [SAMPLE_MOD_SOURCE] });

    const switchedOn = await buildCatalog(
      instanceCatalog,
      true,
      [DEFAULT_MOSAIC_ENTRY],
      recording.fetchOptions,
    );
    const switchedOff = await buildCatalog(
      instanceCatalog,
      false,
      [DEFAULT_MOSAIC_ENTRY],
      recording.fetchOptions,
    );

    expect(switchedOn.mosaics).toEqual([
      markDefaultMosaic(SAMPLE_DEFAULT_MOSAIC_SOURCE),
    ]);
    expect(switchedOff.mosaics).toEqual([markUserMosaic(DEFAULT_MOSAIC_ENTRY)]);
  });

  it("lists a user mosaic of the instance catalog once, at its first place", async function dedupesInstanceMosaic(): Promise<void> {
    const recording = buildRecordingFetch();

    const catalog = await buildCatalog(
      buildInstanceCatalog({ mosaics: [SAMPLE_MOSAIC_SOURCE] }),
      false,
      [{ ...REMOTE_ENTRY, address: SAMPLE_MOSAIC_SOURCE }],
      recording.fetchOptions,
    );

    expect(catalog.mosaics).toEqual([markInstanceMosaic(SAMPLE_MOSAIC_SOURCE)]);
  });

  it("gives each entry a provenance of its own", async function copiesProvenance(): Promise<void> {
    const recording = buildRecordingFetch();

    const catalog = await buildCatalog(
      buildInstanceCatalog({}),
      false,
      [STORED_ENTRY],
      recording.fetchOptions,
    );

    expect(catalog.mosaics[0].provenance).not.toBe(STORED_ENTRY.provenance);
  });

  it("Saved copy", async function listsSavedCopy(): Promise<void> {
    const recording = buildRecordingFetch();
    const sampleAddress =
      "https://example.org/samples/mosaics/nobel_laureates_map.yaml";
    const copy: UserCatalogEntry = {
      ...STORED_ENTRY,
      address: "opentesela-browser:///r9/laureates_my_way.yaml",
      provenance: {
        ...STORED_ENTRY.provenance,
        folder: null,
        path: "laureates_my_way.yaml",
        changedSinceExport: true,
        copiedFrom: sampleAddress,
      },
      syncedAt: null,
    };

    const catalog = await buildCatalog(
      buildInstanceCatalog({}),
      false,
      [copy],
      recording.fetchOptions,
    );

    expect(catalog.mosaics[0].provenance).toEqual({
      folder: null,
      path: "laureates_my_way.yaml",
      addedAt: STORED_ENTRY.provenance.addedAt,
      updatedAt: null,
      changedSinceExport: true,
      copiedFrom: sampleAddress,
    });
    expect(catalog.mosaics[0]).not.toHaveProperty("syncedAt");
  });
});
