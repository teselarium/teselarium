import type { FileFetchOptions, YamlMapping } from "../../files/index.ts";
import type { LoadedMod } from "../../mod/index.ts";
import type { IssueLevel } from "../../tile/index.ts";
import type { ModGrants, SiteDecision } from "../permissions/index.ts";
import type { ModStorage } from "../storage/index.ts";
import type { AppAction } from "./app_actions.ts";
import type { ResolvedDefaultModSettings } from "./default_mod_settings.ts";
import { ModMethodError } from "./engine_errors.ts";
import type { ModCheckReport } from "./mod_check_report.ts";
import type { RunLink } from "./mod_launch.ts";
import type { TileBodies } from "./mod_tile_bodies.ts";
import { INVALID_PARAMS, PERMISSION_DENIED } from "./mod_messages.ts";

/** What `mods.check` asks the stage: the resolved mod file and the collection as the request gave it. */
export interface ModCheckRequest {
  source: string;
  collection: string | null;
}

/** The level of a message a mod sends the user: the issue levels, and `info`. */
export type UserNotificationLevel = IssueLevel | "info";

/** What a mod tells the user with `ui.notify`: plain text, and what it is about. */
export interface UserNotification {
  level: UserNotificationLevel;
  /** The request's `source`, or the mod's source. */
  source: string;
  text: string;
}

/** What a request handler knows about the mod that sent the request and the app. */
export interface ModMethodContext {
  mod: LoadedMod;
  grants: ModGrants;
  storage: ModStorage;
  appOrigin: string;
  defaults: ResolvedDefaultModSettings;
  /** `baseUrl` is the app's address. */
  fetchOptions: FileFetchOptions;
  /** The bodies of the tiles the mod currently receives, replaced by "Reload tiles". */
  tileBodies: TileBodies;
  /** The remembered site decisions, read when `mods.inspect` grants a mod's permissions. */
  readSiteDecisions: () => readonly SiteDecision[];
  /** Asks the stage to open a link. `false` when the sandbox is not the visible one. */
  onOpenLink: (link: RunLink) => boolean;
  /**
   * Asks the stage to show an action to the user. Resolves with the user's
   * answer, or is `null` when the sandbox is not the visible one.
   */
  onRequestAction: (action: AppAction) => Promise<boolean> | null;
  /**
   * Asks the stage to check a mod. Resolves with the report, or is `null`
   * when the sandbox is not the visible one.
   */
  onCheckMod: (request: ModCheckRequest) => Promise<ModCheckReport> | null;
  /** Gives the stage a message from the mod for the user, from visible and hidden mods alike. */
  onNotify: (notification: UserNotification) => void;
}

/**
 * A request handler. It resolves with the response's `result`, plain data, or
 * throws `ModMethodError` with the error code and message.
 */
export type ModMethod = (
  context: ModMethodContext,
  params: YamlMapping,
) => Promise<unknown>;

/** The handlers of one request namespace, keyed by method name. */
export type ModMethodTable = Record<string, ModMethod>;

/** Raises `INVALID_PARAMS` with a message naming the method and the problem. */
export function throwInvalidParams(method: string, reason: string): never {
  throw new ModMethodError(INVALID_PARAMS, `${method}: ${reason}`);
}

/** Reads a param that must be a non-empty string, or raises `INVALID_PARAMS`. */
export function readRequiredText(
  params: YamlMapping,
  fieldName: string,
  method: string,
): string {
  const value = params[fieldName];
  if (typeof value !== "string" || value === "") {
    throwInvalidParams(method, `"${fieldName}" must be a non-empty string`);
  }
  return value;
}

/**
 * Asks the user to accept an action, and resolves with the answer. Raises
 * `PERMISSION_DENIED` when the mod's sandbox is not the visible one.
 */
export function askUser(
  context: ModMethodContext,
  method: string,
  action: AppAction,
): Promise<boolean> {
  const answer = context.onRequestAction(action);
  if (answer === null) {
    throw new ModMethodError(
      PERMISSION_DENIED,
      `${method}: only the visible mod can ask the user`,
    );
  }
  return answer;
}
