import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "../../../test/memory_storage.ts";
import { FIXTURES_BASE_URL } from "../../../test/sample_files.ts";
import {
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_MOD_SOURCE,
  SAMPLE_MOSAIC_SOURCE,
} from "../../../test/sample_mods.ts";
import * as storageModule from "./index.ts";
import { readModValue, writeModValue } from "./index.ts";
import type { ModSlot } from "./index.ts";

const OTHER_BOOK_LIST_SOURCE =
  "https://mods.example.net/book_list/mod_conf.yaml";
const OTHER_COLLECTION_SOURCE = `${FIXTURES_BASE_URL}tiles/two_books.yaml`;

function buildSlot(mod: string, context: string): ModSlot {
  const slot: ModSlot = { mod, context };
  return slot;
}

/** The sample mod opened with the sample collection. */
const COLLECTION_SLOT = buildSlot(SAMPLE_MOD_SOURCE, SAMPLE_COLLECTION_SOURCE);

describe("mod storage slots", function describeModStorage(): void {
  it("Store and read a value", function storesValue(): void {
    const storage = createMemoryStorage();
    const value = {
      source: `${FIXTURES_BASE_URL}tiles/books/kallocain.md`,
    };

    writeModValue(storage, COLLECTION_SLOT, "selected", value);

    expect(readModValue(storage, COLLECTION_SLOT, "selected")).toEqual(value);
  });

  it("Missing key", function readsMissingKey(): void {
    const storage = createMemoryStorage();

    expect(readModValue(storage, COLLECTION_SLOT, "selected")).toBeNull();
  });

  it("Remove a value", function removesValue(): void {
    const storage = createMemoryStorage();
    writeModValue(storage, COLLECTION_SLOT, "selected", "kallocain");

    writeModValue(storage, COLLECTION_SLOT, "selected", null);

    expect(readModValue(storage, COLLECTION_SLOT, "selected")).toBeNull();
    expect(storage.items.size).toBe(0);
  });

  it("keeps keys made of : parts apart", function separatesColonKeys(): void {
    const storage = createMemoryStorage();

    writeModValue(storage, buildSlot("https://a.example.net/m:x", ""), "y", 1);
    writeModValue(storage, buildSlot("https://a.example.net/m", "x"), "y", 2);
    writeModValue(storage, buildSlot("https://a.example.net/m", ""), "x:y", 3);

    expect(
      readModValue(storage, buildSlot("https://a.example.net/m:x", ""), "y"),
    ).toBe(1);
    expect(
      readModValue(storage, buildSlot("https://a.example.net/m", "x"), "y"),
    ).toBe(2);
    expect(
      readModValue(storage, buildSlot("https://a.example.net/m", ""), "x:y"),
    ).toBe(3);
    expect(storage.items.size).toBe(3);
  });

  it("prefixes the storage keys", function prefixesKeys(): void {
    const storage = createMemoryStorage();

    writeModValue(storage, COLLECTION_SLOT, "selected", true);

    expect([...storage.items.keys()]).toEqual([
      `teselarium.mod-storage:["${SAMPLE_MOD_SOURCE}","${SAMPLE_COLLECTION_SOURCE}","selected"]`,
    ]);
  });

  it("exports the public API", function exportsPublicApi(): void {
    expect(Object.keys(storageModule).sort()).toEqual([
      "createMemoryBrowserDatabase",
      "createMemoryStorage",
      "openBrowserDatabase",
      "readModValue",
      "writeModValue",
    ]);
  });
});

describe("Storage slots are separate per mod and context", function describeSlotContexts(): void {
  it("Same name, different sources", function separatesSources(): void {
    const storage = createMemoryStorage();

    writeModValue(storage, COLLECTION_SLOT, "selected", "kallocain");

    expect(
      readModValue(
        storage,
        buildSlot(OTHER_BOOK_LIST_SOURCE, SAMPLE_COLLECTION_SOURCE),
        "selected",
      ),
    ).toBeNull();
  });

  it("Two collections", function separatesCollections(): void {
    const storage = createMemoryStorage();

    writeModValue(storage, COLLECTION_SLOT, "study_fields", ["title"]);

    expect(
      readModValue(
        storage,
        buildSlot(SAMPLE_MOD_SOURCE, OTHER_COLLECTION_SOURCE),
        "study_fields",
      ),
    ).toBeNull();
  });

  it("Two mosaics with the same mod and collection", function separatesMosaics(): void {
    const storage = createMemoryStorage();
    const otherMosaicSource = `${FIXTURES_BASE_URL}mosaics/other/mosaic.yaml`;

    writeModValue(
      storage,
      buildSlot(SAMPLE_MOD_SOURCE, SAMPLE_MOSAIC_SOURCE),
      "selected",
      "kallocain",
    );

    expect(
      readModValue(
        storage,
        buildSlot(SAMPLE_MOD_SOURCE, otherMosaicSource),
        "selected",
      ),
    ).toBeNull();
  });

  it("A mosaic and a run link", function separatesMosaicFromLink(): void {
    const storage = createMemoryStorage();

    writeModValue(
      storage,
      buildSlot(SAMPLE_MOD_SOURCE, SAMPLE_MOSAIC_SOURCE),
      "selected",
      "kallocain",
    );

    expect(readModValue(storage, COLLECTION_SLOT, "selected")).toBeNull();
  });

  it("No tiles", function keepsNoContextSlot(): void {
    const storage = createMemoryStorage();
    const noTilesSlot = buildSlot(SAMPLE_MOD_SOURCE, "");

    writeModValue(storage, noTilesSlot, "selected", "kallocain");

    expect(
      readModValue(storage, buildSlot(SAMPLE_MOD_SOURCE, ""), "selected"),
    ).toBe("kallocain");
    expect(readModValue(storage, COLLECTION_SLOT, "selected")).toBeNull();
  });

  it("Value stored before contexts", function ignoresFormerKey(): void {
    const storage = createMemoryStorage();
    storage.setItem(
      `teselarium.mod-storage:${JSON.stringify([SAMPLE_MOD_SOURCE, "selected"])}`,
      JSON.stringify("kallocain"),
    );

    expect(
      readModValue(storage, buildSlot(SAMPLE_MOD_SOURCE, ""), "selected"),
    ).toBeNull();
    expect(readModValue(storage, COLLECTION_SLOT, "selected")).toBeNull();
  });
});
