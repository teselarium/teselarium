import { describe, expect, it, vi } from "vitest";
import {
  createBlockedStorage,
  createFullStorage,
  createMemoryStorage,
} from "../../test/memory_storage.ts";
import type { MemoryStorage } from "../../test/memory_storage.ts";
import {
  createSectionSwitches,
  isSectionShown,
  readSectionSwitchesSnapshot,
  SECTION_SWITCHES_KEY,
  subscribeSectionSwitches,
  switchSection,
} from "./section_switches.ts";
import type { SectionSwitches } from "./section_switches.ts";

const OPTIONAL_IDS = ["tiles", "mods", "mosaics", "guides"];

function buildSwitches(
  storage: MemoryStorage,
  optionalIds: readonly string[] = OPTIONAL_IDS,
): SectionSwitches {
  return createSectionSwitches({ storage, optionalIds });
}

function readStoredValue(storage: MemoryStorage): unknown {
  const stored = storage.items.get(SECTION_SWITCHES_KEY);
  return stored === undefined ? undefined : JSON.parse(stored);
}

describe("section switches", function describeSectionSwitches(): void {
  it("starts with every optional section on", function startsOn(): void {
    const switches = buildSwitches(createMemoryStorage());

    for (const id of OPTIONAL_IDS) {
      expect(isSectionShown(readSectionSwitchesSnapshot(switches), id)).toBe(
        true,
      );
    }
  });

  it("always shows a section that is not optional", function showsFixed(): void {
    const switches = buildSwitches(createMemoryStorage());

    switchSection(switches, "home", false);

    expect(isSectionShown(readSectionSwitchesSnapshot(switches), "home")).toBe(
      true,
    );
  });

  it("Kept after a reload", function keepsSwitch(): void {
    const storage = createMemoryStorage();
    switchSection(buildSwitches(storage), "mosaics", false);

    const reloaded = buildSwitches(storage);

    expect(
      isSectionShown(readSectionSwitchesSnapshot(reloaded), "mosaics"),
    ).toBe(false);
    expect(readStoredValue(storage)).toEqual({ mosaics: false });
  });

  it("Removed section is dropped", function dropsRemoved(): void {
    const storage = createMemoryStorage();
    storage.setItem(
      SECTION_SWITCHES_KEY,
      JSON.stringify({ removed_section: false, guides: false }),
    );

    const switches = buildSwitches(storage);

    expect(readStoredValue(storage)).toEqual({ guides: false });
    expect(
      isSectionShown(readSectionSwitchesSnapshot(switches), "guides"),
    ).toBe(false);
  });

  it("New section starts on", function startsNewOn(): void {
    const storage = createMemoryStorage();
    storage.setItem(SECTION_SWITCHES_KEY, JSON.stringify({ guides: false }));

    const switches = buildSwitches(storage, [...OPTIONAL_IDS, "new_section"]);

    expect(
      isSectionShown(readSectionSwitchesSnapshot(switches), "new_section"),
    ).toBe(true);
  });

  it("ignores an invalid stored value", function ignoresInvalid(): void {
    for (const value of ["off", "[]", '{"guides":"no"}', "null"]) {
      const storage = createMemoryStorage();
      storage.setItem(SECTION_SWITCHES_KEY, value);

      const switches = buildSwitches(storage);

      expect(
        isSectionShown(readSectionSwitchesSnapshot(switches), "guides"),
      ).toBe(true);
    }
  });

  it("Storage cannot be written", function survivesFullStorage(): void {
    const switches = buildSwitches(createFullStorage());

    switchSection(switches, "guides", false);

    expect(
      isSectionShown(readSectionSwitchesSnapshot(switches), "guides"),
    ).toBe(false);
  });

  it("starts with every section on when the storage cannot be read", function survivesBlockedStorage(): void {
    const switches = buildSwitches(createBlockedStorage());

    switchSection(switches, "guides", false);

    expect(isSectionShown(readSectionSwitchesSnapshot(switches), "mods")).toBe(
      true,
    );
    expect(
      isSectionShown(readSectionSwitchesSnapshot(switches), "guides"),
    ).toBe(false);
  });

  it("notifies every change with a new frozen snapshot", function notifiesChanges(): void {
    const switches = buildSwitches(createMemoryStorage());
    const listener = vi.fn<() => void>();
    const unsubscribe = subscribeSectionSwitches(switches, listener);
    const before = readSectionSwitchesSnapshot(switches);

    switchSection(switches, "guides", false);
    unsubscribe();
    switchSection(switches, "guides", true);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(Object.isFrozen(before)).toBe(true);
    expect(readSectionSwitchesSnapshot(switches)).not.toBe(before);
  });
});
