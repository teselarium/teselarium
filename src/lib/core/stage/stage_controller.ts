import type { BrowserFileReader } from "../../files/index.ts";
import type { ModLoadOptions, ModPermission } from "../../mod/index.ts";
import type { UserCatalogEntry } from "../../user_catalog/index.ts";
import {
  buildCatalog,
  MOD_API_VERSION,
  readDeclaringMosaic,
  resolveDefaultModSettings,
} from "../engine/index.ts";
import type {
  ActionAnswer,
  AppAction,
  Catalog,
  DefaultModSettings,
  FrameLayout,
  ModCheckReport,
  ModCheckRequest,
  OpenLinkOptions,
  OpenLinkOutcome,
  ResolvedInstanceCatalog,
  ResolvedDefaultModSettings,
  RunLink,
} from "../engine/index.ts";
import type {
  SiteDecision,
  SiteDecisionSubject,
} from "../permissions/index.ts";
import type { LoadedMosaic, MosaicAliases } from "../../mosaic/index.ts";
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
  pushSandboxCatalog,
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
  LoadedFileEntry,
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
  replaceStageEntry,
  restoreStageEntry,
} from "./stage_state.ts";
import type {
  EntryTarget,
  EntryView,
  HomeFallback,
  ReplacingStep,
  SandboxOpening,
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
  /**
   * The address the files of mods' npm libraries are fetched from, ending in
   * `/`, such as `https://cdn.jsdelivr.net/npm/`. The instantiation chooses it.
   */
  npmHost: string;
  /** The color scheme the app starts with. */
  colorScheme: ColorScheme;
  /** Whether "Load media linked by tiles" is on as the app starts. */
  loadsTileLinkedMedia: boolean;
  /** The instance catalog, resolved and checked by `resolveInstanceCatalog` before the stage is created. */
  instanceCatalog: ResolvedInstanceCatalog;
  /** Whether "List the default mosaics of mods" is on as the app starts. */
  catalogDefaultMosaics: boolean;
  /** The user catalog's entries as the app starts, read from the browser database. Empty by default. */
  userCatalog?: readonly UserCatalogEntry[];
  /** Reads the files stored in the browser, at `teselarium-browser:` addresses. None are stored without it. */
  browserFiles?: BrowserFileReader;
  /** Whether theater mode is on as the app starts. */
  theaterMode: boolean;
  /** The remembered site decisions, read before a mod from another origin starts, by checks and by `mods.inspect`. */
  readSiteDecisions: () => readonly SiteDecision[];
  /** Keeps the decisions of a site consent answer whose Remember was checked. */
  rememberSiteDecisions: (decisions: readonly SiteDecision[]) => void;
  /**
   * Told about each mod, collection and mosaic file a sandbox opened from a
   * mosaic, a collection or a tile loaded, for recently used. Never for a
   * tile or the mosaic a link names as `sites`. Nothing is told without it.
   */
  onFilesLoaded?: (entry: LoadedFileEntry) => void;
}

/**
 * A sandbox's run link as resolved against the app's address. For a mosaic
 * link, `mod` is `""` and `collection` `null` until the mosaic file is
 * loaded, then the mosaic's. Frozen.
 */
export interface SandboxLink {
  mod: string;
  collection: string | null;
  tile: string | null;
  mosaic: string | null;
  sites: string | null;
  params: Readonly<Record<string, string>>;
}

/** One `show` line of a mosaic. Frozen. */
export interface MosaicShowLine {
  host: string;
  reason: string;
}

/** One `show` line of the mosaic a link names as `sites`, and whether the running mod got it. Frozen. */
export interface SitesLine extends MosaicShowLine {
  /** `false` until the mod starts, and for a refused line. */
  granted: boolean;
}

/** One line of the site consent dialog: a declared category and host, and the mod's reason. Frozen. */
export interface SiteConsentLine extends ModPermission {
  /** Passed back in `SiteConsentAnswer.allowed` when the line is checked. */
  key: string;
  /** What declared the line: the mod, or the mosaic it was opened from. */
  subject: SiteDecisionSubject;
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
  /**
   * Whether the frame loader handled `sandbox.connect`, so the frame's
   * document has its color scheme. The page hides the frame until then.
   */
  isFrameConnected: boolean;
  /** Every sandbox but the Home mod at `#/` has a close button. */
  canClose: boolean;
  status: SandboxStatus;
  /** Known once the mod is loaded. */
  mod: { title: string; version: string; source: string } | null;
  /** Known once the mosaic file of a mosaic link is loaded, `null` otherwise. */
  mosaic: {
    title: string;
    source: string;
    aliases: Readonly<MosaicAliases>;
    /** The `show` lines, in file order. */
    show: readonly MosaicShowLine[];
  } | null;
  /** The run link as resolved (see `SandboxLink`). */
  link: SandboxLink;
  /** The collection's title once its file is loaded, `null` before, after a failure, or without a collection. */
  collectionTitle: string | null;
  /** The link's tile, resolved against the app's address, or `null` without one. */
  tile: string | null;
  /** The mosaic the link names as `sites`, once its file is loaded. `null` before, without one, or when it failed. */
  sites: {
    source: string;
    title: string;
    lines: readonly SitesLine[];
  } | null;
  /** The link's mosaic reference, resolved against the app's address, or `null` for a mod link. */
  mosaicReference: string | null;
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
  /**
   * The link's mod reference, resolved against the app's address. For a
   * mosaic link, `""` until the mosaic file is loaded, then the mosaic's mod.
   */
  modReference: string;
  /**
   * The link's collection, resolved against the app's address, or `null`
   * without one. For a mosaic link, the mosaic's collection once its file is
   * loaded.
   */
  collection: string | null;
  errorMessage: string | null;
  /** The mod's `api` range and the app's mod API version, only while the sandbox asks the mod API question. */
  apiMismatch: { range: string; apiVersion: string } | null;
  /**
   * The lines to ask about, in the order declared, and the mosaic whose lines
   * they include (the one the sandbox was opened from, or the one its link
   * names as `sites`), only while the sandbox asks the site consent question.
   */
  siteConsent: {
    lines: readonly SiteConsentLine[];
    mosaic: { title: string; source: string } | null;
  } | null;
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
  fetchOptions: ModLoadOptions;
  storage: ModStorage;
  /** The current theme: new sessions connect with it, and running ones are told when it changes. */
  theme: Theme;
  /** Whether mods launched from now on load the media their tiles link. Running mods keep their launch. */
  loadsTileLinkedMedia: boolean;
  /** The instance catalog, which the catalog that `catalog.list` answers is built from. */
  instanceCatalog: ResolvedInstanceCatalog;
  /** Whether the catalog's mosaics also hold the default mosaics of its mods. */
  catalogDefaultMosaics: boolean;
  /** The user catalog's entries, whose mosaics end the catalog's mosaics. */
  userCatalog: readonly UserCatalogEntry[];
  /** Counts the catalog's changes, so a `catalog.changed` whose catalog a newer change overtook is dropped. */
  catalogGeneration: number;
  /** Whether theater mode is on. With `fullscreenSandboxId`, it decides each frame's layout (`readSandboxLayout`). */
  theaterMode: boolean;
  /** The sandbox whose frame is the app page's fullscreen element, or `null`. */
  fullscreenSandboxId: string | null;
  readSiteDecisions: () => readonly SiteDecision[];
  rememberSiteDecisions: (decisions: readonly SiteDecision[]) => void;
  onFilesLoaded: (entry: LoadedFileEntry) => void;
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
  options: OpenLinkOptions,
): OpenLinkOutcome {
  return openStageLink(stage, link, openerId, options);
}

function readStageTheme(stage: Stage): Theme {
  return stage.theme;
}

/**
 * The catalog as `catalog.list` answers it now, with the current value of
 * "List the default mosaics of mods" and the current user catalog. The stage
 * bar's lists read it too, so the page and the mods read one catalog.
 */
export function readStageCatalog(stage: Stage): Promise<Catalog> {
  return buildCatalog(
    stage.instanceCatalog,
    stage.catalogDefaultMosaics,
    stage.userCatalog,
    stage.fetchOptions,
  );
}

function readStageUserCatalog(stage: Stage): readonly UserCatalogEntry[] {
  return stage.userCatalog;
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
    readCatalog: readStageCatalog.bind(undefined, stage),
    readUserCatalog: readStageUserCatalog.bind(undefined, stage),
    rememberSiteDecisions: stage.rememberSiteDecisions,
    onFilesLoaded: stage.onFilesLoaded,
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
    readCatalog: readStageCatalog.bind(undefined, stage),
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

function buildMosaicSummary(
  runtime: SandboxRuntime | undefined,
): SandboxSnapshot["mosaic"] {
  const mosaic = runtime?.loadedMosaic ?? null;
  if (mosaic === null) {
    return null;
  }
  const summary = {
    title: mosaic.title,
    source: mosaic.source,
    aliases: freezeAliases(mosaic.aliases),
    show: buildShowLines(mosaic),
  };
  return Object.freeze(summary);
}

function freezeAliases(aliases: MosaicAliases): Readonly<MosaicAliases> {
  const frozen: MosaicAliases = {};
  for (const [field, names] of Object.entries(aliases)) {
    frozen[field] = Object.freeze([...names]) as string[];
  }
  return Object.freeze(frozen);
}

function buildShowLines(mosaic: LoadedMosaic): readonly MosaicShowLine[] {
  const lines: MosaicShowLine[] = [];
  for (const permission of mosaic.permissions) {
    if (permission.category === "show") {
      const line: MosaicShowLine = {
        host: permission.host,
        reason: permission.reason,
      };
      lines.push(Object.freeze(line));
    }
  }
  return Object.freeze(lines);
}

/** Whether the running mod got the `show` line of `host` from its `sites` mosaic. */
function isSitesHostGranted(runtime: SandboxRuntime, host: string): boolean {
  const grants = runtime.mosaicGrants;
  if (grants === null || grants.role !== "sites") {
    return false;
  }
  for (const permission of grants.grants.granted) {
    if (permission.category === "show" && permission.host === host) {
      return true;
    }
  }
  return false;
}

function buildSitesSummary(
  runtime: SandboxRuntime | undefined,
): SandboxSnapshot["sites"] {
  const mosaic = runtime?.loadedSites ?? null;
  if (runtime === undefined || mosaic === null) {
    return null;
  }
  const lines: SitesLine[] = [];
  for (const showLine of buildShowLines(mosaic)) {
    const line: SitesLine = {
      ...showLine,
      granted: isSitesHostGranted(runtime, showLine.host),
    };
    lines.push(Object.freeze(line));
  }
  const summary = {
    source: mosaic.source,
    title: mosaic.title,
    lines: Object.freeze(lines),
  };
  return Object.freeze(summary);
}

/** The link's collection: the resolved collection of a mod link, or the mosaic's once its file is loaded. */
function readLinkCollection(
  sandbox: StageSandbox,
  runtime: SandboxRuntime,
): string | null {
  if (sandbox.link.collection !== null) {
    return runtime.tilesLocation;
  }
  return runtime.loadedMosaic?.collection ?? null;
}

function buildSandboxLink(
  sandbox: StageSandbox,
  runtime: SandboxRuntime | undefined,
): SandboxLink {
  const params = Object.freeze({ ...sandbox.link.params });
  if (runtime === undefined) {
    const writtenLink: SandboxLink = {
      mod: sandbox.link.mod,
      collection: sandbox.link.collection,
      tile: sandbox.link.tile ?? null,
      mosaic: sandbox.link.mosaic ?? null,
      sites: sandbox.link.sites ?? null,
      params,
    };
    return Object.freeze(writtenLink);
  }
  const hasTile = (sandbox.link.tile ?? null) !== null;
  const link: SandboxLink = {
    mod: runtime.modReference,
    collection: readLinkCollection(sandbox, runtime),
    tile: hasTile ? runtime.tilesLocation : null,
    mosaic: runtime.mosaicSource,
    sites: runtime.sitesSource,
    params,
  };
  return Object.freeze(link);
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

/** The title and address of the mosaic whose lines a pending launch asks about, or `null`. */
function buildConsentMosaic(
  runtime: SandboxRuntime,
): NonNullable<SandboxSnapshot["siteConsent"]>["mosaic"] {
  const mosaic =
    runtime.pending === null ? null : readDeclaringMosaic(runtime.pending);
  if (mosaic === null) {
    return null;
  }
  const heading = { title: mosaic.title, source: mosaic.source };
  return Object.freeze(heading);
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
      subject: line.subject,
    };
    lines.push(Object.freeze(consentLine));
  }
  const siteConsent = {
    lines: Object.freeze(lines),
    mosaic: buildConsentMosaic(runtime),
  };
  return Object.freeze(siteConsent);
}

/**
 * The link's collection, resolved once the sandbox is launched, or `null`
 * without one. A mosaic's collection once the mosaic file is loaded.
 */
function readSnapshotCollection(
  sandbox: StageSandbox,
  runtime: SandboxRuntime | undefined,
): string | null {
  if (runtime === undefined) {
    return sandbox.link.collection;
  }
  if (runtime.loadedMosaic === null && sandbox.link.collection === null) {
    return null;
  }
  return runtime.tilesLocation;
}

function buildSandboxSnapshot(
  sandbox: StageSandbox,
  runtime: SandboxRuntime | undefined,
  visibleId: string | null,
): SandboxSnapshot {
  const status = runtime?.status ?? "stopped";
  const launch = runtime?.launch ?? null;
  const isRunning = status === "running" && launch !== null;
  const link = buildSandboxLink(sandbox, runtime);
  const snapshot: SandboxSnapshot = {
    id: sandbox.id,
    hash: sandbox.hash,
    isVisible: sandbox.id === visibleId,
    isFrameConnected: runtime?.isFrameConnected ?? false,
    canClose: !sandbox.isHomeMod,
    status,
    mod: buildModSummary(runtime),
    mosaic: buildMosaicSummary(runtime),
    link,
    collectionTitle: runtime?.collectionTitle ?? null,
    tile: link.tile,
    sites: buildSitesSummary(runtime),
    mosaicReference: runtime?.mosaicSource ?? sandbox.link.mosaic ?? null,
    sandboxDocument: isRunning ? launch.sandboxDocument : null,
    canReloadTiles: isRunning && launch.tilesSource !== null,
    messages: buildMessageSnapshots(runtime),
    droppedModMessages: buildDroppedModMessages(runtime),
    modReference: runtime?.modReference ?? sandbox.link.mod,
    collection: readSnapshotCollection(sandbox, runtime),
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

function ignoreLoadedFile(): void {
  // No recently used store was given.
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
    fetchOptions: {
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      npmHost: options.npmHost,
      browserFiles: options.browserFiles,
    },
    storage: options.storage,
    theme: buildTheme(options.colorScheme),
    loadsTileLinkedMedia: options.loadsTileLinkedMedia,
    instanceCatalog: options.instanceCatalog,
    catalogDefaultMosaics: options.catalogDefaultMosaics,
    userCatalog: options.userCatalog ?? [],
    catalogGeneration: 0,
    theaterMode: options.theaterMode,
    fullscreenSandboxId: null,
    readSiteDecisions: options.readSiteDecisions,
    rememberSiteDecisions: options.rememberSiteDecisions,
    onFilesLoaded: options.onFilesLoaded ?? ignoreLoadedFile,
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

const PUSH_OPENING: OpenLinkOptions = Object.freeze({ replace: false });

/**
 * Replaces the visible sandbox, the requester, with a new sandbox for
 * `link`: in the current history entry, whose address becomes the link's,
 * or in a new entry pushed after it. Closing the requester stops its session
 * before this returns, so its request gets no answer, and drops its actions.
 */
function replaceWithLink(
  stage: Stage,
  link: RunLink,
  requesterId: string,
  step: ReplacingStep,
): void {
  const route = routeForLink(link);
  const opening: SandboxOpening = {
    hash: route.hash,
    link: structuredClone(link),
    openerId: null,
    isHomeMod: false,
  };
  applyStageChange(
    stage,
    replaceStageEntry(stage.state, opening, requesterId, step),
  );
  writeCurrentEntry(stage, step === "new-entry" ? "push" : "replace");
}

/**
 * Opens a link a mod asked for, in the opener's section: in a new sandbox
 * with a new history entry, or with `replace` in place of the opener, in its
 * entry. Gives `"not-visible"`, and opens nothing, when the opener is not
 * the visible sandbox, and `"home-mod"` when it asks to replace the Home mod
 * at `#/`.
 */
export function openStageLink(
  stage: Stage,
  link: RunLink,
  openerId: string,
  options: OpenLinkOptions = PUSH_OPENING,
): OpenLinkOutcome {
  const opener = readVisibleSandbox(stage.state);
  if (opener?.id !== openerId) {
    return "not-visible";
  }
  if (options.replace && opener.isHomeMod) {
    return "home-mod";
  }
  if (options.replace) {
    replaceWithLink(stage, link, openerId, "current-entry");
  } else {
    const change = openStageEntry(
      stage.state,
      buildRouteTarget(routeForLink(link), openerId),
      readVisibleEntry(stage.state)?.section ?? null,
    );
    applyStageChange(stage, change);
    writeCurrentEntry(stage, "push");
  }
  publishStage(stage);
  return "opened";
}

/**
 * Opens a combination chosen in the stage bar, in place of the visible
 * sandbox `sandboxId`: a new sandbox takes its opener and section, gets a
 * new history entry, and the previous sandbox is closed, so Back reopens it
 * from its link. Forward entries are dropped. The Home mod at `#/` is not
 * replaced: the link opens as a followed link, with the Home mod as opener.
 * Gives `"not-visible"`, and opens nothing, when `sandboxId` is not the
 * visible sandbox.
 */
export function openStageCombination(
  stage: Stage,
  sandboxId: string,
  link: RunLink,
): OpenLinkOutcome {
  const visible = readVisibleSandbox(stage.state);
  if (visible?.id !== sandboxId) {
    return "not-visible";
  }
  if (visible.isHomeMod) {
    return openStageLink(stage, link, sandboxId);
  }
  replaceWithLink(stage, link, sandboxId, "new-entry");
  publishStage(stage);
  return "opened";
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
): Promise<ActionAnswer> | null {
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
  answer: ActionAnswer,
): void {
  if (!answerAction(stage.actions, id, answer)) {
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

/** Pushes the catalog to every running sandbox, unless a newer change of the catalog started meanwhile. */
function pushStageCatalog(
  stage: Stage,
  generation: number,
  catalog: Catalog,
): void {
  if (generation !== stage.catalogGeneration) {
    return;
  }
  for (const runtime of stage.runtimes.values()) {
    pushSandboxCatalog(runtime, catalog);
  }
}

/**
 * Builds the catalog with the current switch and user catalog, and pushes it
 * as `catalog.changed` to every running mod, visible or hidden, with no frame
 * reloaded. A catalog that a newer refresh overtook is dropped, so two quick
 * changes leave the mods on the second. Resolves once the push is done.
 */
export async function refreshStageCatalog(stage: Stage): Promise<void> {
  stage.catalogGeneration += 1;
  const generation = stage.catalogGeneration;
  const catalog = await readStageCatalog(stage);
  pushStageCatalog(stage, generation, catalog);
}

/**
 * Switches "List the default mosaics of mods". Every `catalog.list` from now
 * on answers with the new value, and running mods get the new catalog (see
 * `refreshStageCatalog`).
 */
export function changeStageCatalogDefaultMosaics(
  stage: Stage,
  isOn: boolean,
): Promise<void> {
  stage.catalogDefaultMosaics = isOn;
  return refreshStageCatalog(stage);
}

/**
 * Replaces the user catalog's entries after the user changed them. Every
 * `catalog.list` from now on answers with them, and running mods get the new
 * catalog (see `refreshStageCatalog`).
 */
export function changeStageUserCatalog(
  stage: Stage,
  entries: readonly UserCatalogEntry[],
): Promise<void> {
  stage.userCatalog = structuredClone(entries);
  return refreshStageCatalog(stage);
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
