import { describe, expect, it } from "vitest";
import type { LocalFiles, PickedFile } from "../files/index.ts";
import { createMemoryBrowserDatabase } from "../core/storage/index.ts";
import type { BrowserDatabase } from "../core/storage/index.ts";
import { loadMosaicFile } from "../mosaic/index.ts";
import type { LoadedMosaic } from "../mosaic/index.ts";
import {
  applyReview,
  canApplyReview,
  classifyMatchingFile,
  isCheckableRow,
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
const SAVE_TIME = new Date("2026-11-20T18:00:00.000Z");
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
    storedVersions: database,
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

/** Saves `text` over the stored entry in the app, as a save would. */
async function saveInApp(
  database: BrowserDatabase<UserCatalogEntry>,
  entry: UserCatalogEntry,
  text: string,
): Promise<UserCatalogEntry> {
  const savedEntry: UserCatalogEntry = {
    ...entry,
    provenance: {
      ...entry.provenance,
      updatedAt: SAVE_TIME.toISOString(),
      changedSinceExport: true,
    },
  };
  await database.apply({
    putFiles: [{ address: entry.address, text }],
    putEntries: [savedEntry],
    putVersions: [
      {
        address: entry.address,
        savedAt: SAVE_TIME.toISOString(),
        kind: "saved",
        text,
      },
    ],
    deleteAddresses: [],
  });
  return savedEntry;
}

/** Imports `nobel_map.yaml` in `my-mosaics`, then saves `editedText` over it in the app. */
async function importAndEdit(
  database: BrowserDatabase<UserCatalogEntry>,
  editedText: string,
): Promise<UserCatalogEntry> {
  await importMyMosaics(database, [pickFile("nobel_map.yaml", NOBEL_TEXT)]);
  const [entry] = await database.readEntries();
  return saveInApp(database, entry, editedText);
}

function readKind(version: { kind: string }): string {
  return version.kind;
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
        versions: [],
        keepBothRoot: null,
        replacesLocalChanges: false,
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

describe("Status of a matching file", function describeMatchingStatus(): void {
  const EDITED_TEXT = writeMosaic(
    "Nobel map, mine",
    "https://tiles.example.net/laureates/",
  );
  const FILE_TEXT = writeMosaic(
    "Nobel map, theirs",
    "https://tiles.example.net/laureates/",
  );

  it("Edited here, file untouched", async function plansChangedHere(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    await importAndEdit(database, EDITED_TEXT);

    const review = await planImport(
      [pickFile("nobel_map.yaml", NOBEL_TEXT)],
      "my-mosaics",
      await readSources(database),
    );
    await database.apply(
      applyReview(review, listDefaultChecked(review), UPDATE_TIME),
    );

    expect(listRowSummaries(review)).toEqual(["nobel_map.yaml: changed-here"]);
    expect(isCheckableRow(review.rows[0])).toBe(false);
    const [entry] = await database.readEntries();
    expect(await database.readText(entry.address)).toBe(EDITED_TEXT);
  });

  it("Edited on both sides", async function plansConflict(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    await importAndEdit(database, EDITED_TEXT);

    const review = await planImport(
      [pickFile("nobel_map.yaml", FILE_TEXT)],
      "my-mosaics",
      await readSources(database),
    );

    expect(listRowSummaries(review)).toEqual(["nobel_map.yaml: conflict"]);
    expect(listDefaultChecked(review)).toEqual(new Set());
    expect(review.rows[0].keepBothRoot).toEqual(expect.any(String));
  });

  it("Both changed the same way", async function plansSameEdit(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    await importAndEdit(database, EDITED_TEXT);

    const review = await planImport(
      [pickFile("nobel_map.yaml", EDITED_TEXT)],
      "my-mosaics",
      await readSources(database),
    );

    expect(listRowSummaries(review)).toEqual(["nobel_map.yaml: unchanged"]);
  });

  it("Take the file", async function takesFile(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    const edited = await importAndEdit(database, EDITED_TEXT);
    const review = await planImport(
      [pickFile("nobel_map.yaml", FILE_TEXT)],
      "my-mosaics",
      await readSources(database),
    );

    await database.apply(
      applyReview(review, new Set(), UPDATE_TIME, new Map([[0, "take-file"]])),
    );

    expect(await database.readText(edited.address)).toBe(FILE_TEXT);
    const versions = await database.readVersions(edited.address);
    expect(versions.map(readKind)).toEqual(["updated", "saved", "imported"]);
    expect(versions[1].text).toBe(EDITED_TEXT);
    const [entry] = await database.readEntries();
    expect(entry.syncedAt).toBe(UPDATE_TIME.toISOString());
    expect(entry.provenance.changedSinceExport).toBe(false);
  });

  it("Keep both", async function keepsBoth(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    const edited = await importAndEdit(database, EDITED_TEXT);
    const conflictReview = await planImport(
      [pickFile("nobel_map.yaml", FILE_TEXT)],
      "my-mosaics",
      await readSources(database),
    );

    await database.apply(
      applyReview(
        conflictReview,
        new Set(),
        UPDATE_TIME,
        new Map([[0, "keep-both"]]),
      ),
    );

    expect(await database.readText(edited.address)).toBe(EDITED_TEXT);
    const entries = await database.readEntries();
    expect(entries).toHaveLength(2);
    const copy = entries[1];
    const copyRoot = conflictReview.rows[0].keepBothRoot;
    expect(copy.root).toBe(copyRoot);
    expect(copy.address).toBe(
      `opentesela-browser:///${copyRoot}/nobel_map%20(from%20file).yaml`,
    );
    expect(copy.provenance).toMatchObject({
      folder: null,
      path: "nobel_map (from file).yaml",
      changedSinceExport: false,
    });
    expect(await database.readText(copy.address)).toBe(FILE_TEXT);
    const copyVersions = await database.readVersions(copy.address);
    expect(copyVersions.map(readKind)).toEqual(["imported"]);
  });

  it("Keep mine", async function keepsMine(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    await importAndEdit(database, EDITED_TEXT);
    const review = await planImport(
      [pickFile("nobel_map.yaml", FILE_TEXT)],
      "my-mosaics",
      await readSources(database),
    );

    const changes = applyReview(
      review,
      new Set(),
      UPDATE_TIME,
      new Map([[0, "keep-mine"]]),
    );

    expect(changes).toEqual({
      putFiles: [],
      putEntries: [],
      putVersions: [],
      deleteVersions: [],
      deleteAddresses: [],
    });
  });

  it("changes nothing for a conflict without a choice", async function ignoresUnchosen(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    await importAndEdit(database, EDITED_TEXT);
    const review = await planImport(
      [pickFile("nobel_map.yaml", FILE_TEXT)],
      "my-mosaics",
      await readSources(database),
    );

    const changes = applyReview(review, new Set([0]), UPDATE_TIME);

    expect(changes.putFiles).toEqual([]);
  });
});

describe("classifyMatchingFile", function describeClassify(): void {
  it("is unchanged when the file is the stored text", function isUnchanged(): void {
    expect(classifyMatchingFile("b", "b", "a")).toBe("unchanged");
  });

  it("is changed when only the file differs from the synced text", function isChanged(): void {
    expect(classifyMatchingFile("b", "a", "a")).toBe("changed");
  });

  it("is changed here when only the stored text does", function isChangedHere(): void {
    expect(classifyMatchingFile("a", "b", "a")).toBe("changed-here");
  });

  it("is a conflict when both changed differently", function isConflict(): void {
    expect(classifyMatchingFile("c", "b", "a")).toBe("conflict");
  });

  it("is a conflict for a mosaic never synced", function isUnsyncedConflict(): void {
    expect(classifyMatchingFile("c", "b", null)).toBe("conflict");
  });
});

describe("canApplyReview", function describeCanApplyReview(): void {
  const EDITED_TEXT = writeMosaic(
    "Nobel map, mine",
    "https://tiles.example.net/laureates/",
  );
  const FILE_TEXT = writeMosaic(
    "Nobel map, theirs",
    "https://tiles.example.net/laureates/",
  );

  it("waits for a choice for each conflict, or a checked row", async function waitsForChoices(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    await importAndEdit(database, EDITED_TEXT);
    const review = await planImport(
      [
        pickFile("nobel_map.yaml", FILE_TEXT),
        pickFile("poets.yaml", POETS_TEXT),
      ],
      "my-mosaics",
      await readSources(database),
    );

    expect(canApplyReview(review, new Set(), new Map())).toBe(false);
    expect(canApplyReview(review, new Set([1]), new Map())).toBe(true);
    expect(canApplyReview(review, new Set(), new Map([[0, "keep-mine"]]))).toBe(
      true,
    );
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

  it("Update over local edits", async function plansUpdateOverEdits(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    const editedText = writeMosaic("Nobel map, mine", "https://a.example/");
    const edited = await importAndEdit(database, editedText);

    const review = await planUpdate(
      pickFile("nobel_map.yaml", POETS_TEXT),
      edited,
      await readSources(database),
    );
    await database.apply(applyReview(review, new Set([0]), UPDATE_TIME));

    expect(review.rows[0].status).toBe("changed");
    expect(review.rows[0].replacesLocalChanges).toBe(true);
    const versions = await database.readVersions(edited.address);
    expect(versions.map(readKind)).toEqual(["updated", "saved", "imported"]);
    expect(versions[1].text).toBe(editedText);
  });

  it("says nothing about local changes for an entry not changed since export", async function plansPlainUpdate(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    await importMyMosaics(database, [pickFile("nobel_map.yaml", NOBEL_TEXT)]);
    const [entry] = await database.readEntries();

    const review = await planUpdate(
      pickFile("nobel_map.yaml", POETS_TEXT),
      entry,
      await readSources(database),
    );

    expect(review.rows[0].replacesLocalChanges).toBe(false);
  });

  it("updates an entry edited here back to its file", async function plansRevert(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    const edited = await importAndEdit(
      database,
      writeMosaic("Nobel map, mine", "https://a.example/"),
    );

    const review = await planUpdate(
      pickFile("nobel_map.yaml", NOBEL_TEXT),
      edited,
      await readSources(database),
    );

    expect(review.rows[0].status).toBe("changed");
    expect(review.rows[0].replacesLocalChanges).toBe(true);
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
            changedSinceExport: false,
            copiedFrom: null,
          },
          syncedAt: "2026-11-20T10:00:00.000Z",
        },
      ],
      putVersions: [
        {
          address,
          savedAt: "2026-11-20T10:00:00.000Z",
          kind: "imported",
          text: NOBEL_TEXT,
        },
      ],
      deleteVersions: [],
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
      changedSinceExport: false,
      copiedFrom: null,
    });
    expect(updatedEntry.syncedAt).toBe("2026-11-21T09:30:00.000Z");
    expect(await database.readText(entry.address)).toBe(POETS_TEXT);
    const versions = await database.readVersions(entry.address);
    expect(versions.map(readKind)).toEqual(["updated", "imported"]);
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
      putVersions: [],
      deleteVersions: [],
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
      putVersions: [],
      deleteVersions: [],
      deleteAddresses: [],
    });
  });
});
