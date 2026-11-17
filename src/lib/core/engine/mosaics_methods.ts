import type { YamlMapping } from "../../files/index.ts";
import { loadMosaicFile, resolveMosaicReference } from "../../mosaic/index.ts";
import type { LoadedMosaic, MosaicAliases } from "../../mosaic/index.ts";
import {
  checkOpenGrant,
  grantMosaicPermissions,
} from "../permissions/index.ts";
import type { ModGrants } from "../permissions/index.ts";
import { describeEngineError, ModMethodError } from "./engine_errors.ts";
import type { ModCheckReport } from "./mod_check_report.ts";
import type { RunLink } from "./mod_launch.ts";
import { LOAD_FAILED, PERMISSION_DENIED } from "./mod_messages.ts";
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

const INSPECT_METHOD = "mosaics.inspect";
const OPEN_METHOD = "mosaics.open";
const CHECK_METHOD = "mosaics.check";

/**
 * A mosaic file's content, without opening it. `mod` and `collection` are
 * resolved addresses, and `permissions` are what its `show` lines would get
 * if it were opened without asking.
 */
export interface MosaicInspection {
  source: string;
  title: string;
  description: string;
  mod: string;
  collection: string | null;
  /** The mosaic's own config, not merged with the mod's. */
  config: YamlMapping;
  aliases: MosaicAliases;
  permissions: ModGrants;
}

/** Resolves a mosaic reference against the app's address, or raises `INVALID_PARAMS` naming `method`. */
function resolveRequestedMosaic(
  context: ModMethodContext,
  reference: string,
  method: string,
): string {
  try {
    return resolveMosaicReference(reference, context.fetchOptions.baseUrl);
  } catch (error) {
    throwInvalidParams(method, describeEngineError(error));
  }
}

/**
 * Checks that the requesting mod may reach the mosaic file at `source`: a
 * granted `open` permission for its origin. The mod the mosaic names is not
 * checked. Runs before any request, so a mod without the grant cannot make
 * the engine fetch a URL.
 */
function checkMosaicAccess(context: ModMethodContext, source: string): void {
  const denial = checkOpenGrant(context.grants, source, "mosaics");
  if (denial !== null) {
    throw new ModMethodError(PERMISSION_DENIED, denial);
  }
}

function buildMosaicInspection(
  context: ModMethodContext,
  mosaic: LoadedMosaic,
): MosaicInspection {
  const inspection: MosaicInspection = {
    source: mosaic.source,
    title: mosaic.title,
    description: mosaic.description,
    mod: mosaic.mod,
    collection: mosaic.collection,
    config: mosaic.config,
    aliases: mosaic.aliases,
    permissions: grantMosaicPermissions(
      mosaic,
      context.appOrigin,
      context.readSiteDecisions(),
    ),
  };
  return inspection;
}

/**
 * `mosaics.inspect { mosaic }`: the mosaic file's content, requesting neither
 * its mod, its collection nor any tile, and never asking the user.
 */
async function inspectRequestedMosaic(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<MosaicInspection> {
  const reference = readRequiredText(params, "mosaic", INSPECT_METHOD);
  const source = resolveRequestedMosaic(context, reference, INSPECT_METHOD);
  checkMosaicAccess(context, source);
  try {
    const mosaic = await loadMosaicFile(source, {
      ...context.fetchOptions,
      defaultModsFolder: context.defaults.folder,
    });
    return buildMosaicInspection(context, mosaic);
  } catch (error) {
    throw new ModMethodError(LOAD_FAILED, describeEngineError(error), {
      cause: error,
    });
  }
}

/** The message of a refused `mosaics.open`, for each refusal the stage gives. */
const OPEN_REFUSALS: Record<Exclude<OpenLinkOutcome, "opened">, string> = {
  "not-visible": "mosaics.open: only the visible mod can open mosaics",
  "home-mod": "mosaics.open: the home mod cannot be replaced",
};

/**
 * `mosaics.open { mosaic, params?, replace? }`: asks the stage to open the
 * mosaic's run link, whose `mosaic` is the resolved mosaic file, in a new
 * sandbox, or with `replace` in place of the requester, and answers `null`.
 * The mosaic's load errors belong to the new sandbox. A replaced requester is
 * stopped before this returns, so it gets no answer.
 */
async function openRequestedMosaic(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<null> {
  const reference = readRequiredText(params, "mosaic", OPEN_METHOD);
  const linkParams = readOpenLinkParams(params, OPEN_METHOD);
  const replace = readOpenReplace(params, OPEN_METHOD);
  const source = resolveRequestedMosaic(context, reference, OPEN_METHOD);
  checkMosaicAccess(context, source);
  const link: RunLink = {
    mod: "",
    collection: null,
    tile: null,
    mosaic: source,
    params: linkParams,
  };
  const outcome = context.onOpenLink(link, { replace });
  if (outcome !== "opened") {
    throw new ModMethodError(PERMISSION_DENIED, OPEN_REFUSALS[outcome]);
  }
  return null;
}

/**
 * `mosaics.check { mosaic }`: asks the stage to check the mosaic as it opens
 * its mod, after the same checks as `mosaics.inspect`, and answers the
 * report. The stage grants a foreign mosaic's lines only by remembered
 * decisions, and asks nothing.
 */
async function checkRequestedMosaic(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<ModCheckReport> {
  const reference = readRequiredText(params, "mosaic", CHECK_METHOD);
  const source = resolveRequestedMosaic(context, reference, CHECK_METHOD);
  checkMosaicAccess(context, source);
  const report = context.onCheckMod({ mosaic: source });
  if (report === null) {
    throw new ModMethodError(
      PERMISSION_DENIED,
      `${CHECK_METHOD}: only the visible mod can check mosaics`,
    );
  }
  return report;
}

/** The `mosaics.*` requests: reading, opening and checking mosaic files. */
export const MOSAICS_METHODS: ModMethodTable = {
  "mosaics.inspect": inspectRequestedMosaic,
  "mosaics.open": openRequestedMosaic,
  "mosaics.check": checkRequestedMosaic,
};
