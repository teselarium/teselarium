import { describe, expect, it } from "vitest";
import type { StoredVersion } from "../core/storage/index.ts";
import { buildSaveFileName, planSave } from "./index.ts";
import type { UserCatalogEntry } from "./index.ts";

const SAVE_TIME = new Date("2026-11-22T10:00:00.000Z");
const IMPORT_TIME = "2026-11-20T10:00:00.000Z";
const STORED_ADDRESS = "opentesela-browser:///r1/maps/nobel_map.yaml";
const SAMPLE_ADDRESS =
  "https://example.org/samples/mosaics/nobel_laureates_map.yaml";

function writeDraft(title: string): string {
  const draft = `mosaic:\n  title: "${title}"\n  mod: "https://example.org/samples/mods/country_map"\n`;
  return draft;
}

const IMPORTED_TEXT = writeDraft("Nobel map");

const STORED_ENTRY: UserCatalogEntry = {
  address: STORED_ADDRESS,
  place: "browser",
  root: "r1",
  provenance: {
    folder: "my-mosaics",
    path: "maps/nobel_map.yaml",
    addedAt: IMPORT_TIME,
    updatedAt: null,
    changedSinceExport: false,
    copiedFrom: null,
  },
  syncedAt: IMPORT_TIME,
};

const IMPORTED_VERSION: StoredVersion = {
  address: STORED_ADDRESS,
  savedAt: IMPORT_TIME,
  kind: "imported",
  text: IMPORTED_TEXT,
};

function createFixedRoot(): string {
  return "new-root";
}

describe("buildSaveFileName", function describeBuildSaveFileName(): void {
  it("names the file after the title", function namesAfterTitle(): void {
    expect(buildSaveFileName("Laureates, my way")).toBe(
      "laureates_my_way.yaml",
    );
  });

  it("drops accents and keeps digits", function dropsAccents(): void {
    expect(buildSaveFileName("Poèmes de 1913")).toBe("poemes_de_1913.yaml");
  });

  it("falls back to mosaic.yaml", function fallsBack(): void {
    expect(buildSaveFileName("詩")).toBe("mosaic.yaml");
    expect(buildSaveFileName("  !! ")).toBe("mosaic.yaml");
  });
});

describe("planSave", function describePlanSave(): void {
  it("Saved from a copy", function savesCopy(): void {
    const draft = writeDraft("Laureates, my way");

    const plan = planSave({
      draft,
      title: "Laureates, my way",
      entry: null,
      copiedFrom: SAMPLE_ADDRESS,
      versions: [],
      now: SAVE_TIME,
      kind: "saved",
      createRoot: createFixedRoot,
    });

    const address = "opentesela-browser:///new-root/laureates_my_way.yaml";
    expect(plan.address).toBe(address);
    expect(plan.changes).toEqual({
      putFiles: [{ address, text: draft }],
      putEntries: [
        {
          address,
          place: "browser",
          root: "new-root",
          provenance: {
            folder: null,
            path: "laureates_my_way.yaml",
            addedAt: SAVE_TIME.toISOString(),
            updatedAt: null,
            changedSinceExport: true,
            copiedFrom: SAMPLE_ADDRESS,
          },
          syncedAt: null,
        },
      ],
      putVersions: [
        {
          address,
          savedAt: SAVE_TIME.toISOString(),
          kind: "saved",
          text: draft,
        },
      ],
      deleteVersions: [],
      deleteAddresses: [],
    });
  });

  it("saves a new mosaic from a combination without a copy address", function savesNew(): void {
    const plan = planSave({
      draft: writeDraft("Untitled mosaic"),
      title: "Untitled mosaic",
      entry: null,
      copiedFrom: null,
      versions: [],
      now: SAVE_TIME,
      kind: "saved",
      createRoot: createFixedRoot,
    });

    expect(plan.address).toBe(
      "opentesela-browser:///new-root/untitled_mosaic.yaml",
    );
    expect(plan.changes.putEntries[0].provenance.copiedFrom).toBeNull();
  });

  it("Saved again", function savesStored(): void {
    const draft = writeDraft("Nobel map, mine");

    const plan = planSave({
      draft,
      title: "Nobel map, mine",
      entry: STORED_ENTRY,
      copiedFrom: null,
      versions: [IMPORTED_VERSION],
      now: SAVE_TIME,
      kind: "saved",
    });

    expect(plan.address).toBe(STORED_ADDRESS);
    expect(plan.changes.putFiles).toEqual([
      { address: STORED_ADDRESS, text: draft },
    ]);
    expect(plan.changes.putEntries).toEqual([
      {
        ...STORED_ENTRY,
        provenance: {
          ...STORED_ENTRY.provenance,
          updatedAt: SAVE_TIME.toISOString(),
          changedSinceExport: true,
        },
      },
    ]);
    expect(plan.changes.putVersions).toEqual([
      {
        address: STORED_ADDRESS,
        savedAt: SAVE_TIME.toISOString(),
        kind: "saved",
        text: draft,
      },
    ]);
  });

  it("is not changed since export once back to the synced text", function savesSyncedText(): void {
    const plan = planSave({
      draft: IMPORTED_TEXT,
      title: "Nobel map",
      entry: {
        ...STORED_ENTRY,
        provenance: { ...STORED_ENTRY.provenance, changedSinceExport: true },
      },
      copiedFrom: null,
      versions: [
        {
          ...IMPORTED_VERSION,
          savedAt: "2026-11-21T10:00:00.000Z",
          kind: "saved",
          text: "x",
        },
        IMPORTED_VERSION,
      ],
      now: SAVE_TIME,
      kind: "restored",
    });

    expect(plan.changes.putEntries[0].provenance.changedSinceExport).toBe(
      false,
    );
  });

  it("Restore the imported text", function restores(): void {
    const plan = planSave({
      draft: IMPORTED_TEXT,
      title: "Nobel map",
      entry: STORED_ENTRY,
      copiedFrom: null,
      versions: [IMPORTED_VERSION],
      now: SAVE_TIME,
      kind: "restored",
    });

    expect(plan.changes.putVersions[0].kind).toBe("restored");
  });

  it("prunes the history past twenty versions", function prunes(): void {
    const versions: StoredVersion[] = [];
    for (let index = 20; index >= 1; index -= 1) {
      versions.push({
        address: STORED_ADDRESS,
        savedAt: `2026-11-21T10:${String(index).padStart(2, "0")}:00.000Z`,
        kind: "saved",
        text: `save ${index}`,
      });
    }
    versions.push(IMPORTED_VERSION);

    const plan = planSave({
      draft: writeDraft("Save 21"),
      title: "Save 21",
      entry: STORED_ENTRY,
      copiedFrom: null,
      versions,
      now: SAVE_TIME,
      kind: "saved",
    });

    expect(plan.changes.deleteVersions).toEqual([
      { address: STORED_ADDRESS, savedAt: "2026-11-21T10:01:00.000Z" },
    ]);
  });
});
