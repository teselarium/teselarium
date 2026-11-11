import type { FileFetchOptions } from "../../files/index.ts";
import type { ModPermission } from "../../mod/index.ts";
import { MOD_API_VERSION, resolveDefaultModSettings } from "../engine/index.ts";
import type {
  AppAction,
  DefaultModSettings,
  FrameLayout,
  ModCheckReport,
  ModCheckRequest,
  ResolvedDefaultModSettings,
  RunLink,
} from "../engine/index.ts";
import type { SiteDecision } from "../permissions/index.ts";
import type { ModStorage } from "../storage/index.ts";
import { buildTheme } from "../theme/index.ts";
import type { ColorScheme, Theme } from "../theme/index.ts";
import {
  addStageAction,
  answerAction,
  createStageActions,
  dropActions,
  markActionPlaying,
  readShownAction,
} from "./stage_actions.ts";
import type { ActionMod, StageActions } from "./stage_actions.ts";
import {
  attachStageCheckFrame,
  createStageChecks,
  endRequesterChecks,
  runStageCheck,
  stopReloadedCheckFrame,
} from "./stage_checks.ts";
import type { CheckServices, StageChecks } from "./stage_checks.ts";
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
  addFullscreenRefusedWarning,
  answerSandboxApiMismatch,
  answerSandboxSiteConsent,
  attachSandboxFrame,
  buildConsentLineKey,
  launchSandbox,
  pushSandboxLayout,
  pushSandboxTheme,
  clearSandboxNotifications,
  dismissSandboxMessage,
  markSandboxMessagesRead,
  readSandboxMessages,
  reloadSandboxTiles,
  stopSandbox,
} from "./stage_sandboxes.ts";
import { buildNoDroppedMessages } from "./stage_messages.ts";
import type {
  DroppedMessageCounts,
  MessageLevel,
  MessageProducer,
} from "./stage_messages.ts";
import type {
  SandboxRuntime,
  SandboxServices,
  SandboxStatus,
  SiteConsentAnswer,
} from "./stage_sandboxes.ts";
import {
  createSectionMemory,
  forgetSandboxes,
  readSectionPlace,
  rememberShownEntry,
} from "./stage_sections.ts";
import type { SectionMemory, SectionPlace } from "./stage_sections.ts";
import { readSandboxLayout } from "./stage_layout.ts";
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
  /** Whether "Load media linked by tiles" is on as the app starts. */
  loadsTileLinkedMedia: boolean;
  /** Whether theater mode is on as the app starts. */
  theaterMode: boolean;
  /** The remembered site decisions, read before a mod from another origin starts, by checks and by `mods.inspect`. */
  readSiteDecisions: () => readonly SiteDecision[];
  /** Keeps the decisions of a site consent answer whose Remember was checked. */
  rememberSiteDecisions: (decisions: readonly SiteDecision[]) => void;
}

/** One line of the site consent dialog: a declared category and host, and the mod's reason. Frozen. */
export interface SiteConsentLine extends ModPermission {
  /** Passed back in `SiteConsentAnswer.allowed` when the line is checked. */
  key: string;
}

/** What the page renders of one message of a sandbox. Frozen. */
export interface MessageSnapshot {
  /** Passed back to `dismissMessage`. Higher for a newer message of the same sandbox. */
  id: number;
  level: MessageLevel;
  producer: MessageProducer;
  source: string;
  /** Plain text. */
  text: string;
  isRead: boolean;
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
  /**
   * Every message, in the order they were found: mod file issues, collection
   * issues, tile link issues, then the others as they arrived. The page
   * derives the counts from it.
   */
  messages: readonly MessageSnapshot[];
  /** How many older messages from the mod were dropped, per level. */
  droppedModMessages: Readonly<DroppedMessageCounts>;
  /** The link's mod reference, resolved against the app's address. */
  modReference: string;
  /** The link's collection, resolved against the app's address, or `null` without one. */
  collection: string | null;
  errorMessage: string | null;
  /** The mod's `api` range and the app's mod API version, only while the sandbox asks the mod API question. */
  apiMismatch: { range: string; apiVersion: string } | null;
  /** The lines to ask about, in the order declared, only while the sandbox asks the site consent question. */
  siteConsent: { lines: readonly SiteConsentLine[] } | null;
}

/** What the page renders of one check: its hidden frame running now. Frozen. */
export interface CheckSnapshot {
  id: string;
  /** The frame's key. It changes for each new frame of the check, so the page makes a new iframe. */
  key: string;
  /** The frame's `srcdoc`. */
  sandboxDocument: string;
  /** The checked mod's title, for the frame's `title`. */
  title: string;
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
  /** The running checks, whose hidden frames the page renders apart from the sandboxes. */
  checks: readonly CheckSnapshot[];
  /** The oldest action waiting for the user, or `null`. Later ones wait their turn. */
  action: ActionSnapshot | null;
  visible: VisibleView;
  /** The section the current entry belongs to, or `null`. */
  activeSection: string | null;
  /** Whether theater mode is on, for the stage bar's button. */
  isTheaterMode: boolean;
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
  /** Whether mods launched from now on load the media their tiles link. Running mods keep their launch. */
  loadsTileLinkedMedia: boolean;
  /** Whether theater mode is on. With `fullscreenSandboxId`, it decides each frame's layout (`readSandboxLayout`). */
  theaterMode: boolean;
  /** The sandbox whose frame is the app page's fullscreen element, or `null`. */
  fullscreenSandboxId: string | null;
  readSiteDecisions: () => readonly SiteDecision[];
  rememberSiteDecisions: (decisions: readonly SiteDecision[]) => void;
  /** The actions the visible mod asked for, oldest first. */
  actions: StageActions;
  /** The running mod checks, apart from the sandboxes and the history. */
  checks: StageChecks;
  listeners: Set<() => void>;
  snapshot: StageSnapshot;
}

const LEFT_PAGE_MESSAGE = "The mod left its page and was stopped.";

const EMPTY_SNAPSHOT: StageSnapshot = Object.freeze({
  sandboxes: Object.freeze([]),
  checks: Object.freeze([]),
  action: null,
  visible: null,
  activeSection: null,
  isTheaterMode: false,
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

function readStageLayout(stage: Stage, sandboxId: string): FrameLayout {
  return readSandboxLayout(
    stage.theaterMode,
    stage.fullscreenSandboxId,
    sandboxId,
  );
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
    onCheckMod: checkStageMod.bind(undefined, stage),
    readTheme: readStageTheme.bind(undefined, stage),
    readLayout: readStageLayout.bind(undefined, stage),
    loadsTileLinkedMedia: stage.loadsTileLinkedMedia,
    readSiteDecisions: stage.readSiteDecisions,
    rememberSiteDecisions: stage.rememberSiteDecisions,
  };
  return services;
}

function isSandboxRunning(stage: Stage, sandboxId: string): boolean {
  return stage.runtimes.get(sandboxId)?.status === "running";
}

function buildCheckServices(stage: Stage): CheckServices {
  const services: CheckServices = {
    appOrigin: stage.appOrigin,
    defaults: stage.defaults,
    fetchOptions: stage.fetchOptions,
    readTheme: readStageTheme.bind(undefined, stage),
    isSandboxRunning: isSandboxRunning.bind(undefined, stage),
    onChange: publishStage.bind(undefined, stage),
    loadsTileLinkedMedia: stage.loadsTileLinkedMedia,
    readSiteDecisions: stage.readSiteDecisions,
  };
  return services;
}

function buildModSummary(
  runtime: SandboxRuntime | undefined,
): SandboxSnapshot["mod"] {
  const mod = runtime?.loadedMod ?? null;
  if (mod === null) {
    return null;
  }
  const summary = {
    title: mod.title,
    version: mod.version,
    source: mod.source,
  };
  return Object.freeze(summary);
}

function buildMessageSnapshots(
  runtime: SandboxRuntime | undefined,
): readonly MessageSnapshot[] {
  const snapshots: MessageSnapshot[] = [];
  if (runtime === undefined) {
    return Object.freeze(snapshots);
  }
  for (const message of readSandboxMessages(runtime)) {
    const snapshot: MessageSnapshot = {
      id: message.id,
      level: message.level,
      producer: message.producer,
      source: message.source,
      text: message.text,
      isRead: runtime.readMessageIds.has(message.id),
    };
    snapshots.push(Object.freeze(snapshot));
  }
  return Object.freeze(snapshots);
}

function buildDroppedModMessages(
  runtime: SandboxRuntime | undefined,
): Readonly<DroppedMessageCounts> {
  const counts = runtime?.droppedModMessages ?? buildNoDroppedMessages();
  return Object.freeze({ ...counts });
}

function buildApiMismatch(
  runtime: SandboxRuntime | undefined,
): SandboxSnapshot["apiMismatch"] {
  if (runtime?.status !== "asking" || runtime.question !== "api") {
    return null;
  }
  const range = runtime.pending?.mod.api ?? null;
  if (range === null) {
    return null;
  }
  const mismatch = { range, apiVersion: MOD_API_VERSION };
  return Object.freeze(mismatch);
}

function buildSiteConsent(
  runtime: SandboxRuntime | undefined,
): SandboxSnapshot["siteConsent"] {
  if (runtime?.status !== "asking" || runtime.question !== "sites") {
    return null;
  }
  const lines: SiteConsentLine[] = [];
  for (const line of runtime.consentLines) {
    const consentLine: SiteConsentLine = {
      key: buildConsentLineKey(line),
      category: line.category,
      host: line.host,
      reason: line.reason,
    };
    lines.push(Object.freeze(consentLine));
  }
  const siteConsent = { lines: Object.freeze(lines) };
  return Object.freeze(siteConsent);
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
    messages: buildMessageSnapshots(runtime),
    droppedModMessages: buildDroppedModMessages(runtime),
    modReference: runtime?.modReference ?? sandbox.link.mod,
    collection:
      runtime === undefined
        ? sandbox.link.collection
        : runtime.collectionLocation,
    errorMessage: runtime?.errorMessage ?? null,
    apiMismatch: buildApiMismatch(runtime),
    siteConsent: buildSiteConsent(runtime),
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

function buildCheckSnapshots(checks: StageChecks): readonly CheckSnapshot[] {
  const snapshots: CheckSnapshot[] = [];
  for (const check of checks.entries.values()) {
    if (check.frame === null) {
      continue;
    }
    const snapshot: CheckSnapshot = {
      id: check.id,
      key: check.frame.key,
      sandboxDocument: check.frame.sandboxDocument,
      title: check.launch.mod.title,
    };
    snapshots.push(Object.freeze(snapshot));
  }
  return Object.freeze(snapshots);
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
    checks: buildCheckSnapshots(stage.checks),
    action: buildActionSnapshot(stage),
    visible: buildVisibleView(stage.state),
    activeSection: readVisibleEntry(stage.state)?.section ?? null,
    isTheaterMode: stage.theaterMode,
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
 * one, updates the section memory, drops the actions of the sandboxes that
 * left and ends the checks the closed sandboxes asked for.
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
  if (
    stage.fullscreenSandboxId !== null &&
    change.closedIds.includes(stage.fullscreenSandboxId)
  ) {
    stage.fullscreenSandboxId = null;
  }
  if (change.opened !== null) {
    stage.runtimes.set(
      change.opened.id,
      launchSandbox(change.opened, buildSandboxServices(stage)),
    );
  }
  dropLeftActions(stage);
  for (const closedId of change.closedIds) {
    endRequesterChecks(stage.checks, buildCheckServices(stage), closedId);
  }
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
    loadsTileLinkedMedia: options.loadsTileLinkedMedia,
    theaterMode: options.theaterMode,
    fullscreenSandboxId: null,
    readSiteDecisions: options.readSiteDecisions,
    rememberSiteDecisions: options.rememberSiteDecisions,
    actions: createStageActions(),
    checks: createStageChecks(),
    listeners: new Set(),
    snapshot: Object.freeze({
      ...EMPTY_SNAPSHOT,
      isTheaterMode: options.theaterMode,
    }),
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

/**
 * Marks every message of `level` of a sandbox read, as when the user opens
 * that level's popover. Does nothing for an unknown sandbox.
 */
export function markMessagesRead(
  stage: Stage,
  sandboxId: string,
  level: MessageLevel,
): void {
  const runtime = stage.runtimes.get(sandboxId);
  if (runtime === undefined) {
    return;
  }
  markSandboxMessagesRead(runtime, level);
  publishStage(stage);
}

/**
 * Dismisses a notification of a sandbox. Errors and warnings cannot be
 * dismissed. Does nothing for an unknown sandbox or message.
 */
export function dismissMessage(
  stage: Stage,
  sandboxId: string,
  messageId: number,
): void {
  const runtime = stage.runtimes.get(sandboxId);
  if (runtime === undefined || !dismissSandboxMessage(runtime, messageId)) {
    return;
  }
  publishStage(stage);
}

/** Dismisses every notification of a sandbox, as "Clear all" does. Does nothing for an unknown sandbox. */
export function clearNotifications(stage: Stage, sandboxId: string): void {
  const runtime = stage.runtimes.get(sandboxId);
  if (runtime === undefined) {
    return;
  }
  clearSandboxNotifications(runtime);
  publishStage(stage);
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
 * Records that the user pressed Play in the player dialog of action `id`, so
 * a player removed with its mod answers `true`. Does nothing for an unknown
 * id. Changes nothing the page shows.
 */
export function markStageActionPlaying(stage: Stage, id: number): void {
  markActionPlaying(stage.actions, id);
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

/**
 * Answers the site consent question of the visible sandbox and starts its
 * mod: the lines whose keys `answer.allowed` holds are granted and the
 * others refused, and the decisions are remembered when `answer.remember` is
 * `true`. `null` (Escape) refuses every line and remembers nothing. Does
 * nothing unless the sandbox is visible and still asking, so a late or
 * repeated answer is ignored.
 */
export function answerSiteConsent(
  stage: Stage,
  sandboxId: string,
  answer: SiteConsentAnswer | null,
): void {
  const runtime = stage.runtimes.get(sandboxId);
  if (
    runtime === undefined ||
    readVisibleSandbox(stage.state)?.id !== sandboxId
  ) {
    return;
  }
  answerSandboxSiteConsent(runtime, buildSandboxServices(stage), answer);
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
 * Checks a mod for the sandbox `requesterId`, outside the sandboxes and the
 * history: the bundle check, then, without a bundle error, the mount check
 * and the mod's tests in hidden frames the snapshot lists in `checks`, one at
 * a time. Resolves with the
 * report. Returns `null`, and checks nothing, when the requester is not the
 * visible sandbox.
 */
export function checkStageMod(
  stage: Stage,
  requesterId: string,
  request: ModCheckRequest,
): Promise<ModCheckReport> | null {
  if (readVisibleSandbox(stage.state)?.id !== requesterId) {
    return null;
  }
  return runStageCheck(
    stage.checks,
    buildCheckServices(stage),
    requesterId,
    request,
  );
}

/**
 * Connects the check `id`'s frame `key`, on the frame's first `load`, and
 * starts its limit. A frame the check already replaced is ignored.
 */
export function attachCheckFrame(
  stage: Stage,
  id: string,
  key: string,
  frameTarget: Pick<Window, "postMessage">,
): void {
  attachStageCheckFrame(
    stage.checks,
    buildCheckServices(stage),
    id,
    key,
    frameTarget,
  );
}

/**
 * The check `id`'s frame `key` loaded another document: the checked mod is
 * stopped. The mount check ends with an error, and a case fails. A frame the
 * check already replaced is ignored.
 */
export function checkFrameLoadedAgain(
  stage: Stage,
  id: string,
  key: string,
): void {
  stopReloadedCheckFrame(
    stage.checks,
    buildCheckServices(stage),
    id,
    key,
    LEFT_PAGE_MESSAGE,
  );
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

/** Each runtime's layout, by sandbox id. */
function readRuntimeLayouts(stage: Stage): Map<string, FrameLayout> {
  const layouts = new Map<string, FrameLayout>();
  for (const sandboxId of stage.runtimes.keys()) {
    layouts.set(sandboxId, readStageLayout(stage, sandboxId));
  }
  return layouts;
}

/** Pushes `layout.changed` to each runtime whose layout is not the one it had before. */
function pushChangedLayouts(
  stage: Stage,
  layoutsBefore: ReadonlyMap<string, FrameLayout>,
): void {
  for (const [sandboxId, runtime] of stage.runtimes) {
    const layout = readStageLayout(stage, sandboxId);
    if (layoutsBefore.get(sandboxId) !== layout) {
      pushSandboxLayout(runtime, layout);
    }
  }
}

/**
 * Turns theater mode on or off, pushes `layout.changed` to every running mod
 * whose layout changed, visible or hidden, and publishes the snapshot. A
 * fullscreen mod keeps its layout and gets nothing. Does nothing when theater
 * mode already is `isOn`.
 */
export function changeStageTheaterMode(stage: Stage, isOn: boolean): void {
  if (stage.theaterMode === isOn) {
    return;
  }
  const layoutsBefore = readRuntimeLayouts(stage);
  stage.theaterMode = isOn;
  pushChangedLayouts(stage, layoutsBefore);
  publishStage(stage);
}

/**
 * Records which sandbox's frame is the app page's fullscreen element, or
 * `null` for none, pushes `layout.changed` to the mods whose layout changed,
 * and publishes the snapshot. Does nothing when it is already the one.
 */
export function changeStageFullscreen(
  stage: Stage,
  sandboxId: string | null,
): void {
  if (stage.fullscreenSandboxId === sandboxId) {
    return;
  }
  const layoutsBefore = readRuntimeLayouts(stage);
  stage.fullscreenSandboxId = sandboxId;
  pushChangedLayouts(stage, layoutsBefore);
  publishStage(stage);
}

/**
 * Tells a sandbox's stage bar that the browser refused to show its frame
 * fullscreen: a `warning` from the app, with the browser's `reason`. Does
 * nothing for an unknown sandbox.
 */
export function warnFullscreenRefused(
  stage: Stage,
  sandboxId: string,
  reason: string,
): void {
  const runtime = stage.runtimes.get(sandboxId);
  if (runtime === undefined) {
    return;
  }
  addFullscreenRefusedWarning(runtime, reason);
  publishStage(stage);
}

/**
 * Switches "Load media linked by tiles" for the mods launched and checked
 * from now on. Running sandboxes keep their launch and their frame, and
 * nothing is published, since the snapshot does not change.
 */
export function changeStageTileLinkedMedia(stage: Stage, isOn: boolean): void {
  stage.loadsTileLinkedMedia = isOn;
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
