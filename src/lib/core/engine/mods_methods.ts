import { isYamlMapping } from "../../files/index.ts";
import type { YamlMapping, YamlValue } from "../../files/index.ts";
import { resolveModReference } from "../../mod/index.ts";
import { checkOpenGrant } from "../permissions/index.ts";
import { findSwitchedOffMod } from "./default_mod_settings.ts";
import {
  describeEngineError,
  ModMethodError,
  ModSwitchedOffError,
} from "./engine_errors.ts";
import { inspectMod } from "./mod_inspection.ts";
import type { ModInspection } from "./mod_inspection.ts";
import type { RunLink } from "./mod_launch.ts";
import {
  LOAD_FAILED,
  MOD_SWITCHED_OFF,
  PERMISSION_DENIED,
} from "./mod_messages.ts";
import { readRequiredText, throwInvalidParams } from "./mod_methods.ts";
import type { ModMethodContext, ModMethodTable } from "./mod_methods.ts";

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
      context.fetchOptions,
    );
    return inspection;
  } catch (error) {
    throw new ModMethodError(LOAD_FAILED, describeEngineError(error), {
      cause: error,
    });
  }
}

function readOpenCollection(params: YamlMapping): string | null {
  const collection: YamlValue | undefined = params.collection;
  if (collection === undefined || collection === null) {
    return null;
  }
  if (typeof collection !== "string" || collection === "") {
    throwInvalidParams(
      "mods.open",
      '"collection" must be null or a non-empty string',
    );
  }
  return collection;
}

function readLinkParams(params: YamlMapping): Record<string, string> {
  const linkParams: Record<string, string> = {};
  if (params.params === undefined) {
    return linkParams;
  }
  if (!isYamlMapping(params.params)) {
    throwInvalidParams("mods.open", '"params" must be a mapping');
  }
  for (const [name, value] of Object.entries(params.params)) {
    if (typeof value !== "string") {
      throwInvalidParams("mods.open", `"params.${name}" must be a string`);
    }
    linkParams[name] = value;
  }
  return linkParams;
}

/** Reads the params of `mods.open` into a run link. Raises `INVALID_PARAMS`. */
export function readOpenParams(params: YamlMapping): RunLink {
  const link: RunLink = {
    mod: readRequiredText(params, "mod", "mods.open"),
    collection: readOpenCollection(params),
    params: readLinkParams(params),
  };
  return link;
}

/**
 * `mods.open { mod, collection?, params? }`: asks the stage to open the mod
 * in a new sandbox, and answers `null`. The new mod's load errors belong to
 * its own sandbox.
 */
async function openRequestedMod(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<null> {
  const link = readOpenParams(params);
  const source = resolveRequestedMod(context, link.mod, "mods.open");
  checkModAccess(context, source);
  if (!context.onOpenLink(link)) {
    throw new ModMethodError(
      PERMISSION_DENIED,
      "mods.open: only the visible mod can open mods",
    );
  }
  return null;
}

/** The `mods.*` requests: inspecting and opening other mods. */
export const MODS_METHODS: ModMethodTable = {
  "mods.inspect": inspectRequestedMod,
  "mods.open": openRequestedMod,
};
