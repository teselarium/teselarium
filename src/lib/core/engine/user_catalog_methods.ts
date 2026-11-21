import type { YamlMapping } from "../../files/index.ts";
import { findStoredEntry, findUserEntry } from "../../user_catalog/index.ts";
import type { CatalogAction } from "./app_actions.ts";
import {
  askUser,
  readRequiredText,
  throwInvalidParams,
} from "./mod_methods.ts";
import type { ModMethodContext, ModMethodTable } from "./mod_methods.ts";
import { resolveRequestedMosaic } from "./mosaics_methods.ts";

/** Reads the required `mosaic` param, resolved against the app's address as a mosaic reference. */
function readRequestedMosaic(
  context: ModMethodContext,
  params: YamlMapping,
  method: string,
): string {
  const reference = readRequiredText(params, "mosaic", method);
  return resolveRequestedMosaic(context, reference, method);
}

/** Raises `INVALID_PARAMS` unless `address` is a stored entry. Checks skip it. */
function checkStoredEntry(
  context: ModMethodContext,
  address: string,
  method: string,
): void {
  const entries = context.readUserCatalog();
  if (entries !== null && findStoredEntry(entries, address) === null) {
    throwInvalidParams(
      method,
      `the mosaic "${address}" is not stored in this browser`,
    );
  }
}

/** Raises `INVALID_PARAMS` unless `address` is a user entry, stored or remote. Checks skip it. */
function checkUserEntry(
  context: ModMethodContext,
  address: string,
  method: string,
): void {
  const entries = context.readUserCatalog();
  if (entries !== null && findUserEntry(entries, address) === null) {
    throwInvalidParams(
      method,
      `the mosaic "${address}" is not in the user catalog`,
    );
  }
}

function askCatalogAction(
  context: ModMethodContext,
  method: string,
  action: CatalogAction,
): Promise<boolean> {
  return askUser(context, method, action);
}

/** `userCatalog.import`: the import dialog. Its params are ignored. */
async function importMosaics(context: ModMethodContext): Promise<boolean> {
  return askCatalogAction(context, "userCatalog.import", {
    kind: "catalogImport",
  });
}

/** `userCatalog.update { mosaic }`: the update dialog of a stored entry. */
async function updateMosaic(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<boolean> {
  const method = "userCatalog.update";
  const address = readRequestedMosaic(context, params, method);
  checkStoredEntry(context, address, method);
  return askCatalogAction(context, method, { kind: "catalogUpdate", address });
}

/** The optional `mosaic` of `userCatalog.add`, resolved, or `null` without one. */
function readSuggestedMosaic(
  context: ModMethodContext,
  params: YamlMapping,
): string | null {
  const method = "userCatalog.add";
  const reference = params.mosaic;
  if (reference === undefined || reference === "") {
    return null;
  }
  if (typeof reference !== "string") {
    throwInvalidParams(method, '"mosaic" must be a string');
  }
  return resolveRequestedMosaic(context, reference, method);
}

/** `userCatalog.add { mosaic? }`: the "Add a mosaic" dialog, its field filled with `mosaic`. */
async function addMosaic(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<boolean> {
  const suggested = readSuggestedMosaic(context, params);
  return askCatalogAction(context, "userCatalog.add", {
    kind: "catalogAdd",
    suggested,
  });
}

/** `userCatalog.export { mosaic }`: the save dialog of a stored entry's file. */
async function exportMosaic(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<boolean> {
  const method = "userCatalog.export";
  const address = readRequestedMosaic(context, params, method);
  checkStoredEntry(context, address, method);
  return askCatalogAction(context, method, { kind: "catalogExport", address });
}

/** `userCatalog.remove { mosaic }`: the confirmation that removes a user entry. */
async function removeMosaic(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<boolean> {
  const method = "userCatalog.remove";
  const address = readRequestedMosaic(context, params, method);
  checkUserEntry(context, address, method);
  return askCatalogAction(context, method, { kind: "catalogRemove", address });
}

/**
 * The `userCatalog.*` requests: dialogs of the app that change the user
 * catalog, only for the visible mod, without any permission. Each answers
 * `true` once the user confirmed and the change is done, `false` otherwise.
 */
export const USER_CATALOG_METHODS: ModMethodTable = {
  "userCatalog.import": importMosaics,
  "userCatalog.update": updateMosaic,
  "userCatalog.add": addMosaic,
  "userCatalog.export": exportMosaic,
  "userCatalog.remove": removeMosaic,
};
