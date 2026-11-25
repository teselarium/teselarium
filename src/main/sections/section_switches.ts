/** The part of `Storage` the switches use. The app passes `localStorage`. */
export type SwitchesStorage = Pick<Storage, "getItem" | "setItem">;

export interface SectionSwitchesOptions {
  storage: SwitchesStorage;
  /** The ids of the app's optional sections. Other ids cannot be switched off. */
  optionalIds: readonly string[];
}

/** Which optional sections are switched off, by id. Frozen, and new after every change. */
export type SectionSwitchesSnapshot = Readonly<Record<string, boolean>>;

/** The user's switches of the optional sections. Mutable. */
export interface SectionSwitches {
  storage: SwitchesStorage;
  optionalIds: readonly string[];
  listeners: Set<() => void>;
  snapshot: SectionSwitchesSnapshot;
}

/** Outside the `teselarium.mod-storage:` keys, so no mod storage slot can reach it. */
export const SECTION_SWITCHES_KEY = "teselarium.sidebar-sections";

function readStoredValue(storage: SwitchesStorage): unknown {
  try {
    const stored: unknown = JSON.parse(
      storage.getItem(SECTION_SWITCHES_KEY) ?? "null",
    );
    return stored;
  } catch {
    // Unreadable or not JSON: counts as no stored switches.
    return null;
  }
}

function writeSwitches(
  storage: SwitchesStorage,
  switches: SectionSwitchesSnapshot,
): void {
  try {
    storage.setItem(SECTION_SWITCHES_KEY, JSON.stringify(switches));
  } catch {
    // The switches still apply until the page is closed.
  }
}

/**
 * The stored switches of the given sections. A stored switch of any other id
 * is dropped, and anything that is not `true` or `false` is ignored.
 */
function readStoredSwitches(
  storage: SwitchesStorage,
  optionalIds: readonly string[],
): SectionSwitchesSnapshot {
  const stored = readStoredValue(storage);
  const switches: Record<string, boolean> = {};
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) {
    return Object.freeze(switches);
  }
  for (const [id, isOn] of Object.entries(stored)) {
    if (optionalIds.includes(id) && typeof isOn === "boolean") {
      switches[id] = isOn;
    }
  }
  return Object.freeze(switches);
}

/**
 * Reads the stored switches, and rewrites them without the ids of sections
 * the app no longer has.
 */
export function createSectionSwitches(
  options: SectionSwitchesOptions,
): SectionSwitches {
  const snapshot = readStoredSwitches(options.storage, options.optionalIds);
  if (readStoredValue(options.storage) !== null) {
    writeSwitches(options.storage, snapshot);
  }
  const switches: SectionSwitches = {
    storage: options.storage,
    optionalIds: options.optionalIds,
    listeners: new Set(),
    snapshot,
  };
  return switches;
}

/** Whether a section's item is shown: every section but an optional one switched off. */
export function isSectionShown(
  snapshot: SectionSwitchesSnapshot,
  id: string,
): boolean {
  return snapshot[id] !== false;
}

/** Switches an optional section on or off, stored when the storage allows, and applied at once. */
export function switchSection(
  switches: SectionSwitches,
  id: string,
  isOn: boolean,
): void {
  if (!switches.optionalIds.includes(id)) {
    return;
  }
  const changed: Record<string, boolean> = { ...switches.snapshot, [id]: isOn };
  switches.snapshot = Object.freeze(changed);
  writeSwitches(switches.storage, switches.snapshot);
  for (const listener of switches.listeners) {
    listener();
  }
}

export function readSectionSwitchesSnapshot(
  switches: SectionSwitches,
): SectionSwitchesSnapshot {
  return switches.snapshot;
}

function unsubscribeSectionSwitches(
  switches: SectionSwitches,
  listener: () => void,
): void {
  switches.listeners.delete(listener);
}

/** Calls `listener` after every change. Returns the function that unsubscribes it. */
export function subscribeSectionSwitches(
  switches: SectionSwitches,
  listener: () => void,
): () => void {
  switches.listeners.add(listener);
  return unsubscribeSectionSwitches.bind(undefined, switches, listener);
}
