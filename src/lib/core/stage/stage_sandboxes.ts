import type { FileFetchOptions } from "../../files/index.ts";
import type { ModIssue } from "../../mod/index.ts";
import type { TileIssue } from "../../tile/index.ts";
import {
  connectModSession,
  describeCancelledApiMismatch,
  loadModTiles,
  prepareModLaunch,
  pushThemeChanged,
  pushTilesChanged,
  stopModSession,
} from "../engine/index.ts";
import type {
  AppAction,
  ModCheckReport,
  ModCheckRequest,
  ModLaunch,
  ModSession,
  ResolvedDefaultModSettings,
  RunLink,
} from "../engine/index.ts";
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
}

/** `asking`: the mod is loaded, but written for another mod API, and waits for the user's answer. */
export type SandboxStatus =
  "loading" | "asking" | "failed" | "running" | "stopped";

/** The runtime of one sandbox. Mutable, because it follows a launch and a session. */
export interface SandboxRuntime {
  id: string;
  status: SandboxStatus;
  launch: ModLaunch | null;
  session: ModSession | null;
  /** The issues of the mod file itself, such as a missing `api` range. */
  fileIssues: ModIssue[];
  /** The issues of the collection, replaced when the tiles are reloaded. */
  collectionIssues: TileIssue[];
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

/** Keeps the launch of a mod written for another mod API, without starting it. */
function askRuntime(
  runtime: SandboxRuntime,
  services: SandboxServices,
  launch: ModLaunch,
): void {
  if (runtime.status === "stopped") {
    return;
  }
  runtime.status = "asking";
  runtime.launch = launch;
  services.onChange();
}

function settleLaunch(
  runtime: SandboxRuntime,
  services: SandboxServices,
  launch: ModLaunch,
): void {
  if (launch.apiCompatible === false) {
    askRuntime(runtime, services, launch);
    return;
  }
  startRuntime(runtime, services, launch);
}

/**
 * Answers the question of an `asking` runtime: "Run anyway" starts its mod as
 * a matching launch would, and "Cancel" fails it with an error naming the
 * mod's range and the mod API version. Does nothing for any other runtime.
 */
export function answerSandboxApiMismatch(
  runtime: SandboxRuntime,
  services: SandboxServices,
  runAnyway: boolean,
): void {
  const launch = runtime.launch;
  if (runtime.status !== "asking" || launch === null) {
    return;
  }
  if (runAnyway) {
    startRuntime(runtime, services, launch);
    return;
  }
  failRuntime(runtime, services, describeCancelledApiMismatch(launch.mod.api));
}

/**
 * Starts loading a sandbox's mod. The runtime is `loading`, then `running` or
 * `failed`, or `asking` when the mod was written for another mod API.
 */
export function launchSandbox(
  sandbox: StageSandbox,
  services: SandboxServices,
): SandboxRuntime {
  const runtime: SandboxRuntime = {
    id: sandbox.id,
    status: "loading",
    launch: null,
    session: null,
    fileIssues: [],
    collectionIssues: [],
    issues: [],
    errorMessage: null,
    settled: Promise.resolve(),
  };
  runtime.settled = prepareModLaunch(
    {
      link: sandbox.link,
      appOrigin: services.appOrigin,
      defaults: services.defaults,
    },
    services.fetchOptions,
  ).then(
    settleLaunch.bind(undefined, runtime, services),
    failRuntime.bind(undefined, runtime, services),
  );
  return runtime;
}

/** Every issue of a sandbox, in the order they were found: mod file, collection, then the others. */
export function readSandboxIssues(runtime: SandboxRuntime): ModIssue[] {
  const issues: ModIssue[] = [
    ...runtime.fileIssues,
    ...runtime.collectionIssues,
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

async function readReloadedIssues(
  runtime: SandboxRuntime,
  launch: ModLaunch,
  collectionSource: string,
  services: SandboxServices,
): Promise<TileIssue[]> {
  try {
    const modTiles = await loadModTiles(
      launch.mod,
      collectionSource,
      services.fetchOptions,
    );
    if (runtime.session !== null && runtime.status === "running") {
      pushTilesChanged(runtime.session, modTiles.tiles, modTiles.issues);
    }
    return modTiles.issues;
  } catch (error) {
    const reloadIssue: TileIssue = {
      level: "error",
      source: collectionSource,
      message: describeError(error),
    };
    return [reloadIssue];
  }
}

/**
 * Loads and validates the sandbox's collection again, pushes `tiles.changed`
 * to the running mod and replaces the collection issues. A collection that
 * cannot be loaded becomes the only collection issue.
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
  runtime.collectionIssues = issues;
  services.onChange();
}
