import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "../../../test/memory_storage.ts";
import * as storageModule from "./index.ts";
import { readModValue, writeModValue } from "./index.ts";

const BOOK_LIST_SOURCE =
  "https://example.org/fixtures/mods/book_list/mod_conf.yaml";
const OTHER_BOOK_LIST_SOURCE =
  "https://mods.example.net/book_list/mod_conf.yaml";

describe("mod storage slots", function describeModStorage(): void {
  it("Store and read a value", function storesValue(): void {
    const storage = createMemoryStorage();
    const value = {
      source: "https://example.org/fixtures/tiles/books/kallocain.md",
    };

    writeModValue(storage, BOOK_LIST_SOURCE, "selected", value);

    expect(readModValue(storage, BOOK_LIST_SOURCE, "selected")).toEqual(value);
  });

  it("Missing key", function readsMissingKey(): void {
    const storage = createMemoryStorage();

    expect(readModValue(storage, BOOK_LIST_SOURCE, "selected")).toBeNull();
  });

  it("Remove a value", function removesValue(): void {
    const storage = createMemoryStorage();
    writeModValue(storage, BOOK_LIST_SOURCE, "selected", "kallocain");

    writeModValue(storage, BOOK_LIST_SOURCE, "selected", null);

    expect(readModValue(storage, BOOK_LIST_SOURCE, "selected")).toBeNull();
    expect(storage.items.size).toBe(0);
  });

  it("Same name, different sources", function separatesSources(): void {
    const storage = createMemoryStorage();

    writeModValue(storage, BOOK_LIST_SOURCE, "selected", "kallocain");

    expect(
      readModValue(storage, OTHER_BOOK_LIST_SOURCE, "selected"),
    ).toBeNull();
  });

  it("keeps keys made of : parts apart", function separatesColonKeys(): void {
    const storage = createMemoryStorage();

    writeModValue(storage, "https://a.example.net/m:x", "y", "first");
    writeModValue(storage, "https://a.example.net/m", "x:y", "second");

    expect(readModValue(storage, "https://a.example.net/m:x", "y")).toBe(
      "first",
    );
    expect(readModValue(storage, "https://a.example.net/m", "x:y")).toBe(
      "second",
    );
    expect(storage.items.size).toBe(2);
  });

  it("prefixes the storage keys", function prefixesKeys(): void {
    const storage = createMemoryStorage();

    writeModValue(storage, BOOK_LIST_SOURCE, "selected", true);

    expect([...storage.items.keys()]).toEqual([
      `opentesela.mod-storage:["${BOOK_LIST_SOURCE}","selected"]`,
    ]);
  });

  it("exports the public API", function exportsPublicApi(): void {
    expect(Object.keys(storageModule).sort()).toEqual([
      "readModValue",
      "writeModValue",
    ]);
  });
});
