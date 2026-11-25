import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildFolderArchive, planExportSync } from "./index.ts";
import type { ArchivedEntry, UserCatalogEntry } from "./index.ts";

const IMPORT_TIME = "2026-11-20T10:00:00.000Z";
const SAVE_TIME = "2026-11-21T10:00:00.000Z";

function buildStoredEntry(
  folder: string | null,
  path: string,
  isChanged: boolean,
): UserCatalogEntry {
  const entry: UserCatalogEntry = {
    address: `teselarium-browser:///r1/${path}`,
    place: "browser",
    root: "r1",
    provenance: {
      folder,
      path,
      addedAt: IMPORT_TIME,
      updatedAt: isChanged ? SAVE_TIME : null,
      changedSinceExport: isChanged,
      copiedFrom: null,
    },
    syncedAt: IMPORT_TIME,
  };
  return entry;
}

function archive(
  entry: UserCatalogEntry,
  text: string,
  currentVersion: string,
): ArchivedEntry {
  const archived: ArchivedEntry = { entry, text, currentVersion };
  return archived;
}

const NOBEL = buildStoredEntry("my-mosaics", "maps/nobel_map.yaml", true);
const POETS = buildStoredEntry("my-mosaics", "poets.yaml", false);
const OTHER = buildStoredEntry("other", "other.yaml", true);

const ARCHIVED = [
  archive(NOBEL, "nobel, edited\n", SAVE_TIME),
  archive(POETS, "poets\n", IMPORT_TIME),
  archive(OTHER, "other\n", SAVE_TIME),
];

function readArchive(bytes: Uint8Array): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [path, content] of Object.entries(unzipSync(bytes))) {
    files[path] = strFromU8(content);
  }
  return files;
}

describe("buildFolderArchive", function describeBuildFolderArchive(): void {
  it("Exported folder", function archivesFolder(): void {
    const folderArchive = buildFolderArchive(ARCHIVED, "my-mosaics");

    expect(readArchive(folderArchive.bytes)).toEqual({
      "maps/nobel_map.yaml": "nobel, edited\n",
      "poets.yaml": "poets\n",
    });
  });

  it("makes every exported entry unchanged since export", function syncsEntries(): void {
    const folderArchive = buildFolderArchive(ARCHIVED, "my-mosaics");

    expect(folderArchive.changes.putEntries).toEqual([
      {
        ...NOBEL,
        provenance: { ...NOBEL.provenance, changedSinceExport: false },
        syncedAt: SAVE_TIME,
      },
      POETS,
    ]);
    expect(folderArchive.changes.putFiles).toEqual([]);
    expect(folderArchive.changes.putVersions).toEqual([]);
  });

  it("holds nothing for a folder no entry has", function archivesNothing(): void {
    const folderArchive = buildFolderArchive(ARCHIVED, "nowhere");

    expect(readArchive(folderArchive.bytes)).toEqual({});
    expect(folderArchive.changes.putEntries).toEqual([]);
  });
});

describe("planExportSync", function describePlanExportSync(): void {
  it("Saved, then exported", function syncsExportedEntry(): void {
    const changes = planExportSync(NOBEL, SAVE_TIME);

    expect(changes.putEntries[0].syncedAt).toBe(SAVE_TIME);
    expect(changes.putEntries[0].provenance.changedSinceExport).toBe(false);
  });
});
