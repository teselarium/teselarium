import type { FileFetchOptions } from "../../files/index.ts";
import type { ModIssue } from "../../mod/index.ts";
import { MOD_API_VERSION, resolveDefaultModSettings } from "../engine/index.ts";
import type {
  AppAction,
  DefaultModSettings,
  ModLaunch,
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
  readHistorySection,
  writeStageEntry,
} from "./stage_history.ts";
import type { StageHistory } from "./stage_history.ts";
import {
  buildHomeRoute,
  buildPageHash,
  buildSectionHash,
  findLinkSection,
  findSectionLink,
  isHomeModSection,
  readStageRoute,
  routeForLink,
} from "./stage_routes.ts";
import type { StageRoute, StageRouting } from "./stage_routes.ts";
import {
  answerSandboxApiMismatch,
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
  createSectionMemory,
  forgetSandboxes,
  readSectionPlace,
  rememberShownEntry,
} from "./stage_sections.ts";
import type { SectionMemory, SectionPlace } from "./stage_sections.ts";
import {
  closeStageSandbox,
  createStageState,
  findSandbox,
  openStageEntry,
  readVisibleEntry,
  readVisibleSandbox,
  restoreStageEntry,
} from "./stage_state.ts";
import type {
  EntryTarget,
  EntryView,
  HomeFallback,
  StageChange,
  StageSandbox,
  StageState,
} from "./stage_state.ts";

export interface StageOptions {
  history: StageHistory;
  defaults: DefaultModSettings;
  /** The page sections, what Home is and the mod sections' links. */
  routing: StageRouting;
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
  /** Every sandbox but the Home mod at `#/` has a close button. */
  canClose: boolean;
  status: SandboxStatus;
  /** Known once the mod is loaded. */
  mod: { title: string; version: string; source: string } | null;
  /** The frame's `srcdoc`, only while the mod is running. */
  sandboxDocument: string | null;
  canReloadTiles: boolean;
  issues: readonly ModIssue[];
  errorMessage: string | null;
  /** The mod's `api` range and the app's mod API version, only while the sandbox is `asking`. */
  apiMismatch: { range: string; apiVersion: string } | null;
}

/** The action the page shows in its dialog. Frozen, except the bytes of a save. */
export interface ActionSnapshot {
  /** Passed back to `answerStageAction`. */
  id: number;
  /** The asking mod's title and source. */
  mod: ActionMod;
  action: AppAction;
}

/** What the current entry shows: a sandbox, a page, or nothing before the first entry. */
export type VisibleView =
  | { kind: "sandbox"; id: string }
  | { kind: "page"; section: string; page: string | null }
  | null;

/** What the page renders of the stage. Frozen, and new after every change. */
export interface StageSnapshot {
  sandboxes: readonly SandboxSnapshot[];
  /** The oldest action waiting for the user, or `null`. Later ones wait their turn. */
  action: ActionSnapshot | null;
  visible: VisibleView;
  /** The section the current entry belongs to, or `null`. */
  activeSection: string | null;
}

/** The stage: open sandboxes, their history entries and the snapshot the page renders. Mutable. */
export interface Stage {
  state: StageState;
  runtimes: Map<string, SandboxRuntime>;
  history: StageHistory;
  defaults: ResolvedDefaultModSettings;
  routing: StageRouting;
  /** Where each section was left, for section navigation. */
  sections: SectionMemory;
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
  visible: null,
  activeSection: null,
});

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

function buildApiMismatch(
  status: SandboxStatus,
  launch: ModLaunch | null,
): SandboxSnapshot["apiMismatch"] {
  if (status !== "asking" || launch === null || launch.mod.api === null) {
    return null;
  }
  const mismatch = { range: launch.mod.api, apiVersion: MOD_API_VERSION };
  return Object.freeze(mismatch);
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
    canClose: !sandbox.isHomeMod,
    status,
    mod: buildModSummary(runtime),
    sandboxDocument: isRunning ? launch.sandboxDocument : null,
    canReloadTiles: isRunning && launch.collectionSource !== null,
    issues: freezeIssues(
      runtime === undefined ? [] : readSandboxIssues(runtime),
    ),
    errorMessage: runtime?.errorMessage ?? null,
    apiMismatch: buildApiMismatch(status, launch),
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

function buildVisibleView(state: StageState): VisibleView {
  const entry = readVisibleEntry(state);
  if (entry === null) {
    return null;
  }
  if (entry.view.kind === "page") {
    const pageView: VisibleView = {
      kind: "page",
      section: entry.view.section,
      page: entry.view.page,
    };
    return Object.freeze(pageView);
  }
  const sandboxView: VisibleView = {
    kind: "sandbox",
    id: entry.view.sandboxId,
  };
  return Object.freeze(sandboxView);
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
    visible: buildVisibleView(stage.state),
    activeSection: readVisibleEntry(stage.state)?.section ?? null,
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
 * one, updates the section memory and drops the actions of the sandboxes
 * that left.
 */
function applyStageChange(stage: Stage, change: StageChange): void {
  stage.state = change.state;
  stage.sections = rememberShownEntry(
    forgetSandboxes(stage.sections, change.closedIds),
    stage.state,
    stage.routing,
  );
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
    routing: options.routing,
    sections: createSectionMemory(),
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

/** The address of a view: its sandbox's hash, or its page's address. */
function readViewHash(stage: Stage, view: EntryView): string {
  if (view.kind === "page") {
    return buildPageHash(stage.routing, view.section, view.page);
  }
  return findSandbox(stage.state, view.sandboxId)?.hash ?? "#/";
}

/** Writes the current entry to the history, with its position, its section and its address. */
function writeCurrentEntry(stage: Stage, mode: "push" | "replace"): void {
  const entry = readVisibleEntry(stage.state);
  if (entry === null) {
    return;
  }
  writeStageEntry(stage.history, mode, {
    position: entry.position,
    section: entry.section,
    hash: readViewHash(stage, entry.view),
  });
}

/**
 * The section of an address the stage did not write: a page belongs to its
 * section, the Home mod to the Home section, and a run link to the section
 * whose mod link it exactly is, or to none.
 */
function readRouteSection(
  routing: StageRouting,
  route: StageRoute,
): string | null {
  if (route.kind === "page") {
    return route.section;
  }
  if (route.isHomeMod) {
    return routing.home.section;
  }
  return findLinkSection(routing, route.link);
}

function buildRouteTarget(
  route: StageRoute,
  openerId: string | null,
): EntryTarget {
  if (route.kind === "page") {
    const pageTarget: EntryTarget = {
      kind: "page",
      section: route.section,
      page: route.page,
    };
    return pageTarget;
  }
  const sandboxTarget: EntryTarget = {
    kind: "new-sandbox",
    opening: {
      hash: route.hash,
      link: route.link,
      openerId,
      isHomeMod: route.isHomeMod,
    },
  };
  return sandboxTarget;
}

/**
 * Follows the current history entry, on start and on every `popstate`. An
 * entry the stage wrote shows its page or its sandbox again, or opens its
 * link in a new sandbox when that sandbox is closed, and keeps its stored
 * section. Any other entry (first load, a typed address, a link followed in
 * the page) shows its page or opens its link in a new sandbox at the next
 * position.
 */
export function followHistory(
  stage: Stage,
  hash: string,
  historyState: unknown,
): void {
  const route = readStageRoute(hash, stage.routing);
  const position = readHistoryPosition(historyState);
  if (position === null) {
    const change = openStageEntry(
      stage.state,
      buildRouteTarget(route, null),
      readRouteSection(stage.routing, route),
    );
    applyStageChange(stage, change);
    writeCurrentEntry(stage, "replace");
  } else {
    applyStageChange(
      stage,
      restoreStageEntry(
        stage.state,
        position,
        route,
        readHistorySection(historyState),
      ),
    );
  }
  publishStage(stage);
}

/**
 * Opens a link a mod asked for, in a new sandbox with a new history entry,
 * in the opener's section. Returns `false`, and opens nothing, when the
 * opener is not the visible sandbox.
 */
export function openStageLink(
  stage: Stage,
  link: RunLink,
  openerId: string,
): boolean {
  if (readVisibleSandbox(stage.state)?.id !== openerId) {
    return false;
  }
  const change = openStageEntry(
    stage.state,
    buildRouteTarget(routeForLink(link), openerId),
    readVisibleEntry(stage.state)?.section ?? null,
  );
  applyStageChange(stage, change);
  writeCurrentEntry(stage, "push");
  publishStage(stage);
  return true;
}

/** A new sandbox for a mod section's link. The Home section's mod opens at `#/`. */
function buildSectionSandbox(
  routing: StageRouting,
  section: string,
  link: RunLink,
): EntryTarget {
  const target: EntryTarget = {
    kind: "new-sandbox",
    opening: {
      hash: buildSectionHash(routing, section) ?? "#/",
      link,
      openerId: null,
      isHomeMod: isHomeModSection(routing, section),
    },
  };
  return target;
}

/**
 * A section's start: the index page of a page section, or the root sandbox of
 * a mod section while it is open, or a new one. `null` for an unknown section.
 */
function buildSectionStart(
  routing: StageRouting,
  section: string,
  place: SectionPlace,
): EntryTarget | null {
  if (routing.pageSections.includes(section)) {
    const indexTarget: EntryTarget = { kind: "page", section, page: null };
    return indexTarget;
  }
  const link = findSectionLink(routing, section);
  if (link === null) {
    return null;
  }
  if (place.root !== null) {
    const rootTarget: EntryTarget = { kind: "sandbox", sandboxId: place.root };
    return rootTarget;
  }
  return buildSectionSandbox(routing, section, link);
}

/**
 * Activates a section, as a tab bar does: a new history entry shows the last
 * view seen in the section when the user comes from another section, or the
 * section's start when there is none or the section is the current one.
 * Returns `false`, and opens nothing, for an unknown section.
 */
export function openStageSection(stage: Stage, section: string): boolean {
  const place = readSectionPlace(stage.sections, section);
  const isCurrent = readVisibleEntry(stage.state)?.section === section;
  const target =
    !isCurrent && place.last !== null
      ? place.last
      : buildSectionStart(stage.routing, section, place);
  if (target === null) {
    return false;
  }
  applyStageChange(stage, openStageEntry(stage.state, target, section));
  writeCurrentEntry(stage, "push");
  publishStage(stage);
  return true;
}

/** Closes a sandbox and replaces the current entry with the one of what is now shown. */
export function closeSandbox(stage: Stage, id: string): void {
  const home: HomeFallback = {
    route: buildHomeRoute(stage.routing),
    section: stage.routing.home.section,
  };
  applyStageChange(stage, closeStageSandbox(stage.state, id, home));
  writeCurrentEntry(stage, "replace");
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

/**
 * Answers the question of the visible sandbox, whose mod was written for
 * another mod API: `runAnyway` starts the mod, otherwise the sandbox fails
 * with an error naming both versions and keeps its entry and close button.
 * Does nothing unless the sandbox is visible and still asking, so a late or
 * repeated answer is ignored.
 */
export function answerApiMismatch(
  stage: Stage,
  sandboxId: string,
  runAnyway: boolean,
): void {
  const runtime = stage.runtimes.get(sandboxId);
  if (
    runtime === undefined ||
    readVisibleSandbox(stage.state)?.id !== sandboxId
  ) {
    return;
  }
  answerSandboxApiMismatch(runtime, buildSandboxServices(stage), runAnyway);
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
