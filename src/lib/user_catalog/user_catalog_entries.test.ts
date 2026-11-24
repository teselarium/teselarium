import { describe, expect, it } from "vitest";
import {
  buildRemoteEntry,
  buildUserMosaicEntries,
  findStoredEntry,
  findUserEntry,
  readExportFileName,
} from "./index.ts";
import type { UserCatalogEntry } from "./index.ts";

const STORED_ENTRY: UserCatalogEntry = {
  address: "teselarium-browser:///r1/maps/nobel_map.yaml",
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

describe("buildUserMosaicEntries", function describeUserMosaics(): void {
  it("Stored and remote entries", function buildsBothKinds(): void {
    const mosaics = buildUserMosaicEntries([STORED_ENTRY, REMOTE_ENTRY]);

    expect(mosaics).toEqual([
      {
        source: STORED_ENTRY.address,
        place: "browser",
        provenance: STORED_ENTRY.provenance,
      },
      {
        source: REMOTE_ENTRY.address,
        place: "remote",
        provenance: REMOTE_ENTRY.provenance,
      },
    ]);
  });

  it("copies the provenance", function copiesProvenance(): void {
    const mosaics = buildUserMosaicEntries([STORED_ENTRY]);

    expect(mosaics[0].provenance).not.toBe(STORED_ENTRY.provenance);
  });
});

describe("buildRemoteEntry", function describeRemoteEntry(): void {
  it("Remote entry", function buildsRemoteEntry(): void {
    const entry = buildRemoteEntry(
      REMOTE_ENTRY.address,
      new Date("2026-11-20T11:00:00.000Z"),
    );

    expect(entry).toEqual(REMOTE_ENTRY);
  });
});

describe("findUserEntry and findStoredEntry", function describeFindEntry(): void {
  it("finds a user entry of either kind", function findsUserEntry(): void {
    const entries = [STORED_ENTRY, REMOTE_ENTRY];

    expect(findUserEntry(entries, REMOTE_ENTRY.address)).toBe(REMOTE_ENTRY);
    expect(findUserEntry(entries, "https://example.org/a.yaml")).toBeNull();
  });

  it("finds only stored entries", function findsStoredEntry(): void {
    const entries = [STORED_ENTRY, REMOTE_ENTRY];

    expect(findStoredEntry(entries, STORED_ENTRY.address)).toBe(STORED_ENTRY);
    expect(findStoredEntry(entries, REMOTE_ENTRY.address)).toBeNull();
  });
});

describe("readExportFileName", function describeExportFileName(): void {
  it("names the file after the last segment of its path", function namesAfterPath(): void {
    expect(readExportFileName(STORED_ENTRY)).toBe("nobel_map.yaml");
  });

  it("Single file", function namesSingleFile(): void {
    const singleFileEntry: UserCatalogEntry = {
      ...STORED_ENTRY,
      provenance: {
        ...STORED_ENTRY.provenance,
        folder: null,
        path: "poets.yml",
      },
    };

    expect(readExportFileName(singleFileEntry)).toBe("poets.yml");
  });
});
