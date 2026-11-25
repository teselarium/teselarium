import type { YamlMapping, YamlValue } from "../../files/index.ts";
import { resolveModReference } from "../../mod/index.ts";
import { checkOpenGrant } from "../permissions/index.ts";
import { findSwitchedOffMod } from "./default_mod_settings.ts";
import {
  describeEngineError,
  ModMethodError,
  ModSwitchedOffError,
} from "./engine_errors.ts";
import type { ModCheckReport } from "./mod_check_report.ts";
import { inspectMod } from "./mod_inspection.ts";
import type { ModInspection } from "./mod_inspection.ts";
import type { RunLink } from "./mod_launch.ts";
import {
  LOAD_FAILED,
  MOD_SWITCHED_OFF,
  PERMISSION_DENIED,
} from "./mod_messages.ts";
import {
  readOpenLinkParams,
  readOpenReplace,
  readRequiredText,
  throwInvalidParams,
} from "./mod_methods.ts";
import type {
  ModMethodContext,
  ModMethodTable,
  OpenLinkOutcome,
} from "./mod_methods.ts";

/** Resolves a reference against the app's address and the default mods folder. */
function resolveRequestedMod(
  context: ModMethodContext,
  reference: string,
  method: string,
): string {
  try {
    const source = resolveModReference(reference, {
      baseUrl: context.fetchOptions.baseUrl,
      defaultModsFolder: context.defaults.folder,
    });
    return source;
  } catch (error) {
    throwInvalidParams(method, describeEngineError(error));
  }
}

/**
 * Checks that the requesting mod may reach the mod at `source`: a granted
 * `open` permission for its origin, and the mod not switched off. Runs before
 * any request, so a mod without the grant cannot make the engine fetch a URL.
 */
function checkModAccess(context: ModMethodContext, source: string): void {
  const denial = checkOpenGrant(context.grants, source);
  if (denial !== null) {
    throw new ModMethodError(PERMISSION_DENIED, denial);
  }
  const switchedOffName = findSwitchedOffMod(source, context.defaults);
  if (switchedOffName !== null) {
    const error = new ModSwitchedOffError(switchedOffName, source);
    throw new ModMethodError(MOD_SWITCHED_OFF, error.message);
  }
}

/** `mods.inspect { mod }`: the mod's metadata, without running it. */
async function inspectRequestedMod(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<ModInspection> {
  const reference = readRequiredText(params, "mod", "mods.inspect");
  const source = resolveRequestedMod(context, reference, "mods.inspect");
  checkModAccess(context, source);
  try {
    const inspection = await inspectMod(
      source,
      context.appOrigin,
      context.readSiteDecisions(),
      context.fetchOptions,
    );
    return inspection;
  } catch (error) {
    throw new ModMethodError(LOAD_FAILED, describeEngineError(error), {
      cause: error,
    });
  }
}

/** Reads an optional location, `collection` or `tile`, or raises `INVALID_PARAMS` naming `method`. */
function readOpenLocation(
  params: YamlMapping,
  name: "collection" | "tile",
  method: string,
): string | null {
  const location: YamlValue | undefined = params[name];
  if (location === undefined || location === null) {
    return null;
  }
  if (typeof location !== "string" || location === "") {
    throwInvalidParams(method, `"${name}" must be null or a non-empty string`);
  }
  return location;
}

/** What `mods.open` asks for: the run link, and whether it replaces the requester. */
export interface OpenRequest {
  link: RunLink;
  replace: boolean;
}

/**
 * Reads the params of `mods.open` into a run link and the replace mode.
 * Raises `INVALID_PARAMS`, also for a link with both a collection and a tile
 * and for `params` that hold a reserved name.
 */
export function readOpenParams(params: YamlMapping): OpenRequest {
  const link: RunLink = {
    mod: readRequiredText(params, "mod", "mods.open"),
    collection: readOpenLocation(params, "collection", "mods.open"),
    tile: readOpenLocation(params, "tile", "mods.open"),
    params: readOpenLinkParams(params, "mods.open"),
  };
  if (link.collection !== null && link.tile !== null) {
    throwInvalidParams(
      "mods.open",
      'a link cannot have both "collection" and "tile"',
    );
  }
  const request: OpenRequest = {
    link,
    replace: readOpenReplace(params, "mods.open"),
  };
  return request;
}

/** The message of a refused `mods.open`, for each refusal the stage gives. */
const OPEN_REFUSALS: Record<Exclude<OpenLinkOutcome, "opened">, string> = {
  "not-visible": "mods.open: only the visible mod can open mods",
  "home-mod": "mods.open: the home mod cannot be replaced",
};

/**
 * `mods.open { mod, collection?, tile?, params?, replace? }`: asks the stage
 * to open the mod in a new sandbox, or with `replace` in place of the
 * requester, and answers `null`. The new mod's load errors belong to its
 * own sandbox. A replaced requester is stopped before this returns, so it
 * gets no answer.
 */
async function openRequestedMod(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<null> {
  const request = readOpenParams(params);
  const source = resolveRequestedMod(context, request.link.mod, "mods.open");
  checkModAccess(context, source);
  const outcome = context.onOpenLink(request.link, {
    replace: request.replace,
  });
  if (outcome !== "opened") {
    throw new ModMethodError(PERMISSION_DENIED, OPEN_REFUSALS[outcome]);
  }
  return null;
}

/**
 * `mods.check { mod, collection? }`: asks the stage to check the mod, after
 * the same checks as `mods.inspect`, and answers the report.
 */
async function checkRequestedMod(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<ModCheckReport> {
  const reference = readRequiredText(params, "mod", "mods.check");
  const collection = readOpenLocation(params, "collection", "mods.check");
  const source = resolveRequestedMod(context, reference, "mods.check");
  checkModAccess(context, source);
  const report = context.onCheckMod({ source, collection });
  if (report === null) {
    throw new ModMethodError(
      PERMISSION_DENIED,
      "mods.check: only the visible mod can check mods",
    );
  }
  return report;
}

/** The `mods.*` requests: inspecting, opening and checking other mods. */
export const MODS_METHODS: ModMethodTable = {
  "mods.inspect": inspectRequestedMod,
  "mods.open": openRequestedMod,
  "mods.check": checkRequestedMod,
};
