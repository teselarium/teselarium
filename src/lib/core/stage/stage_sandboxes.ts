import { resolveLocation } from "../../files/index.ts";
import type { FileFetchOptions } from "../../files/index.ts";
import { resolveModReference } from "../../mod/index.ts";
import type { LoadedMod, ModIssue, ModPermission } from "../../mod/index.ts";
import { describeNewTileLinks } from "../sandbox/index.ts";
import type { TileIssue } from "../../tile/index.ts";
import {
  buildModLaunch,
  buildTileBodies,
  collectModTileLinks,
  connectModSession,
  describeCancelledApiMismatch,
  loadLaunchMod,
  loadLaunchTiles,
  loadModTiles,
  matchModApiRange,
  pushLayoutChanged,
  pushThemeChanged,
  pushTilesChanged,
  stopModSession,
} from "../engine/index.ts";
import type {
  AppAction,
  FrameLayout,
  ModCheckReport,
  ModCheckRequest,
  ModLaunch,
  ModLaunchInputs,
  ModSession,
  ModTiles,
  ResolvedDefaultModSettings,
  RunLink,
  TileBodies,
  UserNotification,
} from "../engine/index.ts";
import { grantModPermissions, listConsentLines } from "../permissions/index.ts";
import type { SiteDecision } from "../permissions/index.ts";
import type { ModStorage } from "../storage/index.ts";
import type { Theme } from "../theme/index.ts";
import {
  addModMessage,
  buildAppIssueContent,
  buildAppNotification,
  buildNoDroppedMessages,
  buildSandboxMessage,
  buildSandboxMessages,
  dismissNotification,
  markLevelRead,
  removeNotifications,
} from "./stage_messages.ts";
import type {
  DroppedMessageCounts,
  MessageContent,
  MessageLevel,
  SandboxMessage,
} from "./stage_messages.ts";
import {
  describeLoadedCollection,
  describeReloadedTiles,
  describeSiteConsentAnswer,
} from "./stage_notifications.ts";
import type { StageSandbox } from "./stage_state.ts";

/** What the runtimes need from the stage. */
export interface SandboxServices {
  defaults: ResolvedDefaultModSettings;
  appOrigin: string;
  /** `baseUrl` is the app's address. */
  fetchOptions: FileFetchOptions;
  storage: ModStorage;
  /** Called when a runtime changed on its own, so the stage publishes a snapshot. */
  onChange: () => void;
  onOpenLink: (openerId: string, link: RunLink) => boolean;
  /** Queues an action for the user. `null` when the sandbox is not the visible one. */
  onRequestAction: (
    sandboxId: string,
    action: AppAction,
  ) => Promise<boolean> | null;
  /** Asks the stage to check a mod for the requesting sandbox. `null` when it is not the visible one. */
  onCheckMod: (
    requesterId: string,
    request: ModCheckRequest,
  ) => Promise<ModCheckReport> | null;
  /** The stage's current theme, read when a session connects. */
  readTheme: () => Theme;
  /** A sandbox's current layout (`readSandboxLayout`), read when its session connects. */
  readLayout: (sandboxId: string) => FrameLayout;
  /** Whether "Load media linked by tiles" is on, read when a sandbox's mod starts. */
  loadsTileLinkedMedia: boolean;
  /** The remembered site decisions, read before the site consent question and when a mod starts. */
  readSiteDecisions: () => readonly SiteDecision[];
  /** Keeps the decisions of an answer whose Remember was checked. */
  rememberSiteDecisions: (decisions: readonly SiteDecision[]) => void;
}

/**
 * `asking`: the mod is loaded and waits for the user's answer to its
 * `question`, before its frame exists.
 */
export type SandboxStatus =
  "loading" | "asking" | "failed" | "running" | "stopped";

/** What an `asking` runtime waits for: the mod API question, or the site consent question. */
export type SandboxQuestion = "api" | "sites";

/** The user's answer in the site consent dialog. */
export interface SiteConsentAnswer {
  /** The keys of the checked lines (`buildConsentLineKey`). */
  allowed: string[];
  remember: boolean;
}

/** The runtime of one sandbox. Mutable, because it follows a launch and a session. */
export interface SandboxRuntime {
  id: string;
  status: SandboxStatus;
  /** The mod once its mod file is loaded, kept when the sandbox fails later. */
  loadedMod: LoadedMod | null;
  /** The loaded mod while the runtime asks, before its launch is built. */
  pending: ModLaunchInputs | null;
  /** The question of an `asking` runtime, `null` otherwise. */
  question: SandboxQuestion | null;
  /** The lines of the site consent question, while it is asked. */
  consentLines: ModPermission[];
  /** Set when the mod starts. */
  launch: ModLaunch | null;
  session: ModSession | null;
  /**
   * The link's mod reference resolved against the app's address, or the
   * reference as written when it cannot be resolved.
   */
  modReference: string;
  /** The link's collection resolved against the app's address, as written when it cannot be resolved, or `null` without one. */
  collectionLocation: string | null;
  /** The issues of the mod file itself, such as a missing `api` range. */
  fileIssues: SandboxMessage[];
  /** The issues of the collection, replaced with new ids when the tiles are reloaded. */
  collectionIssues: SandboxMessage[];
  /**
   * The tile links left out of the policy and, after "Reload tiles", the
   * notice of links the frame does not allow yet. Replaced with new ids when
   * the tiles are reloaded.
   */
  tileLinkIssues: SandboxMessage[];
  /**
   * The arrival list: permission issues, then the messages that arrive while
   * the sandbox lives (issues, failures, the app's notifications and the
   * mod's messages), in order.
   */
  messages: SandboxMessage[];
  /** The id the next message gets. */
  nextMessageId: number;
  /** The ids of the messages the user has read. */
  readMessageIds: Set<number>;
  /** How many messages from the mod the cap dropped, per level. */
  droppedModMessages: DroppedMessageCounts;
  /** The load error's message of a `failed` runtime. */
  errorMessage: string | null;
  /** Settles when the launch settled. */
  settled: Promise<void>;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** Messages for `contents`, with the runtime's next ids. */
function takeRuntimeMessages(
  runtime: SandboxRuntime,
  contents: readonly MessageContent[],
): SandboxMessage[] {
  const messages = buildSandboxMessages(runtime.nextMessageId, contents);
  runtime.nextMessageId += messages.length;
  return messages;
}

function buildIssueContents(issues: readonly ModIssue[]): MessageContent[] {
  const contents: MessageContent[] = [];
  for (const issue of issues) {
    contents.push(buildAppIssueContent(issue));
  }
  return contents;
}

/** Messages from the app for `issues`, with the runtime's next ids. */
function takeIssueMessages(
  runtime: SandboxRuntime,
  issues: readonly ModIssue[],
): SandboxMessage[] {
  return takeRuntimeMessages(runtime, buildIssueContents(issues));
}

/** Adds a message at the end of the arrival list. */
function appendRuntimeMessage(
  runtime: SandboxRuntime,
  content: MessageContent,
): void {
  runtime.messages.push(...takeRuntimeMessages(runtime, [content]));
}

/** The notification of a mod started with a collection, or `null` without one. */
function buildLoadedCollectionNotification(
  launch: ModLaunch,
): MessageContent | null {
  if (launch.collectionSource === null) {
    return null;
  }
  return buildAppNotification(
    launch.collectionSource,
    describeLoadedCollection(launch.context.tiles.length),
  );
}

/**
 * Starts a launch. The arrival list starts with the launch's issues, then
 * the notification of the site consent answer, if any, then the
 * notification of the loaded collection, if any.
 */
function startRuntime(
  runtime: SandboxRuntime,
  services: SandboxServices,
  launch: ModLaunch,
  consentNotification: MessageContent | null,
): void {
  if (runtime.status === "stopped") {
    return;
  }
  runtime.status = "running";
  runtime.launch = launch;
  runtime.fileIssues = takeIssueMessages(runtime, launch.fileIssues);
  runtime.collectionIssues = takeIssueMessages(runtime, launch.context.issues);
  runtime.tileLinkIssues =
    launch.tileLinks === null
      ? []
      : takeIssueMessages(runtime, launch.tileLinks.issues);
  runtime.messages = takeIssueMessages(runtime, launch.issues);
  if (consentNotification !== null) {
    appendRuntimeMessage(runtime, consentNotification);
  }
  const collectionNotification = buildLoadedCollectionNotification(launch);
  if (collectionNotification !== null) {
    appendRuntimeMessage(runtime, collectionNotification);
  }
  services.onChange();
}

function hasSource(error: unknown): error is Error & { source: string } {
  return (
    error instanceof Error &&
    "source" in error &&
    typeof error.source === "string"
  );
}

/**
 * What a failure is about: the file that failed for the errors that name one,
 * and otherwise the loaded mod's source or the resolved mod reference.
 */
function readFailureSource(runtime: SandboxRuntime, error: unknown): string {
  if (hasSource(error)) {
    return error.source;
  }
  return runtime.loadedMod?.source ?? runtime.modReference;
}

/** Fails the runtime with the error, which is also an error from the app in its messages. */
function failRuntime(
  runtime: SandboxRuntime,
  services: SandboxServices,
  error: unknown,
): void {
  if (runtime.status === "stopped") {
    return;
  }
  runtime.status = "failed";
  runtime.errorMessage = describeError(error);
  appendRuntimeMessage(runtime, {
    level: "error",
    producer: "app",
    source: readFailureSource(runtime, error),
    text: runtime.errorMessage,
  });
  services.onChange();
}

/** Puts a loaded mod's runtime in the `asking` status, until the user answers `question`. */
function askRuntime(
  runtime: SandboxRuntime,
  services: SandboxServices,
  question: SandboxQuestion,
): void {
  runtime.status = "asking";
  runtime.question = question;
  services.onChange();
}

/** Builds the pending mod's launch with the remembered decisions and `answers`, and starts it. */
function startPendingRuntime(
  runtime: SandboxRuntime,
  services: SandboxServices,
  inputs: ModLaunchInputs,
  answers: SiteDecision[],
  consentNotification: MessageContent | null,
): void {
  const decisions = [...services.readSiteDecisions(), ...answers];
  const grants = grantModPermissions(inputs.mod, services.appOrigin, decisions);
  const launch = buildModLaunch(
    inputs.mod,
    inputs.link,
    inputs.modTiles,
    grants,
    services.loadsTileLinkedMedia,
  );
  runtime.pending = null;
  runtime.question = null;
  runtime.consentLines = [];
  startRuntime(runtime, services, launch, consentNotification);
}

/** The second question: asks about the sites of the pending mod, or starts it when there is nothing to ask. */
function askSitesOrStart(
  runtime: SandboxRuntime,
  services: SandboxServices,
  inputs: ModLaunchInputs,
): void {
  const lines = listConsentLines(
    inputs.mod,
    services.appOrigin,
    services.readSiteDecisions(),
  );
  if (lines.length === 0) {
    startPendingRuntime(runtime, services, inputs, [], null);
    return;
  }
  runtime.consentLines = lines;
  askRuntime(runtime, services, "sites");
}

/**
 * Settles a loaded mod before its frame exists: first the question of a mod
 * written for another mod API, then the site consent question, then the
 * launch is built and the mod starts.
 */
function settleLaunchInputs(
  runtime: SandboxRuntime,
  services: SandboxServices,
  inputs: ModLaunchInputs,
): void {
  if (runtime.status === "stopped") {
    return;
  }
  runtime.loadedMod = inputs.mod;
  runtime.pending = inputs;
  if (matchModApiRange(inputs.mod.api) === false) {
    askRuntime(runtime, services, "api");
    return;
  }
  askSitesOrStart(runtime, services, inputs);
}

/** The pending inputs of a runtime asking `question`, or `null` when it is not asking it. */
function readAskedInputs(
  runtime: SandboxRuntime,
  question: SandboxQuestion,
): ModLaunchInputs | null {
  if (runtime.status !== "asking" || runtime.question !== question) {
    return null;
  }
  return runtime.pending;
}

/**
 * Answers the mod API question of an `asking` runtime: "Run anyway" goes on
 * to the site consent question, or starts the mod when there is nothing to
 * ask, and "Cancel" fails it with an error naming the mod's range and the mod
 * API version. Does nothing for any other runtime.
 */
export function answerSandboxApiMismatch(
  runtime: SandboxRuntime,
  services: SandboxServices,
  runAnyway: boolean,
): void {
  const inputs = readAskedInputs(runtime, "api");
  if (inputs === null) {
    return;
  }
  if (runAnyway) {
    askSitesOrStart(runtime, services, inputs);
    return;
  }
  runtime.pending = null;
  runtime.question = null;
  failRuntime(runtime, services, describeCancelledApiMismatch(inputs.mod.api));
}

/** The key of a consent line in `SiteConsentAnswer.allowed`: its category and host. */
export function buildConsentLineKey(
  line: Pick<ModPermission, "category" | "host">,
): string {
  const key = `${line.category} ${line.host}`;
  return key;
}

function isLineAllowed(
  line: ModPermission,
  answer: SiteConsentAnswer | null,
): boolean {
  if (answer === null) {
    return false;
  }
  return answer.allowed.includes(buildConsentLineKey(line));
}

/** One decision per consent line: the lines `answer` allows are allowed, the others refused. */
function buildConsentDecisions(
  mod: LoadedMod,
  lines: ModPermission[],
  answer: SiteConsentAnswer | null,
): SiteDecision[] {
  const decisions: SiteDecision[] = [];
  for (const line of lines) {
    decisions.push({
      mod: mod.source,
      title: mod.title,
      category: line.category,
      host: line.host,
      allowed: isLineAllowed(line, answer),
    });
  }
  return decisions;
}

/**
 * Answers the site consent question of an `asking` runtime and starts its
 * mod: the lines `answer.allowed` names are granted and the others refused,
 * and the decisions are remembered when `answer.remember` is `true`. `null`
 * (Escape) refuses every line without remembering. Does nothing for any
 * other runtime.
 */
export function answerSandboxSiteConsent(
  runtime: SandboxRuntime,
  services: SandboxServices,
  answer: SiteConsentAnswer | null,
): void {
  const inputs = readAskedInputs(runtime, "sites");
  if (inputs === null) {
    return;
  }
  const decisions = buildConsentDecisions(
    inputs.mod,
    runtime.consentLines,
    answer,
  );
  const isRemembered = answer !== null && answer.remember;
  if (isRemembered) {
    services.rememberSiteDecisions(decisions);
  }
  const notification = buildAppNotification(
    inputs.mod.source,
    describeSiteConsentAnswer(decisions, isRemembered),
  );
  startPendingRuntime(runtime, services, inputs, decisions, notification);
}

/**
 * Starts loading a sandbox's mod. The runtime is `loading`, then `running` or
 * `failed`, or `asking` when the mod was written for another mod API or
 * needs the user's consent for sites.
 */
/** The link's mod reference resolved as a launch resolves it, or as written when it cannot be resolved. */
function resolveLinkModReference(
  sandbox: StageSandbox,
  services: SandboxServices,
): string {
  try {
    return resolveModReference(sandbox.link.mod, {
      baseUrl: services.fetchOptions.baseUrl,
      defaultModsFolder: services.defaults.folder,
    });
  } catch {
    return sandbox.link.mod;
  }
}

/** The link's collection resolved against the app's address, or as written when it cannot be resolved. */
function resolveLinkCollection(
  sandbox: StageSandbox,
  services: SandboxServices,
): string | null {
  const collection = sandbox.link.collection;
  if (collection === null) {
    return null;
  }
  try {
    return resolveLocation(collection, services.fetchOptions.baseUrl).href;
  } catch {
    return collection;
  }
}

/** Loads the mod, keeps it on the runtime, then loads the link's tiles. */
async function loadRuntimeInputs(
  runtime: SandboxRuntime,
  sandbox: StageSandbox,
  services: SandboxServices,
): Promise<ModLaunchInputs> {
  const mod = await loadLaunchMod(
    { link: sandbox.link, defaults: services.defaults },
    services.fetchOptions,
  );
  runtime.loadedMod = mod;
  return loadLaunchTiles(mod, sandbox.link, services.fetchOptions);
}

export function launchSandbox(
  sandbox: StageSandbox,
  services: SandboxServices,
): SandboxRuntime {
  const runtime: SandboxRuntime = {
    id: sandbox.id,
    status: "loading",
    loadedMod: null,
    pending: null,
    question: null,
    consentLines: [],
    launch: null,
    session: null,
    modReference: resolveLinkModReference(sandbox, services),
    collectionLocation: resolveLinkCollection(sandbox, services),
    fileIssues: [],
    collectionIssues: [],
    tileLinkIssues: [],
    messages: [],
    nextMessageId: 1,
    readMessageIds: new Set(),
    droppedModMessages: buildNoDroppedMessages(),
    errorMessage: null,
    settled: Promise.resolve(),
  };
  runtime.settled = loadRuntimeInputs(runtime, sandbox, services).then(
    settleLaunchInputs.bind(undefined, runtime, services),
    failRuntime.bind(undefined, runtime, services),
  );
  return runtime;
}

/**
 * Every message of a sandbox, in the order they were found: mod file,
 * collection, tile links, then the arrival list.
 */
export function readSandboxMessages(runtime: SandboxRuntime): SandboxMessage[] {
  const messages: SandboxMessage[] = [
    ...runtime.fileIssues,
    ...runtime.collectionIssues,
    ...runtime.tileLinkIssues,
    ...runtime.messages,
  ];
  return messages;
}

/** Marks every message of `level` read. */
export function markSandboxMessagesRead(
  runtime: SandboxRuntime,
  level: MessageLevel,
): void {
  runtime.readMessageIds = markLevelRead(
    readSandboxMessages(runtime),
    runtime.readMessageIds,
    level,
  );
}

/**
 * Removes the notification `messageId`, and returns whether it was removed.
 * Errors, warnings and unknown ids are ignored.
 */
export function dismissSandboxMessage(
  runtime: SandboxRuntime,
  messageId: number,
): boolean {
  const keptMessages = dismissNotification(runtime.messages, messageId);
  const isDismissed = keptMessages.length < runtime.messages.length;
  runtime.messages = keptMessages;
  return isDismissed;
}

/** Removes every notification, and leaves the errors and warnings. */
export function clearSandboxNotifications(runtime: SandboxRuntime): void {
  runtime.messages = removeNotifications(runtime.messages);
}

function addRuntimeIssue(
  runtime: SandboxRuntime,
  services: SandboxServices,
  issue: ModIssue,
): void {
  appendRuntimeMessage(runtime, buildAppIssueContent(issue));
  services.onChange();
}

/**
 * Adds a message from the mod to the arrival list, under the cap of
 * messages from the mod, whether the sandbox is visible or hidden.
 */
function addRuntimeNotification(
  runtime: SandboxRuntime,
  services: SandboxServices,
  notification: UserNotification,
): void {
  const message = buildSandboxMessage(runtime.nextMessageId, {
    level: notification.level,
    producer: "mod",
    source: notification.source,
    text: notification.text,
  });
  runtime.nextMessageId += 1;
  const arrived = addModMessage(
    {
      messages: runtime.messages,
      droppedModMessages: runtime.droppedModMessages,
    },
    message,
  );
  runtime.messages = arrived.messages;
  runtime.droppedModMessages = arrived.droppedModMessages;
  services.onChange();
}

/** Connects the session of a running sandbox to its frame, on the frame's first load. */
export function attachSandboxFrame(
  runtime: SandboxRuntime,
  frameTarget: Pick<Window, "postMessage">,
  services: SandboxServices,
): void {
  if (
    runtime.status !== "running" ||
    runtime.launch === null ||
    runtime.session !== null
  ) {
    return;
  }
  runtime.session = connectModSession(frameTarget, runtime.launch, {
    storage: services.storage,
    appOrigin: services.appOrigin,
    defaults: services.defaults,
    fetchOptions: services.fetchOptions,
    readSiteDecisions: services.readSiteDecisions,
    onIssue: addRuntimeIssue.bind(undefined, runtime, services),
    onOpenLink: services.onOpenLink.bind(undefined, runtime.id),
    onRequestAction: services.onRequestAction.bind(undefined, runtime.id),
    onCheckMod: services.onCheckMod.bind(undefined, runtime.id),
    onNotify: addRuntimeNotification.bind(undefined, runtime, services),
    theme: services.readTheme(),
    layout: services.readLayout(runtime.id),
  });
}

/**
 * Pushes `theme.changed` to a running sandbox with a session. A sandbox still
 * loading gets the theme when its frame connects.
 */
export function pushSandboxTheme(runtime: SandboxRuntime, theme: Theme): void {
  if (runtime.status !== "running" || runtime.session === null) {
    return;
  }
  pushThemeChanged(runtime.session, theme);
}

/**
 * Pushes `layout.changed` to a running sandbox with a session. A sandbox still
 * loading gets its layout when its frame connects.
 */
export function pushSandboxLayout(
  runtime: SandboxRuntime,
  layout: FrameLayout,
): void {
  if (runtime.status !== "running" || runtime.session === null) {
    return;
  }
  pushLayoutChanged(runtime.session, layout);
}

/**
 * Adds a warning from the app that the browser refused to show the
 * sandbox's frame fullscreen, with the browser's reason. Its source is the
 * mod's source, or the link's mod reference before the mod is loaded.
 */
export function addFullscreenRefusedWarning(
  runtime: SandboxRuntime,
  reason: string,
): void {
  const issue: ModIssue = {
    level: "warning",
    source: runtime.loadedMod?.source ?? runtime.modReference,
    message: `Fullscreen is not available: ${reason}`,
  };
  appendRuntimeMessage(runtime, buildAppIssueContent(issue));
}

/** Stops the sandbox's session, adding `issue` when the mod was stopped for a reason. */
export function stopSandbox(
  runtime: SandboxRuntime,
  issue: ModIssue | null,
): void {
  if (runtime.session !== null) {
    stopModSession(runtime.session);
  }
  runtime.status = "stopped";
  if (issue !== null) {
    appendRuntimeMessage(runtime, buildAppIssueContent(issue));
  }
}

/** The issues a reload replaces. */
interface ReloadedIssues {
  /** The number of tiles the mod received, or `null` when the collection did not load. */
  tileCount: number | null;
  collectionIssues: TileIssue[];
  /** `null` keeps the current tile link issues: tile links are off, or the collection did not load. */
  tileLinkIssues: ModIssue[] | null;
}

function countNewSources(sources: string[], allowedSources: string[]): number {
  const allowed = new Set(allowedSources);
  let count = 0;
  for (const source of sources) {
    if (!allowed.has(source)) {
      count += 1;
    }
  }
  return count;
}

/**
 * The tile link issues of the reloaded tiles, compared against the launch,
 * whose policy the frame keeps: the notice of links it does not allow yet,
 * then the left-out links.
 */
function readReloadedTileLinkIssues(
  launch: ModLaunch,
  modTiles: ModTiles,
  tileBodies: TileBodies,
  collectionSource: string,
): ModIssue[] | null {
  if (launch.tileLinks === null) {
    return null;
  }
  const reloadedLinks = collectModTileLinks(
    modTiles.tiles,
    tileBodies,
    launch.contentHosts,
    launch.context.permissions.granted,
  );
  const newSourceCount = countNewSources(
    reloadedLinks.sources,
    launch.tileLinks.sources,
  );
  const issues: ModIssue[] = [];
  if (newSourceCount > 0) {
    issues.push(describeNewTileLinks(newSourceCount, collectionSource));
  }
  issues.push(...reloadedLinks.issues);
  return issues;
}

async function readReloadedIssues(
  runtime: SandboxRuntime,
  launch: ModLaunch,
  collectionSource: string,
  services: SandboxServices,
): Promise<ReloadedIssues> {
  try {
    const modTiles = await loadModTiles(
      launch.mod,
      collectionSource,
      services.fetchOptions,
    );
    const tileBodies = buildTileBodies(modTiles.tiles);
    if (runtime.session !== null && runtime.status === "running") {
      pushTilesChanged(
        runtime.session,
        modTiles.tiles,
        modTiles.issues,
        tileBodies,
      );
    }
    const reloadedIssues: ReloadedIssues = {
      tileCount: modTiles.tiles.length,
      collectionIssues: modTiles.issues,
      tileLinkIssues: readReloadedTileLinkIssues(
        launch,
        modTiles,
        tileBodies,
        collectionSource,
      ),
    };
    return reloadedIssues;
  } catch (error) {
    const reloadIssue: TileIssue = {
      level: "error",
      source: collectionSource,
      message: describeError(error),
    };
    const failedIssues: ReloadedIssues = {
      tileCount: null,
      collectionIssues: [reloadIssue],
      tileLinkIssues: null,
    };
    return failedIssues;
  }
}

/**
 * Loads and validates the sandbox's collection again, pushes `tiles.changed`
 * to the running mod and replaces the collection issues. With tile links on,
 * it also replaces the tile link issues with those of the reloaded tiles,
 * led by a notice when they link files the frame does not allow yet. A
 * collection that cannot be loaded becomes the only collection issue, and
 * the tile link issues stay as they were. A reload whose collection loaded
 * adds a notification with the tile count and the collection issue count.
 */
export async function reloadSandboxTiles(
  runtime: SandboxRuntime,
  services: SandboxServices,
): Promise<void> {
  const launch = runtime.launch;
  if (launch === null || launch.collectionSource === null) {
    return;
  }
  const issues = await readReloadedIssues(
    runtime,
    launch,
    launch.collectionSource,
    services,
  );
  if (runtime.status === "stopped") {
    return;
  }
  runtime.collectionIssues = takeIssueMessages(
    runtime,
    issues.collectionIssues,
  );
  if (issues.tileLinkIssues !== null) {
    runtime.tileLinkIssues = takeIssueMessages(runtime, issues.tileLinkIssues);
  }
  if (issues.tileCount !== null) {
    appendRuntimeMessage(
      runtime,
      buildAppNotification(
        launch.collectionSource,
        describeReloadedTiles(issues.tileCount, issues.collectionIssues.length),
      ),
    );
  }
  services.onChange();
}
