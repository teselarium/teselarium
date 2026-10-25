import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "./index.ts";

describe("createMemoryStorage", function describeMemoryStorage(): void {
  it("starts empty", function startsEmpty(): void {
    const storage = createMemoryStorage();

    expect(storage.getItem("selected")).toBeNull();
    expect(storage.items.size).toBe(0);
  });

  it("reads what was set", function readsSetItem(): void {
    const storage = createMemoryStorage();

    storage.setItem("selected", '"kallocain"');

    expect(storage.getItem("selected")).toBe('"kallocain"');
  });

  it("removes an item", function removesItem(): void {
    const storage = createMemoryStorage();
    storage.setItem("selected", '"kallocain"');

    storage.removeItem("selected");

    expect(storage.getItem("selected")).toBeNull();
    expect(storage.items.size).toBe(0);
  });

  it("two storages do not share items", function separatesStorages(): void {
    const firstStorage = createMemoryStorage();
    const secondStorage = createMemoryStorage();

    firstStorage.setItem("selected", '"kallocain"');

    expect(secondStorage.getItem("selected")).toBeNull();
  });
});
