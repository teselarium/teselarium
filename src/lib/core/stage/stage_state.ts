import type { RunLink } from "../engine/index.ts";
import type { StageRoute } from "./stage_routes.ts";

/** One sandbox of the stage. `id` is given by the stage, never by a mod. */
export interface StageSandbox {
  id: string;
  /** The address hash of the sandbox's history entries. */
  hash: string;
  link: RunLink;
  /** The sandbox whose mod opened this one, or `null` for a link the user followed. */
  openerId: string | null;
  /** The section the sandbox was opened in, or `null`. */
  section: string | null;
  /** Opened for `#/` when Home is a mod. The Home mod has no close button. */
  isHomeMod: boolean;
}

/** What a history entry shows: a sandbox, or a page of a page section (`page: null` is the index). */
export type EntryView =
  | { kind: "sandbox"; sandboxId: string }
  | { kind: "page"; section: string; page: string | null };

/** A history entry the stage wrote, what it shows and the section it belongs to. */
export interface StageEntry {
  position: number;
  view: EntryView;
  section: string | null;
}

/** A sandbox to open. */
export interface SandboxOpening {
  hash: string;
  link: RunLink;
  openerId: string | null;
  isHomeMod: boolean;
}

/** What a new entry shows: a new sandbox, an open sandbox or a page. */
export type EntryTarget =
  { kind: "new-sandbox"; opening: SandboxOpening } | EntryView;

/** What closing shows when the closed sandbox has no open opener: Home, and its section. */
export interface HomeFallback {
  route: StageRoute;
  section: string;
}

/**
 * The stage as plain data. What is visible is the view of the entry at
 * `position`: at most one sandbox, and none while a page is shown.
 */
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

export function findSandbox(
  state: StageState,
  id: string,
): StageSandbox | null {
  for (const sandbox of state.sandboxes) {
    if (sandbox.id === id) {
      return sandbox;
    }
  }
  return null;
}

/** The entry at the current position, or `null` before the first entry. */
export function readVisibleEntry(state: StageState): StageEntry | null {
  return findEntry(state, state.position);
}

/** The sandbox of the entry at the current position, or `null` while a page or nothing is shown. */
export function readVisibleSandbox(state: StageState): StageSandbox | null {
  const entry = readVisibleEntry(state);
  if (entry === null || entry.view.kind !== "sandbox") {
    return null;
  }
  return findSandbox(state, entry.view.sandboxId);
}

/** Whether a view can be shown as it is: a page, or a sandbox that is still open. */
function isViewOpen(state: StageState, view: EntryView): boolean {
  return view.kind === "page" || findSandbox(state, view.sandboxId) !== null;
}

function buildSandbox(
  state: StageState,
  opening: SandboxOpening,
  section: string | null,
): StageSandbox {
  const sandbox: StageSandbox = {
    id: `sandbox-${state.nextNumber}`,
    hash: opening.hash,
    link: structuredClone(opening.link),
    openerId: opening.openerId,
    section,
    isHomeMod: opening.isHomeMod,
  };
  return sandbox;
}

function buildSandboxView(sandbox: StageSandbox): EntryView {
  const view: EntryView = { kind: "sandbox", sandboxId: sandbox.id };
  return view;
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
    if (entry.view.kind === "sandbox") {
      reachedIds.add(entry.view.sandboxId);
    }
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

/**
 * Places `entry` among `entries`, adds `opened` when a sandbox is opened, and
 * closes every sandbox that no entry reaches any more.
 */
function buildPlacingChange(
  state: StageState,
  entries: StageEntry[],
  entry: StageEntry,
  opened: StageSandbox | null,
): StageChange {
  const placedEntries = placeEntry(entries, entry);
  const sandboxes =
    opened === null ? state.sandboxes : [...state.sandboxes, opened];
  const split = keepReachedSandboxes(sandboxes, placedEntries);
  const change: StageChange = {
    state: {
      sandboxes: split.kept,
      entries: placedEntries,
      position: entry.position,
      nextNumber: opened === null ? state.nextNumber : state.nextNumber + 1,
    },
    opened,
    closedIds: split.closedIds,
  };
  return change;
}

/**
 * Adds an entry at the next history position that shows `target`: a new
 * sandbox, an open sandbox or a page. Entries after the current position are
 * dropped, as a browser drops forward entries, and every sandbox that no
 * remaining entry points to is closed.
 */
export function openStageEntry(
  state: StageState,
  target: EntryTarget,
  section: string | null,
): StageChange {
  const keptEntries: StageEntry[] = [];
  for (const entry of state.entries) {
    if (entry.position <= state.position) {
      keptEntries.push(entry);
    }
  }
  const position = state.position + 1;
  if (target.kind === "new-sandbox") {
    const sandbox = buildSandbox(state, target.opening, section);
    const entry: StageEntry = {
      position,
      view: buildSandboxView(sandbox),
      section,
    };
    return buildPlacingChange(state, keptEntries, entry, sandbox);
  }
  const entry: StageEntry = { position, view: target, section };
  return buildPlacingChange(state, keptEntries, entry, null);
}

/**
 * Goes to a history position. When its entry shows a page or an open
 * sandbox, that is shown. Otherwise, after a reload or when its sandbox was
 * closed, the entry takes the route's page, or a new sandbox for the route's
 * link. Forward entries are kept.
 */
export function restoreStageEntry(
  state: StageState,
  position: number,
  route: StageRoute,
  section: string | null,
): StageChange {
  const entry = findEntry(state, position);
  if (entry !== null && isViewOpen(state, entry.view)) {
    const change: StageChange = {
      state: { ...state, position },
      opened: null,
      closedIds: [],
    };
    return change;
  }
  if (route.kind === "page") {
    const pageEntry: StageEntry = {
      position,
      view: { kind: "page", section: route.section, page: route.page },
      section,
    };
    return buildPlacingChange(state, state.entries, pageEntry, null);
  }
  const opening: SandboxOpening = {
    hash: route.hash,
    link: route.link,
    openerId: null,
    isHomeMod: route.isHomeMod,
  };
  const sandbox = buildSandbox(state, opening, section);
  const sandboxEntry: StageEntry = {
    position,
    view: buildSandboxView(sandbox),
    section,
  };
  return buildPlacingChange(state, state.entries, sandboxEntry, sandbox);
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

/** The current entry pointed to Home: its page, or a new Home mod sandbox. */
function pointCurrentEntryHome(
  remainingState: StageState,
  home: HomeFallback,
  id: string,
): StageChange {
  const position = remainingState.position;
  if (home.route.kind === "page") {
    const pageEntry: StageEntry = {
      position,
      view: {
        kind: "page",
        section: home.route.section,
        page: home.route.page,
      },
      section: home.section,
    };
    const pageState: StageState = {
      ...remainingState,
      entries: placeEntry(remainingState.entries, pageEntry),
    };
    return buildClosingChange(pageState, null, id);
  }
  const opening: SandboxOpening = {
    hash: home.route.hash,
    link: home.route.link,
    openerId: null,
    isHomeMod: home.route.isHomeMod,
  };
  const homeSandbox = buildSandbox(remainingState, opening, home.section);
  const homeEntry: StageEntry = {
    position,
    view: buildSandboxView(homeSandbox),
    section: home.section,
  };
  const homeState: StageState = {
    sandboxes: [...remainingState.sandboxes, homeSandbox],
    entries: placeEntry(remainingState.entries, homeEntry),
    position,
    nextNumber: remainingState.nextNumber + 1,
  };
  return buildClosingChange(homeState, homeSandbox, id);
}

/**
 * Closes a sandbox. When it was visible, the current entry shows its opener
 * when the opener is still open, or Home otherwise. Other entries that
 * pointed to it stay, and are restored when visited.
 */
export function closeStageSandbox(
  state: StageState,
  id: string,
  home: HomeFallback,
): StageChange {
  const remainingState = removeSandbox(state, id);
  const visibleEntry = readVisibleEntry(state);
  if (visibleEntry === null || readVisibleSandbox(state)?.id !== id) {
    return buildClosingChange(remainingState, null, id);
  }
  const opener = findOpenOpener(state, remainingState, id);
  if (opener === null) {
    return pointCurrentEntryHome(remainingState, home, id);
  }
  const openerEntry: StageEntry = {
    position: state.position,
    view: buildSandboxView(opener),
    section: visibleEntry.section,
  };
  const openerState: StageState = {
    ...remainingState,
    entries: placeEntry(remainingState.entries, openerEntry),
  };
  return buildClosingChange(openerState, null, id);
}
