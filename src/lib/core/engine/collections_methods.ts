import { resolveLocation } from "../../files/index.ts";
import type { YamlMapping } from "../../files/index.ts";
import { readTileCollectionIndex } from "../../tile/index.ts";
import type { TileCollectionIndex } from "../../tile/index.ts";
import { checkOpenGrant } from "../permissions/index.ts";
import { describeEngineError, ModMethodError } from "./engine_errors.ts";
import { LOAD_FAILED, PERMISSION_DENIED } from "./mod_messages.ts";
import { readRequiredText, throwInvalidParams } from "./mod_methods.ts";
import type { ModMethodContext, ModMethodTable } from "./mod_methods.ts";

const INSPECT_METHOD = "collections.inspect";

/** Resolves a collection location against the app's address, or raises `INVALID_PARAMS`. */
function resolveRequestedCollection(
  context: ModMethodContext,
  location: string,
): string {
  try {
    const source = resolveLocation(location, context.fetchOptions.baseUrl);
    return source.href;
  } catch (error) {
    throwInvalidParams(INSPECT_METHOD, describeEngineError(error));
  }
}

/**
 * Checks that the requesting mod may reach the collection file at `source`:
 * a granted `open` permission for its origin. Runs before any request, so a
 * mod without the grant cannot make the engine fetch a URL.
 */
function checkCollectionAccess(
  context: ModMethodContext,
  source: string,
): void {
  const denial = checkOpenGrant(context.grants, source, "collections");
  if (denial !== null) {
    throw new ModMethodError(PERMISSION_DENIED, denial);
  }
}

/** `collections.inspect { collection }`: the collection's index, with no tile requested. */
async function inspectRequestedCollection(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<TileCollectionIndex> {
  const location = readRequiredText(params, "collection", INSPECT_METHOD);
  const source = resolveRequestedCollection(context, location);
  checkCollectionAccess(context, source);
  try {
    const collectionIndex = await readTileCollectionIndex(
      source,
      context.fetchOptions,
    );
    return collectionIndex;
  } catch (error) {
    throw new ModMethodError(LOAD_FAILED, describeEngineError(error), {
      cause: error,
    });
  }
}

/** The `collections.*` requests: reading tile collections without loading them. */
export const COLLECTIONS_METHODS: ModMethodTable = {
  "collections.inspect": inspectRequestedCollection,
};
