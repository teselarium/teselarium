import type { FileFetchOptions } from "../../files/index.ts";
import type { ModIssue } from "../../mod/index.ts";
import type { TileIssue } from "../../tile/index.ts";
import {
  connectModSession,
  loadModTiles,
  prepareModLaunch,
  pushThemeChanged,
  pushTilesChanged,
  stopModSession,
} from "../engine/index.ts";
import type {
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
  /** The stage's current theme, read when a session connects. */
  readTheme: () => Theme;
}

export type SandboxStatus = "loading" | "failed" | "running" | "stopped";

/** The runtime of one sandbox. Mutable, because it follows a launch and a session. */
export interface SandboxRuntime {
  id: string;
  status: SandboxStatus;
  launch: ModLaunch | null;
  session: ModSession | null;
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

/** Starts loading a sandbox's mod. The runtime is `loading`, then `running` or `failed`. */
export function launchSandbox(
  sandbox: StageSandbox,
  services: SandboxServices,
): SandboxRuntime {
  const runtime: SandboxRuntime = {
    id: sandbox.id,
    status: "loading",
    launch: null,
    session: null,
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
    startRuntime.bind(undefined, runtime, services),
    failRuntime.bind(undefined, runtime, services),
  );
  return runtime;
}

/** Every issue of a sandbox, in the order they were found. */
export function readSandboxIssues(runtime: SandboxRuntime): ModIssue[] {
  const issues: ModIssue[] = [...runtime.collectionIssues, ...runtime.issues];
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
