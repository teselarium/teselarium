import { describe, expect, it } from "vitest";
import type { LocalFiles, PickedFile } from "../files/index.ts";
import { createMemoryBrowserDatabase } from "../core/storage/index.ts";
import type { BrowserDatabase } from "../core/storage/index.ts";
import { loadMosaicFile } from "../mosaic/index.ts";
import type { LoadedMosaic } from "../mosaic/index.ts";
import {
  applyReview,
  listDefaultChecked,
  planImport,
  planUpdate,
} from "./index.ts";
import type {
  ImportReview,
  ImportReviewRow,
  ReviewSources,
  UserCatalogEntry,
} from "./index.ts";

const DEFAULT_MODS_FOLDER = "https://example.org/default_mods/";
const IMPORT_TIME = new Date("2026-11-20T10:00:00.000Z");
const UPDATE_TIME = new Date("2026-11-21T09:30:00.000Z");

function writeMosaic(title: string, collection: string): string {
  const text = [
    "mosaic:",
    `  title: "${title}"`,
    '  mod: "https://mods.example.net/book_list/"',
    `  collection: "${collection}"`,
    "",
  ].join("\n");
  return text;
}

const NOBEL_TEXT = writeMosaic(
  "Nobel map",
  "https://tiles.example.net/laureates/",
);
const POETS_TEXT = writeMosaic("Poets", "https://tiles.example.net/poets/");
const BROKEN_TEXT = 'mosaic:\n  mod: "https://mods.example.net/book_list/"\n';

function pickFile(path: string, text: string): PickedFile {
  const pickedFile: PickedFile = { path, content: new Blob([text]) };
  return pickedFile;
}

function readPickedMosaic(
  address: string,
  localFiles: LocalFiles,
): Promise<LoadedMosaic> {
  return loadMosaicFile(address, {
    localFiles,
    defaultModsFolder: DEFAULT_MODS_FOLDER,
  });
}

/** Gives roots `root-1`, `root-2`… in order. */
class CountingRoots {
  private count = 0;

  createRoot(): string {
    this.count += 1;
    return `root-${this.count}`;
  }
}

async function readSources(
  database: BrowserDatabase<UserCatalogEntry>,
): Promise<ReviewSources> {
  const roots = new CountingRoots();
  const sources: ReviewSources = {
    entries: await database.readEntries(),
    storedFiles: database,
    readMosaic: readPickedMosaic,
    createRoot: roots.createRoot.bind(roots),
  };
  return sources;
}

function readRowSummary(row: ImportReviewRow): string {
  return `${row.path}: ${row.status}`;
}

function listRowSummaries(review: ImportReview): string[] {
  const summaries = review.rows.map(readRowSummary);
  return summaries;
}

function findRow(review: ImportReview, path: string): ImportReviewRow {
  for (const row of review.rows) {
    if (row.path === path) {
      return row;
    }
  }
  throw new Error(`The review has no row for "${path}"`);
}

async function importMyMosaics(
  database: BrowserDatabase<UserCatalogEntry>,
  picked: PickedFile[],
): Promise<void> {
  const review = await planImport(
    picked,
    "my-mosaics",
    await readSources(database),
  );
  await database.apply(
    applyReview(review, listDefaultChecked(review), IMPORT_TIME),
  );
}

describe("planImport", function describePlanImport(): void {
  it("Folder with other files", async function ignoresOtherFiles(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();

    const review = await planImport(
      [
        pickFile("nobel_map.yaml", NOBEL_TEXT),
        pickFile("notes.md", "# Notes"),
        pickFile("tiles/a.md", "# A"),
      ],
      "my-mosaics",
      await readSources(database),
    );

    expect(listRowSummaries(review)).toEqual(["nobel_map.yaml: new"]);
    expect(review.ignoredCount).toBe(2);
  });

  it("New file of a folder", async function plansNewFile(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();

    const review = await planImport(
      [pickFile("maps/nobel_map.yaml", NOBEL_TEXT)],
      "my-mosaics",
      await readSources(database),
    );

    expect(review.rows).toEqual([
      {
        path: "maps/nobel_map.yaml",
        status: "new",
        title: "Nobel map",
        error: null,
        warnings: [],
        address: "opentesela-browser:///root-1/maps/nobel_map.yaml",
        root: "root-1",
        text: NOBEL_TEXT,
        entry: null,
      },
    ]);
  });

  it("Picked again after a change", async function plansChangedFolder(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    await importMyMosaics(database, [
      pickFile("nobel_map.yaml", NOBEL_TEXT),
      pickFile("maps/other.yaml", POETS_TEXT),
    ]);

    const review = await planImport(
      [
        pickFile(
          "nobel_map.yaml",
          writeMosaic("Nobel map 2", "https://a.example/"),
        ),
        pickFile("maps/other.yaml", POETS_TEXT),
        pickFile("poets.yaml", POETS_TEXT),
      ],
      "my-mosaics",
      await readSources(database),
    );

    expect(listRowSummaries(review)).toEqual([
      "nobel_map.yaml: changed",
      "maps/other.yaml: unchanged",
      "poets.yaml: new",
    ]);
  });

  it("reuses the root of a folder name imported before", async function reusesRoot(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    await importMyMosaics(database, [pickFile("nobel_map.yaml", NOBEL_TEXT)]);

    const review = await planImport(
      [
        pickFile("nobel_map.yaml", POETS_TEXT),
        pickFile("poets.yaml", POETS_TEXT),
      ],
      "my-mosaics",
      await readSources(database),
    );

    const [storedEntry] = await database.readEntries();
    expect(findRow(review, "nobel_map.yaml").address).toBe(storedEntry.address);
    expect(findRow(review, "nobel_map.yaml").entry).toEqual(storedEntry);
    expect(findRow(review, "poets.yaml").address).toBe(
      "opentesela-browser:///root-1/poets.yaml",
    );
  });

  it("gives each single file a root of its own", async function separatesSingleFiles(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();

    const review = await planImport(
      [
        pickFile("nobel_map.yaml", NOBEL_TEXT),
        pickFile("poets.yaml", POETS_TEXT),
      ],
      null,
      await readSources(database),
    );

    expect(review.rows[0].address).toBe(
      "opentesela-browser:///root-1/nobel_map.yaml",
    );
    expect(review.rows[1].address).toBe(
      "opentesela-browser:///root-2/poets.yaml",
    );
  });

  it("Invalid mosaic", async function plansInvalidMosaic(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();

    const review = await planImport(
      [pickFile("broken.yaml", BROKEN_TEXT)],
      "my-mosaics",
      await readSources(database),
    );

    const row = findRow(review, "broken.yaml");
    expect(row.status).toBe("invalid");
    expect(row.error).toContain('"title" must be a non-empty string');
    expect(listDefaultChecked(review)).toEqual(new Set());
  });

  it("File above 1 MB", async function plansLargeFile(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    const largeText = `${NOBEL_TEXT}#${"x".repeat(1024 * 1024)}\n`;

    const review = await planImport(
      [pickFile("large.yaml", largeText)],
      "my-mosaics",
      await readSources(database),
    );

    expect(findRow(review, "large.yaml")).toMatchObject({
      status: "invalid",
      error: "larger than 1 MB",
      text: null,
    });
  });

  it("File deleted from the folder", async function plansMissingEntry(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    await importMyMosaics(database, [
      pickFile("nobel_map.yaml", NOBEL_TEXT),
      pickFile("old.yaml", POETS_TEXT),
    ]);

    const review = await planImport(
      [pickFile("nobel_map.yaml", NOBEL_TEXT)],
      "my-mosaics",
      await readSources(database),
    );

    expect(listRowSummaries(review)).toEqual([
      "nobel_map.yaml: unchanged",
      "old.yaml: missing",
    ]);
    expect(listDefaultChecked(review)).toEqual(new Set());
  });

  it("lists no missing entry for another folder or single files", async function keepsOtherFolders(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    await importMyMosaics(database, [pickFile("old.yaml", POETS_TEXT)]);

    const otherFolder = await planImport(
      [pickFile("nobel_map.yaml", NOBEL_TEXT)],
      "other-mosaics",
      await readSources(database),
    );
    const singleFile = await planImport(
      [pickFile("nobel_map.yaml", NOBEL_TEXT)],
      null,
      await readSources(database),
    );

    expect(listRowSummaries(otherFolder)).toEqual(["nobel_map.yaml: new"]);
    expect(listRowSummaries(singleFile)).toEqual(["nobel_map.yaml: new"]);
  });

  it("Single file with a relative collection", async function warnsOutsideStore(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();

    const review = await planImport(
      [
        pickFile(
          "nobel_map.yaml",
          writeMosaic("Nobel map", "../tiles/laureates"),
        ),
      ],
      null,
      await readSources(database),
    );

    const row = findRow(review, "nobel_map.yaml");
    expect(row.status).toBe("new");
    expect(row.warnings).toEqual([
      '"../tiles/laureates" is not in this browser, so the mosaic will not open until it is',
    ]);
    expect(listDefaultChecked(review)).toEqual(new Set([0]));
  });

  it("gives no warning for a relative collection among the picked files", async function keepsPickedReference(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();

    const review = await planImport(
      [
        pickFile(
          "maps/nobel_map.yaml",
          writeMosaic("Nobel map", "../tiles/laureates"),
        ),
        pickFile(
          "tiles/laureates/collection.yaml",
          "collection:\n  title: L\n",
        ),
      ],
      "my-mosaics",
      await readSources(database),
    );

    expect(findRow(review, "maps/nobel_map.yaml").warnings).toEqual([]);
  });

  it("warns about a relative mod too", async function warnsRelativeMod(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    const text = 'mosaic:\n  title: "Mine"\n  mod: "./mods/mine"\n';

    const review = await planImport(
      [pickFile("mine.yaml", text)],
      null,
      await readSources(database),
    );

    expect(findRow(review, "mine.yaml").warnings).toEqual([
      '"./mods/mine" is not in this browser, so the mosaic will not open until it is',
    ]);
  });
});

describe("planUpdate", function describePlanUpdate(): void {
  it("Update from a file", async function plansUpdate(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    await importMyMosaics(database, [
      pickFile("maps/nobel_map.yaml", NOBEL_TEXT),
    ]);
    const [entry] = await database.readEntries();

    const review = await planUpdate(
      pickFile("nobel_map (2).yaml", POETS_TEXT),
      entry,
      await readSources(database),
    );

    expect(review.rows).toHaveLength(1);
    expect(review.rows[0]).toMatchObject({
      path: "maps/nobel_map.yaml",
      status: "changed",
      address: entry.address,
      entry,
    });
  });

  it("Unchanged and invalid files", async function plansUnchangedUpdate(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    await importMyMosaics(database, [pickFile("nobel_map.yaml", NOBEL_TEXT)]);
    const [entry] = await database.readEntries();
    const sources = await readSources(database);

    const unchanged = await planUpdate(
      pickFile("copy.yaml", NOBEL_TEXT),
      entry,
      sources,
    );
    const invalid = await planUpdate(
      pickFile("broken.yaml", BROKEN_TEXT),
      entry,
      sources,
    );

    expect(unchanged.rows[0].status).toBe("unchanged");
    expect(invalid.rows[0].status).toBe("invalid");
  });
});

describe("applyReview", function describeApplyReview(): void {
  it("Imported from a folder", async function appliesNewFile(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    const review = await planImport(
      [pickFile("maps/nobel_map.yaml", NOBEL_TEXT)],
      "my-mosaics",
      await readSources(database),
    );

    const changes = applyReview(review, new Set([0]), IMPORT_TIME);

    const address = "opentesela-browser:///root-1/maps/nobel_map.yaml";
    expect(changes).toEqual({
      putFiles: [{ address, text: NOBEL_TEXT }],
      putEntries: [
        {
          address,
          place: "browser",
          root: "root-1",
          provenance: {
            folder: "my-mosaics",
            path: "maps/nobel_map.yaml",
            addedAt: "2026-11-20T10:00:00.000Z",
            updatedAt: null,
          },
        },
      ],
      deleteAddresses: [],
    });
  });

  it("Updated", async function appliesUpdate(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    await importMyMosaics(database, [
      pickFile("maps/nobel_map.yaml", NOBEL_TEXT),
    ]);
    const [entry] = await database.readEntries();
    const review = await planUpdate(
      pickFile("nobel_map.yaml", POETS_TEXT),
      entry,
      await readSources(database),
    );

    await database.apply(applyReview(review, new Set([0]), UPDATE_TIME));

    const [updatedEntry] = await database.readEntries();
    expect(updatedEntry.address).toBe(entry.address);
    expect(updatedEntry.provenance).toEqual({
      folder: "my-mosaics",
      path: "maps/nobel_map.yaml",
      addedAt: "2026-11-20T10:00:00.000Z",
      updatedAt: "2026-11-21T09:30:00.000Z",
    });
    expect(await database.readText(entry.address)).toBe(POETS_TEXT);
  });

  it("deletes a checked missing entry and its file", async function deletesMissing(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    await importMyMosaics(database, [pickFile("old.yaml", POETS_TEXT)]);
    const [entry] = await database.readEntries();
    const review = await planImport(
      [],
      "my-mosaics",
      await readSources(database),
    );

    await database.apply(applyReview(review, new Set([0]), UPDATE_TIME));

    expect(await database.readEntries()).toEqual([]);
    expect(await database.readText(entry.address)).toBeNull();
  });

  it("keeps an unchecked missing entry", async function keepsUncheckedMissing(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    await importMyMosaics(database, [pickFile("old.yaml", POETS_TEXT)]);
    const review = await planImport(
      [],
      "my-mosaics",
      await readSources(database),
    );

    const changes = applyReview(review, new Set(), UPDATE_TIME);

    expect(changes).toEqual({
      putFiles: [],
      putEntries: [],
      deleteAddresses: [],
    });
  });

  it("ignores rows that cannot be checked", async function ignoresUncheckable(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    const review = await planImport(
      [pickFile("broken.yaml", BROKEN_TEXT)],
      "my-mosaics",
      await readSources(database),
    );

    const changes = applyReview(review, new Set([0]), IMPORT_TIME);

    expect(changes).toEqual({
      putFiles: [],
      putEntries: [],
      deleteAddresses: [],
    });
  });
});
