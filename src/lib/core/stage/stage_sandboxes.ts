import type { FileFetchOptions } from "../../files/index.ts";
import type { LoadedMod, ModIssue, ModPermission } from "../../mod/index.ts";
import { describeNewTileLinks } from "../sandbox/index.ts";
import type { TileIssue } from "../../tile/index.ts";
import {
  buildModLaunch,
  buildTileBodies,
  collectModTileLinks,
  connectModSession,
  describeCancelledApiMismatch,
  loadModLaunchInputs,
  loadModTiles,
  matchModApiRange,
  pushThemeChanged,
  pushTilesChanged,
  stopModSession,
} from "../engine/index.ts";
import type {
  AppAction,
  ModCheckReport,
  ModCheckRequest,
  ModLaunch,
  ModLaunchInputs,
  ModSession,
  ModTiles,
  ResolvedDefaultModSettings,
  RunLink,
  TileBodies,
} from "../engine/index.ts";
import { grantModPermissions, listConsentLines } from "../permissions/index.ts";
import type { SiteDecision } from "../permissions/index.ts";
import type { ModStorage } from "../storage/index.ts";
import type { Theme } from "../theme/index.ts";
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
  /** The loaded mod while the runtime asks, before its launch is built. */
  pending: ModLaunchInputs | null;
  /** The question of an `asking` runtime, `null` otherwise. */
  question: SandboxQuestion | null;
  /** The lines of the site consent question, while it is asked. */
  consentLines: ModPermission[];
  /** Set when the mod starts. */
  launch: ModLaunch | null;
  session: ModSession | null;
  /** The issues of the mod file itself, such as a missing `api` range. */
  fileIssues: ModIssue[];
  /** The issues of the collection, replaced when the tiles are reloaded. */
  collectionIssues: TileIssue[];
  /**
   * The tile links left out of the policy and, after "Reload tiles", the
   * notice of links the frame does not allow yet. Replaced when the tiles are reloaded.
   */
  tileLinkIssues: ModIssue[];
  /** Permission issues, then the issues found while the mod runs, in order. */
  issues: ModIssue[];
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

function startRuntime(
  runtime: SandboxRuntime,
  services: SandboxServices,
  launch: ModLaunch,
): void {
  if (runtime.status === "stopped") {
    return;
  }
  runtime.status = "running";
  runtime.launch = launch;
  runtime.fileIssues = [...launch.fileIssues];
  runtime.collectionIssues = launch.context.issues;
  runtime.tileLinkIssues =
    launch.tileLinks === null ? [] : [...launch.tileLinks.issues];
  runtime.issues = [...launch.issues];
  services.onChange();
}

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
  startRuntime(runtime, services, launch);
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
    startPendingRuntime(runtime, services, inputs, []);
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
  if (answer !== null && answer.remember) {
    services.rememberSiteDecisions(decisions);
  }
  startPendingRuntime(runtime, services, inputs, decisions);
}

/**
 * Starts loading a sandbox's mod. The runtime is `loading`, then `running` or
 * `failed`, or `asking` when the mod was written for another mod API or
 * needs the user's consent for sites.
 */
export function launchSandbox(
  sandbox: StageSandbox,
  services: SandboxServices,
): SandboxRuntime {
  const runtime: SandboxRuntime = {
    id: sandbox.id,
    status: "loading",
    pending: null,
    question: null,
    consentLines: [],
    launch: null,
    session: null,
    fileIssues: [],
    collectionIssues: [],
    tileLinkIssues: [],
    issues: [],
    errorMessage: null,
    settled: Promise.resolve(),
  };
  runtime.settled = loadModLaunchInputs(
    { link: sandbox.link, defaults: services.defaults },
    services.fetchOptions,
  ).then(
    settleLaunchInputs.bind(undefined, runtime, services),
    failRuntime.bind(undefined, runtime, services),
  );
  return runtime;
}

/** Every issue of a sandbox, in the order they were found: mod file, collection, tile links, then the others. */
export function readSandboxIssues(runtime: SandboxRuntime): ModIssue[] {
  const issues: ModIssue[] = [
    ...runtime.fileIssues,
    ...runtime.collectionIssues,
    ...runtime.tileLinkIssues,
    ...runtime.issues,
  ];
  return issues;
}

function addRuntimeIssue(
  runtime: SandboxRuntime,
  services: SandboxServices,
  issue: ModIssue,
): void {
  runtime.issues.push(issue);
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
    theme: services.readTheme(),
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
    runtime.issues.push(issue);
  }
}

/** The issues a reload replaces. */
interface ReloadedIssues {
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
 * the tile link issues stay as they were.
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
  runtime.collectionIssues = issues.collectionIssues;
  if (issues.tileLinkIssues !== null) {
    runtime.tileLinkIssues = issues.tileLinkIssues;
  }
  services.onChange();
}
