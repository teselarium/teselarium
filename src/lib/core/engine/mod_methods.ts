import { isYamlMapping } from "../../files/index.ts";
import type { YamlMapping, YamlValue } from "../../files/index.ts";
import type { LoadedMod, ModLoadOptions } from "../../mod/index.ts";
import type { IssueLevel } from "../../tile/index.ts";
import type { ModGrants, SiteDecision } from "../permissions/index.ts";
import type { ModSlot, ModStorage } from "../storage/index.ts";
import type { AppAction } from "./app_actions.ts";
import type { CatalogListing } from "./catalog_listing.ts";
import type { ResolvedDefaultModSettings } from "./default_mod_settings.ts";
import { ModMethodError } from "./engine_errors.ts";
import type { ModCheckReport } from "./mod_check_report.ts";
import { RUN_LINK_RESERVED_NAMES } from "./mod_launch.ts";
import type { RunLink } from "./mod_launch.ts";
import type { TileBodies } from "./mod_tile_bodies.ts";
import { INVALID_PARAMS, PERMISSION_DENIED } from "./mod_messages.ts";

/** How the stage opens a link a mod asked for: in a new sandbox, or in place of the requester. */
export interface OpenLinkOptions {
  replace: boolean;
}

/**
 * What came of a mod's request to open a link: opened, refused because the
 * requester is not the visible sandbox, or refused because the requester is
 * the Home mod at `#/`, which cannot be replaced.
 */
export type OpenLinkOutcome = "opened" | "not-visible" | "home-mod";

/**
 * What `mods.check` asks the stage: the resolved mod file and the collection
 * as the request gave it. Without a collection, the mod is checked with its
 * default mosaic, when it declares one.
 */
export interface ModCheckTarget {
  source: string;
  collection: string | null;
}

/** What `mosaics.check` asks the stage: the resolved mosaic file, checked as it opens its mod. */
export interface MosaicCheckTarget {
  mosaic: string;
}

/** What a check request asks the stage to check: a mod or a mosaic. */
export type ModCheckRequest = ModCheckTarget | MosaicCheckTarget;

/** Whether a check request names a mosaic rather than a mod. */
export function isMosaicCheckTarget(
  request: ModCheckRequest,
): request is MosaicCheckTarget {
  return "mosaic" in request;
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
  /** The slot `storage.*` reads and writes: the mod and what it was opened with. */
  storageSlot: ModSlot;
  appOrigin: string;
  defaults: ResolvedDefaultModSettings;
  /** `baseUrl` is the app's address. */
  fetchOptions: ModLoadOptions;
  /** The bodies of the tiles the mod currently receives, replaced by "Reload tiles". */
  tileBodies: TileBodies;
  /** The remembered site decisions, read when `mods.inspect` grants a mod's permissions. */
  readSiteDecisions: () => readonly SiteDecision[];
  /** The app's catalog as `catalog.list` answers it, read anew for each request. */
  readCatalog: () => Promise<CatalogListing>;
  /**
   * Asks the stage to open a link, in a new sandbox or, with `replace`, in
   * place of the requesting one. Gives what came of it.
   */
  onOpenLink: (link: RunLink, options: OpenLinkOptions) => OpenLinkOutcome;
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
 * Reads the optional `params` of a request that opens a link (`mods.open`,
 * `mosaics.open`): a mapping of strings without the reserved link names.
 * Raises `INVALID_PARAMS` naming `method`.
 */
export function readOpenLinkParams(
  params: YamlMapping,
  method: string,
): Record<string, string> {
  const linkParams: Record<string, string> = {};
  if (params.params === undefined) {
    return linkParams;
  }
  if (!isYamlMapping(params.params)) {
    throwInvalidParams(method, '"params" must be a mapping');
  }
  for (const [name, value] of Object.entries(params.params)) {
    if (RUN_LINK_RESERVED_NAMES.includes(name)) {
      throwInvalidParams(method, `"params.${name}" is reserved`);
    }
    if (typeof value !== "string") {
      throwInvalidParams(method, `"params.${name}" must be a string`);
    }
    linkParams[name] = value;
  }
  return linkParams;
}

/** Reads the optional `replace` of a request that opens a link, `false` when absent. Raises `INVALID_PARAMS` naming `method`. */
export function readOpenReplace(params: YamlMapping, method: string): boolean {
  const replace: YamlValue | undefined = params.replace;
  if (replace === undefined) {
    return false;
  }
  if (typeof replace !== "boolean") {
    throwInvalidParams(method, '"replace" must be a boolean');
  }
  return replace;
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
