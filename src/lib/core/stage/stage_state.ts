import type { RunLink } from "../engine/index.ts";

/** One sandbox of the stage. `id` is given by the stage, never by a mod. */
export interface StageSandbox {
  id: string;
  /** The address hash of the sandbox's history entries. */
  hash: string;
  link: RunLink;
  /** The sandbox whose mod opened this one, or `null` for a link the user followed. */
  openerId: string | null;
  /** Opened for `#/`. The home mod at `#/` has no close button. */
  isHome: boolean;
}

/** A history entry the stage wrote, and the sandbox it shows. */
export interface StageEntry {
  position: number;
  sandboxId: string;
}

/** The stage as plain data. The visible sandbox is the one of the entry at `position`. */
export interface StageState {
  /** In creation order, so rendering never moves a frame. */
  sandboxes: StageSandbox[];
  /** Sorted by position. */
  entries: StageEntry[];
  position: number;
  nextNumber: number;
}

/** The new state, and the side effects the controller applies. */
export interface StageChange {
  state: StageState;
  opened: StageSandbox | null;
  closedIds: string[];
}

export function createStageState(): StageState {
  const state: StageState = {
    sandboxes: [],
    entries: [],
    position: -1,
    nextNumber: 1,
  };
  return state;
}

function findEntry(state: StageState, position: number): StageEntry | null {
  for (const entry of state.entries) {
    if (entry.position === position) {
      return entry;
    }
  }
  return null;
}

function findSandbox(state: StageState, id: string): StageSandbox | null {
  for (const sandbox of state.sandboxes) {
    if (sandbox.id === id) {
      return sandbox;
    }
  }
  return null;
}

/** The sandbox of the entry at the current position, or `null` before the first entry. */
export function readVisibleSandbox(state: StageState): StageSandbox | null {
  const entry = findEntry(state, state.position);
  if (entry === null) {
    return null;
  }
  return findSandbox(state, entry.sandboxId);
}

function buildSandbox(
  state: StageState,
  hash: string,
  link: RunLink,
  openerId: string | null,
  isHome: boolean,
): StageSandbox {
  const sandbox: StageSandbox = {
    id: `sandbox-${state.nextNumber}`,
    hash,
    link: structuredClone(link),
    openerId,
    isHome,
  };
  return sandbox;
}

/** Entries sorted by position, with `entry` taking the place of any entry at its position. */
function placeEntry(entries: StageEntry[], entry: StageEntry): StageEntry[] {
  const placedEntries: StageEntry[] = [];
  for (const existingEntry of entries) {
    if (existingEntry.position !== entry.position) {
      placedEntries.push(existingEntry);
    }
  }
  placedEntries.push(entry);
  placedEntries.sort(compareEntries);
  return placedEntries;
}

function compareEntries(first: StageEntry, second: StageEntry): number {
  return first.position - second.position;
}

/** Splits the sandboxes into the ones an entry points to and the ones no entry reaches. */
function keepReachedSandboxes(
  sandboxes: StageSandbox[],
  entries: StageEntry[],
): { kept: StageSandbox[]; closedIds: string[] } {
  const reachedIds = new Set<string>();
  for (const entry of entries) {
    reachedIds.add(entry.sandboxId);
  }
  const kept: StageSandbox[] = [];
  const closedIds: string[] = [];
  for (const sandbox of sandboxes) {
    if (reachedIds.has(sandbox.id)) {
      kept.push(sandbox);
    } else {
      closedIds.push(sandbox.id);
    }
  }
  const split = { kept, closedIds };
  return split;
}

function buildOpeningChange(
  state: StageState,
  sandbox: StageSandbox,
  position: number,
  entries: StageEntry[],
): StageChange {
  const placedEntries = placeEntry(entries, {
    position,
    sandboxId: sandbox.id,
  });
  const split = keepReachedSandboxes(
    [...state.sandboxes, sandbox],
    placedEntries,
  );
  const change: StageChange = {
    state: {
      sandboxes: split.kept,
      entries: placedEntries,
      position,
      nextNumber: state.nextNumber + 1,
    },
    opened: sandbox,
    closedIds: split.closedIds,
  };
  return change;
}

/**
 * Opens a link in a new sandbox at the next history position. Entries after
 * the current position are dropped, as a browser drops forward entries, and
 * every sandbox that no remaining entry points to is closed.
 */
export function openStageEntry(
  state: StageState,
  hash: string,
  link: RunLink,
  openerId: string | null,
  isHome: boolean,
): StageChange {
  const keptEntries: StageEntry[] = [];
  for (const entry of state.entries) {
    if (entry.position <= state.position) {
      keptEntries.push(entry);
    }
  }
  const sandbox = buildSandbox(state, hash, link, openerId, isHome);
  return buildOpeningChange(state, sandbox, state.position + 1, keptEntries);
}

/**
 * Goes to a history position. When its entry points to an open sandbox, that
 * sandbox becomes visible. Otherwise, after a reload or when its sandbox was
 * closed, a new sandbox takes the entry. Forward entries are kept.
 */
export function restoreStageEntry(
  state: StageState,
  position: number,
  hash: string,
  link: RunLink,
  isHome: boolean,
): StageChange {
  const entry = findEntry(state, position);
  if (entry !== null && findSandbox(state, entry.sandboxId) !== null) {
    const change: StageChange = {
      state: { ...state, position },
      opened: null,
      closedIds: [],
    };
    return change;
  }
  const sandbox = buildSandbox(state, hash, link, null, isHome);
  return buildOpeningChange(state, sandbox, position, state.entries);
}

function pointCurrentEntry(state: StageState, sandboxId: string): StageEntry[] {
  return placeEntry(state.entries, { position: state.position, sandboxId });
}

function removeSandbox(state: StageState, id: string): StageState {
  const sandboxes: StageSandbox[] = [];
  for (const sandbox of state.sandboxes) {
    if (sandbox.id !== id) {
      sandboxes.push(sandbox);
    }
  }
  const remainingState: StageState = { ...state, sandboxes };
  return remainingState;
}

/** The opener of the sandbox `id`, when it is still open in `remainingState`. */
function findOpenOpener(
  state: StageState,
  remainingState: StageState,
  id: string,
): StageSandbox | null {
  const openerId = findSandbox(state, id)?.openerId ?? null;
  if (openerId === null) {
    return null;
  }
  return findSandbox(remainingState, openerId);
}

function buildClosingChange(
  state: StageState,
  opened: StageSandbox | null,
  id: string,
): StageChange {
  const change: StageChange = { state, opened, closedIds: [id] };
  return change;
}

/**
 * Closes a sandbox. When it was visible, the current entry shows its opener
 * when the opener is still open, or a new home sandbox otherwise. Other
 * entries that pointed to it stay, and are restored when visited.
 */
export function closeStageSandbox(
  state: StageState,
  id: string,
  homeLink: RunLink,
): StageChange {
  const remainingState = removeSandbox(state, id);
  if (readVisibleSandbox(state)?.id !== id) {
    return buildClosingChange(remainingState, null, id);
  }
  const opener = findOpenOpener(state, remainingState, id);
  if (opener !== null) {
    const openerState: StageState = {
      ...remainingState,
      entries: pointCurrentEntry(remainingState, opener.id),
    };
    return buildClosingChange(openerState, null, id);
  }
  const home = buildSandbox(remainingState, "#/", homeLink, null, true);
  const homeState: StageState = {
    sandboxes: [...remainingState.sandboxes, home],
    entries: pointCurrentEntry(remainingState, home.id),
    position: state.position,
    nextNumber: state.nextNumber + 1,
  };
  return buildClosingChange(homeState, home, id);
}
