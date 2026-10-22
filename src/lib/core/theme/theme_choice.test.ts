import { describe, expect, it } from "vitest";
import {
  createFullStorage,
  createMemoryStorage,
} from "../../../test/memory_storage.ts";
import {
  readThemeChoice,
  resolveColorScheme,
  THEME_CHOICE_KEY,
  writeThemeChoice,
} from "./index.ts";
import type { ThemeStorage } from "./index.ts";

function throwSecurityError(): never {
  throw new DOMException("The storage is disabled.", "SecurityError");
}

/** A storage whose reads fail like a `localStorage` the browser blocks. */
function createBlockedStorage(): ThemeStorage {
  const blockedStorage: ThemeStorage = {
    getItem: throwSecurityError,
    setItem: throwSecurityError,
  };
  return blockedStorage;
}

describe("resolveColorScheme", function describeResolveColorScheme(): void {
  it("System follows the operating system", function followsSystem(): void {
    expect(resolveColorScheme("system", true)).toBe("dark");
    expect(resolveColorScheme("system", false)).toBe("light");
  });

  it("An explicit choice ignores the operating system", function keepsChoice(): void {
    expect(resolveColorScheme("light", true)).toBe("light");
    expect(resolveColorScheme("dark", false)).toBe("dark");
  });
});

describe("readThemeChoice", function describeReadThemeChoice(): void {
  it("reads a stored choice", function readsChoice(): void {
    const storage = createMemoryStorage();
    storage.setItem("opentesela.theme-choice", "dark");

    expect(readThemeChoice(storage)).toBe("dark");
  });

  it("gives System for a missing value", function readsMissing(): void {
    expect(readThemeChoice(createMemoryStorage())).toBe("system");
  });

  it("Unknown stored value", function readsUnknown(): void {
    const storage = createMemoryStorage();
    storage.setItem(THEME_CHOICE_KEY, "purple");

    expect(readThemeChoice(storage)).toBe("system");
  });

  it("gives System when the storage cannot be read", function readsBlocked(): void {
    expect(readThemeChoice(createBlockedStorage())).toBe("system");
  });
});

describe("writeThemeChoice", function describeWriteThemeChoice(): void {
  it("writes the choice under the theme key", function writesChoice(): void {
    const storage = createMemoryStorage();

    writeThemeChoice(storage, "light");

    expect(storage.items).toEqual(
      new Map([["opentesela.theme-choice", "light"]]),
    );
  });

  it("uses a key outside the mod storage slots", function separatesKey(): void {
    expect(THEME_CHOICE_KEY.startsWith("opentesela.mod-storage:")).toBe(false);
  });

  it("swallows a write error", function swallowsWriteError(): void {
    const writeToFullStorage = writeThemeChoice.bind(
      undefined,
      createFullStorage(),
      "dark",
    );
    const writeToBlockedStorage = writeThemeChoice.bind(
      undefined,
      createBlockedStorage(),
      "dark",
    );

    expect(writeToFullStorage).not.toThrow();
    expect(writeToBlockedStorage).not.toThrow();
  });
});
