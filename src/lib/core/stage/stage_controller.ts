import type { FileFetchOptions } from "../../files/index.ts";
import type { ModIssue } from "../../mod/index.ts";
import { resolveDefaultModSettings } from "../engine/index.ts";
import type {
  AppAction,
  DefaultModSettings,
  ResolvedDefaultModSettings,
  RunLink,
} from "../engine/index.ts";
import type { ModStorage } from "../storage/index.ts";
import { buildTheme } from "../theme/index.ts";
import type { ColorScheme, Theme } from "../theme/index.ts";
import {
  addStageAction,
  answerAction,
  createStageActions,
  dropActions,
  readShownAction,
} from "./stage_actions.ts";
import type { ActionMod, StageActions } from "./stage_actions.ts";
import {
  readHistoryPosition,
  readStageRoute,
  routeForLink,
  writeStageEntry,
} from "./stage_history.ts";
import type { StageHistory } from "./stage_history.ts";
import {
  attachSandboxFrame,
  launchSandbox,
  pushSandboxTheme,
  readSandboxIssues,
  reloadSandboxTiles,
  stopSandbox,
} from "./stage_sandboxes.ts";
import type {
  SandboxRuntime,
  SandboxServices,
  SandboxStatus,
} from "./stage_sandboxes.ts";
import {
  closeStageSandbox,
  createStageState,
  openStageEntry,
  readVisibleSandbox,
  restoreStageEntry,
} from "./stage_state.ts";
import type { StageChange, StageSandbox, StageState } from "./stage_state.ts";

export interface StageOptions {
  history: StageHistory;
  defaults: DefaultModSettings;
  appOrigin: string;
  /** The app's address: relative references and locations resolve against it. */
  baseUrl: string;
  storage: ModStorage;
  fetch?: typeof globalThis.fetch;
  /** The color scheme the app starts with. */
  colorScheme: ColorScheme;
}

/** What the page renders of one sandbox. Frozen. */
export interface SandboxSnapshot {
  id: string;
  hash: string;
  isVisible: boolean;
  /** Every sandbox but the home mod at `#/` has a close button. */
  canClose: boolean;
  status: SandboxStatus;
  /** Known once the mod is loaded. */
  mod: { title: string; version: string; source: string } | null;
  /** The frame's `srcdoc`, only while the mod is running. */
  sandboxDocument: string | null;
  canReloadTiles: boolean;
  issues: readonly ModIssue[];
  errorMessage: string | null;
}

/** The action the page shows in its dialog. Frozen, except the bytes of a save. */
export interface ActionSnapshot {
  /** Passed back to `answerStageAction`. */
  id: number;
  /** The asking mod's title and source. */
  mod: ActionMod;
  action: AppAction;
}

/** What the page renders of the stage. Frozen, and new after every change. */
export interface StageSnapshot {
  sandboxes: readonly SandboxSnapshot[];
  /** The oldest action waiting for the user, or `null`. Later ones wait their turn. */
  action: ActionSnapshot | null;
}

/** The stage: open sandboxes, their history entries and the snapshot the page renders. Mutable. */
export interface Stage {
  state: StageState;
  runtimes: Map<string, SandboxRuntime>;
  history: StageHistory;
  defaults: ResolvedDefaultModSettings;
  appOrigin: string;
  fetchOptions: FileFetchOptions;
  storage: ModStorage;
  /** The current theme: new sessions connect with it, and running ones are told when it changes. */
  theme: Theme;
  /** The actions the visible mod asked for, oldest first. */
  actions: StageActions;
  listeners: Set<() => void>;
  snapshot: StageSnapshot;
}

const LEFT_PAGE_MESSAGE = "The mod left its page and was stopped.";

const EMPTY_SNAPSHOT: StageSnapshot = Object.freeze({
  sandboxes: Object.freeze([]),
  action: null,
});

function buildHomeLink(stage: Stage): RunLink {
  const homeLink: RunLink = {
    mod: stage.defaults.home,
    collection: null,
    params: {},
  };
  return homeLink;
}

function openLinkFromSandbox(
  stage: Stage,
  openerId: string,
  link: RunLink,
): boolean {
  return openStageLink(stage, link, openerId);
}

function readStageTheme(stage: Stage): Theme {
  return stage.theme;
}

function buildSandboxServices(stage: Stage): SandboxServices {
  const services: SandboxServices = {
    defaults: stage.defaults,
    appOrigin: stage.appOrigin,
    fetchOptions: stage.fetchOptions,
    storage: stage.storage,
    onChange: publishStage.bind(undefined, stage),
    onOpenLink: openLinkFromSandbox.bind(undefined, stage),
    onRequestAction: requestStageAction.bind(undefined, stage),
    readTheme: readStageTheme.bind(undefined, stage),
  };
  return services;
}

function buildModSummary(
  runtime: SandboxRuntime | undefined,
): SandboxSnapshot["mod"] {
  const mod = runtime?.launch?.mod;
  if (mod === undefined) {
    return null;
  }
  const summary = {
    title: mod.title,
    version: mod.version,
    source: mod.source,
  };
  return Object.freeze(summary);
}

function freezeIssues(issues: ModIssue[]): readonly ModIssue[] {
  const frozenIssues: ModIssue[] = [];
  for (const issue of issues) {
    frozenIssues.push(Object.freeze({ ...issue }));
  }
  return Object.freeze(frozenIssues);
}

function buildSandboxSnapshot(
  sandbox: StageSandbox,
  runtime: SandboxRuntime | undefined,
  visibleId: string | null,
): SandboxSnapshot {
  const status = runtime?.status ?? "stopped";
  const launch = runtime?.launch ?? null;
  const isRunning = status === "running" && launch !== null;
  const snapshot: SandboxSnapshot = {
    id: sandbox.id,
    hash: sandbox.hash,
    isVisible: sandbox.id === visibleId,
    canClose: !sandbox.isHome,
    status,
    mod: buildModSummary(runtime),
    sandboxDocument: isRunning ? launch.sandboxDocument : null,
    canReloadTiles: isRunning && launch.collectionSource !== null,
    issues: freezeIssues(
      runtime === undefined ? [] : readSandboxIssues(runtime),
    ),
    errorMessage: runtime?.errorMessage ?? null,
  };
  return Object.freeze(snapshot);
}

/** The shown action, frozen. The bytes of a save stay as they are: a typed array cannot be frozen. */
function buildActionSnapshot(stage: Stage): ActionSnapshot | null {
  const entry = readShownAction(stage.actions);
  if (entry === null) {
    return null;
  }
  const snapshot: ActionSnapshot = {
    id: entry.id,
    mod: Object.freeze({ ...entry.mod }),
    action: Object.freeze({ ...entry.action }),
  };
  return Object.freeze(snapshot);
}

function buildStageSnapshot(stage: Stage): StageSnapshot {
  const visibleId = readVisibleSandbox(stage.state)?.id ?? null;
  const sandboxes: SandboxSnapshot[] = [];
  for (const sandbox of stage.state.sandboxes) {
    sandboxes.push(
      buildSandboxSnapshot(sandbox, stage.runtimes.get(sandbox.id), visibleId),
    );
  }
  const snapshot: StageSnapshot = {
    sandboxes: Object.freeze(sandboxes),
    action: buildActionSnapshot(stage),
  };
  return Object.freeze(snapshot);
}

/** Builds a new snapshot and notifies the listeners. */
function publishStage(stage: Stage): void {
  stage.snapshot = buildStageSnapshot(stage);
  for (const listener of stage.listeners) {
    listener();
  }
}

/** A sandbox can ask the user while it is the visible one and its mod runs. */
function canSandboxAsk(stage: Stage, sandboxId: string): boolean {
  return (
    readVisibleSandbox(stage.state)?.id === sandboxId &&
    stage.runtimes.get(sandboxId)?.status === "running"
  );
}

/**
 * Answers `false` to the actions of every sandbox that is no longer visible,
 * was closed or was stopped, and removes them without acting. A stopped
 * session drops the answer, so a stopped mod gets none.
 */
function dropLeftActions(stage: Stage): void {
  dropActions(stage.actions, canSandboxAsk.bind(undefined, stage));
}

/**
 * Applies a state change: stops the closed sandboxes, launches the opened
 * one and drops the actions of the sandboxes that left.
 */
function applyStageChange(stage: Stage, change: StageChange): void {
  stage.state = change.state;
  for (const closedId of change.closedIds) {
    const runtime = stage.runtimes.get(closedId);
    if (runtime !== undefined) {
      stopSandbox(runtime, null);
      stage.runtimes.delete(closedId);
    }
  }
  if (change.opened !== null) {
    stage.runtimes.set(
      change.opened.id,
      launchSandbox(change.opened, buildSandboxServices(stage)),
    );
  }
  dropLeftActions(stage);
}

export function createStage(options: StageOptions): Stage {
  const stage: Stage = {
    state: createStageState(),
    runtimes: new Map(),
    history: options.history,
    defaults: resolveDefaultModSettings(options.defaults, options.baseUrl),
    appOrigin: options.appOrigin,
    fetchOptions: { baseUrl: options.baseUrl, fetch: options.fetch },
    storage: options.storage,
    theme: buildTheme(options.colorScheme),
    actions: createStageActions(),
    listeners: new Set(),
    snapshot: EMPTY_SNAPSHOT,
  };
  return stage;
}

/**
 * Follows the current history entry, on start and on every `popstate`. An
 * entry the stage wrote shows its sandbox again, or opens its link in a new
 * one when that sandbox is closed. Any other entry (first load, a typed
 * address, a link followed in the page) opens its link in a new sandbox at
 * the next position.
 */
export function followHistory(
  stage: Stage,
  hash: string,
  historyState: unknown,
): void {
  const route = readStageRoute(hash, stage.defaults.home);
  const position = readHistoryPosition(historyState);
  if (position === null) {
    const change = openStageEntry(
      stage.state,
      route.hash,
      route.link,
      null,
      route.isHome,
    );
    applyStageChange(stage, change);
    writeStageEntry(
      stage.history,
      "replace",
      change.state.position,
      route.hash,
    );
  } else {
    applyStageChange(
      stage,
      restoreStageEntry(
        stage.state,
        position,
        route.hash,
        route.link,
        route.isHome,
      ),
    );
  }
  publishStage(stage);
}

/**
 * Opens a link a mod asked for, in a new sandbox with a new history entry.
 * Returns `false`, and opens nothing, when the opener is not the visible sandbox.
 */
export function openStageLink(
  stage: Stage,
  link: RunLink,
  openerId: string,
): boolean {
  if (readVisibleSandbox(stage.state)?.id !== openerId) {
    return false;
  }
  const route = routeForLink(link);
  const change = openStageEntry(
    stage.state,
    route.hash,
    route.link,
    openerId,
    route.isHome,
  );
  applyStageChange(stage, change);
  writeStageEntry(stage.history, "push", change.state.position, route.hash);
  publishStage(stage);
  return true;
}

/** Closes a sandbox and replaces the current entry with the one of the sandbox now shown. */
export function closeSandbox(stage: Stage, id: string): void {
  applyStageChange(
    stage,
    closeStageSandbox(stage.state, id, buildHomeLink(stage)),
  );
  const visible = readVisibleSandbox(stage.state);
  if (visible !== null) {
    writeStageEntry(
      stage.history,
      "replace",
      stage.state.position,
      visible.hash,
    );
  }
  publishStage(stage);
}

/** Reloads the tiles of a sandbox opened with a collection, and pushes them to its mod. */
export async function reloadTiles(stage: Stage, id: string): Promise<void> {
  const runtime = stage.runtimes.get(id);
  if (runtime === undefined) {
    return;
  }
  await reloadSandboxTiles(runtime, buildSandboxServices(stage));
}

/** The title and source of a running sandbox's mod, or `null` when it is not running. */
function readRunningMod(stage: Stage, sandboxId: string): ActionMod | null {
  const runtime = stage.runtimes.get(sandboxId);
  if (runtime?.status !== "running" || runtime.launch === null) {
    return null;
  }
  const mod: ActionMod = {
    title: runtime.launch.mod.title,
    source: runtime.launch.mod.source,
  };
  return mod;
}

/**
 * Queues an action a mod asked for, to show to the user after the ones
 * already waiting. Resolves with the user's answer. Returns `null`, and
 * queues nothing, when the sandbox is not the visible one or not running.
 */
export function requestStageAction(
  stage: Stage,
  sandboxId: string,
  action: AppAction,
): Promise<boolean> | null {
  const mod = readRunningMod(stage, sandboxId);
  if (readVisibleSandbox(stage.state)?.id !== sandboxId || mod === null) {
    return null;
  }
  const answer = addStageAction(stage.actions, sandboxId, mod, action);
  publishStage(stage);
  return answer;
}

/**
 * Answers the action `id` the page shows, so the mod's request resolves and
 * the next action is shown. Does nothing for an unknown id.
 */
export function answerStageAction(
  stage: Stage,
  id: number,
  accepted: boolean,
): void {
  if (!answerAction(stage.actions, id, accepted)) {
    return;
  }
  publishStage(stage);
}

/** Connects a sandbox's frame, on the frame's first `load`. */
export function attachFrame(
  stage: Stage,
  id: string,
  frameTarget: Pick<Window, "postMessage">,
): void {
  const runtime = stage.runtimes.get(id);
  if (runtime === undefined) {
    return;
  }
  attachSandboxFrame(runtime, frameTarget, buildSandboxServices(stage));
  publishStage(stage);
}

/** A frame loaded another document: its mod navigated, so it is stopped and its frame removed. */
export function frameLoadedAgain(stage: Stage, id: string): void {
  const runtime = stage.runtimes.get(id);
  if (runtime === undefined || runtime.status === "stopped") {
    return;
  }
  const source = runtime.launch?.mod.source ?? id;
  stopSandbox(runtime, { level: "error", source, message: LEFT_PAGE_MESSAGE });
  dropLeftActions(stage);
  publishStage(stage);
}

/**
 * Switches the stage to a color scheme and pushes `theme.changed` to every
 * running mod, visible or hidden. Does nothing when the color scheme is the
 * current one.
 */
export function changeStageColorScheme(
  stage: Stage,
  colorScheme: ColorScheme,
): void {
  if (stage.theme.colorScheme === colorScheme) {
    return;
  }
  stage.theme = buildTheme(colorScheme);
  for (const runtime of stage.runtimes.values()) {
    pushSandboxTheme(runtime, stage.theme);
  }
}

export function readStageSnapshot(stage: Stage): StageSnapshot {
  return stage.snapshot;
}

function unsubscribeStage(stage: Stage, listener: () => void): void {
  stage.listeners.delete(listener);
}

/** Calls `listener` after every change. Returns the function that unsubscribes it. */
export function subscribeStage(stage: Stage, listener: () => void): () => void {
  stage.listeners.add(listener);
  return unsubscribeStage.bind(undefined, stage, listener);
}
