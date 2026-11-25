import type { YamlMapping } from "../../files/index.ts";
import { isYamlMapping } from "../../files/index.ts";
import {
  applyMosaicEdits,
  loadMosaicWithText,
  MosaicEditError,
  readMosaicEdits,
  resolveMosaicReference,
} from "../../mosaic/index.ts";
import type {
  LoadedMosaic,
  MosaicAliases,
  MosaicWithText,
} from "../../mosaic/index.ts";
import {
  checkOpenGrant,
  grantMosaicPermissions,
} from "../permissions/index.ts";
import type { ModGrants } from "../permissions/index.ts";
import { describeEngineError, ModMethodError } from "./engine_errors.ts";
import type { ModCheckReport } from "./mod_check_report.ts";
import { validateMosaicDraft } from "./mosaic_draft.ts";
import type { DraftSourceKind, DraftValidation } from "./mosaic_draft.ts";
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
const VALIDATE_METHOD = "mosaics.validate";
const EDIT_METHOD = "mosaics.edit";

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
  /** The mosaic file's text, as read. */
  content: string;
}

/** What `mosaics.edit` answers: the draft's new text. */
export interface MosaicEditResult {
  content: string;
}

/** Resolves a mosaic reference against the app's address, or raises `INVALID_PARAMS` naming `method`. */
export function resolveRequestedMosaic(
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
  mosaicWithText: MosaicWithText,
): MosaicInspection {
  const mosaic: LoadedMosaic = mosaicWithText.mosaic;
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
    content: mosaicWithText.content,
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
    const mosaicWithText = await loadMosaicWithText(source, {
      ...context.fetchOptions,
      defaultModsFolder: context.defaults.folder,
    });
    return buildMosaicInspection(context, mosaicWithText);
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

/**
 * Refuses a draft's mod or collection at `source` when the requester has no
 * granted `open` permission for its origin, as `mods.inspect` and
 * `collections.inspect` do.
 */
function checkDraftAccess(
  context: ModMethodContext,
  subject: "mods" | "collections",
  source: string,
): void {
  const denial = checkOpenGrant(context.grants, source, subject);
  if (denial !== null) {
    throw new ModMethodError(
      PERMISSION_DENIED,
      `${VALIDATE_METHOD}: ${denial}`,
    );
  }
}

/** The `checkAccess` of a requested validation: `open` for the origin of the draft's mod or collection. */
function checkDraftSource(
  context: ModMethodContext,
  source: string,
  kind: DraftSourceKind,
): void {
  checkDraftAccess(context, kind === "mod" ? "mods" : "collections", source);
}

/** The optional `mosaic` of `mosaics.validate`: the address a draft will be saved at, resolved, or `null`. */
function readDraftAddress(
  context: ModMethodContext,
  params: YamlMapping,
): string | null {
  if (params.mosaic === undefined || params.mosaic === null) {
    return null;
  }
  const reference = readRequiredText(params, "mosaic", VALIDATE_METHOD);
  return resolveRequestedMosaic(context, reference, VALIDATE_METHOD);
}

/**
 * `mosaics.validate { content, mosaic? }`: the errors, warnings and alias
 * hints of a draft, after checking `open` for its mod's and collection's
 * origins. Asks the user nothing.
 */
async function validateRequestedDraft(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<DraftValidation> {
  const content = readRequiredText(params, "content", VALIDATE_METHOD);
  const address = readDraftAddress(context, params);
  return validateMosaicDraft(content, address, {
    fetchOptions: {
      ...context.fetchOptions,
      defaultModsFolder: context.defaults.folder,
    },
    loads: context.draftLoads,
    checkAccess: checkDraftSource.bind(undefined, context),
  });
}

/** Raises `INVALID_PARAMS` naming `mosaics.edit` for a refused edit. Rethrows any other error. */
function throwEditError(error: unknown): never {
  if (error instanceof MosaicEditError) {
    throwInvalidParams(EDIT_METHOD, error.reason);
  }
  throw error;
}

/**
 * `mosaics.edit { content, edits }`: the draft with the form's edits applied,
 * keeping its comments. Needs no permission and requests no file.
 */
async function editRequestedDraft(
  _context: ModMethodContext,
  params: YamlMapping,
): Promise<MosaicEditResult> {
  const content = readRequiredText(params, "content", EDIT_METHOD);
  if (!isYamlMapping(params.edits)) {
    throwInvalidParams(EDIT_METHOD, '"edits" must be a mapping');
  }
  try {
    const edits = readMosaicEdits(params.edits);
    const result: MosaicEditResult = {
      content: applyMosaicEdits(content, edits),
    };
    return result;
  } catch (error) {
    throwEditError(error);
  }
}

/** The `mosaics.*` requests: reading, opening, checking, validating and editing mosaic files. */
export const MOSAICS_METHODS: ModMethodTable = {
  "mosaics.inspect": inspectRequestedMosaic,
  "mosaics.open": openRequestedMosaic,
  "mosaics.check": checkRequestedMosaic,
  "mosaics.validate": validateRequestedDraft,
  "mosaics.edit": editRequestedDraft,
};
